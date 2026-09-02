import {
  type PartyId,
  type PartyState,
} from "../model/appState";
import { createJoinMemberEntry } from "../model/partyInvite";
import type { ISODateTimeString } from "../model/types";
import type { FirebaseConfig } from "./firebaseConfig";
import {
  fromFirestorePartyDocument,
  isLegacyFirestorePartyDocument,
  toFirestorePartyDocument,
} from "./firestoreDocument";
import { createLegacyUpgradeLifecycle } from "./legacyUpgradeLifecycle";
import type { FieldUpdate } from "./partyStateDiff";
import type { SyncStatus } from "./types";

export const FIREBASE_PARTY_STATE_COLLECTION = "parties";
const LEGACY_UPGRADE_RETRY_DELAY_MS = 1500;
const LEGACY_UPGRADE_MAX_RETRY_DELAY_MS = 30_000;

export type FirebaseWriter = {
  applyFieldUpdates: (updates: FieldUpdate[]) => Promise<void>;
  replaceDocument: (partyState: PartyState) => Promise<void>;
};

export type FirebaseAuthAccount = {
  uid: string;
  isAnonymous: boolean;
  email?: string;
  displayName?: string;
};

type StartFirebaseAppStateSyncInput = {
  config: FirebaseConfig;
  getCurrentPartyState: () => PartyState;
  // Invite code from the URL; used to add this user to the party when they
  // are not yet a member.
  inviteCode?: string;
  onError: (message: string) => void;
  onAuthUserId: (userId: string) => void;
  onAuthAccount?: (account: FirebaseAuthAccount) => void;
  onJoined?: () => void;
  onReadyToWrite: (writer: FirebaseWriter) => void;
  onRemotePartyState: (partyState: PartyState) => void;
  onStatusChange: (syncStatus: SyncStatus) => void;
  partyId: PartyId;
};

async function loadFirebase(config: FirebaseConfig) {
  const [{ getApps, initializeApp }, authModule, firestore] = await Promise.all([
    import("firebase/app"),
    import("firebase/auth"),
    import("firebase/firestore"),
  ]);

  const app = getApps().length > 0 ? getApps()[0] : initializeApp(config);

  return { app, authModule, firestore, auth: authModule.getAuth(app) };
}

function toAuthAccount(user: {
  uid: string;
  isAnonymous: boolean;
  email: string | null;
  displayName: string | null;
}): FirebaseAuthAccount {
  return {
    uid: user.uid,
    isAnonymous: user.isAnonymous,
    ...(user.email ? { email: user.email } : {}),
    ...(user.displayName ? { displayName: user.displayName } : {}),
  };
}

export async function startFirebaseAppStateSync({
  config,
  getCurrentPartyState,
  inviteCode,
  onAuthAccount,
  onAuthUserId,
  onError,
  onJoined,
  onReadyToWrite,
  onRemotePartyState,
  onStatusChange,
  partyId,
}: StartFirebaseAppStateSyncInput): Promise<() => void> {
  onStatusChange("connecting");

  try {
    const { app, authModule, firestore, auth } = await loadFirebase(config);

    onStatusChange("authenticating");

    if (!auth.currentUser) {
      await authModule.signInAnonymously(auth);
    }

    const user = auth.currentUser;

    if (user) {
      onAuthUserId(user.uid);
      onAuthAccount?.(toAuthAccount(user));
    }

    onStatusChange("syncing");

    const database = firestore.initializeFirestore(app, {
      ignoreUndefinedProperties: true,
    });
    const partyStateRef = firestore.doc(
      database,
      FIREBASE_PARTY_STATE_COLLECTION,
      partyId,
    );

    if (inviteCode && user) {
      const joined = await joinPartyWithInvite({
        firestore,
        partyStateRef,
        uid: user.uid,
        inviteCode,
        onError,
      });

      if (joined === "failed") {
        return () => undefined;
      }

      if (joined === "joined") {
        onJoined?.();
      }
    }

    let fieldUpdatesReady = false;
    let resolveFieldUpdatesReady: (() => void) | undefined;
    const fieldUpdatesReadyPromise = new Promise<void>((resolve) => {
      resolveFieldUpdatesReady = resolve;
    });
    const writer: FirebaseWriter = {
      applyFieldUpdates: async (updates) => {
        if (updates.length === 0) {
          return;
        }

        if (!fieldUpdatesReady) {
          await fieldUpdatesReadyPromise;
        }

        const fieldValues = updates.flatMap((update) => {
          const fieldPath = new firestore.FieldPath(...update.path);

          switch (update.op) {
            case "set":
              return [fieldPath, update.value];
            case "delete":
              return [fieldPath, firestore.deleteField()];
            case "arrayUnion":
              return [fieldPath, firestore.arrayUnion(...update.value)];
          }
        });
        const [firstField, firstValue, ...remainingFieldValues] = fieldValues;

        await firestore.updateDoc(
          partyStateRef,
          firstField as import("firebase/firestore").FieldPath,
          firstValue,
          ...remainingFieldValues,
        );
      },
      replaceDocument: async (partyState) => {
        await firestore.setDoc(
          partyStateRef,
          toFirestorePartyDocument(partyState),
        );
      },
    };

    onReadyToWrite(writer);

    let stopped = false;
    let creatingDocument = false;

    const applyVersion2PartyState = (partyState: PartyState) => {
      if (stopped) {
        return;
      }

      if (!fieldUpdatesReady) {
        fieldUpdatesReady = true;
        resolveFieldUpdatesReady?.();
      }

      onRemotePartyState(partyState);
    };

    const legacyUpgradeLifecycle = createLegacyUpgradeLifecycle({
      applyVersion2: applyVersion2PartyState,
      attemptUpgrade: () =>
        firestore.runTransaction(database, async (transaction) => {
          const currentSnapshot = await transaction.get(partyStateRef);

          if (
            !currentSnapshot.exists() ||
            !isLegacyFirestorePartyDocument(currentSnapshot.data())
          ) {
            return;
          }

          const currentPartyState = fromFirestorePartyDocument(
            currentSnapshot.data(),
            partyId,
          );

          if (!currentPartyState) {
            throw new Error("Firestore party document is not a valid PartyState.");
          }

          transaction.set(
            partyStateRef,
            toFirestorePartyDocument(currentPartyState),
          );
        }),
      maxRetryDelayMs: LEGACY_UPGRADE_MAX_RETRY_DELAY_MS,
      onRetry: () => onStatusChange("syncing"),
      reportError: (error) => onError(formatFirebaseError(error)),
      retryDelayMs: LEGACY_UPGRADE_RETRY_DELAY_MS,
    });

    const unsubscribe = firestore.onSnapshot(
      partyStateRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          if (creatingDocument) {
            return;
          }

          creatingDocument = true;
          onStatusChange("saving");
          void writer.replaceDocument(getCurrentPartyState()).catch(
            (error: unknown) => {
              creatingDocument = false;
              onError(formatFirebaseError(error));
            },
          );
          return;
        }

        const data = snapshot.data();
        const partyState = fromFirestorePartyDocument(data, partyId);

        if (!partyState) {
          onError("Firestore party document is not a valid PartyState.");
          return;
        }

        if (isLegacyFirestorePartyDocument(data)) {
          onStatusChange("syncing");
          legacyUpgradeLifecycle.handleLegacyDocument();
          return;
        }

        legacyUpgradeLifecycle.handleVersion2Document(partyState);
      },
      (error) => onError(formatFirebaseError(error)),
    );

    return () => {
      stopped = true;
      legacyUpgradeLifecycle.stop();
      unsubscribe();
    };
  } catch (error) {
    onError(formatFirebaseError(error));
    return () => undefined;
  }
}

type JoinOutcome = "joined" | "already-member" | "failed";

/**
 * A non-member cannot read the party document, so membership is probed with a
 * read: permission-denied means "not a member", and the join is a targeted
 * update that only adds this user's member entry (see isInviteJoin in
 * firestore.rules). Existing members and missing documents fall through
 * untouched.
 */
async function joinPartyWithInvite({
  firestore,
  partyStateRef,
  uid,
  inviteCode,
  onError,
}: {
  firestore: typeof import("firebase/firestore");
  partyStateRef: import("firebase/firestore").DocumentReference;
  uid: string;
  inviteCode: string;
  onError: (message: string) => void;
}): Promise<JoinOutcome> {
  try {
    await firestore.getDoc(partyStateRef);
    return "already-member";
  } catch (error) {
    if (getFirebaseErrorCode(error) !== "permission-denied") {
      onError(formatFirebaseError(error));
      return "failed";
    }
  }

  try {
    const joinedAt = new Date().toISOString() as ISODateTimeString;
    await firestore.updateDoc(
      partyStateRef,
      new firestore.FieldPath("party", "members", uid),
      createJoinMemberEntry(inviteCode, joinedAt),
    );
    return "joined";
  } catch (error) {
    onError(
      getFirebaseErrorCode(error) === "permission-denied"
        ? "This invite link is no longer valid. Ask the GM for a new one."
        : formatFirebaseError(error),
    );
    return "failed";
  }
}

export type GoogleSignInResult =
  | { ok: true; account: FirebaseAuthAccount; uidChanged: boolean }
  | { ok: false; message: string };

/**
 * Upgrades the current anonymous session to a Google account, keeping the UID
 * (and therefore GM/member status). If that Google account is already bound
 * to another Firebase user, signs in as that user instead; the UID changes and
 * the caller must restart sync.
 */
export async function linkOrSignInWithGoogle(
  config: FirebaseConfig,
): Promise<GoogleSignInResult> {
  try {
    const { authModule, auth } = await loadFirebase(config);
    const provider = new authModule.GoogleAuthProvider();
    const previousUid = auth.currentUser?.uid;

    if (auth.currentUser?.isAnonymous) {
      try {
        const credential = await authModule.linkWithPopup(auth.currentUser, provider);
        return { ok: true, account: toAuthAccount(credential.user), uidChanged: false };
      } catch (error) {
        if (getFirebaseErrorCode(error) !== "auth/credential-already-in-use") {
          throw error;
        }

        const googleCredential = authModule.GoogleAuthProvider.credentialFromError(
          error as import("firebase/auth").AuthError,
        );

        if (!googleCredential) {
          throw error;
        }

        const result = await authModule.signInWithCredential(auth, googleCredential);
        return {
          ok: true,
          account: toAuthAccount(result.user),
          uidChanged: result.user.uid !== previousUid,
        };
      }
    }

    const result = await authModule.signInWithPopup(auth, provider);
    return {
      ok: true,
      account: toAuthAccount(result.user),
      uidChanged: result.user.uid !== previousUid,
    };
  } catch (error) {
    return { ok: false, message: formatFirebaseError(error) };
  }
}

export async function signOutFirebase(config: FirebaseConfig): Promise<void> {
  const { authModule, auth } = await loadFirebase(config);
  await authModule.signOut(auth);
}

function getFirebaseErrorCode(error: unknown): string | undefined {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return undefined;
}

function formatFirebaseError(error: unknown): string {
  const code = getFirebaseErrorCode(error);

  if (code === "permission-denied") {
    return "You are not a member of this party. Ask the GM for an invite link.";
  }

  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
    return "Sign-in was cancelled.";
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim().length > 0
  ) {
    return error.message;
  }

  return "Firebase sync failed.";
}

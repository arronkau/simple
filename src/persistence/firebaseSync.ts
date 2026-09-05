import {
  assignPartyGm,
  type PartyId,
  type PartyState,
} from "../model/appState";
import { createJoinMemberEntry } from "../model/partyInvite";
import type { ISODateTimeString } from "../model/types";
import type { FirebaseConfig } from "./firebaseConfig";
import { getFirebaseErrorCode } from "./firebaseWriteLifecycle";
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
  // True when the Firestore SDK persists unsent writes to IndexedDB, so an
  // accepted write survives a reload without the app holding it in memory.
  offlineWritesDurable: boolean;
  replaceDocument: (partyState: PartyState) => Promise<void>;
};

export type RemoteSnapshotMetadata = {
  fromCache: boolean;
  hasPendingWrites: boolean;
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
  onRemotePartyState: (
    partyState: PartyState,
    metadata: RemoteSnapshotMetadata,
  ) => void;
  onStatusChange: (syncStatus: SyncStatus) => void;
  partyId: PartyId;
};

let firestoreDatabase: import("firebase/firestore").Firestore | undefined;
let firestoreOfflineWritesDurable = false;

/**
 * Firestore may only be initialized once per app, and `initializeFirestore`
 * throws when called again with different settings, so the instance is created
 * on first use and reused by every later sync session (party switch, re-auth).
 *
 * The IndexedDB cache keeps unsent writes across reloads and lets the app run
 * offline. Environments without it (private modes, unsupported browsers, the
 * fixture runner) fall back to the default in-memory cache; sync still works,
 * writes are just not durable across a reload.
 */
function getFirestoreDatabase(
  app: import("firebase/app").FirebaseApp,
  firestore: typeof import("firebase/firestore"),
): {
  database: import("firebase/firestore").Firestore;
  offlineWritesDurable: boolean;
} {
  if (!firestoreDatabase) {
    if (typeof indexedDB !== "undefined") {
      try {
        firestoreDatabase = firestore.initializeFirestore(app, {
          ignoreUndefinedProperties: true,
          localCache: firestore.persistentLocalCache({
            tabManager: firestore.persistentMultipleTabManager(),
          }),
        });
        firestoreOfflineWritesDurable = true;
      } catch {
        firestoreDatabase = undefined;
      }
    }

    if (!firestoreDatabase) {
      firestoreDatabase = firestore.initializeFirestore(app, {
        ignoreUndefinedProperties: true,
      });
      firestoreOfflineWritesDurable = false;
    }
  }

  return {
    database: firestoreDatabase,
    offlineWritesDurable: firestoreOfflineWritesDurable,
  };
}

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

    const { database, offlineWritesDurable } = getFirestoreDatabase(
      app,
      firestore,
    );
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
      offlineWritesDurable,
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
    // Set once a snapshot reports the document exists. A document that then
    // disappears was deleted by its GM, and must not be written back.
    let documentSeen = false;

    const applyVersion2PartyState = ({
      metadata,
      partyState,
    }: {
      metadata: RemoteSnapshotMetadata;
      partyState: PartyState;
    }) => {
      if (stopped) {
        return;
      }

      if (!fieldUpdatesReady) {
        fieldUpdatesReady = true;
        resolveFieldUpdatesReady?.();
      }

      onRemotePartyState(partyState, metadata);
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
      // Metadata changes carry the write acknowledgements the status depends
      // on: without them a write that leaves the document unchanged never
      // reports back that the server accepted it.
      { includeMetadataChanges: true },
      (snapshot) => {
        const metadata: RemoteSnapshotMetadata = {
          fromCache: snapshot.metadata.fromCache,
          hasPendingWrites: snapshot.metadata.hasPendingWrites,
        };

        if (!snapshot.exists()) {
          // An offline client sees "missing" for any document it has never
          // cached. Creating it from local state there would overwrite the
          // real party once the connection returns.
          if (creatingDocument || metadata.fromCache) {
            return;
          }

          // The document existed a moment ago, so the GM deleted it. Creating
          // it again would resurrect the party and, because creation assigns
          // GM to the creating uid, hand GM to whichever member happened to
          // still be subscribed.
          if (documentSeen) {
            onError("This party was deleted by the GM.");
            return;
          }

          if (!user) {
            onError("Sign-in is required before a party can be created.");
            return;
          }

          creatingDocument = true;
          onStatusChange("saving");
          // Creating the document is what makes someone the GM of a new party:
          // the Firestore create rule requires the caller to be both
          // `party.gmUid` and a member, and no earlier step may assume it.
          void writer
            .replaceDocument(assignPartyGm(getCurrentPartyState(), user.uid))
            .catch((error: unknown) => {
              creatingDocument = false;
              onError(formatFirebaseError(error));
            });
          return;
        }

        documentSeen = true;

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

        legacyUpgradeLifecycle.handleVersion2Document({ metadata, partyState });
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

export type DeletePartyDocumentResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Removes the party document. Only the GM may do this (see the delete rule in
 * firestore.rules); callers must stop the snapshot subscription first, because
 * a subscribed client recreates a party document that disappears under it.
 */
export async function deletePartyDocument(
  config: FirebaseConfig,
  partyId: PartyId,
): Promise<DeletePartyDocumentResult> {
  try {
    const { app, firestore } = await loadFirebase(config);
    const database = firestore.getFirestore(app);

    await firestore.deleteDoc(
      firestore.doc(database, FIREBASE_PARTY_STATE_COLLECTION, partyId),
    );

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        getFirebaseErrorCode(error) === "permission-denied"
          ? "Only the GM can delete this party."
          : formatFirebaseError(error),
    };
  }
}

export async function signOutFirebase(config: FirebaseConfig): Promise<void> {
  const { authModule, auth } = await loadFirebase(config);
  await authModule.signOut(auth);
}

export function formatFirebaseError(error: unknown): string {
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

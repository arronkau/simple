import {
  parsePartyState,
  type PartyId,
  type PartyState,
} from "../model/appState";
import { createJoinMemberEntry } from "../model/partyInvite";
import type { ISODateTimeString } from "../model/types";
import type { FirebaseConfig } from "./firebaseConfig";
import type { SyncStatus } from "./types";

export const FIREBASE_PARTY_STATE_COLLECTION = "parties";

export type FirebaseWritePartyState = (partyState: PartyState) => Promise<void>;

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
  onReadyToWrite: (writePartyState: FirebaseWritePartyState) => void;
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

    const writePartyState: FirebaseWritePartyState = async (partyState) => {
      await firestore.setDoc(partyStateRef, partyState);
    };

    onReadyToWrite(writePartyState);

    return firestore.onSnapshot(
      partyStateRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          onStatusChange("saving");
          void writePartyState(getCurrentPartyState())
            .then(() => onStatusChange("synced"))
            .catch((error: unknown) => onError(formatFirebaseError(error)));
          return;
        }

        const partyState = parsePartyState(snapshot.data(), partyId);

        if (!partyState) {
          onError("Firestore party document is not a valid PartyState.");
          return;
        }

        onRemotePartyState(partyState);
      },
      (error) => onError(formatFirebaseError(error)),
    );
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

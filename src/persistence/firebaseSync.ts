import {
  parsePartyState,
  type PartyId,
  type PartyState,
} from "../model/appState";
import type { FirebaseConfig } from "./firebaseConfig";
import type { SyncStatus } from "./types";

export const FIREBASE_PARTY_STATE_COLLECTION = "parties";

export type FirebaseWritePartyState = (partyState: PartyState) => Promise<void>;

type StartFirebaseAppStateSyncInput = {
  config: FirebaseConfig;
  getCurrentPartyState: () => PartyState;
  onError: (message: string) => void;
  onAuthUserId: (userId: string) => void;
  onReadyToWrite: (writePartyState: FirebaseWritePartyState) => void;
  onRemotePartyState: (partyState: PartyState) => void;
  onStatusChange: (syncStatus: SyncStatus) => void;
  partyId: PartyId;
};

export async function startFirebaseAppStateSync({
  config,
  getCurrentPartyState,
  onAuthUserId,
  onError,
  onReadyToWrite,
  onRemotePartyState,
  onStatusChange,
  partyId,
}: StartFirebaseAppStateSyncInput): Promise<() => void> {
  onStatusChange("connecting");

  try {
    const [
      { getApps, initializeApp },
      { getAuth, signInAnonymously },
      firestore,
    ] = await Promise.all([
      import("firebase/app"),
      import("firebase/auth"),
      import("firebase/firestore"),
    ]);

    const app = getApps().length > 0 ? getApps()[0] : initializeApp(config);

    onStatusChange("authenticating");

    const auth = getAuth(app);

    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }

    if (auth.currentUser) {
      onAuthUserId(auth.currentUser.uid);
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

function formatFirebaseError(error: unknown): string {
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

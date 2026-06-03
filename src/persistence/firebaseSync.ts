import { parseAppState, type AppState } from "../model/appState";
import type { FirebaseConfig } from "./firebaseConfig";
import type { SyncStatus } from "./types";

export const FIREBASE_APP_STATE_COLLECTION = "appStates";
export const FIREBASE_APP_STATE_DOCUMENT_ID = "default";

export type FirebaseWriteAppState = (appState: AppState) => Promise<void>;

type StartFirebaseAppStateSyncInput = {
  config: FirebaseConfig;
  getCurrentAppState: () => AppState;
  onError: (message: string) => void;
  onReadyToWrite: (writeAppState: FirebaseWriteAppState) => void;
  onRemoteAppState: (appState: AppState) => void;
  onStatusChange: (syncStatus: SyncStatus) => void;
};

export async function startFirebaseAppStateSync({
  config,
  getCurrentAppState,
  onError,
  onReadyToWrite,
  onRemoteAppState,
  onStatusChange,
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

    onStatusChange("syncing");

    const database = firestore.initializeFirestore(app, {
      ignoreUndefinedProperties: true,
    });
    const appStateRef = firestore.doc(
      database,
      FIREBASE_APP_STATE_COLLECTION,
      FIREBASE_APP_STATE_DOCUMENT_ID,
    );
    const writeAppState: FirebaseWriteAppState = async (appState) => {
      await firestore.setDoc(appStateRef, appState);
    };

    onReadyToWrite(writeAppState);

    return firestore.onSnapshot(
      appStateRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          onStatusChange("saving");
          void writeAppState(getCurrentAppState())
            .then(() => onStatusChange("synced"))
            .catch((error: unknown) => onError(formatFirebaseError(error)));
          return;
        }

        const appState = parseAppState(snapshot.data());

        if (!appState) {
          onError("Firestore app state document is not a valid AppState.");
          return;
        }

        onRemoteAppState(appState);
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

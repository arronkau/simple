import {
  formatFirebaseReconnectMessage,
  isRetryableFirebaseConnectionError,
} from "./firebaseConnectionLifecycle";

export const FIREBASE_CONNECTION_LIFECYCLE_MANUAL_FIXTURES = [
  {
    name: "Firebase connection retries only transient failures",
    actual: [
      isRetryableFirebaseConnectionError({ code: "auth/network-request-failed" }),
      isRetryableFirebaseConnectionError({ code: "unavailable" }),
      isRetryableFirebaseConnectionError({ code: "deadline-exceeded" }),
      isRetryableFirebaseConnectionError({ code: "auth/too-many-requests" }),
      isRetryableFirebaseConnectionError({ code: "permission-denied" }),
      isRetryableFirebaseConnectionError({ code: "auth/operation-not-allowed" }),
      isRetryableFirebaseConnectionError(new Error("offline")),
    ],
    expected: [true, true, true, false, false, false, false],
  },
  {
    name: "Firebase reconnect message reports the scheduled delay",
    actual: formatFirebaseReconnectMessage(
      "Firebase: Error (auth/network-request-failed).",
      2000,
    ),
    expected:
      "Firebase: Error (auth/network-request-failed). Reconnecting in 2s.",
  },
];

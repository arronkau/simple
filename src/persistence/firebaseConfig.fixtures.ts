import {
  getFirebaseConfigFromEnv,
  type FirebaseEnv,
} from "./firebaseConfig";

const completeFirebaseEnv: FirebaseEnv = {
  VITE_FIREBASE_API_KEY: "api-key",
  VITE_FIREBASE_AUTH_DOMAIN: "simple.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "simple",
  VITE_FIREBASE_STORAGE_BUCKET: "simple.appspot.com",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "123",
  VITE_FIREBASE_APP_ID: "app-id",
};

export const FIREBASE_CONFIG_MANUAL_FIXTURES = [
  {
    name: "complete Firebase env enables Firebase config",
    actual: getFirebaseConfigFromEnv(completeFirebaseEnv),
    expected: {
      apiKey: "api-key",
      authDomain: "simple.firebaseapp.com",
      projectId: "simple",
      storageBucket: "simple.appspot.com",
      messagingSenderId: "123",
      appId: "app-id",
    },
  },
  {
    name: "partial Firebase env falls back to local mode",
    actual:
      getFirebaseConfigFromEnv({
        ...completeFirebaseEnv,
        VITE_FIREBASE_APP_ID: undefined,
      }) ?? "local",
    expected: "local",
  },
  {
    name: "blank Firebase env values fall back to local mode",
    actual:
      getFirebaseConfigFromEnv({
        ...completeFirebaseEnv,
        VITE_FIREBASE_API_KEY: "   ",
      }) ?? "local",
    expected: "local",
  },
];

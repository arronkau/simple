export const REQUIRED_FIREBASE_ENV_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

export type FirebaseEnvKey = (typeof REQUIRED_FIREBASE_ENV_KEYS)[number];

export type FirebaseEnv = Partial<Record<FirebaseEnvKey, string | undefined>>;

export type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

export function getFirebaseConfigFromEnv(
  env: FirebaseEnv,
): FirebaseConfig | undefined {
  const values = REQUIRED_FIREBASE_ENV_KEYS.map((key) => env[key]?.trim() ?? "");

  if (values.some((value) => value.length === 0)) {
    return undefined;
  }

  return {
    apiKey: values[0],
    authDomain: values[1],
    projectId: values[2],
    storageBucket: values[3],
    messagingSenderId: values[4],
    appId: values[5],
  };
}

export function getRuntimeFirebaseConfig(): FirebaseConfig | undefined {
  return getFirebaseConfigFromEnv((import.meta.env ?? {}) as FirebaseEnv);
}

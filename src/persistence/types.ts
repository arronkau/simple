export type PersistenceMode = "local" | "firebase";

export type SyncStatus =
  | "local"
  | "connecting"
  | "authenticating"
  | "syncing"
  | "saving"
  | "synced"
  | "error";

import type { PartyRole } from "../model/types";

export type PersistenceMode = "local" | "firebase";

export type SyncStatus =
  | "local"
  | "connecting"
  | "authenticating"
  | "syncing"
  | "saving"
  | "synced"
  | "error";

export function canEditUserIdentity(
  persistenceMode: PersistenceMode,
  syncStatus: SyncStatus,
  partyRole: PartyRole | null,
): boolean {
  if (persistenceMode === "local") {
    return true;
  }

  return syncStatus === "synced" && partyRole !== null;
}

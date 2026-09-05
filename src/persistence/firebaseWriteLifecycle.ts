import type { PartyRole } from "../model/types";
import type { SyncStatus } from "./types";

export async function runFirebaseWriteForGeneration({
  generation,
  getCurrentGeneration,
  onFailure,
  onSuccess,
  write,
}: {
  generation: number;
  getCurrentGeneration: () => number;
  onFailure: (error: unknown) => void;
  onSuccess: () => void;
  write: () => Promise<void>;
}): Promise<void> {
  try {
    await write();

    if (generation !== getCurrentGeneration()) {
      return;
    }

    onSuccess();
  } catch (error) {
    if (generation !== getCurrentGeneration()) {
      return;
    }

    onFailure(error);
  }
}

export function getFirebaseErrorCode(error: unknown): string | undefined {
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

export type FirebaseWriteFailureKind = "permission-denied" | "retryable";

/**
 * A rejected-by-rules write can never succeed by repeating it, so it is dropped
 * and the local copy is restored from the last snapshot. Everything else
 * (transient network, backend unavailable, aborted transaction) is retried.
 */
export function classifyFirebaseWriteFailure(
  error: unknown,
): FirebaseWriteFailureKind {
  return getFirebaseErrorCode(error) === "permission-denied"
    ? "permission-denied"
    : "retryable";
}

export function getPermissionDeniedWriteMessage(
  role: PartyRole | null | undefined,
): string {
  if (role === "gm") {
    return "The server rejected that change. Your copy was restored from the last synced version.";
  }

  if (role === "player") {
    return "Only the GM can change that. Your copy was restored from the last synced version.";
  }

  return "You are not a member of this party. Ask the GM for an invite link.";
}

/**
 * Updates still queued in the app have not reached the Firestore SDK, so
 * closing the tab loses them. Once handed over they survive a reload whenever
 * the persistent (IndexedDB) cache is active, so an in-flight write only blocks
 * the unload when writes are memory-only.
 */
export function shouldBlockUnloadForFirebaseWrites({
  offlineWritesDurable,
  pendingUpdateCount,
  writeInFlight,
}: {
  offlineWritesDurable: boolean;
  pendingUpdateCount: number;
  writeInFlight: boolean;
}): boolean {
  if (pendingUpdateCount > 0) {
    return true;
  }

  return writeInFlight && !offlineWritesDurable;
}

/**
 * Status for a snapshot. `synced` means server-acknowledged: the snapshot came
 * from the backend (`fromCache === false`) with no local write still pending
 * (`hasPendingWrites === false`) and nothing left in the app's own queue.
 * `undefined` means "leave the status alone" — a scheduled retry owns the
 * status and its error message until it resolves.
 */
export function deriveSnapshotSyncStatus({
  fromCache,
  hasPendingWrites,
  pendingUpdateCount,
  retryPending,
  writeInFlight,
}: {
  fromCache: boolean;
  hasPendingWrites: boolean;
  pendingUpdateCount: number;
  retryPending: boolean;
  writeInFlight: boolean;
}): SyncStatus | undefined {
  if (retryPending) {
    return undefined;
  }

  if (hasPendingWrites || writeInFlight || pendingUpdateCount > 0) {
    return "saving";
  }

  return fromCache ? "syncing" : "synced";
}

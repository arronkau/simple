import { getFirebaseErrorCode } from "./firebaseWriteLifecycle";

const RETRYABLE_CONNECTION_ERROR_CODES = new Set([
  "aborted",
  "auth/network-request-failed",
  "deadline-exceeded",
  "internal",
  "resource-exhausted",
  "unavailable",
]);

/**
 * Connection failures caused by a temporary network/backend condition can be
 * retried safely. Configuration, membership, and validation failures must stay
 * terminal so a bad deployment does not spin forever.
 */
export function isRetryableFirebaseConnectionError(error: unknown): boolean {
  const code = getFirebaseErrorCode(error);

  return code !== undefined && RETRYABLE_CONNECTION_ERROR_CODES.has(code);
}

export function formatFirebaseReconnectMessage(
  message: string,
  retryDelayMs: number,
): string {
  return `${message} Reconnecting in ${Math.round(retryDelayMs / 1000)}s.`;
}

import { createRetryScheduler } from "./retryBackoff";

type RetryHandle = unknown;

/**
 * Drives the one-time legacy → v2 document upgrade for a sync session.
 *
 * - A v2 snapshot always wins: it applies immediately and detaches any
 *   in-flight or scheduled upgrade work.
 * - A failed upgrade retries with exponential backoff (capped) for as long
 *   as the document is known to be legacy, because an unchanged document
 *   produces no further snapshots to re-trigger it. Only a v2 snapshot or
 *   stop() ends the retry loop.
 */
export function createLegacyUpgradeLifecycle<T>({
  applyVersion2,
  attemptUpgrade,
  cancelRetry,
  maxRetryDelayMs,
  onRetry,
  reportError,
  retryDelayMs,
  scheduleRetry,
}: {
  applyVersion2: (value: T) => void;
  attemptUpgrade: () => Promise<void>;
  cancelRetry?: (handle: RetryHandle) => void;
  maxRetryDelayMs: number;
  onRetry: () => void;
  reportError: (error: unknown) => void;
  retryDelayMs: number;
  scheduleRetry?: (callback: () => void, delayMs: number) => RetryHandle;
}) {
  let resolved = true;
  let stopped = false;
  let upgradePromise: Promise<void> | undefined;

  const retries = createRetryScheduler({
    cancelRetry,
    maxRetryDelayMs,
    onRetry: () => {
      if (stopped || resolved) {
        return;
      }

      onRetry();
      startUpgrade();
    },
    retryDelayMs,
    scheduleRetry,
  });

  const startUpgrade = () => {
    if (stopped || upgradePromise || retries.hasPendingRetry()) {
      return;
    }

    resolved = false;
    const currentPromise = attemptUpgrade();
    upgradePromise = currentPromise;
    void currentPromise
      .then(() => {
        if (stopped || upgradePromise !== currentPromise) {
          return;
        }

        resolved = true;
        retries.reset();
        upgradePromise = undefined;
      })
      .catch((error: unknown) => {
        if (stopped || upgradePromise !== currentPromise) {
          return;
        }

        upgradePromise = undefined;
        reportError(error);

        if (resolved) {
          return;
        }

        retries.recordFailure();
      });
  };

  return {
    handleLegacyDocument: startUpgrade,
    handleVersion2Document: (value: T) => {
      if (stopped) {
        return;
      }

      resolved = true;
      upgradePromise = undefined;
      retries.reset();
      applyVersion2(value);
    },
    stop: () => {
      stopped = true;
      retries.cancel();
      upgradePromise = undefined;
    },
  };
}

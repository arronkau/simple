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
  cancelRetry = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  maxRetryDelayMs,
  onRetry,
  reportError,
  retryDelayMs,
  scheduleRetry = (callback, delayMs) => setTimeout(callback, delayMs),
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
  let failures = 0;
  let resolved = true;
  let retryHandle: RetryHandle | undefined;
  let stopped = false;
  let upgradePromise: Promise<void> | undefined;

  const clearRetry = () => {
    if (retryHandle !== undefined) {
      cancelRetry(retryHandle);
      retryHandle = undefined;
    }
  };

  const nextRetryDelay = () =>
    Math.min(retryDelayMs * 2 ** Math.max(0, failures - 1), maxRetryDelayMs);

  const startUpgrade = () => {
    if (stopped || upgradePromise || retryHandle !== undefined) {
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
        failures = 0;
        upgradePromise = undefined;
      })
      .catch((error: unknown) => {
        if (stopped || upgradePromise !== currentPromise) {
          return;
        }

        upgradePromise = undefined;
        failures += 1;
        reportError(error);

        if (resolved) {
          return;
        }

        retryHandle = scheduleRetry(() => {
          retryHandle = undefined;

          if (stopped || resolved) {
            return;
          }

          onRetry();
          startUpgrade();
        }, nextRetryDelay());
      });
  };

  return {
    handleLegacyDocument: startUpgrade,
    handleVersion2Document: (value: T) => {
      if (stopped) {
        return;
      }

      resolved = true;
      failures = 0;
      upgradePromise = undefined;
      clearRetry();
      applyVersion2(value);
    },
    stop: () => {
      stopped = true;
      clearRetry();
      upgradePromise = undefined;
    },
  };
}

type RetryHandle = unknown;

export function createLegacyUpgradeLifecycle<T>({
  applyVersion2,
  attemptUpgrade,
  cancelRetry = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  maxAttempts,
  onRetry,
  reportError,
  retryDelayMs,
  scheduleRetry = (callback, delayMs) => setTimeout(callback, delayMs),
}: {
  applyVersion2: (value: T) => void;
  attemptUpgrade: () => Promise<void>;
  cancelRetry?: (handle: RetryHandle) => void;
  maxAttempts: number;
  onRetry: () => void;
  reportError: (error: unknown) => void;
  retryDelayMs: number;
  scheduleRetry?: (callback: () => void, delayMs: number) => RetryHandle;
}) {
  let attempts = 0;
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

  const startUpgrade = () => {
    if (
      stopped ||
      upgradePromise ||
      retryHandle !== undefined ||
      attempts >= maxAttempts
    ) {
      return;
    }

    resolved = false;
    attempts += 1;
    const currentPromise = attemptUpgrade();
    upgradePromise = currentPromise;
    void currentPromise
      .then(() => {
        if (stopped || upgradePromise !== currentPromise) {
          return;
        }

        resolved = true;
        attempts = 0;
        upgradePromise = undefined;
      })
      .catch((error: unknown) => {
        if (stopped || upgradePromise !== currentPromise) {
          return;
        }

        upgradePromise = undefined;
        reportError(error);

        if (!resolved && attempts < maxAttempts) {
          retryHandle = scheduleRetry(() => {
            retryHandle = undefined;

            if (stopped || resolved) {
              return;
            }

            onRetry();
            startUpgrade();
          }, retryDelayMs);
        }
      });
  };

  return {
    handleLegacyDocument: startUpgrade,
    handleVersion2Document: (value: T) => {
      if (stopped) {
        return;
      }

      resolved = true;
      attempts = 0;
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

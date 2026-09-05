type RetryHandle = unknown;

/**
 * Exponential backoff delay for attempt number `failures` (1-based), capped at
 * `maxRetryDelayMs`. Shared by every retrying sync lifecycle so the schedule is
 * described in exactly one place.
 */
export function getRetryDelayMs({
  failures,
  maxRetryDelayMs,
  retryDelayMs,
}: {
  failures: number;
  maxRetryDelayMs: number;
  retryDelayMs: number;
}): number {
  return Math.min(
    retryDelayMs * 2 ** Math.max(0, failures - 1),
    maxRetryDelayMs,
  );
}

export type RetryScheduler = {
  cancel: () => void;
  getFailureCount: () => number;
  hasPendingRetry: () => boolean;
  recordFailure: () => number;
  reset: () => void;
};

/**
 * Schedules a single pending retry with exponential backoff.
 *
 * `recordFailure` replaces any pending retry and returns the delay it used;
 * `reset` clears the pending retry and the failure count (call it on success or
 * when the work it retries is no longer wanted). Timer functions are injectable
 * so the schedule can be exercised without real timers.
 */
export function createRetryScheduler({
  cancelRetry = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  maxRetryDelayMs,
  onRetry,
  retryDelayMs,
  scheduleRetry = (callback, delayMs) => setTimeout(callback, delayMs),
}: {
  cancelRetry?: (handle: RetryHandle) => void;
  maxRetryDelayMs: number;
  onRetry: () => void;
  retryDelayMs: number;
  scheduleRetry?: (callback: () => void, delayMs: number) => RetryHandle;
}): RetryScheduler {
  let failures = 0;
  let retryHandle: RetryHandle | undefined;

  const cancel = () => {
    if (retryHandle !== undefined) {
      cancelRetry(retryHandle);
      retryHandle = undefined;
    }
  };

  return {
    cancel,
    getFailureCount: () => failures,
    hasPendingRetry: () => retryHandle !== undefined,
    recordFailure: () => {
      cancel();
      failures += 1;
      const delayMs = getRetryDelayMs({
        failures,
        maxRetryDelayMs,
        retryDelayMs,
      });
      retryHandle = scheduleRetry(() => {
        retryHandle = undefined;
        onRetry();
      }, delayMs);

      return delayMs;
    },
    reset: () => {
      failures = 0;
      cancel();
    },
  };
}

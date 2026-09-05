import { createRetryScheduler, getRetryDelayMs } from "./retryBackoff";

const writeRetryDelays = [1, 2, 3, 4, 5, 6, 7].map((failures) =>
  getRetryDelayMs({ failures, maxRetryDelayMs: 30_000, retryDelayMs: 1000 }),
);
const schedulerEvents = collectSchedulerEvents();
const resetEvents = collectResetEvents();

export const RETRY_BACKOFF_MANUAL_FIXTURES = [
  {
    name: "Retry delays double from 1s and cap at 30s",
    actual: writeRetryDelays,
    expected: [1000, 2000, 4000, 8000, 16_000, 30_000, 30_000],
  },
  {
    name: "Retry scheduler replaces a pending retry and reports its delay",
    actual: schedulerEvents,
    expected: [
      "schedule:1000",
      "delay:1000",
      "cancel:1",
      "schedule:2000",
      "delay:2000",
      "retry",
      "pendingRetry:false",
      "failures:2",
    ],
  },
  {
    name: "Retry scheduler reset cancels the pending retry and clears the failure count",
    actual: resetEvents,
    expected: ["schedule:1500", "cancel:1", "failures:0", "delay:1500"],
  },
];

function collectSchedulerEvents(): string[] {
  const events: string[] = [];
  const retries = new Map<number, () => void>();
  let nextRetryId = 1;
  const scheduler = createRetryScheduler({
    cancelRetry: (handle) => events.push(`cancel:${String(handle)}`),
    maxRetryDelayMs: 30_000,
    onRetry: () => events.push("retry"),
    retryDelayMs: 1000,
    scheduleRetry: (callback, delayMs) => {
      events.push(`schedule:${delayMs}`);
      const id = nextRetryId;
      nextRetryId += 1;
      retries.set(id, callback);
      return id;
    },
  });

  events.push(`delay:${scheduler.recordFailure()}`);
  events.push(`delay:${scheduler.recordFailure()}`);
  retries.get(2)?.();
  events.push(`pendingRetry:${scheduler.hasPendingRetry()}`);
  events.push(`failures:${scheduler.getFailureCount()}`);

  return events;
}

function collectResetEvents(): string[] {
  const events: string[] = [];
  const scheduler = createRetryScheduler({
    cancelRetry: (handle) => events.push(`cancel:${String(handle)}`),
    maxRetryDelayMs: 12_000,
    onRetry: () => events.push("retry"),
    retryDelayMs: 1500,
    scheduleRetry: (_callback, delayMs) => {
      events.push(`schedule:${delayMs}`);
      return 1;
    },
  });

  scheduler.recordFailure();
  scheduler.reset();
  events.push(`failures:${scheduler.getFailureCount()}`);
  events.push(
    `delay:${getRetryDelayMs({
      failures: scheduler.getFailureCount() + 1,
      maxRetryDelayMs: 12_000,
      retryDelayMs: 1500,
    })}`,
  );

  return events;
}

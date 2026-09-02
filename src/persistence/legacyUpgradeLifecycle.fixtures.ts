import { createLegacyUpgradeLifecycle } from "./legacyUpgradeLifecycle";

const version2RaceEvents = await collectVersion2RaceEvents();
const retryEvents = await collectRetryEvents();
const unsubscribeEvents = await collectUnsubscribeEvents();

export const LEGACY_UPGRADE_LIFECYCLE_MANUAL_FIXTURES = [
  {
    name: "A v2 snapshot applies immediately and detaches an in-flight legacy upgrade",
    actual: version2RaceEvents,
    expected: ["attempt", "apply:v2"],
  },
  {
    name: "Legacy upgrade failures report and retry only up to the attempt bound",
    actual: retryEvents,
    expected: [
      "attempt:1",
      "error:failure 1",
      "retry",
      "attempt:2",
      "error:failure 2",
      "retry",
      "attempt:3",
      "error:failure 3",
      "retry",
      "attempt:4",
      "error:failure 4",
    ],
  },
  {
    name: "Stopping legacy upgrade lifecycle cancels a pending retry",
    actual: unsubscribeEvents,
    expected: ["attempt", "error", "cancel"],
  },
];

async function collectVersion2RaceEvents(): Promise<string[]> {
  const events: string[] = [];
  let rejectUpgrade: ((error: Error) => void) | undefined;
  const lifecycle = createLegacyUpgradeLifecycle({
    applyVersion2: (value: string) => events.push(`apply:${value}`),
    attemptUpgrade: () => {
      events.push("attempt");
      return new Promise<void>((_resolve, reject) => {
        rejectUpgrade = reject;
      });
    },
    maxAttempts: 4,
    onRetry: () => events.push("retry"),
    reportError: () => events.push("error"),
    retryDelayMs: 1500,
    scheduleRetry: () => {
      events.push("schedule");
      return 1;
    },
  });

  lifecycle.handleLegacyDocument();
  lifecycle.handleVersion2Document("v2");
  rejectUpgrade?.(new Error("obsolete failure"));
  await flushPromiseHandlers();

  return events;
}

async function collectRetryEvents(): Promise<string[]> {
  const events: string[] = [];
  const retries = new Map<number, () => void>();
  let nextRetryId = 1;
  let attempts = 0;
  const lifecycle = createLegacyUpgradeLifecycle({
    applyVersion2: () => events.push("apply"),
    attemptUpgrade: async () => {
      attempts += 1;
      events.push(`attempt:${attempts}`);
      throw new Error(`failure ${attempts}`);
    },
    maxAttempts: 4,
    onRetry: () => events.push("retry"),
    reportError: (error) =>
      events.push(`error:${error instanceof Error ? error.message : "unknown"}`),
    retryDelayMs: 1500,
    scheduleRetry: (callback) => {
      const id = nextRetryId;
      nextRetryId += 1;
      retries.set(id, callback);
      return id;
    },
  });

  lifecycle.handleLegacyDocument();

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await flushPromiseHandlers();
    const retry = retries.get(attempt);
    retries.delete(attempt);
    retry?.();
  }

  await flushPromiseHandlers();
  return events;
}

async function collectUnsubscribeEvents(): Promise<string[]> {
  const events: string[] = [];
  const lifecycle = createLegacyUpgradeLifecycle({
    applyVersion2: () => events.push("apply"),
    attemptUpgrade: async () => {
      events.push("attempt");
      throw new Error("failure");
    },
    cancelRetry: () => events.push("cancel"),
    maxAttempts: 4,
    onRetry: () => events.push("retry"),
    reportError: () => events.push("error"),
    retryDelayMs: 1500,
    scheduleRetry: () => 1,
  });

  lifecycle.handleLegacyDocument();
  await flushPromiseHandlers();
  lifecycle.stop();

  return events;
}

async function flushPromiseHandlers(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

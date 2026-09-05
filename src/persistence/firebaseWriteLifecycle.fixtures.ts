import {
  classifyFirebaseWriteFailure,
  deriveSnapshotSyncStatus,
  getPermissionDeniedWriteMessage,
  runFirebaseWriteForGeneration,
  shouldBlockUnloadForFirebaseWrites,
} from "./firebaseWriteLifecycle";

const staleWriteEvents = await collectStaleWriteEvents();
const currentWriteEvents = await collectCurrentWriteEvents();

export const FIREBASE_WRITE_LIFECYCLE_MANUAL_FIXTURES = [
  {
    name: "Firebase writes ignore stale-generation success and failure settlements",
    actual: staleWriteEvents,
    expected: [],
  },
  {
    name: "Firebase writes settle callbacks for the current generation",
    actual: currentWriteEvents,
    expected: ["success", "failure: current failure"],
  },
  {
    name: "Only permission-denied write failures are non-retryable",
    actual: [
      classifyFirebaseWriteFailure({ code: "permission-denied" }),
      classifyFirebaseWriteFailure({ code: "unavailable" }),
      classifyFirebaseWriteFailure({ code: "deadline-exceeded" }),
      classifyFirebaseWriteFailure(new Error("offline")),
      classifyFirebaseWriteFailure(undefined),
    ],
    expected: [
      "permission-denied",
      "retryable",
      "retryable",
      "retryable",
      "retryable",
    ],
  },
  {
    name: "Permission-denied write messages are role-aware",
    actual: [
      getPermissionDeniedWriteMessage("gm"),
      getPermissionDeniedWriteMessage("player"),
      getPermissionDeniedWriteMessage(null),
    ],
    expected: [
      "The server rejected that change. Your copy was restored from the last synced version.",
      "Only the GM can change that. Your copy was restored from the last synced version.",
      "You are not a member of this party. Ask the GM for an invite link.",
    ],
  },
  {
    name: "Unload is blocked only while updates have not reached the Firestore SDK",
    actual: [
      shouldBlockUnloadForFirebaseWrites({
        offlineWritesDurable: true,
        pendingUpdateCount: 0,
        writeInFlight: false,
      }),
      shouldBlockUnloadForFirebaseWrites({
        offlineWritesDurable: true,
        pendingUpdateCount: 2,
        writeInFlight: false,
      }),
      shouldBlockUnloadForFirebaseWrites({
        offlineWritesDurable: true,
        pendingUpdateCount: 0,
        writeInFlight: true,
      }),
      shouldBlockUnloadForFirebaseWrites({
        offlineWritesDurable: false,
        pendingUpdateCount: 0,
        writeInFlight: true,
      }),
    ],
    expected: [false, true, false, true],
  },
  {
    name: "Synced status requires a server snapshot with no write outstanding",
    actual: [
      describeSnapshotSyncStatus({
        fromCache: false,
        hasPendingWrites: false,
        pendingUpdateCount: 0,
        retryPending: false,
        writeInFlight: false,
      }),
      describeSnapshotSyncStatus({
        fromCache: false,
        hasPendingWrites: true,
        pendingUpdateCount: 0,
        retryPending: false,
        writeInFlight: false,
      }),
      describeSnapshotSyncStatus({
        fromCache: true,
        hasPendingWrites: false,
        pendingUpdateCount: 0,
        retryPending: false,
        writeInFlight: false,
      }),
      describeSnapshotSyncStatus({
        fromCache: false,
        hasPendingWrites: false,
        pendingUpdateCount: 3,
        retryPending: false,
        writeInFlight: false,
      }),
      describeSnapshotSyncStatus({
        fromCache: false,
        hasPendingWrites: false,
        pendingUpdateCount: 0,
        retryPending: false,
        writeInFlight: true,
      }),
      describeSnapshotSyncStatus({
        fromCache: false,
        hasPendingWrites: false,
        pendingUpdateCount: 1,
        retryPending: true,
        writeInFlight: false,
      }),
    ],
    expected: ["synced", "saving", "syncing", "saving", "saving", "unchanged"],
  },
];

function describeSnapshotSyncStatus(
  input: Parameters<typeof deriveSnapshotSyncStatus>[0],
): string {
  return deriveSnapshotSyncStatus(input) ?? "unchanged";
}

async function collectStaleWriteEvents(): Promise<string[]> {
  const events: string[] = [];
  let generation = 1;

  const staleSuccess = runFirebaseWriteForGeneration({
    generation,
    getCurrentGeneration: () => generation,
    onFailure: () => events.push("failure"),
    onSuccess: () => events.push("success"),
    write: async () => undefined,
  });
  generation += 1;
  await staleSuccess;

  const staleFailure = runFirebaseWriteForGeneration({
    generation,
    getCurrentGeneration: () => generation,
    onFailure: () => events.push("failure"),
    onSuccess: () => events.push("success"),
    write: async () => {
      throw new Error("stale failure");
    },
  });
  generation += 1;
  await staleFailure;

  return events;
}

async function collectCurrentWriteEvents(): Promise<string[]> {
  const events: string[] = [];
  const generation = 1;

  await runFirebaseWriteForGeneration({
    generation,
    getCurrentGeneration: () => generation,
    onFailure: () => events.push("failure"),
    onSuccess: () => events.push("success"),
    write: async () => undefined,
  });
  await runFirebaseWriteForGeneration({
    generation,
    getCurrentGeneration: () => generation,
    onFailure: (error) =>
      events.push(
        `failure: ${error instanceof Error ? error.message : "unknown"}`,
      ),
    onSuccess: () => events.push("success"),
    write: async () => {
      throw new Error("current failure");
    },
  });

  return events;
}

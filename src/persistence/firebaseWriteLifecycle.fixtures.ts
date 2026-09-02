import { runFirebaseWriteForGeneration } from "./firebaseWriteLifecycle";

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
];

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

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

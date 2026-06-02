export type AppState = {
  schemaVersion: 1;
  entities: unknown[];
  inventoryRecords: unknown[];
};

export const APP_STATE_STORAGE_KEY = "simple.inventory.appState.v1";

export const EMPTY_APP_STATE: AppState = {
  schemaVersion: 1,
  entities: [],
  inventoryRecords: [],
};

export function createEmptyAppState(): AppState {
  return {
    schemaVersion: EMPTY_APP_STATE.schemaVersion,
    entities: [],
    inventoryRecords: [],
  };
}

export function readLocalAppState(): AppState {
  if (!canUseLocalStorage()) {
    return createEmptyAppState();
  }

  try {
    const storedValue = window.localStorage.getItem(APP_STATE_STORAGE_KEY);

    if (!storedValue) {
      return createEmptyAppState();
    }

    const parsedValue: unknown = JSON.parse(storedValue);

    if (isAppState(parsedValue)) {
      return {
        schemaVersion: 1,
        entities: parsedValue.entities,
        inventoryRecords: parsedValue.inventoryRecords,
      };
    }
  } catch {
    return createEmptyAppState();
  }

  return createEmptyAppState();
}

export function writeLocalAppState(appState: AppState): void {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(appState));
  } catch {
    // Storage can fail in private contexts or when quota is exceeded.
  }
}

function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AppState>;

  return (
    candidate.schemaVersion === 1 &&
    Array.isArray(candidate.entities) &&
    Array.isArray(candidate.inventoryRecords)
  );
}

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && "localStorage" in window;
}

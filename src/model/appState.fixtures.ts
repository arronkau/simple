import {
  APP_STATE_STORAGE_KEY,
  createEmptyAppState,
  parseAppState,
  readLocalAppState,
  writeLocalAppState,
  type AppState,
} from "./appState";
import type { Entity, InventoryRecord } from "./types";

const characterEntity: Entity = {
  id: "character-1",
  name: "Morgan",
  entityType: "character",
  active: true,
  sortOrder: 0,
};

const legacyWeaponRecord: InventoryRecord = {
  id: "spear-1",
  recordType: "weapon",
  name: "Spear",
  location: {
    entityId: characterEntity.id,
    locationType: "equipped",
    placement: "bothHands",
  },
  sortOrder: 0,
  slotProfile: { kind: "fixed", slots: 1 },
  weapon: {
    hands: "twoHands",
  },
};

const firebaseCoinRecord: InventoryRecord = {
  id: "coins-1",
  recordType: "coins",
  location: {
    entityId: characterEntity.id,
    locationType: "stowed",
    placement: "coinPurse",
  },
  sortOrder: 1000,
  slotProfile: { kind: "coins" },
  coins: {
    pp: 0,
    gp: 5,
    sp: 0,
    cp: 0,
  },
};

const storedAppState: AppState = {
  schemaVersion: 1,
  entities: [characterEntity],
  inventoryRecords: [legacyWeaponRecord],
};

const parsedAppState = parseAppState(storedAppState);
const firebaseDocumentAppState: AppState = {
  schemaVersion: 1,
  entities: [characterEntity],
  inventoryRecords: [firebaseCoinRecord],
};

const localRoundTripAppState = withMockLocalStorage(() => {
  writeLocalAppState(storedAppState);
  return readLocalAppState();
});

const invalidLocalAppState = withMockLocalStorage((localStorage) => {
  localStorage.setItem(APP_STATE_STORAGE_KEY, "{");
  return readLocalAppState();
});

export const APP_STATE_MANUAL_FIXTURES = [
  {
    name: "app state parsing preserves v1 shape and normalizes records",
    actual: {
      schemaVersion: parsedAppState?.schemaVersion,
      entities: parsedAppState?.entities,
      recordHandsRequired:
        parsedAppState?.inventoryRecords[0]?.recordType === "weapon"
          ? parsedAppState.inventoryRecords[0].handsRequired
          : undefined,
    },
    expected: {
      schemaVersion: 1,
      entities: [characterEntity],
      recordHandsRequired: 2,
    },
  },
  {
    name: "invalid app state values do not parse",
    actual: parseAppState({
      schemaVersion: 2,
      entities: [],
      inventoryRecords: [],
    }),
    expected: undefined,
  },
  {
    name: "Firebase document data preserves the same logical AppState shape",
    actual: parseAppState(firebaseDocumentAppState),
    expected: firebaseDocumentAppState,
  },
  {
    name: "local app state persists through localStorage",
    actual: localRoundTripAppState,
    expected: {
      ...storedAppState,
      inventoryRecords: [
        {
          ...legacyWeaponRecord,
          handsRequired: 2,
        },
      ],
    },
  },
  {
    name: "invalid local app state falls back to empty state",
    actual: invalidLocalAppState,
    expected: createEmptyAppState(),
  },
];

function withMockLocalStorage<T>(run: (localStorage: Storage) => T): T {
  const globalValue = globalThis as unknown as { window?: Window };
  const previousWindow = globalValue.window;
  const localStorage = createMemoryStorage();

  globalValue.window = { localStorage } as Window;

  try {
    return run(localStorage);
  } finally {
    if (previousWindow) {
      globalValue.window = previousWindow;
    } else {
      delete globalValue.window;
    }
  }
}

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

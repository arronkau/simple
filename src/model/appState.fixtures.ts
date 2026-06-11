import {
  APP_STATE_STORAGE_KEY,
  createEmptyAppState,
  createPartyState,
  migratePartyMembership,
  parsePartyState,
  parseAppState,
  readLocalAppState,
  writeLocalAppState,
  type AppState,
} from "./appState";
import { createEmptyCharacterData } from "./characters";
import type { AuditLogEntry, Entity, InventoryRecord } from "./types";

const characterEntity: Entity = {
  id: "character-1",
  name: "Morgan",
  entityType: "character",
  active: true,
  sortOrder: 0,
};

const normalizedCharacterEntity: Entity = {
  ...characterEntity,
  character: createEmptyCharacterData(),
};

const legacyWeaponRecord: InventoryRecord = {
  id: "spear-1",
  recordType: "weapon",
  name: "Spear",
  entityId: characterEntity.id,
  location: {
    kind: "equipped",
    placement: "bothHands",
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  weapon: {
    hands: "twoHands",
  },
};

const firebaseCoinRecord: InventoryRecord = {
  id: "coins-1",
  recordType: "coins",
  entityId: characterEntity.id,
  location: {
    kind: "coinPurse",
  },
  sortOrder: 1000,
  coins: {
    pp: 0,
    gp: 5,
    sp: 0,
    cp: 0,
  },
};

const coinRecordWithQuantity = {
  id: "coins-invalid-1",
  recordType: "coins",
  entityId: characterEntity.id,
  location: {
    kind: "coinPurse",
  },
  sortOrder: 1000,
  quantity: 5,
  coins: {
    pp: 0,
    gp: 5,
    sp: 0,
    cp: 0,
  },
};

const coinRecordWithBurden = {
  id: "coins-invalid-2",
  recordType: "coins",
  entityId: characterEntity.id,
  location: {
    kind: "coinPurse",
  },
  sortOrder: 1000,
  burden: { kind: "fixed", slotsPerItem: 1 },
  coins: {
    pp: 0,
    gp: 5,
    sp: 0,
    cp: 0,
  },
};

const coinRecordWithTreasure = {
  id: "coins-invalid-3",
  recordType: "coins",
  entityId: characterEntity.id,
  location: {
    kind: "coinPurse",
  },
  sortOrder: 1000,
  treasure: { value: "uncommon" },
  coins: {
    pp: 0,
    gp: 5,
    sp: 0,
    cp: 0,
  },
};

const coinRecordWithWeapon = {
  id: "coins-invalid-4",
  recordType: "coins",
  entityId: characterEntity.id,
  location: {
    kind: "coinPurse",
  },
  sortOrder: 1000,
  weapon: { hands: "oneHand" },
  coins: {
    pp: 0,
    gp: 5,
    sp: 0,
    cp: 0,
  },
};

const coinRecordWithArmor = {
  id: "coins-invalid-5",
  recordType: "coins",
  entityId: characterEntity.id,
  location: {
    kind: "coinPurse",
  },
  sortOrder: 1000,
  armor: {},
  coins: {
    pp: 0,
    gp: 5,
    sp: 0,
    cp: 0,
  },
};

const coinRecordWithContainer = {
  id: "coins-invalid-6",
  recordType: "coins",
  entityId: characterEntity.id,
  location: {
    kind: "coinPurse",
  },
  sortOrder: 1000,
  container: { capacitySlots: 10 },
  coins: {
    pp: 0,
    gp: 5,
    sp: 0,
    cp: 0,
  },
};

const coinRecordWithIdentification = {
  id: "coins-invalid-7",
  recordType: "coins",
  entityId: characterEntity.id,
  location: {
    kind: "coinPurse",
  },
  sortOrder: 1000,
  identification: { identified: true },
  coins: {
    pp: 0,
    gp: 5,
    sp: 0,
    cp: 0,
  },
};

const auditLogEntry: AuditLogEntry = {
  id: "audit-1",
  actorLabel: "Local user",
  createdAt: "2026-06-03T12:00:00.000Z",
  entityId: characterEntity.id,
  eventType: "inventoryRecordCreated",
  recordId: firebaseCoinRecord.id,
  summary: 'Created coins for "Morgan".',
  details: {
    recordType: "coins",
  },
};

const legacyStoredAppState: Omit<AppState, "auditLog"> = {
  schemaVersion: 1,
  entities: [characterEntity],
  inventoryRecords: [legacyWeaponRecord],
};

const legacySlotProfileAppState = {
  schemaVersion: 1,
  entities: [characterEntity],
  inventoryRecords: [
    {
      id: "daggers-1",
      recordType: "weapon",
      name: "Daggers",
      entityId: characterEntity.id,
  location: {
    kind: "equipped",
    placement: "loose",
  },
      sortOrder: 0,
      slotProfile: { kind: "fixed", slots: 1 },
      weapon: {},
    },
    {
      id: "rations-1",
      recordType: "equipment",
      name: "Rations",
      entityId: characterEntity.id,
  location: {
    kind: "container",
    containerId: "backpack-1",
  },
      sortOrder: 1000,
      slotProfile: { kind: "stackable", quantity: 15, perSlot: 5 },
    },
  ],
};

const storedAppState: AppState = {
  schemaVersion: 1,
  entities: [characterEntity],
  inventoryRecords: [legacyWeaponRecord],
  auditLog: [auditLogEntry],
};

const advancedRecordAppState: AppState = {
  schemaVersion: 1,
  entities: [characterEntity],
  inventoryRecords: [
    {
      id: "advanced-lantern",
      recordType: "equipment",
      name: "Bullseye lantern",
      description: "True description",
      entityId: characterEntity.id,
  location: {
    kind: "equipped",
    placement: "loose",
  },
      sortOrder: 0,
      quantity: 1,
      burden: { kind: "fixed", slotsPerItem: 1 },
      identification: {
        identified: false,
        secretName: "Odd lantern",
        secretDescription: "A hooded brass lamp",
      },
      light: {
        isLit: true,
        lightDescription: "Directional beam",
      },
      uses: {
        current: 24,
        max: 24,
      },
      modifiers: [
        {
          target: "movement",
          value: 10,
          label: "Signal beam",
        },
      ],
      notes: "GM-facing label only.",
    },
  ],
  auditLog: [],
};

const legacyIdentificationAppState = {
  schemaVersion: 1,
  entities: [characterEntity],
  inventoryRecords: [
    {
      id: "legacy-secret-1",
      recordType: "equipment",
      name: "Plain ring",
      entityId: characterEntity.id,
      location: {
        kind: "equipped",
        placement: "loose",
      },
      sortOrder: 0,
      quantity: 1,
      burden: { kind: "fixed", slotsPerItem: 1 },
      identification: {
        identified: false,
        unidentifiedName: "Ring of Warmth",
        unidentifiedDescription: "A copper ring that is warm to the touch.",
      },
    },
  ],
  auditLog: [],
};

const legacyBackpackFlagAppState = {
  schemaVersion: 1,
  entities: [characterEntity],
  inventoryRecords: [
    {
      id: "backpack-1",
      recordType: "equipment",
      name: "Backpack",
      entityId: characterEntity.id,
      location: {
        kind: "stowedRoot",
      },
      sortOrder: 0,
      quantity: 1,
      burden: { kind: "fixed", slotsPerItem: 1 },
      handsRequired: 0,
      container: {
        capacitySlots: 16,
      },
    },
  ],
  auditLog: [],
};

const parsedLegacyAppState = parseAppState(legacyStoredAppState);
const firebaseDocumentAppState: AppState = {
  schemaVersion: 1,
  entities: [normalizedCharacterEntity],
  inventoryRecords: [firebaseCoinRecord],
  auditLog: [auditLogEntry],
};

const localRoundTripAppState = withMockLocalStorage(() => {
  writeLocalAppState(storedAppState);
  return readLocalAppState();
});

const invalidLocalAppState = withMockLocalStorage((localStorage) => {
  localStorage.setItem(APP_STATE_STORAGE_KEY, "{");
  return readLocalAppState();
});

const partyStateWithUserProfiles = createPartyState({
  appState: storedAppState,
  displayName: "Blackmarsh Table",
  partyId: "party-1",
  userProfiles: [
    {
      id: "user-1",
      displayName: "Morgan",
      role: "GM",
      updatedAt: "2026-06-05T12:00:00.000Z",
    },
  ],
});

export const APP_STATE_MANUAL_FIXTURES = [
  {
    name: "app state parsing preserves v1 shape and normalizes records",
    actual: {
      schemaVersion: parsedLegacyAppState?.schemaVersion,
      entities: parsedLegacyAppState?.entities,
      auditLog: parsedLegacyAppState?.auditLog,
      recordHandsRequired:
        parsedLegacyAppState?.inventoryRecords[0]?.recordType === "weapon"
          ? parsedLegacyAppState.inventoryRecords[0].handsRequired
          : undefined,
    },
    expected: {
      schemaVersion: 1,
      entities: [normalizedCharacterEntity],
      auditLog: [],
      recordHandsRequired: 2,
    },
  },
  {
    name: "app state parsing preserves current audit log entries",
    actual: parseAppState(storedAppState)?.auditLog,
    expected: [auditLogEntry],
  },
  {
    name: "app state parsing migrates legacy unidentified fields to secret fields",
    actual: parseAppState(legacyIdentificationAppState)?.inventoryRecords[0],
    expected: {
      id: "legacy-secret-1",
      recordType: "equipment",
      name: "Plain ring",
      entityId: characterEntity.id,
      location: {
        kind: "equipped",
        placement: "loose",
      },
      sortOrder: 0,
      quantity: 1,
      burden: { kind: "fixed", slotsPerItem: 1 },
      identification: {
        identified: false,
        secretName: "Ring of Warmth",
        secretDescription: "A copper ring that is warm to the touch.",
      },
      handsRequired: 0,
    },
  },
  {
    name: "app state parsing accepts and strips legacy backpack container flag",
    actual: parseAppState(legacyBackpackFlagAppState)?.inventoryRecords[0],
    expected: {
      id: "backpack-1",
      recordType: "equipment",
      name: "Backpack",
      entityId: characterEntity.id,
      location: {
        kind: "stowedRoot",
      },
      sortOrder: 0,
      quantity: 1,
      burden: { kind: "fixed", slotsPerItem: 1 },
      handsRequired: 0,
      container: {
        capacitySlots: 16,
      },
    },
  },
  {
    name: "app state parsing migrates legacy slot profiles",
    actual: parseAppState(legacySlotProfileAppState)?.inventoryRecords,
    expected: [
      {
        id: "daggers-1",
        recordType: "weapon",
        name: "Daggers",
        entityId: characterEntity.id,
  location: {
    kind: "equipped",
    placement: "loose",
  },
        sortOrder: 0,
        weapon: {},
        quantity: 1,
        burden: { kind: "fixed", slotsPerItem: 1 },
        handsRequired: 0,
      },
      {
        id: "rations-1",
        recordType: "equipment",
        name: "Rations",
        entityId: characterEntity.id,
  location: {
    kind: "container",
    containerId: "backpack-1",
  },
        sortOrder: 1000,
        quantity: 15,
        burden: { kind: "stacked", itemsPerSlot: 5 },
        handsRequired: 0,
      },
    ],
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
    name: "malformed inventory records reject the whole app state",
    actual: parseAppState({
      schemaVersion: 1,
      entities: [characterEntity],
      inventoryRecords: [
        legacyWeaponRecord,
        {
          id: "bad-record",
          recordType: "equipment",
          entityId: characterEntity.id,
          location: {
            kind: "container",
          },
          sortOrder: 1,
        },
      ],
      auditLog: [],
    }),
    expected: undefined,
  },
  {
    name: "malformed audit entries reject the whole app state",
    actual: parseAppState({
      schemaVersion: 1,
      entities: [characterEntity],
      inventoryRecords: [],
      auditLog: [
        {
          id: "audit-bad",
          createdAt: "2026-06-03T12:00:00.000Z",
          actorLabel: "Local user",
          eventType: "not-real",
          summary: "Invalid event.",
        },
      ],
    }),
    expected: undefined,
  },
  {
    name: "Firebase document data preserves the same logical AppState shape",
    actual: parseAppState(firebaseDocumentAppState),
    expected: firebaseDocumentAppState,
  },
  {
    name: "party state parsing preserves user profiles",
    actual: parsePartyState(partyStateWithUserProfiles, "party-1"),
    expected: {
      ...partyStateWithUserProfiles,
      appState: {
        ...storedAppState,
        entities: [normalizedCharacterEntity],
        inventoryRecords: [
          {
            ...legacyWeaponRecord,
            handsRequired: 2,
          },
        ],
      },
    },
  },
  {
    name: "party state parsing defaults missing user profiles",
    actual: parsePartyState({
      schemaVersion: 1,
      party: {
        id: "party-1",
        displayName: "Blackmarsh Table",
      },
      appState: storedAppState,
    })?.userProfiles,
    expected: [],
  },
  {
    name: "app state parsing preserves exposed advanced inventory fields",
    actual: parseAppState(advancedRecordAppState)?.inventoryRecords[0],
    expected: {
      ...advancedRecordAppState.inventoryRecords[0],
      handsRequired: 0,
    },
  },
  {
    name: "local app state persists through localStorage",
    actual: localRoundTripAppState,
    expected: {
      ...storedAppState,
      entities: [normalizedCharacterEntity],
      inventoryRecords: [
        {
          ...legacyWeaponRecord,
          handsRequired: 2,
        },
      ],
    },
  },
  {
    name: "coin record with quantity field rejects app state",
    actual: parseAppState({
      schemaVersion: 1,
      entities: [characterEntity],
      inventoryRecords: [coinRecordWithQuantity as unknown as InventoryRecord],
    }),
    expected: undefined,
  },
  {
    name: "coin record with burden field rejects app state",
    actual: parseAppState({
      schemaVersion: 1,
      entities: [characterEntity],
      inventoryRecords: [coinRecordWithBurden as unknown as InventoryRecord],
    }),
    expected: undefined,
  },
  {
    name: "coin record with treasure field rejects app state",
    actual: parseAppState({
      schemaVersion: 1,
      entities: [characterEntity],
      inventoryRecords: [coinRecordWithTreasure as unknown as InventoryRecord],
    }),
    expected: undefined,
  },
  {
    name: "coin record with weapon field rejects app state",
    actual: parseAppState({
      schemaVersion: 1,
      entities: [characterEntity],
      inventoryRecords: [coinRecordWithWeapon as unknown as InventoryRecord],
    }),
    expected: undefined,
  },
  {
    name: "coin record with armor field rejects app state",
    actual: parseAppState({
      schemaVersion: 1,
      entities: [characterEntity],
      inventoryRecords: [coinRecordWithArmor as unknown as InventoryRecord],
    }),
    expected: undefined,
  },
  {
    name: "coin record with container field rejects app state",
    actual: parseAppState({
      schemaVersion: 1,
      entities: [characterEntity],
      inventoryRecords: [coinRecordWithContainer as unknown as InventoryRecord],
    }),
    expected: undefined,
  },
  {
    name: "coin record with identification field rejects app state",
    actual: parseAppState({
      schemaVersion: 1,
      entities: [characterEntity],
      inventoryRecords: [coinRecordWithIdentification as unknown as InventoryRecord],
    }),
    expected: undefined,
  },
  {
    name: "invalid local app state falls back to empty state",
    actual: invalidLocalAppState,
    expected: createEmptyAppState(),
  },
  // --- Membership migration ---
  {
    name: "migratePartyMembership assigns current user as GM for unmigrated party",
    actual: (() => {
      const party = createPartyState({ partyId: "party-m1", displayName: "Old Party" });
      const migrated = migratePartyMembership(party, "uid-first-user");
      return { gmUid: migrated.party.gmUid, memberRole: migrated.party.members?.["uid-first-user"]?.role };
    })(),
    expected: { gmUid: "uid-first-user", memberRole: "gm" },
  },
  {
    name: "migratePartyMembership does not reassign GM on already-migrated party",
    actual: (() => {
      const party = createPartyState({
        partyId: "party-m2",
        gmUid: "uid-gm",
        members: { "uid-gm": { role: "gm" } },
      });
      const migrated = migratePartyMembership(party, "uid-gm");
      return migrated.party.gmUid;
    })(),
    expected: "uid-gm",
  },
  {
    name: "migratePartyMembership does not auto-add non-member to initialized party",
    actual: (() => {
      const party = createPartyState({
        partyId: "party-m3",
        gmUid: "uid-gm",
        members: { "uid-gm": { role: "gm" } },
      });
      const migrated = migratePartyMembership(party, "uid-non-member");
      return migrated.party.members?.["uid-non-member"]?.role;
    })(),
    expected: undefined,
  },
  {
    name: "migratePartyMembership repairs missing GM member record",
    actual: (() => {
      const party = createPartyState({ partyId: "party-m4", gmUid: "uid-gm" });
      const migrated = migratePartyMembership(party, "uid-gm");
      return migrated.party.members?.["uid-gm"]?.role;
    })(),
    expected: "gm",
  },
  {
    name: "migratePartyMembership repair does not auto-add non-GM current user",
    actual: (() => {
      const party = createPartyState({ partyId: "party-m4b", gmUid: "uid-gm" });
      const migrated = migratePartyMembership(party, "uid-non-member");
      return migrated.party.members?.["uid-non-member"]?.role;
    })(),
    expected: undefined,
  },
  {
    name: "parsePartyState preserves gmUid and members from stored data",
    actual: (() => {
      const parsed = parsePartyState({
        schemaVersion: 1,
        party: {
          id: "party-m5",
          displayName: "Test",
          gmUid: "uid-gm",
          members: { "uid-gm": { role: "gm", joinedAt: "2026-01-01T00:00:00.000Z" } },
        },
        appState: { schemaVersion: 1, entities: [], inventoryRecords: [], auditLog: [] },
        userProfiles: [],
      });
      return { gmUid: parsed?.party.gmUid, memberRole: parsed?.party.members?.["uid-gm"]?.role };
    })(),
    expected: { gmUid: "uid-gm", memberRole: "gm" },
  },
  {
    name: "parsePartyState accepts party without gmUid (old format)",
    actual: (() => {
      const parsed = parsePartyState({
        schemaVersion: 1,
        party: { id: "party-m6", displayName: "Old" },
        appState: { schemaVersion: 1, entities: [], inventoryRecords: [], auditLog: [] },
        userProfiles: [],
      });
      return { gmUid: parsed?.party.gmUid, members: parsed?.party.members };
    })(),
    expected: { gmUid: undefined, members: undefined },
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

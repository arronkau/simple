import {
  APP_STATE_STORAGE_KEY,
  CORRUPT_PARTY_STATE_STORAGE_KEY_PREFIX,
  assignPartyGm,
  classifyStoredPartyState,
  createEmptyAppState,
  createPartyState,
  formatUnreadablePartyStateWarning,
  getCorruptPartyStateStorageKey,
  deleteLocalPartyState,
  forgetIndexedParty,
  getLocalPartyStateStorageKey,
  migratePartyMembership,
  parsePartyIndex,
  parsePartyState,
  parseAppState,
  readLocalAppState,
  readLocalPartyStateResult,
  repairPartyMembership,
  readPartyIndex,
  rememberOpenedParty,
  removePartyIndexEntry,
  renameIndexedParty,
  seedPartyIndexEntries,
  upsertPartyIndexEntry,
  writeLocalAppState,
  writeLocalPartyState,
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
    kind: "equipped",
    placement: "loose",
  },
  sortOrder: 1000,
  coins: {
    pp: 0,
    gp: 5,
    sp: 0,
    cp: 0,
  },
};

const legacyBackpackRecord: InventoryRecord = {
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
};

const legacyCoinPurseRecord = {
  id: "coins-legacy-1",
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
} as unknown as InventoryRecord;

const storageEntity: Entity = {
  id: "storage-1",
  name: "Cart",
  entityType: "storage",
  active: true,
  sortOrder: 1,
};

const storageCoinRecord: InventoryRecord = {
  id: "coins-storage-1",
  recordType: "coins",
  entityId: storageEntity.id,
  location: {
    kind: "contents",
  },
  sortOrder: 0,
  coins: {
    pp: 0,
    gp: 7,
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

const handCapacityContainerAppState = {
  schemaVersion: 1,
  entities: [characterEntity],
  inventoryRecords: [
    {
      id: "sack-1",
      recordType: "equipment",
      name: "Sack",
      entityId: characterEntity.id,
      location: { kind: "equipped", placement: "leftHand" },
      sortOrder: 0,
      quantity: 1,
      burden: { kind: "none" },
      handsRequired: 1,
      container: {
        capacityByHands: { oneHand: 6, twoHands: 12 },
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

const parsedPartyIndex = parsePartyIndex([
  {
    id: "party-a",
    displayName: "Alpha",
    lastOpenedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "party-b",
    displayName: "   ",
    lastOpenedAt: "2026-03-01T00:00:00.000Z",
  },
  {
    id: "party-a",
    displayName: "Duplicate",
    lastOpenedAt: "2026-09-01T00:00:00.000Z",
  },
  { id: "", displayName: "No id", lastOpenedAt: "2026-09-01T00:00:00.000Z" },
  "not an entry",
  { id: "party-c", displayName: "Gamma" },
]);

const partyIndexStorageRun = withMockLocalStorage((localStorage) => {
  writeLocalPartyState(
    createPartyState({ partyId: "party-old", displayName: "Old Table" }),
  );
  writeLocalPartyState(
    createPartyState({ partyId: "party-older", displayName: "Older Table" }),
  );

  const seededIndex = readPartyIndex();
  const openedIndex = rememberOpenedParty(
    "party-old",
    "Old Table",
    "2026-09-05T09:00:00.000Z",
  );
  const renamedIndex = renameIndexedParty("party-old", "Renamed Table");
  const forgottenIndex = forgetIndexedParty("party-older");
  const rereadIndex = readPartyIndex();
  const forgottenPartyStateRemains =
    localStorage.getItem(getLocalPartyStateStorageKey("party-older")) !== null;

  deleteLocalPartyState("party-older");

  return {
    seededIndex,
    openedIndex,
    renamedIndex,
    forgottenIndex,
    rereadIndex,
    forgottenPartyStateRemains,
    deletedPartyStateRemains:
      localStorage.getItem(getLocalPartyStateStorageKey("party-older")) !== null,
  };
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
    name: "app state parsing preserves hand-dependent container capacity",
    actual: parseAppState(handCapacityContainerAppState)?.inventoryRecords[0],
    expected: handCapacityContainerAppState.inventoryRecords[0],
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
  // --- Legacy coin-purse migration ---
  {
    name: "legacy coin-purse record migrates into the stowed root container",
    actual: parseAppState({
      schemaVersion: 1,
      entities: [characterEntity],
      inventoryRecords: [legacyBackpackRecord, legacyCoinPurseRecord],
    })?.inventoryRecords,
    expected: [
      legacyBackpackRecord,
      {
        ...legacyCoinPurseRecord,
        location: { kind: "container", containerId: "backpack-1" },
      },
    ],
  },
  {
    name: "legacy coin-purse record with no stowed root migrates to equipped loose",
    actual: parseAppState({
      schemaVersion: 1,
      entities: [characterEntity],
      inventoryRecords: [legacyCoinPurseRecord],
    })?.inventoryRecords,
    expected: [
      {
        ...legacyCoinPurseRecord,
        location: { kind: "equipped", placement: "loose" },
      },
    ],
  },
  {
    name: "non-character coin record is left where it is",
    actual: parseAppState({
      schemaVersion: 1,
      entities: [storageEntity],
      inventoryRecords: [storageCoinRecord],
    })?.inventoryRecords,
    expected: [storageCoinRecord],
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
  // --- GM assignment for a party document being created ---
  {
    name: "repairPartyMembership never hands GM to the reader",
    actual: (() => {
      const party = createPartyState({ partyId: "party-r1" });
      const repaired = repairPartyMembership(party);
      return { gmUid: repaired.party.gmUid, members: repaired.party.members };
    })(),
    expected: { gmUid: undefined, members: undefined },
  },
  {
    name: "repairPartyMembership restores a missing GM member entry",
    actual: (() => {
      const party = createPartyState({ partyId: "party-r2", gmUid: "uid-gm" });
      const repaired = repairPartyMembership(party);
      return {
        gmUid: repaired.party.gmUid,
        memberUids: Object.keys(repaired.party.members ?? {}),
        gmRole: repaired.party.members?.["uid-gm"]?.role,
      };
    })(),
    expected: { gmUid: "uid-gm", memberUids: ["uid-gm"], gmRole: "gm" },
  },
  {
    name: "assignPartyGm makes the creating uid GM and member",
    actual: (() => {
      const assigned = assignPartyGm(
        createPartyState({ partyId: "party-a1" }),
        "uid-creator",
        "2026-02-02T00:00:00.000Z",
      );
      return {
        gmUid: assigned.party.gmUid,
        gmEntry: assigned.party.members?.["uid-creator"],
      };
    })(),
    expected: {
      gmUid: "uid-creator",
      gmEntry: { role: "gm", joinedAt: "2026-02-02T00:00:00.000Z" },
    },
  },
  {
    name: "assignPartyGm replaces a cached GM identity and keeps other members",
    actual: (() => {
      const assigned = assignPartyGm(
        createPartyState({
          partyId: "party-a2",
          gmUid: "local-user-1",
          members: {
            "local-user-1": { role: "gm", joinedAt: "2026-01-01T00:00:00.000Z" },
            "uid-player": { role: "player", joinedAt: "2026-01-03T00:00:00.000Z" },
          },
        }),
        "uid-creator",
        "2026-02-02T00:00:00.000Z",
      );
      return {
        gmUid: assigned.party.gmUid,
        memberUids: Object.keys(assigned.party.members ?? {}),
        gmEntry: assigned.party.members?.["uid-creator"],
        staleEntry: assigned.party.members?.["local-user-1"],
        playerRole: assigned.party.members?.["uid-player"]?.role,
      };
    })(),
    expected: {
      gmUid: "uid-creator",
      memberUids: ["uid-player", "uid-creator"],
      gmEntry: { role: "gm", joinedAt: "2026-01-01T00:00:00.000Z" },
      staleEntry: undefined,
      playerRole: "player",
    },
  },
  {
    name: "assignPartyGm leaves an established GM untouched",
    actual: (() => {
      const party = createPartyState({
        partyId: "party-a3",
        gmUid: "uid-gm",
        members: { "uid-gm": { role: "gm", joinedAt: "2026-01-01T00:00:00.000Z" } },
      });
      return assignPartyGm(party, "uid-gm", "2026-02-02T00:00:00.000Z") === party;
    })(),
    expected: true,
  },
  // --- Unreadable stored party data ---
  {
    name: "classifyStoredPartyState reports absent for a missing value",
    actual: classifyStoredPartyState(null, "party-c1"),
    expected: { status: "absent" },
  },
  {
    name: "classifyStoredPartyState reports absent for a blank value",
    actual: classifyStoredPartyState("   ", "party-c1"),
    expected: { status: "absent" },
  },
  {
    name: "classifyStoredPartyState reports unreadable for invalid JSON",
    actual: classifyStoredPartyState("{not json", "party-c2"),
    expected: { status: "unreadable" },
  },
  {
    name: "classifyStoredPartyState reports unreadable for a future schema version",
    actual: classifyStoredPartyState(
      JSON.stringify({ schemaVersion: 2, party: { id: "party-c3" } }),
      "party-c3",
    ),
    expected: { status: "unreadable" },
  },
  {
    name: "classifyStoredPartyState reports unreadable for another party's data",
    actual: classifyStoredPartyState(
      JSON.stringify(createPartyState({ partyId: "party-other" })),
      "party-c4",
    ),
    expected: { status: "unreadable" },
  },
  {
    name: "classifyStoredPartyState returns readable stored party data",
    actual: classifyStoredPartyState(
      JSON.stringify(createPartyState({ partyId: "party-c5", displayName: "Keep" })),
      "party-c5",
    ),
    expected: {
      status: "readable",
      partyState: createPartyState({ partyId: "party-c5", displayName: "Keep" }),
    },
  },
  {
    name: "corrupt backup key namespaces party and timestamp",
    actual: getCorruptPartyStateStorageKey("party-c6", "2026-09-05T01:02:03.456Z"),
    expected:
      "simple.inventory.partyState.corrupt.v1.party-c6.2026-09-05T01:02:03.456Z",
  },
  {
    name: "unreadable party warning names the backup key and the import path",
    actual: formatUnreadablePartyStateWarning("backup-key-1"),
    expected:
      'Saved data for this party could not be read, so it was kept in browser storage as "backup-key-1" and the party opened empty. Restore a JSON export from Manage → Import JSON.',
  },
  {
    name: "unreadable local party data is copied to a backup key",
    actual: withMockLocalStorage((localStorage) => {
      const partyKey = getLocalPartyStateStorageKey("party-corrupt");
      localStorage.setItem(partyKey, "{not json");

      const result = readLocalPartyStateResult("party-corrupt");

      return {
        partyId: result.partyState.party.id,
        entityCount: result.partyState.appState.entities.length,
        backupKeyPrefixed:
          result.backupKey?.startsWith(
            `${CORRUPT_PARTY_STATE_STORAGE_KEY_PREFIX}party-corrupt.`,
          ) ?? false,
        backupValue: result.backupKey
          ? localStorage.getItem(result.backupKey)
          : undefined,
        originalValue: localStorage.getItem(partyKey),
        warningNamesBackupKey:
          result.backupKey !== undefined &&
          (result.warning?.includes(result.backupKey) ?? false),
        warningPointsToImport:
          result.warning?.includes("Manage → Import JSON") ?? false,
      };
    }),
    expected: {
      partyId: "party-corrupt",
      entityCount: 0,
      backupKeyPrefixed: true,
      backupValue: "{not json",
      originalValue: "{not json",
      warningNamesBackupKey: true,
      warningPointsToImport: true,
    },
  },
  {
    name: "backed-up party data survives the write that follows an unreadable read",
    actual: withMockLocalStorage((localStorage) => {
      const partyKey = getLocalPartyStateStorageKey("party-corrupt-2");
      localStorage.setItem(partyKey, '{"schemaVersion":99}');

      const result = readLocalPartyStateResult("party-corrupt-2");
      // What the store does immediately after loading a party.
      writeLocalPartyState(result.partyState);

      return {
        backupValue: result.backupKey
          ? localStorage.getItem(result.backupKey)
          : undefined,
        partyKeyOverwritten:
          localStorage.getItem(partyKey) === JSON.stringify(result.partyState),
      };
    }),
    expected: {
      backupValue: '{"schemaVersion":99}',
      partyKeyOverwritten: true,
    },
  },
  {
    name: "readable local party data is returned without a warning",
    actual: withMockLocalStorage(() => {
      writeLocalPartyState(
        createPartyState({ partyId: "party-readable", displayName: "Blackmarsh" }),
      );

      const result = readLocalPartyStateResult("party-readable");

      return {
        displayName: result.partyState.party.displayName,
        backupKey: result.backupKey,
        warning: result.warning,
      };
    }),
    expected: {
      displayName: "Blackmarsh",
      backupKey: undefined,
      warning: undefined,
    },
  },
  {
    name: "absent local party data opens an empty party without a warning",
    actual: withMockLocalStorage((localStorage) => {
      const result = readLocalPartyStateResult("party-absent");

      return {
        partyId: result.partyState.party.id,
        storedKeyCount: localStorage.length,
        backupKey: result.backupKey,
        warning: result.warning,
      };
    }),
    expected: {
      partyId: "party-absent",
      storedKeyCount: 0,
      backupKey: undefined,
      warning: undefined,
    },
  },
  {
    name: "party index parse drops unusable entries and sorts by last opened",
    actual: parsedPartyIndex,
    expected: [
      {
        id: "party-b",
        displayName: "New Party",
        lastOpenedAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "party-a",
        displayName: "Alpha",
        lastOpenedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "party-c",
        displayName: "Gamma",
        lastOpenedAt: "1970-01-01T00:00:00.000Z",
      },
    ],
  },
  {
    name: "party index upsert replaces an entry and moves it to the top",
    actual: upsertPartyIndexEntry(parsedPartyIndex, {
      id: "party-a",
      displayName: "Alpha Table",
      lastOpenedAt: "2026-09-05T09:00:00.000Z",
    }),
    expected: [
      {
        id: "party-a",
        displayName: "Alpha Table",
        lastOpenedAt: "2026-09-05T09:00:00.000Z",
      },
      {
        id: "party-b",
        displayName: "New Party",
        lastOpenedAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "party-c",
        displayName: "Gamma",
        lastOpenedAt: "1970-01-01T00:00:00.000Z",
      },
    ],
  },
  {
    name: "party index remove drops only the named party",
    actual: removePartyIndexEntry(parsedPartyIndex, "party-b"),
    expected: [
      {
        id: "party-a",
        displayName: "Alpha",
        lastOpenedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "party-c",
        displayName: "Gamma",
        lastOpenedAt: "1970-01-01T00:00:00.000Z",
      },
    ],
  },
  {
    name: "party index seed adds unknown parties and leaves known ones alone",
    actual: seedPartyIndexEntries(parsedPartyIndex, [
      {
        id: "party-c",
        displayName: "Ignored rename",
        lastOpenedAt: "2026-09-01T00:00:00.000Z",
      },
      {
        id: "party-d",
        displayName: "Delta",
        lastOpenedAt: "1970-01-01T00:00:00.000Z",
      },
    ]),
    expected: [
      {
        id: "party-b",
        displayName: "New Party",
        lastOpenedAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "party-a",
        displayName: "Alpha",
        lastOpenedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "party-d",
        displayName: "Delta",
        lastOpenedAt: "1970-01-01T00:00:00.000Z",
      },
      {
        id: "party-c",
        displayName: "Gamma",
        lastOpenedAt: "1970-01-01T00:00:00.000Z",
      },
    ],
  },
  {
    name: "party index seeding skips unreadable parties and writes no backup",
    actual: withMockLocalStorage((localStorage) => {
      writeLocalPartyState(
        createPartyState({ partyId: "party-good", displayName: "Good Table" }),
      );
      localStorage.setItem(
        getLocalPartyStateStorageKey("party-broken"),
        "{not json",
      );

      const seededIndex = readPartyIndex();
      const corruptKeys: string[] = [];

      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);

        if (key?.startsWith(CORRUPT_PARTY_STATE_STORAGE_KEY_PREFIX)) {
          corruptKeys.push(key);
        }
      }

      return { seededIndex, corruptKeys };
    }),
    expected: {
      seededIndex: [
        {
          id: "party-good",
          displayName: "Good Table",
          lastOpenedAt: "1970-01-01T00:00:00.000Z",
        },
      ],
      corruptKeys: [],
    },
  },
  {
    name: "party index seeds once from stored party states",
    actual: partyIndexStorageRun.seededIndex,
    expected: [
      {
        id: "party-old",
        displayName: "Old Table",
        lastOpenedAt: "1970-01-01T00:00:00.000Z",
      },
      {
        id: "party-older",
        displayName: "Older Table",
        lastOpenedAt: "1970-01-01T00:00:00.000Z",
      },
    ],
  },
  {
    name: "party index records opens and renames without losing the open time",
    actual: {
      opened: partyIndexStorageRun.openedIndex,
      renamed: partyIndexStorageRun.renamedIndex,
    },
    expected: {
      opened: [
        {
          id: "party-old",
          displayName: "Old Table",
          lastOpenedAt: "2026-09-05T09:00:00.000Z",
        },
        {
          id: "party-older",
          displayName: "Older Table",
          lastOpenedAt: "1970-01-01T00:00:00.000Z",
        },
      ],
      renamed: [
        {
          id: "party-old",
          displayName: "Renamed Table",
          lastOpenedAt: "2026-09-05T09:00:00.000Z",
        },
        {
          id: "party-older",
          displayName: "Older Table",
          lastOpenedAt: "1970-01-01T00:00:00.000Z",
        },
      ],
    },
  },
  {
    name: "forgetting a party keeps its stored state and is not re-seeded",
    actual: {
      forgotten: partyIndexStorageRun.forgottenIndex,
      reread: partyIndexStorageRun.rereadIndex,
      forgottenPartyStateRemains:
        partyIndexStorageRun.forgottenPartyStateRemains,
      deletedPartyStateRemains: partyIndexStorageRun.deletedPartyStateRemains,
    },
    expected: {
      forgotten: [
        {
          id: "party-old",
          displayName: "Renamed Table",
          lastOpenedAt: "2026-09-05T09:00:00.000Z",
        },
      ],
      reread: [
        {
          id: "party-old",
          displayName: "Renamed Table",
          lastOpenedAt: "2026-09-05T09:00:00.000Z",
        },
      ],
      forgottenPartyStateRemains: true,
      deletedPartyStateRemains: false,
    },
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

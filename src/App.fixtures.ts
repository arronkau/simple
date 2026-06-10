import { getPartyOverviewCards } from "./pages/PartyPage";
import {
  getAuditEntityFilterOptions,
  getFilteredAuditLogEntries,
} from "./audit/AuditPage";
import {
  parseImportedAppState,
  parseImportedAppStateResult,
} from "./modals/ManageDataModal";
import {
  getAuditEntryDisplay,
  getDeleteConfirmationMessage,
  getRecordDisplayName,
} from "./formatters";
import type { AppState } from "./model/appState";
import { createEmptyCharacterData } from "./model/characters";
import {
  createDefaultBackpack,
  type AuditLogEntry,
  type InventoryRecord,
} from "./model/types";

const emptyCoinRecord: InventoryRecord = {
  id: "coins-empty",
  recordType: "coins",
  entityId: "character-1",
  location: {
    kind: "coinPurse",
  },
  sortOrder: 0,
  coins: {
    pp: 0,
    gp: 0,
    sp: 0,
    cp: 0,
  },
};

const valuableCoinRecord: InventoryRecord = {
  ...emptyCoinRecord,
  id: "coins-valuable",
  coins: {
    pp: 0,
    gp: 12,
    sp: 35,
    cp: 0,
  },
};

const zeroTreasureRecord: InventoryRecord = {
  id: "treasure-zero",
  recordType: "treasure",
  name: "Plain stone",
  entityId: "storage-1",
  location: {
    kind: "contents",
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  treasure: {
    gpValue: 0,
  },
};

const valuableTreasureRecord: InventoryRecord = {
  ...zeroTreasureRecord,
  id: "treasure-valuable",
  name: "Silver plate",
  treasure: {
    gpValue: 50,
  },
};

const topLevelStowedContainerRecord = createDefaultBackpack({
  entityId: "character-1",
  id: "backpack-1",
});

const emptyContainerRecord: InventoryRecord = {
  id: "container-empty",
  recordType: "equipment",
  name: "Sack",
  entityId: "character-1",
  location: {
    kind: "equipped",
    placement: "loose",
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 0,
  container: {
    capacitySlots: 6,
  },
};

const nonEmptyContainerRecord: InventoryRecord = {
  ...emptyContainerRecord,
  id: "container-non-empty",
};

const childRecord: InventoryRecord = {
  id: "container-child",
  recordType: "equipment",
  name: "Torch",
  entityId: "character-1",
  location: {
    kind: "container",
    containerId: nonEmptyContainerRecord.id,
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 0,
};

const ordinaryRecord: InventoryRecord = {
  id: "ordinary-1",
  recordType: "equipment",
  name: "Rope",
  entityId: "character-1",
  location: {
    kind: "equipped",
    placement: "loose",
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 0,
};

const auditFilterAppState: AppState = {
  schemaVersion: 1,
  entities: [
    {
      id: "entity-active",
      active: true,
      entityType: "character",
      name: "Active Entity",
      sortOrder: 0,
    },
  ],
  inventoryRecords: [],
  auditLog: [
    {
      id: "audit-1",
      actorLabel: "Local user",
      createdAt: "2026-06-03T10:00:00.000Z",
      entityId: "entity-active",
      eventType: "entityCreated",
      summary: "Created active entity.",
    },
    {
      id: "audit-2",
      actorLabel: "Local user",
      createdAt: "2026-06-03T11:00:00.000Z",
      entityId: "entity-deleted",
      eventType: "entityDeleted",
      summary: "Deleted old entity.",
    },
    {
      id: "audit-3",
      actorLabel: "Local user",
      createdAt: "2026-06-03T12:00:00.000Z",
      entityId: "entity-active",
      eventType: "coinsChanged",
      summary: "Changed coins.",
    },
  ],
};

const exportedAppState = {
  version: 1,
  exportedAt: "2026-06-04T12:00:00.000Z",
  data: auditFilterAppState,
};

const auditDisplayEntry: AuditLogEntry = {
  id: "audit-display-1",
  actorLabel: "Yost",
  createdAt: "2026-06-03T16:32:00.000Z",
  entityId: "entity-active",
  eventType: "coinsChanged",
  summary: "Yost spent 20 gp — bought some nice cheese",
};

const partyCharacterId = "party-character";
const partyRetainerId = "party-retainer";
const partyStorageId = "party-storage";
const partyBackpackRecord = createDefaultBackpack({
  entityId: partyCharacterId,
  id: "party-backpack",
});
const partyTorchRecord: InventoryRecord = {
  id: "party-torch",
  recordType: "equipment",
  name: "Torch",
  entityId: partyCharacterId,
  location: {
    kind: "equipped",
    placement: "leftHand",
  },
  sortOrder: 1,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 1,
  light: {
    isLit: true,
    lightDescription: "30' radius",
  },
};
const partyShieldRecord: InventoryRecord = {
  id: "party-shield",
  recordType: "armor",
  name: "Shield",
  entityId: partyCharacterId,
  location: {
    kind: "equipped",
    placement: "rightHand",
  },
  sortOrder: 2,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 1,
  armor: {
    armorBonus: 1,
  },
};
const partyOverviewAppState: AppState = {
  schemaVersion: 1,
  entities: [
    {
      id: partyCharacterId,
      active: true,
      entityType: "character",
      name: "Yost",
      sortOrder: 0,
      character: {
        ...createEmptyCharacterData(),
        className: "Fighter",
        level: 2,
        hp: {
          current: 5,
          max: 8,
        },
        languages: ["Common", "Elvish"],
      },
    },
    {
      id: partyRetainerId,
      active: true,
      entityType: "retainer",
      name: "Nessa",
      sortOrder: 1,
      character: {
        ...createEmptyCharacterData(),
        className: "Torchbearer",
      },
    },
    {
      id: partyStorageId,
      active: true,
      entityType: "storage",
      name: "Camp chest",
      sortOrder: 2,
    },
  ],
  inventoryRecords: [
    partyBackpackRecord,
    partyTorchRecord,
    partyShieldRecord,
  ],
  auditLog: [],
};
const validEmptyExport = {
  version: 1,
  exportedAt: "2026-06-06T12:00:00.000Z",
  data: {
    schemaVersion: 1,
    entities: [],
    inventoryRecords: [],
    auditLog: [],
  },
};
const invalidLocationExport = {
  version: 1,
  exportedAt: "2026-06-06T12:00:00.000Z",
  data: {
    schemaVersion: 1,
    entities: [],
    inventoryRecords: [
      {
        id: "bad-location-record",
        entityId: "entity-1",
        recordType: "equipment",
        name: "Bad Location",
        location: {
          kind: "badKind",
        },
        sortOrder: 0,
        quantity: 1,
        burden: {
          kind: "fixed",
          slotsPerItem: 1,
        },
      },
    ],
    auditLog: [],
  },
};

export const APP_MANUAL_FIXTURES = [
  {
    name: "coin display is safe for unnamed coin records",
    actual: {
      emptyCoins: getRecordDisplayName(emptyCoinRecord),
      valuableCoins: getRecordDisplayName(valuableCoinRecord),
    },
    expected: {
      emptyCoins: "Coins",
      valuableCoins: "Coins",
    },
  },
  {
    name: "delete confirmations call out valuable and container records",
    actual: {
      emptyCoin: getDeleteConfirmationMessage(emptyCoinRecord),
      valuableCoin: getDeleteConfirmationMessage(valuableCoinRecord),
      zeroTreasure: getDeleteConfirmationMessage(zeroTreasureRecord),
      valuableTreasure: getDeleteConfirmationMessage(valuableTreasureRecord),
      topLevelStowedContainer: getDeleteConfirmationMessage(topLevelStowedContainerRecord),
      emptyContainer: getDeleteConfirmationMessage(emptyContainerRecord),
      nonEmptyContainer: getDeleteConfirmationMessage(nonEmptyContainerRecord, [
        nonEmptyContainerRecord,
        childRecord,
      ]),
      ordinary: getDeleteConfirmationMessage(ordinaryRecord),
    },
    expected: {
      emptyCoin: "Confirm delete empty coin record?",
      valuableCoin:
        "Confirm delete coin record containing 12 gp, 35 sp worth 15.5 gp?",
      zeroTreasure:
        'Confirm delete treasure "Plain stone" with no recorded gp value?',
      valuableTreasure: 'Confirm delete treasure "Silver plate" worth 50 gp?',
      topLevelStowedContainer:
        'Confirm delete stowed container "Backpack" with 16 slots capacity? This may make stowed inventory invalid.',
      emptyContainer:
        'Confirm delete empty container "Sack" with 6 slots capacity?',
      nonEmptyContainer:
        'Confirm delete non-empty container "Sack" containing 1 record? This is blocked until the contents are moved.',
      ordinary: 'Confirm delete "Rope"?',
    },
  },
  {
    name: "audit log helper derives current and historical entity filters",
    actual: getAuditEntityFilterOptions(auditFilterAppState),
    expected: [
      {
        label: "Active Entity",
        value: "entity-active",
      },
      {
        label: "entity-deleted",
        value: "entity-deleted",
      },
    ],
  },
  {
    name: "audit log helper filters newest-first entries",
    actual: getFilteredAuditLogEntries(
      auditFilterAppState.auditLog,
      "entity-active",
      "coinsChanged",
    ).map((entry) => entry.id),
    expected: ["audit-3"],
  },
  {
    name: "audit log display is concise and human readable",
    actual: getAuditEntryDisplay(auditDisplayEntry),
    expected: {
      summary: "Yost spent 20 gp — bought some nice cheese",
      timestamp: new Date(auditDisplayEntry.createdAt).toLocaleTimeString(
        "en-US",
        {
          hour: "numeric",
          minute: "2-digit",
        },
      ),
      metaLabels: ["Coins changed", "Yost"],
    },
  },
  {
    name: "party overview cards summarize characters and retainers",
    actual: getPartyOverviewCards(partyOverviewAppState).map((card) => ({
      name: card.name,
      entityType: card.entityType,
      classLevel: card.classLevel,
      hp: card.hp,
      hurt: card.hurt,
      movement: card.movement,
      ac: card.ac,
      abilityScores: card.abilityScores,
      languages: card.languages,
      hands: card.hands,
      warningCount: card.warningCount,
      warningSummary: card.warningSummary,
    })),
    expected: [
      {
        name: "Yost",
        entityType: "character",
        classLevel: "Fighter 2",
        hp: "5/8",
        hurt: true,
        movement: "120'",
        ac: "AC 11",
        abilityScores: [
          { label: "S", value: "—" },
          { label: "I", value: "—" },
          { label: "W", value: "—" },
          { label: "D", value: "—" },
          { label: "C", value: "—" },
          { label: "Ch", value: "—" },
        ],
        languages: "Common, Elvish",
        hands: ["L: Torch [lit]", "R: Shield [active AC]"],
        warningCount: 0,
        warningSummary: "No warnings",
      },
      {
        name: "Nessa",
        entityType: "retainer",
        classLevel: "Torchbearer",
        hp: "—/—",
        hurt: false,
        movement: "120'",
        ac: "AC 10",
        abilityScores: [
          { label: "S", value: "—" },
          { label: "I", value: "—" },
          { label: "W", value: "—" },
          { label: "D", value: "—" },
          { label: "C", value: "—" },
          { label: "Ch", value: "—" },
        ],
        languages: "None",
        hands: ["L: Empty", "R: Empty"],
        warningCount: 1,
        warningSummary: "1 warning",
      },
    ],
  },
  {
    name: "import parser accepts current export wrapper",
    actual: parseImportedAppState(exportedAppState),
    expected: {
      ...auditFilterAppState,
      entities: [
        {
          ...auditFilterAppState.entities[0],
          character: createEmptyCharacterData(),
        },
      ],
    },
  },
  {
    name: "import parser rejects malformed export data",
    actual: parseImportedAppState({
      ...exportedAppState,
      data: {
        ...auditFilterAppState,
        inventoryRecords: [
          {
            id: "bad-record",
            recordType: "equipment",
            entityId: "entity-active",
            location: {
              kind: "container",
            },
            sortOrder: 0,
          },
        ],
      },
    }),
    expected: undefined,
  },
  {
    name: "import validation reports missing export data object",
    actual: parseImportedAppStateResult({}),
    expected: {
      ok: false,
      path: "data",
      message: 'Missing top-level "data" object.',
    },
  },
  {
    name: "import validation reports unsupported export version",
    actual: parseImportedAppStateResult({
      version: 2,
      exportedAt: "2026-06-06T12:00:00.000Z",
      data: validEmptyExport.data,
    }),
    expected: {
      ok: false,
      path: "version",
      message: "Unsupported export version: 2.",
    },
  },
  {
    name: "import validation reports missing entities array",
    actual: parseImportedAppStateResult({
      version: 1,
      exportedAt: "2026-06-06T12:00:00.000Z",
      data: {
        schemaVersion: 1,
      },
    }),
    expected: {
      ok: false,
      path: "data.entities",
      message: '"data.entities" must be an array.',
    },
  },
  {
    name: "import validation reports invalid nested inventory location",
    actual: parseImportedAppStateResult(invalidLocationExport),
    expected: {
      ok: false,
      path: "data.inventoryRecords[0].location.kind",
      message: "Invalid location kind.",
    },
  },
  {
    name: "import validation accepts valid empty export",
    actual: parseImportedAppStateResult(validEmptyExport),
    expected: {
      ok: true,
      value: validEmptyExport.data,
    },
  },
];

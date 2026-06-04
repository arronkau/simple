import {
  getAuditEntityFilterOptions,
  getDeleteConfirmationMessage,
  getFilteredAuditLogEntries,
  getRecordDisplayName,
} from "./App";
import type { AppState } from "./model/appState";
import { createDefaultBackpack, type InventoryRecord } from "./model/types";

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

const backpackRecord = createDefaultBackpack({
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
      backpack: getDeleteConfirmationMessage(backpackRecord),
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
      backpack:
        'Confirm delete backpack "Backpack" with 16 slots capacity? This may make stowed inventory invalid.',
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
];

import {
  MOVEMENT_SLOT_BURDEN_OPTIONS,
  getCoinCount,
  getCoinGpValue,
  getCoinSlotBurden,
  getContainerSlotUsage,
  getContentsSlots,
  getEffectiveRecordAndContentsSlotBurden,
  getRecordSlotBurden,
  getTotalEntitySlots,
} from "./calculations";
import type { Entity, InventoryRecord } from "./types";

const storageEntity: Entity = {
  id: "storage-1",
  name: "Storage",
  entityType: "storage",
  active: true,
  sortOrder: 0,
  capacitySlots: 20,
};

const characterEntity: Entity = {
  id: "character-1",
  name: "Morgan",
  entityType: "character",
  active: true,
  sortOrder: 0,
};

const coinsRecord: InventoryRecord = {
  id: "coins-1",
  recordType: "coins",
  location: {
    entityId: "character-1",
    locationType: "stowed",
    placement: "coinPurse",
  },
  sortOrder: 0,
  slotProfile: { kind: "coins" },
  coins: {
    pp: 0,
    gp: 12,
    sp: 35,
    cp: 80,
  },
};

const crateRecord: InventoryRecord = {
  id: "crate-1",
  recordType: "equipment",
  name: "Crate",
  location: {
    entityId: "storage-1",
    locationType: "contents",
    placement: "contents",
  },
  sortOrder: 0,
  slotProfile: { kind: "fixed", slots: 2 },
  container: {
    capacitySlots: 8,
    burdenMode: "containerPlusContents",
  },
};

const ropeRecord: InventoryRecord = {
  id: "rope-1",
  recordType: "equipment",
  name: "Rope",
  location: {
    entityId: "storage-1",
    locationType: "contents",
    placement: "container",
    containerId: "crate-1",
  },
  sortOrder: 0,
  slotProfile: { kind: "fixed", slots: 1 },
};

const torchRecord: InventoryRecord = {
  id: "torches-1",
  recordType: "equipment",
  name: "Torches",
  location: {
    entityId: "storage-1",
    locationType: "contents",
    placement: "container",
    containerId: "crate-1",
  },
  sortOrder: 1000,
  slotProfile: { kind: "stackable", quantity: 6, perSlot: 3 },
};

const sackRecord: InventoryRecord = {
  id: "sack-1",
  recordType: "equipment",
  name: "Sack",
  location: {
    entityId: "character-1",
    locationType: "equipped",
    placement: "rightHand",
  },
  sortOrder: 0,
  slotProfile: { kind: "fixed", slots: 1 },
  container: {
    capacitySlots: 6,
    handsRequired: 1,
  },
};

const rationsRecord: InventoryRecord = {
  id: "rations-1",
  recordType: "equipment",
  name: "Rations",
  location: {
    entityId: "character-1",
    locationType: "stowed",
    placement: "container",
    containerId: "sack-1",
  },
  sortOrder: 0,
  slotProfile: { kind: "fixed", slots: 3 },
};

const capacityRecords = [crateRecord, ropeRecord, torchRecord];
const heldContainerRecords = [sackRecord, rationsRecord];

export const CALCULATION_MANUAL_FIXTURES = [
  {
    name: "coins count, value, and slots",
    actual: {
      coinCount: getCoinCount(coinsRecord.coins),
      coinGpValue: getCoinGpValue(coinsRecord.coins),
      coinSlots: getCoinSlotBurden(coinsRecord.coins),
    },
    expected: {
      coinCount: 127,
      coinGpValue: 16.3,
      coinSlots: 2,
    },
  },
  {
    name: "containerPlusContents includes container base and descendants",
    actual: {
      crateBaseSlots: getRecordSlotBurden(crateRecord),
      crateUsedSlots: getContainerSlotUsage(crateRecord, capacityRecords),
      crateTotalSlots: getEffectiveRecordAndContentsSlotBurden(
        crateRecord,
        capacityRecords,
      ),
      contentsSlots: getContentsSlots(storageEntity, capacityRecords),
      totalEntitySlots: getTotalEntitySlots(storageEntity, capacityRecords),
    },
    expected: {
      crateBaseSlots: 2,
      crateUsedSlots: {
        usedSlots: 3,
        capacitySlots: 8,
      },
      crateTotalSlots: 5,
      contentsSlots: 5,
      totalEntitySlots: 5,
    },
  },
  {
    name: "held hands-required container remains visible but excludes movement burden",
    actual: {
      visibleContainerUsage: getContainerSlotUsage(
        sackRecord,
        heldContainerRecords,
      ),
      normalTotalEntitySlots: getTotalEntitySlots(
        characterEntity,
        heldContainerRecords,
      ),
      movementTotalEntitySlots: getTotalEntitySlots(
        characterEntity,
        heldContainerRecords,
        MOVEMENT_SLOT_BURDEN_OPTIONS,
      ),
    },
    expected: {
      visibleContainerUsage: {
        usedSlots: 3,
        capacitySlots: 6,
      },
      normalTotalEntitySlots: 3,
      movementTotalEntitySlots: 0,
    },
  },
];

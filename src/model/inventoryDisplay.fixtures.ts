import { createDefaultBackpack, type Entity, type InventoryRecord } from "./types";
import { getContainerContents, getInventorySections } from "./inventoryDisplay";
import { getCharacterEncumbrance, getContentsCapacity } from "./encumbrance";
import { getContainerSlotUsage, getRecordSlotBurden } from "./calculations";

const characterEntity: Entity = {
  id: "character-1",
  name: "Morgan",
  entityType: "character",
  active: true,
  sortOrder: 0,
};

const retainerEntity: Entity = {
  id: "retainer-1",
  name: "Tamsin",
  entityType: "retainer",
  active: true,
  sortOrder: 1000,
};

const mountEntity: Entity = {
  id: "mount-1",
  name: "Mule",
  entityType: "mount",
  active: true,
  sortOrder: 2000,
  capacitySlots: 12,
};

const vehicleEntity: Entity = {
  id: "vehicle-1",
  name: "Cart",
  entityType: "vehicle",
  active: true,
  sortOrder: 3000,
  capacitySlots: 20,
};

const storageEntity: Entity = {
  id: "storage-1",
  name: "Vault",
  entityType: "storage",
  active: true,
  sortOrder: 4000,
  capacitySlots: 10,
};

const characterBackpack = createDefaultBackpack({
  entityId: characterEntity.id,
  id: "character-backpack-1",
});

const retainerBackpack = createDefaultBackpack({
  entityId: retainerEntity.id,
  id: "retainer-backpack-1",
});

const swordRecord: InventoryRecord = {
  id: "sword-1",
  recordType: "weapon",
  name: "Sword",
  entityId: characterEntity.id,
  location: {
    kind: "equipped",
    placement: "rightHand",
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 1,
  weapon: {
    damage: "1d8",
  },
};

const armorRecord: InventoryRecord = {
  id: "armor-1",
  recordType: "armor",
  name: "Chain",
  entityId: characterEntity.id,
  location: {
    kind: "equipped",
    placement: "loose",
  },
  sortOrder: 1000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 2 },
  armor: {
    baseArmorClass: 14,
  },
};

const coinsRecord: InventoryRecord = {
  id: "coins-1",
  recordType: "coins",
  entityId: characterEntity.id,
  location: {
    kind: "coinPurse",
  },
  sortOrder: 2000,
  coins: {
    pp: 0,
    gp: 125,
    sp: 0,
    cp: 0,
  },
};

const ropeRecord: InventoryRecord = {
  id: "rope-1",
  recordType: "equipment",
  name: "Rope",
  entityId: characterEntity.id,
  location: {
    kind: "container",
    containerId: characterBackpack.id,
  },
  sortOrder: 3000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
};

const sackRecord: InventoryRecord = {
  id: "sack-1",
  recordType: "equipment",
  name: "Sack",
  entityId: characterEntity.id,
  location: {
    kind: "container",
    containerId: characterBackpack.id,
  },
  sortOrder: 4000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 1,
  container: {
    capacitySlots: 6,
  },
};

const rationsRecord: InventoryRecord = {
  id: "rations-1",
  recordType: "equipment",
  name: "Rations",
  entityId: characterEntity.id,
  location: {
    kind: "container",
    containerId: sackRecord.id,
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 3 },
};

const retainerDagger: InventoryRecord = {
  id: "retainer-dagger-1",
  recordType: "weapon",
  name: "Dagger",
  entityId: retainerEntity.id,
  location: {
    kind: "equipped",
    placement: "leftHand",
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 1,
  weapon: {},
};

const mountFeedRecord: InventoryRecord = {
  id: "mount-feed-1",
  recordType: "equipment",
  name: "Feed",
  entityId: mountEntity.id,
  location: {
    kind: "contents",
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 4 },
};

const vehicleCrateRecord: InventoryRecord = {
  id: "vehicle-crate-1",
  recordType: "equipment",
  name: "Crate",
  entityId: vehicleEntity.id,
  location: {
    kind: "contents",
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 2 },
  container: {
    capacitySlots: 8,
  },
};

const vehicleToolsRecord: InventoryRecord = {
  id: "vehicle-tools-1",
  recordType: "equipment",
  name: "Tools",
  entityId: vehicleEntity.id,
  location: {
    kind: "container",
    containerId: vehicleCrateRecord.id,
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 3 },
};

const storageTreasureRecord: InventoryRecord = {
  id: "storage-treasure-1",
  recordType: "treasure",
  name: "Silver plate",
  entityId: storageEntity.id,
  location: {
    kind: "contents",
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 2 },
  treasure: {
    gpValue: 50,
  },
};

const sampleRecords = [
  characterBackpack,
  retainerBackpack,
  swordRecord,
  armorRecord,
  coinsRecord,
  ropeRecord,
  sackRecord,
  rationsRecord,
  retainerDagger,
  mountFeedRecord,
  vehicleCrateRecord,
  vehicleToolsRecord,
  storageTreasureRecord,
];

const characterSections = getInventorySections(characterEntity, sampleRecords);
const retainerSections = getInventorySections(retainerEntity, sampleRecords);
const mountSections = getInventorySections(mountEntity, sampleRecords);
const vehicleSections = getInventorySections(vehicleEntity, sampleRecords);
const storageSections = getInventorySections(storageEntity, sampleRecords);

const unsortedContentsRecords: InventoryRecord[] = [
  {
    id: "contents-late",
    recordType: "equipment",
    name: "Late",
    entityId: storageEntity.id,
    location: { kind: "contents" },
    sortOrder: 2000,
    quantity: 1,
    burden: { kind: "fixed", slotsPerItem: 1 },
  },
  {
    id: "contents-early",
    recordType: "equipment",
    name: "Early",
    entityId: storageEntity.id,
    location: { kind: "contents" },
    sortOrder: 0,
    quantity: 1,
    burden: { kind: "fixed", slotsPerItem: 1 },
  },
  {
    id: "container-late",
    recordType: "equipment",
    name: "Nested late",
    entityId: storageEntity.id,
    location: { kind: "container", containerId: "contents-late" },
    sortOrder: 1000,
    quantity: 1,
    burden: { kind: "fixed", slotsPerItem: 1 },
  },
  {
    id: "container-early",
    recordType: "equipment",
    name: "Nested early",
    entityId: storageEntity.id,
    location: { kind: "container", containerId: "contents-late" },
    sortOrder: 0,
    quantity: 1,
    burden: { kind: "fixed", slotsPerItem: 1 },
  },
];
const unsortedContentsSections = getInventorySections(
  storageEntity,
  unsortedContentsRecords,
);

export const INVENTORY_DISPLAY_MANUAL_FIXTURES = [
  {
    name: "character inventory sections include hands, other equipped, coin purse, and backpack",
    actual: {
      mode: characterSections.mode,
      rightHand:
        characterSections.mode === "characterLike"
          ? characterSections.handRecordIds.rightHand
          : undefined,
      otherEquipped:
        characterSections.mode === "characterLike"
          ? characterSections.otherEquipped.map((record) => record.id)
          : [],
      coinRecord:
        characterSections.mode === "characterLike"
          ? characterSections.coinRecord?.id
          : undefined,
      topLevelStowedContainerContents:
        characterSections.mode === "characterLike"
          ? characterSections.topLevelStowedContainerContents.map((record) => record.id)
          : [],
      sackContents: getContainerContents(sackRecord, sampleRecords).map(
        (record) => record.id,
      ),
      encumbrance: getCharacterEncumbrance(characterEntity, sampleRecords),
      backpackUsage: getContainerSlotUsage(characterBackpack, sampleRecords),
      sackUsage: getContainerSlotUsage(sackRecord, sampleRecords),
      coinSlots: getRecordSlotBurden(coinsRecord),
    },
    expected: {
      mode: "characterLike",
      rightHand: "sword-1",
      otherEquipped: ["armor-1"],
      coinRecord: "coins-1",
      topLevelStowedContainerContents: ["rope-1", "sack-1"],
      sackContents: ["rations-1"],
      encumbrance: {
        equippedItems: 3,
        stowedItems: 8,
        equippedRate: { explorationFeet: 120, encounterFeet: 40 },
        stowedRate: { explorationFeet: 120, encounterFeet: 40 },
        movement: { explorationFeet: 0, encounterFeet: 0 },
        overloaded: true,
        overloadedReason: "invalid",
        band: "overloaded",
      },
      backpackUsage: {
        usedSlots: 5,
        capacitySlots: 16,
      },
      sackUsage: {
        usedSlots: 3,
        capacitySlots: 6,
      },
      coinSlots: 2,
    },
  },
  {
    name: "retainer inventory uses character-like sections",
    actual: {
      mode: retainerSections.mode,
      topLevelStowedContainerContents:
        retainerSections.mode === "characterLike"
          ? retainerSections.topLevelStowedContainerContents.length
          : undefined,
      hand:
        retainerSections.mode === "characterLike"
          ? retainerSections.handRecordIds.leftHand
          : undefined,
    },
    expected: {
      mode: "characterLike",
      topLevelStowedContainerContents: 0,
      hand: "retainer-dagger-1",
    },
  },
  {
    name: "mount, vehicle, and storage use contents-only sections",
    actual: {
      mount:
        mountSections.mode === "contentsOnly"
          ? mountSections.contents.map((record) => record.id)
          : [],
      vehicle:
        vehicleSections.mode === "contentsOnly"
          ? vehicleSections.contents.map((record) => record.id)
          : [],
      storage:
        storageSections.mode === "contentsOnly"
          ? storageSections.contents.map((record) => record.id)
          : [],
      mountCapacity: getContentsCapacity(mountEntity, sampleRecords),
      vehicleCapacity: getContentsCapacity(vehicleEntity, sampleRecords),
      storageCapacity: getContentsCapacity(storageEntity, sampleRecords),
    },
    expected: {
      mount: ["mount-feed-1"],
      vehicle: ["vehicle-crate-1"],
      storage: ["storage-treasure-1"],
      mountCapacity: {
        usedSlots: 4,
        capacitySlots: 12,
        overloaded: false,
      },
      vehicleCapacity: {
        usedSlots: 5,
        capacitySlots: 20,
        overloaded: false,
      },
      storageCapacity: {
        usedSlots: 2,
        capacitySlots: 10,
        overloaded: false,
      },
    },
  },
  {
    name: "inventory display sorts contents and container children by sortOrder",
    actual: {
      contents:
        unsortedContentsSections.mode === "contentsOnly"
          ? unsortedContentsSections.contents.map((record) => record.id)
          : [],
      nested: getContainerContents(
        unsortedContentsRecords[0],
        unsortedContentsRecords,
      ).map((record) => record.id),
    },
    expected: {
      contents: ["contents-early", "contents-late"],
      nested: ["container-early", "container-late"],
    },
  },
];

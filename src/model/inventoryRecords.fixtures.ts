import {
  createInventoryLocation,
  getUsableContainerRecords,
} from "./inventoryRecords";
import type { Entity, InventoryRecord } from "./types";

const characterEntity: Entity = {
  id: "character-1",
  name: "Morgan",
  entityType: "character",
  active: true,
  sortOrder: 0,
};

const storageEntity: Entity = {
  id: "storage-1",
  name: "Vault",
  entityType: "storage",
  active: true,
  sortOrder: 1000,
};

const mountEntity: Entity = {
  id: "mount-1",
  name: "Mule",
  entityType: "mount",
  active: true,
  sortOrder: 2000,
};

const topLevelContainerRecord: InventoryRecord = {
  id: "container-top",
  recordType: "equipment",
  name: "Chest",
  location: {
    entityId: characterEntity.id,
    locationType: "equipped",
    placement: "loose",
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 0,
  container: {
    capacitySlots: 8,
  },
};

const editingContainerRecord: InventoryRecord = {
  ...topLevelContainerRecord,
  id: "container-editing",
  name: "Bag",
  sortOrder: 1000,
};

const nestedContainerRecord: InventoryRecord = {
  ...topLevelContainerRecord,
  id: "container-nested",
  name: "Nested pouch",
  location: {
    entityId: characterEntity.id,
    locationType: "stowed",
    placement: "container",
    containerId: topLevelContainerRecord.id,
  },
  sortOrder: 0,
};

const nestedContainerChildRecord: InventoryRecord = {
  id: "nested-container-child",
  recordType: "equipment",
  name: "Gem",
  location: {
    entityId: characterEntity.id,
    locationType: "stowed",
    placement: "container",
    containerId: nestedContainerRecord.id,
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 0,
};

const crossEntityContainerRecord: InventoryRecord = {
  ...topLevelContainerRecord,
  id: "container-cross-entity",
  name: "Storage crate",
  location: {
    entityId: storageEntity.id,
    locationType: "contents",
    placement: "contents",
  },
};

const childRecord: InventoryRecord = {
  id: "editing-container-child",
  recordType: "equipment",
  name: "Torch",
  location: {
    entityId: characterEntity.id,
    locationType: "stowed",
    placement: "container",
    containerId: editingContainerRecord.id,
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 0,
};

const mountContainerRecord: InventoryRecord = {
  id: "mount-container",
  recordType: "equipment",
  name: "Saddlebags",
  location: {
    entityId: mountEntity.id,
    locationType: "contents",
    placement: "contents",
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 0,
  container: {
    capacitySlots: 6,
  },
};

const containerFilterRecords = [
  topLevelContainerRecord,
  editingContainerRecord,
  nestedContainerRecord,
  nestedContainerChildRecord,
  crossEntityContainerRecord,
];
const nonEmptyEditingContainerRecords = [
  topLevelContainerRecord,
  editingContainerRecord,
  childRecord,
];

const directNonCharacterCoinLocation = createInventoryLocation({
  entity: mountEntity,
  recordType: "coins",
  records: [mountContainerRecord],
  location: {
    entityId: mountEntity.id,
    placement: "contents",
  },
});

const containedNonCharacterCoinLocation = createInventoryLocation({
  entity: mountEntity,
  recordType: "coins",
  records: [mountContainerRecord],
  location: {
    entityId: mountEntity.id,
    placement: "container",
    containerId: mountContainerRecord.id,
  },
});

const invalidCrossEntityContainerLocation = createInventoryLocation({
  entity: characterEntity,
  recordType: "equipment",
  records: containerFilterRecords,
  location: {
    entityId: characterEntity.id,
    placement: "container",
    containerId: crossEntityContainerRecord.id,
  },
});

export const INVENTORY_RECORDS_MANUAL_FIXTURES = [
  {
    name: "container options filter invalid destinations before submit",
    actual: {
      newRecordOptions: getUsableContainerRecords({
        entity: characterEntity,
        records: containerFilterRecords,
      }).map((record) => record.id),
      editingRecordOptions: getUsableContainerRecords({
        entity: characterEntity,
        records: containerFilterRecords,
        editingRecordId: editingContainerRecord.id,
      }).map((record) => record.id),
      nonEmptyEditingOptions: getUsableContainerRecords({
        entity: characterEntity,
        records: nonEmptyEditingContainerRecords,
        editingRecordId: editingContainerRecord.id,
      }).map((record) => record.id),
    },
    expected: {
      newRecordOptions: ["container-top", "container-editing"],
      editingRecordOptions: ["container-top"],
      nonEmptyEditingOptions: [],
    },
  },
  {
    name: "non-character coin records can use contents or container locations",
    actual: {
      directLocation: directNonCharacterCoinLocation,
      containedLocation: containedNonCharacterCoinLocation,
    },
    expected: {
      directLocation: {
        ok: true,
        location: {
          entityId: mountEntity.id,
          locationType: "contents",
          placement: "contents",
        },
      },
      containedLocation: {
        ok: true,
        location: {
          entityId: mountEntity.id,
          locationType: "contents",
          placement: "container",
          containerId: mountContainerRecord.id,
        },
      },
    },
  },
  {
    name: "cross-entity container destination is rejected",
    actual: invalidCrossEntityContainerLocation,
    expected: {
      ok: false,
      message: "Selected container is not available.",
    },
  },
];

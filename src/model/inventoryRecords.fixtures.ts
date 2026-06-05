import {
  createInventoryRecordFromInput,
  createInventoryLocation,
  moveInventoryRecord,
  updateInventoryRecordFromInput,
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
  entityId: characterEntity.id,
  location: {
    kind: "equipped",
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
  entityId: characterEntity.id,
  location: {
    kind: "container",
    containerId: topLevelContainerRecord.id,
  },
  sortOrder: 0,
};

const nestedContainerChildRecord: InventoryRecord = {
  id: "nested-container-child",
  recordType: "equipment",
  name: "Gem",
  entityId: characterEntity.id,
  location: {
    kind: "container",
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
  entityId: storageEntity.id,
  location: {
    kind: "contents",
  },
};

const childRecord: InventoryRecord = {
  id: "editing-container-child",
  recordType: "equipment",
  name: "Torch",
  entityId: characterEntity.id,
  location: {
    kind: "container",
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
  entityId: mountEntity.id,
  location: {
    kind: "contents",
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

const itemIntoNestedContainerLocation = createInventoryLocation({
  entity: characterEntity,
  recordType: "equipment",
  records: containerFilterRecords,
  location: {
    entityId: characterEntity.id,
    placement: "container",
    containerId: nestedContainerRecord.id,
  },
  isContainer: false,
});

const containerIntoNestedContainerLocation = createInventoryLocation({
  entity: characterEntity,
  recordType: "equipment",
  records: containerFilterRecords,
  location: {
    entityId: characterEntity.id,
    placement: "container",
    containerId: nestedContainerRecord.id,
  },
  isContainer: true,
});

const defaultCharacterEquipmentResult = createInventoryRecordFromInput({
  entity: characterEntity,
  id: "created-rope",
  records: [topLevelContainerRecord],
  input: {
    recordType: "equipment",
    name: "Rope",
    quantity: 1,
    burden: { kind: "fixed", slotsPerItem: 0 },
  },
});

const stackedEquipmentResult = createInventoryRecordFromInput({
  entity: characterEntity,
  id: "created-torches",
  records: [],
  input: {
    recordType: "equipment",
    name: "Torches",
    quantity: 6,
    burden: { kind: "stacked", itemsPerSlot: 3 },
  },
});

const advancedWeaponResult = createInventoryRecordFromInput({
  entity: characterEntity,
  id: "created-sword",
  records: [],
  input: {
    recordType: "weapon",
    name: "True sword",
    description: "Referee description",
    quantity: 1,
    burden: { kind: "fixed", slotsPerItem: 1 },
    handsRequired: 1,
    weapon: {
      damage: "1d8",
      range: "Melee",
      qualities: ["silver", "magic"],
    },
    identification: {
      identified: false,
      secretName: "Odd blade",
      secretDescription: "A blade with unfamiliar marks",
    },
    light: {
      isLit: true,
      lightDescription: "30' radius",
    },
    uses: {
      current: 6,
      max: 6,
    },
    modifiers: [
      {
        target: "attack",
        value: 1,
        label: "Magic weapon",
      },
    ],
    notes: "Referee only label, not permissioned.",
  },
});

const updatedNonLightUsesResult = updateInventoryRecordFromInput({
  entity: characterEntity,
  records: [],
  record: {
    id: "wand-1",
    recordType: "equipment",
    name: "Wand",
    entityId: characterEntity.id,
  location: {
    kind: "equipped",
    placement: "loose",
  },
    sortOrder: 0,
    quantity: 1,
    burden: { kind: "fixed", slotsPerItem: 1 },
    uses: { current: 2, max: 5 },
  },
  input: {
    recordType: "equipment",
    name: "Wand",
    quantity: 1,
    burden: { kind: "fixed", slotsPerItem: 1 },
    uses: { current: 1, max: 5 },
  },
});

const removedOptionalDataResult = updateInventoryRecordFromInput({
  entity: characterEntity,
  records: [],
  record: {
    id: "masked-1",
    recordType: "equipment",
    name: "Masked item",
    entityId: characterEntity.id,
  location: {
    kind: "equipped",
    placement: "loose",
  },
    sortOrder: 0,
    quantity: 1,
    burden: { kind: "fixed", slotsPerItem: 1 },
    identification: { identified: false, secretName: "Unknown thing" },
    uses: { current: 3 },
    light: { isLit: false, lightDescription: "Lantern" },
    modifiers: [{ target: "armorClass", value: 1 }],
    notes: "Hidden details",
  },
  input: {
    recordType: "equipment",
    name: "Masked item",
    quantity: 1,
    burden: { kind: "fixed", slotsPerItem: 1 },
  },
});

const reorderRecordA: InventoryRecord = {
  id: "reorder-a",
  recordType: "equipment",
  name: "A",
  entityId: characterEntity.id,
  location: { kind: "equipped", placement: "loose" },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 0,
};
const reorderRecordB: InventoryRecord = {
  ...reorderRecordA,
  id: "reorder-b",
  name: "B",
  sortOrder: 1000,
};
const reorderRecordC: InventoryRecord = {
  ...reorderRecordA,
  id: "reorder-c",
  name: "C",
  sortOrder: 2000,
};
const reorderRecordD: InventoryRecord = {
  ...reorderRecordA,
  id: "reorder-d",
  name: "D",
  location: { kind: "contents" },
  sortOrder: 0,
};
const sameZoneReorderedRecords = moveInventoryRecord({
  recordId: reorderRecordA.id,
  records: [reorderRecordA, reorderRecordB, reorderRecordC, reorderRecordD],
  entityId: characterEntity.id,
  location: reorderRecordA.location,
  targetIndex: 2,
});
const crossZoneReorderedRecords = moveInventoryRecord({
  recordId: reorderRecordB.id,
  records: [reorderRecordA, reorderRecordB, reorderRecordC, reorderRecordD],
  entityId: characterEntity.id,
  location: reorderRecordD.location,
  targetIndex: 0,
});

export const INVENTORY_RECORDS_MANUAL_FIXTURES = [
  {
    name: "container options filter invalid destinations before submit",
    actual: {
      newItemOptions: getUsableContainerRecords({
        entity: characterEntity,
        isContainer: false,
        records: containerFilterRecords,
      }).map((record) => record.id),
      newContainerOptions: getUsableContainerRecords({
        entity: characterEntity,
        isContainer: true,
        records: containerFilterRecords,
      }).map((record) => record.id),
      editingContainerOptions: getUsableContainerRecords({
        entity: characterEntity,
        isContainer: true,
        records: containerFilterRecords,
        editingRecordId: editingContainerRecord.id,
      }).map((record) => record.id),
      nonEmptyEditingOptions: getUsableContainerRecords({
        entity: characterEntity,
        isContainer: true,
        records: nonEmptyEditingContainerRecords,
        editingRecordId: editingContainerRecord.id,
      }).map((record) => record.id),
    },
    expected: {
      newItemOptions: ["container-top", "container-editing", "container-nested"],
      newContainerOptions: ["container-top", "container-editing"],
      editingContainerOptions: ["container-top"],
      nonEmptyEditingOptions: ["container-top"],
    },
  },
  {
    name: "one-level nested container destinations are enforced",
    actual: {
      itemIntoNestedContainerLocation,
      containerIntoNestedContainerLocation,
    },
    expected: {
      itemIntoNestedContainerLocation: {
        ok: true,
        location: {
          kind: "container",
          containerId: nestedContainerRecord.id,
        },
      },
      containerIntoNestedContainerLocation: {
        ok: false,
        message: "Selected container is not available.",
      },
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
          kind: "contents",
        },
      },
      containedLocation: {
        ok: true,
        location: {
          kind: "container",
          containerId: mountContainerRecord.id,
        },
      },
    },
  },
  {
    name: "inventory record move targetIndex reindexes same and cross-zone siblings",
    actual: {
      sameZoneLoose: sameZoneReorderedRecords
        .filter((record) => record.location.kind === "equipped")
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((record) => `${record.id}:${record.sortOrder}`),
      crossZoneContents: crossZoneReorderedRecords
        .filter((record) => record.location.kind === "contents")
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((record) => `${record.id}:${record.sortOrder}`),
    },
    expected: {
      sameZoneLoose: [
        "reorder-b:0",
        "reorder-c:1000",
        "reorder-a:2000",
      ],
      crossZoneContents: ["reorder-b:0", "reorder-d:1000"],
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
  {
    name: "default character equipment creation uses equipped loose and supports zero slots",
    actual: defaultCharacterEquipmentResult,
    expected: {
      ok: true,
      record: {
        id: "created-rope",
        name: "Rope",
        entityId: characterEntity.id,
  location: {
    kind: "equipped",
    placement: "loose",
  },
        sortOrder: 1000,
        quantity: 1,
        burden: { kind: "fixed", slotsPerItem: 0 },
        handsRequired: 0,
        recordType: "equipment",
      },
    },
  },
  {
    name: "stackable item form input saves as stacked items per slot",
    actual: stackedEquipmentResult,
    expected: {
      ok: true,
      record: {
        id: "created-torches",
        name: "Torches",
        entityId: characterEntity.id,
  location: {
    kind: "equipped",
    placement: "loose",
  },
        sortOrder: 0,
        quantity: 6,
        burden: { kind: "stacked", itemsPerSlot: 3 },
        handsRequired: 0,
        recordType: "equipment",
      },
    },
  },
  {
    name: "advanced exposed weapon fields are preserved on create",
    actual: advancedWeaponResult,
    expected: {
      ok: true,
      record: {
        id: "created-sword",
        name: "True sword",
        entityId: characterEntity.id,
  location: {
    kind: "equipped",
    placement: "loose",
  },
        sortOrder: 0,
        quantity: 1,
        burden: { kind: "fixed", slotsPerItem: 1 },
        handsRequired: 1,
        description: "Referee description",
        uses: {
          current: 6,
          max: 6,
        },
        light: {
          isLit: true,
          lightDescription: "30' radius",
        },
        modifiers: [
          {
            target: "attack",
            value: 1,
            label: "Magic weapon",
          },
        ],
        notes: "Referee only label, not permissioned.",
        identification: {
          identified: false,
          secretName: "Odd blade",
          secretDescription: "A blade with unfamiliar marks",
        },
        recordType: "weapon",
        weapon: {
          damage: "1d8",
          range: "Melee",
          qualities: ["silver", "magic"],
        },
      },
    },
  },
  {
    name: "non-light uses update without creating duplicate light data",
    actual: updatedNonLightUsesResult,
    expected: {
      ok: true,
      record: {
        id: "wand-1",
        name: "Wand",
        entityId: characterEntity.id,
  location: {
    kind: "equipped",
    placement: "loose",
  },
        sortOrder: 0,
        quantity: 1,
        burden: { kind: "fixed", slotsPerItem: 1 },
        handsRequired: 0,
        uses: { current: 1, max: 5 },
        recordType: "equipment",
      },
    },
  },
  {
    name: "omitted optional sections remove advanced record data on update",
    actual: removedOptionalDataResult,
    expected: {
      ok: true,
      record: {
        id: "masked-1",
        name: "Masked item",
        entityId: characterEntity.id,
  location: {
    kind: "equipped",
    placement: "loose",
  },
        sortOrder: 0,
        quantity: 1,
        burden: { kind: "fixed", slotsPerItem: 1 },
        handsRequired: 0,
        recordType: "equipment",
      },
    },
  },
];

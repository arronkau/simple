import {
  encodeZoneId,
  parseZoneId,
  resolveEntityReorderIndex,
  resolveRecordDrop,
  resolveRecordDropWithInventory,
  type DragZone,
  type RecordDragData,
  type RecordDropData,
} from "./inventoryDnd";
import type { InventoryRecord } from "./types";

const equippedZone: DragZone = {
  entityId: "entity-1",
  placement: "equippedLoose",
};
const containerZone: DragZone = {
  entityId: "entity-1",
  placement: "container",
  containerId: "pack-1",
};
const otherEntityZone: DragZone = {
  entityId: "entity-2",
  placement: "contents",
};

const draggedRecord: RecordDragData = {
  type: "record",
  kind: "item",
  recordId: "rope-1",
  zone: equippedZone,
  index: 1,
};

const sourceZone: DragZone = {
  entityId: "entity-1",
  placement: "container",
  containerId: "pack-1",
};

const twoHandedDrag: RecordDragData = {
  type: "record",
  kind: "item",
  recordId: "spear-1",
  zone: sourceZone,
  index: 0,
};

const twoHandedRecord: InventoryRecord = {
  id: "spear-1",
  entityId: "entity-1",
  recordType: "weapon",
  name: "Spear",
  location: {
    kind: "container",
    containerId: "pack-1",
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 2,
  weapon: {
    damage: "1d6",
  },
};

const oneHandedRecord: InventoryRecord = {
  id: "mace-1",
  entityId: "entity-1",
  recordType: "weapon",
  name: "Mace",
  location: {
    kind: "equipped",
    placement: "leftHand",
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 1,
  weapon: {
    damage: "1d6",
  },
};

const offHandRecord: InventoryRecord = {
  ...oneHandedRecord,
  id: "shield-1",
  recordType: "armor",
  name: "Shield",
  location: {
    kind: "equipped",
    placement: "rightHand",
  },
  armor: {
    armorBonus: 1,
  },
  weapon: undefined,
};

function itemTarget(recordId: string, zone: DragZone, index: number): RecordDropData {
  return {
    type: "record",
    kind: "item",
    recordId,
    zone,
    index,
  };
}

export const INVENTORY_DND_MANUAL_FIXTURES = [
  {
    name: "inventory dnd zone ids encode and parse direct and container zones",
    actual: {
      direct: parseZoneId(encodeZoneId(equippedZone)),
      container: parseZoneId(encodeZoneId(containerZone)),
      invalid: parseZoneId("item:rope-1"),
    },
    expected: {
      direct: equippedZone,
      container: containerZone,
      invalid: null,
    },
  },
  {
    name: "inventory dnd resolves gap inserts at top, end, and empty list",
    actual: {
      top: resolveRecordDrop(draggedRecord, {
        type: "record",
        kind: "gap",
        zone: equippedZone,
        index: 0,
      }),
      endSameZone: resolveRecordDrop(draggedRecord, {
        type: "record",
        kind: "gap",
        zone: equippedZone,
        index: 3,
      }),
      emptyOtherEntity: resolveRecordDrop(draggedRecord, {
        type: "record",
        kind: "gap",
        zone: otherEntityZone,
        index: 0,
      }),
    },
    expected: {
      top: {
        kind: "move",
        recordId: "rope-1",
        location: {
          entityId: "entity-1",
          placement: "equippedLoose",
          targetIndex: 0,
        },
      },
      endSameZone: {
        kind: "move",
        recordId: "rope-1",
        location: {
          entityId: "entity-1",
          placement: "equippedLoose",
          targetIndex: 2,
        },
      },
      emptyOtherEntity: {
        kind: "move",
        recordId: "rope-1",
        location: {
          entityId: "entity-2",
          placement: "contents",
          targetIndex: 0,
        },
      },
    },
  },
  {
    name: "inventory dnd treats own item and own position drops as no-ops",
    actual: {
      ownItem: resolveRecordDrop(draggedRecord, itemTarget("rope-1", equippedZone, 1)),
      ownPosition: resolveRecordDrop(draggedRecord, {
        type: "record",
        kind: "gap",
        zone: equippedZone,
        index: 1,
      }),
    },
    expected: {
      ownItem: null,
      ownPosition: null,
    },
  },
  {
    name: "inventory dnd resolves item swap with insert-below fallback",
    actual: resolveRecordDrop(draggedRecord, itemTarget("torch-1", equippedZone, 2)),
    expected: {
      kind: "swap",
      recordIdA: "rope-1",
      recordIdB: "torch-1",
      fallback: {
        recordId: "rope-1",
        location: {
          entityId: "entity-1",
          placement: "equippedLoose",
          targetIndex: 2,
        },
      },
    },
  },
  {
    name: "inventory dnd resolves container entity default and slot drops",
    actual: {
      container: resolveRecordDrop(draggedRecord, {
        type: "record",
        kind: "container",
        entityId: "entity-1",
        containerId: "pack-1",
      }),
      entityDefault: resolveRecordDrop(draggedRecord, {
        type: "record",
        kind: "entityDefault",
        entityId: "entity-2",
      }),
      slot: resolveRecordDrop(draggedRecord, {
        type: "record",
        kind: "slot",
        entityId: "entity-1",
        placement: "leftHand",
      }),
    },
    expected: {
      container: {
        kind: "move",
        recordId: "rope-1",
        location: {
          entityId: "entity-1",
          placement: "container",
          containerId: "pack-1",
        },
      },
      entityDefault: {
        kind: "move",
        recordId: "rope-1",
        location: {
          entityId: "entity-2",
          placement: "default",
        },
      },
      slot: {
        kind: "move",
        recordId: "rope-1",
        location: {
          entityId: "entity-1",
          placement: "leftHand",
        },
      },
    },
  },
  {
    name: "inventory dnd places two-handed hand slot drops into both hands",
    actual: {
      emptyHands: resolveRecordDropWithInventory(
        twoHandedDrag,
        {
          type: "record",
          kind: "slot",
          entityId: "entity-1",
          placement: "leftHand",
        },
        [twoHandedRecord],
      ),
      occupiedHands: resolveRecordDropWithInventory(
        twoHandedDrag,
        {
          type: "record",
          kind: "slot",
          entityId: "entity-1",
          placement: "rightHand",
        },
        [twoHandedRecord, oneHandedRecord],
      ),
    },
    expected: {
      emptyHands: {
        kind: "move",
        recordId: "spear-1",
        location: {
          entityId: "entity-1",
          placement: "bothHands",
        },
      },
      occupiedHands: null,
    },
  },
  {
    name: "inventory dnd swaps two-handed item with lone one-handed hand item",
    actual: {
      allowed: resolveRecordDropWithInventory(
        twoHandedDrag,
        itemTarget("mace-1", { entityId: "entity-1", placement: "leftHand" }, 0),
        [twoHandedRecord, oneHandedRecord],
      ),
      blockedOtherHandOccupied: resolveRecordDropWithInventory(
        twoHandedDrag,
        itemTarget("mace-1", { entityId: "entity-1", placement: "leftHand" }, 0),
        [twoHandedRecord, oneHandedRecord, offHandRecord],
      ),
    },
    expected: {
      allowed: {
        kind: "twoHandSwap",
        twoHandedRecordId: "spear-1",
        displacedRecordId: "mace-1",
        twoHandedLocation: {
          entityId: "entity-1",
          placement: "bothHands",
        },
        displacedLocation: {
          entityId: "entity-1",
          placement: "container",
          containerId: "pack-1",
          targetIndex: 0,
        },
      },
      blockedOtherHandOccupied: null,
    },
  },
  {
    name: "inventory dnd resolves hidden entity reorder target index",
    actual: {
      forward: resolveEntityReorderIndex(["a", "b", "c"], "a", "c"),
      self: resolveEntityReorderIndex(["a", "b", "c"], "b", "b"),
      missing: resolveEntityReorderIndex(["a", "b", "c"], "b", "z"),
    },
    expected: {
      forward: 2,
      self: null,
      missing: null,
    },
  },
];

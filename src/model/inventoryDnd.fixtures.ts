import {
  encodeZoneId,
  parseZoneId,
  resolveEntityReorderIndex,
  resolveRecordDrop,
  type DragZone,
  type RecordDragData,
  type RecordDropData,
} from "./inventoryDnd";

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

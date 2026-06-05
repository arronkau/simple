import type {
  InventoryRecordLocationInput,
  InventoryRecordPlacementKey,
} from "./inventoryRecords";
import type { EntityId, InventoryRecord, InventoryRecordId } from "./types";
import { getRecordHandsRequired } from "./types";
import { getHandOccupancy } from "./validation";

/**
 * Pure drag-and-drop resolution helpers. These translate the dnd-kit
 * "active"/"over" data payloads into store mutations. They are deliberately
 * free of any dnd-kit imports so they can be unit tested in isolation.
 */

export type DragZone = {
  entityId: EntityId;
  /** Placement key of the sibling group. One of equippedLoose | contents | container. */
  placement: InventoryRecordPlacementKey;
  containerId?: InventoryRecordId;
};

export type RecordDragData = {
  type: "record";
  kind: "item";
  recordId: InventoryRecordId;
  zone: DragZone;
  index: number;
};

export type EntityDragData = {
  type: "entity";
  entityId: EntityId;
  index: number;
};

export type GapDropData = {
  type: "record";
  kind: "gap";
  zone: DragZone;
  index: number;
};

export type SlotDropData = {
  type: "record";
  kind: "slot";
  entityId: EntityId;
  placement: InventoryRecordPlacementKey;
};

export type EntityDefaultDropData = {
  type: "record";
  kind: "entityDefault";
  entityId: EntityId;
};

export type ContainerDropData = {
  type: "record";
  kind: "container";
  entityId: EntityId;
  containerId: InventoryRecordId;
};

export type RecordDropData =
  | RecordDragData
  | GapDropData
  | SlotDropData
  | EntityDefaultDropData
  | ContainerDropData;

export type DragData = RecordDragData | EntityDragData;
export type DropData = RecordDropData | EntityDragData;

export type RecordDropResolution =
  | {
      kind: "move";
      recordId: InventoryRecordId;
      location: InventoryRecordLocationInput;
    }
  | {
      kind: "swap";
      recordIdA: InventoryRecordId;
      recordIdB: InventoryRecordId;
      fallback: {
        recordId: InventoryRecordId;
        location: InventoryRecordLocationInput;
      };
    }
  | {
      kind: "twoHandSwap";
      twoHandedRecordId: InventoryRecordId;
      displacedRecordId: InventoryRecordId;
      twoHandedLocation: InventoryRecordLocationInput;
      displacedLocation: InventoryRecordLocationInput;
    };

// --- dnd-kit id builders (ids only need to be unique; payloads ride on data) ---

export function encodeZoneId(zone: DragZone): string {
  return zone.containerId
    ? `zone:${zone.entityId}:container:${zone.containerId}`
    : `zone:${zone.entityId}:${zone.placement}`;
}

export function parseZoneId(zoneId: string): DragZone | null {
  const parts = zoneId.split(":");

  if (parts[0] !== "zone") {
    return null;
  }

  if (parts.length === 4 && parts[2] === "container") {
    return {
      entityId: parts[1],
      placement: "container",
      containerId: parts[3],
    };
  }

  if (parts.length === 3) {
    return {
      entityId: parts[1],
      placement: parts[2] as InventoryRecordPlacementKey,
    };
  }

  return null;
}

export function gapDropId(zone: DragZone, index: number): string {
  return `gap__${encodeZoneId(zone)}__${index}`;
}

export function slotDropId(
  entityId: EntityId,
  placement: InventoryRecordPlacementKey,
): string {
  return `slot__${entityId}__${placement}`;
}

export function entityDefaultDropId(entityId: EntityId): string {
  return `entity-default__${entityId}`;
}

// --- resolution ---

export function areZonesEqual(left: DragZone, right: DragZone): boolean {
  return (
    left.entityId === right.entityId &&
    left.placement === right.placement &&
    left.containerId === right.containerId
  );
}

function zoneToLocation(
  zone: DragZone,
  targetIndex?: number,
): InventoryRecordLocationInput {
  return {
    entityId: zone.entityId,
    placement: zone.placement,
    ...(zone.containerId ? { containerId: zone.containerId } : {}),
    ...(targetIndex === undefined ? {} : { targetIndex }),
  };
}

/**
 * Resolve a record drag onto an "over" target. Returns the store mutation to
 * apply, or null for a no-op (e.g. dropping onto the record's own position).
 */
export function resolveRecordDrop(
  activeData: RecordDragData,
  overData: RecordDropData | undefined,
): RecordDropResolution | null {
  if (!overData) {
    return null;
  }

  switch (overData.kind) {
    case "gap": {
      const sameZone = areZonesEqual(activeData.zone, overData.zone);
      // Gap index is the insertion slot among the *rendered* items (which still
      // include the dragged item). Convert to an index among the other siblings.
      let targetIndex = overData.index;

      if (sameZone) {
        if (overData.index > activeData.index) {
          targetIndex -= 1;
        }

        if (targetIndex === activeData.index) {
          return null;
        }
      }

      return {
        kind: "move",
        recordId: activeData.recordId,
        location: zoneToLocation(overData.zone, targetIndex),
      };
    }
    case "item": {
      if (overData.recordId === activeData.recordId) {
        return null;
      }

      const sameZone = areZonesEqual(activeData.zone, overData.zone);
      // Insert-below fallback: position just after the target item, expressed
      // among the other siblings (the dragged item removed).
      let targetOthersIndex = overData.index;

      if (sameZone && overData.index > activeData.index) {
        targetOthersIndex -= 1;
      }

      return {
        kind: "swap",
        recordIdA: activeData.recordId,
        recordIdB: overData.recordId,
        fallback: {
          recordId: activeData.recordId,
          location: zoneToLocation(overData.zone, targetOthersIndex + 1),
        },
      };
    }
    case "container": {
      return {
        kind: "move",
        recordId: activeData.recordId,
        location: {
          entityId: overData.entityId,
          placement: "container",
          containerId: overData.containerId,
        },
      };
    }
    case "slot": {
      return {
        kind: "move",
        recordId: activeData.recordId,
        location: {
          entityId: overData.entityId,
          placement: overData.placement,
        },
      };
    }
    case "entityDefault": {
      return {
        kind: "move",
        recordId: activeData.recordId,
        location: {
          entityId: overData.entityId,
          placement: "default",
        },
      };
    }
    default:
      return null;
  }
}

export function resolveRecordDropWithInventory(
  activeData: RecordDragData,
  overData: RecordDropData | undefined,
  records: InventoryRecord[],
): RecordDropResolution | null {
  const activeRecord = records.find((record) => record.id === activeData.recordId);

  if (!activeRecord || getRecordHandsRequired(activeRecord) !== 2) {
    return resolveRecordDrop(activeData, overData);
  }

  const twoHandResolution = resolveTwoHandedRecordDrop(
    activeData,
    activeRecord,
    overData,
    records,
  );

  if (twoHandResolution !== undefined) {
    return twoHandResolution;
  }

  return resolveRecordDrop(activeData, overData);
}

function resolveTwoHandedRecordDrop(
  activeData: RecordDragData,
  activeRecord: InventoryRecord,
  overData: RecordDropData | undefined,
  records: InventoryRecord[],
): RecordDropResolution | null | undefined {
  if (!overData || overData.type !== "record") {
    return null;
  }

  if (overData.kind === "slot" && isSingleHandPlacement(overData.placement)) {
    if (canOccupyBothHands(activeRecord.id, overData.entityId, records)) {
      return {
        kind: "move",
        recordId: activeRecord.id,
        location: {
          entityId: overData.entityId,
          placement: "bothHands",
        },
      };
    }

    return null;
  }

  if (overData.kind !== "item") {
    return undefined;
  }

  const targetRecord = records.find((record) => record.id === overData.recordId);

  if (
    !targetRecord ||
    targetRecord.id === activeRecord.id ||
    targetRecord.entityId !== activeRecord.entityId ||
    !isSingleHandLocation(targetRecord) ||
    getRecordHandsRequired(targetRecord) !== 1
  ) {
    return undefined;
  }

  if (
    !canSwapSingleHandForTwoHandedRecord(
      activeRecord.id,
      targetRecord,
      records,
    )
  ) {
    return null;
  }

  return {
    kind: "twoHandSwap",
    twoHandedRecordId: activeRecord.id,
    displacedRecordId: targetRecord.id,
    twoHandedLocation: {
      entityId: targetRecord.entityId,
      placement: "bothHands",
    },
    displacedLocation: zoneToLocation(activeData.zone, activeData.index),
  };
}

function canOccupyBothHands(
  activeRecordId: InventoryRecordId,
  entityId: EntityId,
  records: InventoryRecord[],
): boolean {
  const occupancy = getHandOccupancy(entityId, withoutRecord(activeRecordId, records));

  return !occupancy.leftHand && !occupancy.rightHand && !occupancy.bothHands;
}

function canSwapSingleHandForTwoHandedRecord(
  activeRecordId: InventoryRecordId,
  targetRecord: InventoryRecord,
  records: InventoryRecord[],
): boolean {
  const occupancy = getHandOccupancy(
    targetRecord.entityId,
    withoutRecord(activeRecordId, records),
  );

  if (occupancy.bothHands) {
    return false;
  }

  const otherHandRecordId =
    targetRecord.location.kind === "equipped" &&
    targetRecord.location.placement === "leftHand"
      ? occupancy.rightHand
      : occupancy.leftHand;

  const targetHandRecordId =
    targetRecord.location.kind === "equipped" &&
    targetRecord.location.placement === "leftHand"
      ? occupancy.leftHand
      : occupancy.rightHand;

  return targetHandRecordId === targetRecord.id && !otherHandRecordId;
}

function withoutRecord(
  recordId: InventoryRecordId,
  records: InventoryRecord[],
): InventoryRecord[] {
  return records.filter((record) => record.id !== recordId);
}

function isSingleHandPlacement(
  placement: string,
): placement is "leftHand" | "rightHand" {
  return placement === "leftHand" || placement === "rightHand";
}

function isSingleHandLocation(record: InventoryRecord): boolean {
  return (
    record.location.kind === "equipped" &&
    isSingleHandPlacement(record.location.placement)
  );
}

/**
 * Resolve an entity reorder drag. Returns the target index (the position of the
 * "over" entity in the current ordering), or null for a no-op. The store's
 * reorderEntity applies arrayMove semantics from this index.
 */
export function resolveEntityReorderIndex(
  orderedEntityIds: EntityId[],
  activeEntityId: EntityId,
  overEntityId: EntityId,
): number | null {
  if (activeEntityId === overEntityId) {
    return null;
  }

  const overIndex = orderedEntityIds.indexOf(overEntityId);

  if (overIndex === -1 || orderedEntityIds.indexOf(activeEntityId) === -1) {
    return null;
  }

  return overIndex;
}

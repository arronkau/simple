import type { InventoryRecordLocationInput } from "../model/inventoryRecords";
import type { EntityId, InventoryRecordId } from "../model/types";

/**
 * Drag-and-drop id encoding for the Party Gear board.
 *
 * These helpers only translate dnd-kit ids into the destination an
 * {@link InventoryRecordLocationInput} describes. They hold no movement tables
 * and run no invariant checks — every move is handed to the validated store
 * action, which owns all of that.
 */

export type GearDropTarget =
  | {
      entityId: EntityId;
      placement: "leftHand" | "rightHand" | "bothHands" | "equippedLoose" | "contents";
    }
  | {
      entityId: EntityId;
      placement: "container";
      containerId: InventoryRecordId;
    };

export type GearDragData = {
  type: "gear-record";
  recordId: InventoryRecordId;
  /** The list this record sits in, for same-list reorder detection. */
  zoneKey?: string;
  /** Index within that list. */
  index?: number;
};

export type GearDropData = {
  type: "gear-zone";
  target: GearDropTarget;
};

/** An insertion point between rows in an ordered list (for reordering). */
export type GearGapData = {
  type: "gear-gap";
  target: GearDropTarget;
  zoneKey: string;
  index: number;
};

export type GearOverData = GearDropData | GearGapData;

export function recordDraggableId(recordId: InventoryRecordId): string {
  return `rec:${recordId}`;
}

/** Stable key identifying an ordered list (worn / contents / a container). */
export function zoneKeyForTarget(target: GearDropTarget): string {
  if (target.placement === "container") {
    return `container:${target.containerId}`;
  }

  return `${target.entityId}:${target.placement}`;
}

export function gapDropId(zoneKey: string, index: number): string {
  return `gap:${zoneKey}:${index}`;
}

export function handDropId(
  entityId: EntityId,
  placement: "leftHand" | "rightHand" | "bothHands",
): string {
  return `drop:${entityId}:equipped:${placement}`;
}

export function looseDropId(entityId: EntityId): string {
  return `drop:${entityId}:equipped:loose`;
}

export function containerDropId(
  entityId: EntityId,
  containerId: InventoryRecordId,
): string {
  return `drop:${entityId}:container:${containerId}`;
}

export function contentsDropId(entityId: EntityId): string {
  return `drop:${entityId}:contents`;
}

export function dropTargetToLocationInput(
  target: GearDropTarget,
): InventoryRecordLocationInput {
  if (target.placement === "container") {
    return {
      entityId: target.entityId,
      placement: "container",
      containerId: target.containerId,
    };
  }

  return {
    entityId: target.entityId,
    placement: target.placement,
  };
}

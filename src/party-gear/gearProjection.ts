import { getContainerSlotUsage } from "../model/calculations";
import { getCharacterEncumbrance, getContentsCapacity } from "../model/encumbrance";
import {
  createInventoryLocation,
  moveInventoryRecord,
} from "../model/inventoryRecords";
import { isCharacterLikeEntity, validateInventoryState } from "../model/validation";
import type { Entity, InventoryRecord, InventoryRecordId } from "../model/types";
import type { GearDropTarget } from "./gearDnd";
import { dropTargetToLocationInput } from "./gearDnd";
import { buildHandDropSequence, isHandPlacement, type HandMove } from "./gearHands";

function getTargetContainerUsage(
  containerId: InventoryRecordId,
  nextRecords: InventoryRecord[],
) {
  const container = nextRecords.find(
    (candidate) => candidate.id === containerId,
  );

  return container?.container
    ? getContainerSlotUsage(container, nextRecords)
    : undefined;
}

export type MoveProjection = {
  /** Short readout shown in the hover pill. */
  text: string;
  /** True when the resolved move would overload or be structurally rejected. */
  invalid: boolean;
};

/**
 * Compute the hypothetical encumbrance/capacity readout for dropping
 * `recordId` onto `target`, using the same location resolution + pure move the
 * store uses, then reading the shared encumbrance module. Display-only; never
 * mutates the live records and never duplicates the movement tables.
 */
export function projectMove(
  records: InventoryRecord[],
  recordId: InventoryRecordId,
  target: GearDropTarget,
  entities: Entity[],
): MoveProjection | null {
  const record = records.find((candidate) => candidate.id === recordId);
  const entity = entities.find((candidate) => candidate.id === target.entityId);

  if (!record || !entity) {
    return null;
  }

  // A drop on a hand runs the same displacement sequence the board applies, so
  // the pill reflects the state the drop actually produces — not a lone move
  // into an occupied hand.
  const moves: HandMove[] = isHandPlacement(target.placement)
    ? buildHandDropSequence(record, target.placement, target.entityId, records)
    : [{ recordId, location: dropTargetToLocationInput(target) }];

  let nextRecords = records;

  for (const move of moves) {
    const moving = nextRecords.find(
      (candidate) => candidate.id === move.recordId,
    );
    const moveEntity = entities.find(
      (candidate) => candidate.id === move.location.entityId,
    );

    if (!moving || !moveEntity) {
      return { text: "blocked", invalid: true };
    }

    const locationResult = createInventoryLocation({
      entity: moveEntity,
      recordType: moving.recordType,
      records: nextRecords,
      location: move.location,
      isContainer: Boolean(moving.container),
      editingRecordId: move.recordId,
    });

    if (!locationResult.ok) {
      return { text: "blocked", invalid: true };
    }

    nextRecords = moveInventoryRecord({
      recordId: move.recordId,
      records: nextRecords,
      entityId: moveEntity.id,
      location: locationResult.location,
    });
  }

  const validation = validateInventoryState(entities, nextRecords);
  const containerUsage =
    target.placement === "container" && target.containerId
      ? getTargetContainerUsage(target.containerId, nextRecords)
      : undefined;

  if (isCharacterLikeEntity(entity)) {
    const encumbrance = getCharacterEncumbrance(entity, nextRecords);
    // A drop into a container leads with that container's own usage, so the
    // pill answers "does it fit in here?" before the whole-body load.
    const containerText = containerUsage
      ? `${containerUsage.usedSlots}/${containerUsage.capacitySlots ?? "—"} · `
      : "";

    // getCharacterEncumbrance already flags every container this entity owns
    // that is over capacity, so no separate container check is needed here.
    return {
      text: `${containerText}eq ${encumbrance.equippedItems}/${encumbrance.equippedCapacity} · st ${encumbrance.stowedItems}/${encumbrance.stowedCapacity}`,
      invalid: encumbrance.overloaded || !validation.valid,
    };
  }

  if (containerUsage) {
    const overCapacity =
      containerUsage.capacitySlots !== undefined &&
      containerUsage.usedSlots > containerUsage.capacitySlots;

    return {
      text: `${containerUsage.usedSlots}/${containerUsage.capacitySlots ?? "—"}`,
      invalid: overCapacity || !validation.valid,
    };
  }

  const capacity = getContentsCapacity(entity, nextRecords);
  const capacityLabel =
    capacity.capacitySlots === undefined ? "∞" : capacity.capacitySlots;

  return {
    text: `${capacity.usedSlots}/${capacityLabel}`,
    invalid: capacity.overloaded || !validation.valid,
  };
}

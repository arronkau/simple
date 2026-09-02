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

  const locationResult = createInventoryLocation({
    entity,
    recordType: record.recordType,
    records,
    location: dropTargetToLocationInput(target),
    isContainer: Boolean(record.container),
    editingRecordId: recordId,
  });

  if (!locationResult.ok) {
    return { text: "blocked", invalid: true };
  }

  const nextRecords = moveInventoryRecord({
    recordId,
    records,
    entityId: entity.id,
    location: locationResult.location,
  });
  const validation = validateInventoryState(entities, nextRecords);

  if (isCharacterLikeEntity(entity)) {
    const encumbrance = getCharacterEncumbrance(entity, nextRecords);

    return {
      text: `eq ${encumbrance.equippedItems}/${encumbrance.equippedCapacity} · st ${encumbrance.stowedItems}/${encumbrance.stowedCapacity}`,
      invalid: encumbrance.overloaded || !validation.valid,
    };
  }

  if (target.placement === "container" && target.containerId) {
    const container = nextRecords.find(
      (candidate) => candidate.id === target.containerId,
    );

    if (container?.container) {
      const usage = getContainerSlotUsage(container, nextRecords);
      const overCapacity =
        usage.capacitySlots !== undefined &&
        usage.usedSlots > usage.capacitySlots;

      return {
        text: `${usage.usedSlots}/${usage.capacitySlots ?? "—"}`,
        invalid: overCapacity || !validation.valid,
      };
    }
  }

  const capacity = getContentsCapacity(entity, nextRecords);
  const capacityLabel =
    capacity.capacitySlots === undefined ? "∞" : capacity.capacitySlots;

  return {
    text: `${capacity.usedSlots}/${capacityLabel}`,
    invalid: capacity.overloaded || !validation.valid,
  };
}

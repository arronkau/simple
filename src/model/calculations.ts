import { getRecordHandsRequired } from "./types";
import type {
  CoinData,
  Entity,
  InventoryLocation,
  InventoryRecord,
  InventoryRecordId,
} from "./types";

export type SlotBurdenOptions = {
  excludeHeldHandsRequiredContainers?: boolean;
};

export type SlotUsage = {
  usedSlots: number;
  capacitySlots?: number;
};

export const MOVEMENT_SLOT_BURDEN_OPTIONS: SlotBurdenOptions = {
  excludeHeldHandsRequiredContainers: true,
};

export function getCoinCount(coins: CoinData): number {
  return coins.pp + coins.gp + coins.sp + coins.cp;
}

export function getCoinGpValue(coins: CoinData): number {
  return coins.pp * 5 + coins.gp + coins.sp / 10 + coins.cp / 100;
}

export function getCoinSlotBurden(coins: CoinData): number {
  return Math.ceil(getCoinCount(coins) / 100);
}

export function getRecordSlotBurden(record: InventoryRecord): number {
  if (record.recordType === "coins") {
    return getCoinSlotBurden(record.coins);
  }

  switch (record.slotProfile.kind) {
    case "fixed":
      return record.slotProfile.slots;
    case "stackable":
      return Math.ceil(record.slotProfile.quantity / record.slotProfile.perSlot);
  }
}

export function getEffectiveRecordSlotBurden(
  record: InventoryRecord,
  records: InventoryRecord[],
  options: SlotBurdenOptions = {},
): number {
  if (isExcludedByAncestor(record, records, options)) {
    return 0;
  }

  const childRecords = getDirectChildRecords(record.id, records);

  if (
    options.excludeHeldHandsRequiredContainers &&
    isHeldHandsRequiredContainer(record, childRecords)
  ) {
    return 0;
  }

  if (!record.container || childRecords.length === 0) {
    return getRecordSlotBurden(record);
  }

  const burdenMode = record.container.burdenMode ?? "contentsOnlyWhenLoaded";

  if (
    burdenMode === "containerPlusContents" ||
    burdenMode === "fixedOnly"
  ) {
    return getRecordSlotBurden(record);
  }

  return 0;
}

export function getEffectiveRecordAndContentsSlotBurden(
  record: InventoryRecord,
  records: InventoryRecord[],
  options: SlotBurdenOptions = {},
): number {
  return getEffectiveRecordAndContentsSlotBurdenInner(
    record,
    records,
    options,
    new Set(),
  );
}

export function getContainerUsedSlots(
  containerRecord: InventoryRecord,
  records: InventoryRecord[],
  options: SlotBurdenOptions = {},
): number {
  return getDirectChildRecords(containerRecord.id, records).reduce(
    (usedSlots, childRecord) =>
      usedSlots +
      getEffectiveRecordAndContentsSlotBurden(childRecord, records, options),
    0,
  );
}

export function getContainerSlotUsage(
  containerRecord: InventoryRecord,
  records: InventoryRecord[],
  options: SlotBurdenOptions = {},
): SlotUsage {
  const slotUsage: SlotUsage = {
    usedSlots: getContainerUsedSlots(containerRecord, records, options),
  };

  if (containerRecord.container) {
    slotUsage.capacitySlots = containerRecord.container.capacitySlots;
  }

  return slotUsage;
}

export function getContentsSlots(
  entity: Entity,
  records: InventoryRecord[],
  options: SlotBurdenOptions = {},
): number {
  return records
    .filter(
      (record) =>
        record.location.entityId === entity.id &&
        record.location.locationType === "contents" &&
        record.location.placement === "contents",
    )
    .reduce(
      (usedSlots, record) =>
        usedSlots +
        getEffectiveRecordAndContentsSlotBurden(record, records, options),
      0,
    );
}

export function getTotalEntitySlots(
  entity: Entity,
  records: InventoryRecord[],
  options: SlotBurdenOptions = {},
): number {
  return records
    .filter(
      (record) =>
        record.location.entityId === entity.id &&
        !locationHasContainerId(record.location),
    )
    .reduce(
      (usedSlots, record) =>
        usedSlots +
        getEffectiveRecordAndContentsSlotBurden(record, records, options),
      0,
    );
}

export function getEntitySlotUsage(
  entity: Entity,
  records: InventoryRecord[],
  options: SlotBurdenOptions = {},
): SlotUsage {
  const slotUsage: SlotUsage = {
    usedSlots: getTotalEntitySlots(entity, records, options),
  };

  if (entity.capacitySlots !== undefined) {
    slotUsage.capacitySlots = entity.capacitySlots;
  }

  return slotUsage;
}

export function getDirectChildRecords(
  containerId: InventoryRecordId,
  records: InventoryRecord[],
): InventoryRecord[] {
  return records.filter(
    (record) =>
      locationHasContainerId(record.location) &&
      record.location.containerId === containerId,
  );
}

function getEffectiveRecordAndContentsSlotBurdenInner(
  record: InventoryRecord,
  records: InventoryRecord[],
  options: SlotBurdenOptions,
  visitedRecordIds: Set<InventoryRecordId>,
): number {
  if (visitedRecordIds.has(record.id)) {
    return 0;
  }

  visitedRecordIds.add(record.id);

  if (isExcludedByAncestor(record, records, options)) {
    return 0;
  }

  const childRecords = getDirectChildRecords(record.id, records);

  if (
    options.excludeHeldHandsRequiredContainers &&
    isHeldHandsRequiredContainer(record, childRecords)
  ) {
    return 0;
  }

  if (!record.container || childRecords.length === 0) {
    return getRecordSlotBurden(record);
  }

  const burdenMode = record.container.burdenMode ?? "contentsOnlyWhenLoaded";

  if (burdenMode === "fixedOnly") {
    return getRecordSlotBurden(record);
  }

  const childSlots = childRecords.reduce(
    (usedSlots, childRecord) =>
      usedSlots +
      getEffectiveRecordAndContentsSlotBurdenInner(
        childRecord,
        records,
        options,
        new Set(visitedRecordIds),
      ),
    0,
  );

  if (burdenMode === "containerPlusContents") {
    return getRecordSlotBurden(record) + childSlots;
  }

  return childSlots;
}

function isExcludedByAncestor(
  record: InventoryRecord,
  records: InventoryRecord[],
  options: SlotBurdenOptions,
): boolean {
  return getAncestorRecords(record, records).some((ancestor) => {
    if (ancestor.container?.burdenMode === "fixedOnly") {
      return true;
    }

    if (!options.excludeHeldHandsRequiredContainers) {
      return false;
    }

    return isHeldHandsRequiredContainer(
      ancestor,
      getDirectChildRecords(ancestor.id, records),
    );
  });
}

function getAncestorRecords(
  record: InventoryRecord,
  records: InventoryRecord[],
): InventoryRecord[] {
  const ancestors: InventoryRecord[] = [];
  const visitedRecordIds = new Set<InventoryRecordId>([record.id]);
  let currentRecord = record;

  while (locationHasContainerId(currentRecord.location)) {
    const containerId = currentRecord.location.containerId;

    if (visitedRecordIds.has(containerId)) {
      break;
    }

    visitedRecordIds.add(containerId);

    const parentRecord = records.find(
      (candidateRecord) => candidateRecord.id === containerId,
    );

    if (!parentRecord) {
      break;
    }

    ancestors.push(parentRecord);
    currentRecord = parentRecord;
  }

  return ancestors;
}

function isHeldHandsRequiredContainer(
  record: InventoryRecord,
  childRecords: InventoryRecord[],
): boolean {
  return (
    Boolean(record.container && getRecordHandsRequired(record) > 0) &&
    childRecords.length > 0 &&
    record.location.locationType === "equipped" &&
    isHandPlacement(record.location.placement)
  );
}

function isHandPlacement(placement: string): boolean {
  return (
    placement === "leftHand" ||
    placement === "rightHand" ||
    placement === "bothHands"
  );
}

function locationHasContainerId(
  location: InventoryLocation,
): location is InventoryLocation & { containerId: InventoryRecordId } {
  return "containerId" in location;
}

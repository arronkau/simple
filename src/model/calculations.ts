import type {
  CharacterData,
  CoinData,
  Entity,
  EntityId,
  InventoryLocation,
  InventoryRecord,
  InventoryRecordId,
} from "./types";

export type SlotBurdenOptions = {
  excludeHeldHandsRequiredContainers?: boolean;
  excludeHeldContainerContents?: boolean;
};

export type SlotUsage = {
  usedSlots: number;
  capacitySlots?: number;
};

export type CharacterArmorClassResult = {
  armorClass: number;
  baseArmorClass: number;
  equippedArmorRecordIds: InventoryRecordId[];
  itemModifier: number;
  manualModifier: number;
  manualOverride?: number;
  shieldRecordIds: InventoryRecordId[];
  warnings: CharacterArmorClassWarning[];
};

export type CharacterArmorClassWarning = {
  code: "multipleArmorsEquipped";
  entityId: EntityId;
  message: "Multiple armors equipped.";
  recordIds: InventoryRecordId[];
};

export const MOVEMENT_SLOT_BURDEN_OPTIONS: SlotBurdenOptions = {
  excludeHeldContainerContents: true,
};

const DEFAULT_ASCENDING_ARMOR_CLASS = 10;

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

  switch (record.burden.kind) {
    case "fixed":
      return record.quantity * record.burden.slotsPerItem;
    case "stacked":
      return Math.ceil(record.quantity / record.burden.itemsPerSlot);
    case "none":
      return 0;
  }
}

export function getCharacterArmorClass(
  entity: Entity,
  records: InventoryRecord[],
  characterData?: CharacterData,
): CharacterArmorClassResult {
  const ownedRecords = records.filter((record) => record.entityId === entity.id);
  const activeArmorRecords = getActiveArmorRecords(entity, records);
  const bestArmor = [...activeArmorRecords].sort(
    (leftRecord, rightRecord) =>
      getArmorRecordArmorClass(rightRecord) - getArmorRecordArmorClass(leftRecord),
  )[0];
  const shieldRecords = ownedRecords.filter(isHeldShieldRecord);
  const shieldBonus = shieldRecords.reduce(
    (bonus, record) => bonus + (record.armor.armorBonus ?? 0),
    0,
  );
  const itemModifier = ownedRecords
    .filter((record) => record.location.kind === "equipped")
    .flatMap((record) => record.modifiers ?? [])
    .filter((modifier) => modifier.target === "armorClass" && modifier.value > 0)
    .reduce((modifierTotal, modifier) => modifierTotal + modifier.value, 0);
  const manualModifier = characterData?.armorClass?.modifier ?? 0;
  const calculatedArmorClass =
    (bestArmor
      ? getArmorRecordArmorClass(bestArmor)
      : DEFAULT_ASCENDING_ARMOR_CLASS) +
    shieldBonus +
    itemModifier +
    manualModifier;
  const manualOverride = characterData?.armorClass?.override ?? undefined;
  const warnings: CharacterArmorClassWarning[] =
    activeArmorRecords.length > 1
      ? [
          {
            code: "multipleArmorsEquipped",
            entityId: entity.id,
            message: "Multiple armors equipped.",
            recordIds: activeArmorRecords.map((record) => record.id),
          },
        ]
      : [];

  return {
    armorClass: manualOverride ?? calculatedArmorClass,
    baseArmorClass: bestArmor
      ? getArmorRecordArmorClass(bestArmor)
      : DEFAULT_ASCENDING_ARMOR_CLASS,
    equippedArmorRecordIds: activeArmorRecords.map((record) => record.id),
    itemModifier,
    manualModifier,
    ...(manualOverride !== undefined ? { manualOverride } : {}),
    shieldRecordIds: shieldRecords.map((record) => record.id),
    warnings,
  };
}

export function isActiveArmorRecord(
  record: InventoryRecord,
): record is Extract<InventoryRecord, { recordType: "armor" }> {
  return (
    record.recordType === "armor" &&
    record.location.kind === "equipped" &&
    record.armor.baseArmorClass !== undefined
  );
}

export function getActiveArmorRecords(
  entity: Entity,
  records: InventoryRecord[],
): Extract<InventoryRecord, { recordType: "armor" }>[] {
  return records.filter(
    (r) => r.entityId === entity.id && isActiveArmorRecord(r),
  ) as Extract<InventoryRecord, { recordType: "armor" }>[];
}

export function isArmorClassActiveRecord(record: InventoryRecord): boolean {
  return isActiveArmorRecord(record) || isHeldShieldRecord(record);
}

function isHeldShieldRecord(
  record: InventoryRecord,
): record is Extract<InventoryRecord, { recordType: "armor" }> {
  return (
    record.recordType === "armor" &&
    record.armor.baseArmorClass === undefined &&
    (record.armor.armorBonus ?? 0) > 0 &&
    record.location.kind === "equipped" &&
    (record.location.placement === "leftHand" ||
      record.location.placement === "rightHand" ||
      record.location.placement === "bothHands")
  );
}

function getArmorRecordArmorClass(
  record: Extract<InventoryRecord, { recordType: "armor" }>,
): number {
  return (
    (record.armor.baseArmorClass ?? DEFAULT_ASCENDING_ARMOR_CLASS) +
    (record.armor.armorBonus ?? 0)
  );
}

export function getEffectiveRecordSlotBurden(
  record: InventoryRecord,
  records: InventoryRecord[],
  options: SlotBurdenOptions = {},
): number {
  if (isInsideHeldContainer(record, records, options)) {
    return 0;
  }

  return getRecordSlotBurden(record);
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
        record.entityId === entity.id && record.location.kind === "contents",
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
        record.entityId === entity.id &&
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

  return getRecordSlotBurden(record) + childSlots;
}

function isExcludedByAncestor(
  record: InventoryRecord,
  records: InventoryRecord[],
  options: SlotBurdenOptions,
): boolean {
  return getAncestorRecords(record, records).some((ancestor) => {
    if (!shouldExcludeHeldContainerContents(options)) {
      return false;
    }

    return isHeldContainer(ancestor);
  });
}

export function isInsideHeldContainer(
  record: InventoryRecord,
  records: InventoryRecord[],
  options: SlotBurdenOptions = MOVEMENT_SLOT_BURDEN_OPTIONS,
): boolean {
  if (!shouldExcludeHeldContainerContents(options)) {
    return false;
  }

  return getAncestorRecords(record, records).some(isHeldContainer);
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

function isHeldContainer(record: InventoryRecord): boolean {
  return (
    Boolean(record.container) &&
    record.location.kind === "equipped" &&
    isHandPlacement(record.location.placement)
  );
}

function shouldExcludeHeldContainerContents(
  options: SlotBurdenOptions,
): boolean {
  return Boolean(
    options.excludeHeldContainerContents ||
      options.excludeHeldHandsRequiredContainers,
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

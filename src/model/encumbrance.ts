import {
  getContainerSlotUsage,
  getContentsSlots,
  getDirectChildRecords,
  getEffectiveRecordSlotBurden,
  isInsideHeldContainer,
} from "./calculations";
import type {
  Entity,
  EntityId,
  InventoryRecord,
  InventoryRecordId,
} from "./types";
import { getRecordHandsRequired } from "./types";
import {
  findTopLevelStowedContainerRecords,
  isCharacterLikeEntity,
} from "./validation";

export type MovementRate = {
  explorationFeet: number;
  encounterFeet: number;
};

export type EncumbranceBand =
  | "normal"
  | "lightlyEncumbered"
  | "encumbered"
  | "heavilyEncumbered"
  | "overloaded";

export type EffectiveCarryState =
  | "equipped"
  | "stowed"
  | "contents"
  | "excluded";

export type CharacterEncumbranceResult = {
  equippedItems: number;
  stowedItems: number;
  equippedRate: MovementRate;
  stowedRate: MovementRate;
  movement: MovementRate;
  overloaded: boolean;
  overloadedReason?: "equipped" | "stowed" | "both";
  band: EncumbranceBand;
};

export type ContentsCapacityResult = {
  usedSlots: number;
  capacitySlots?: number;
  overloaded: boolean;
};

export type EncumbranceWarningCode =
  | "entityOverCapacity"
  | "containerOverCapacity"
  | "missingBackpack"
  | "handsRequiredContainerNotHeld"
  | "entityOverloaded";

export type EncumbranceWarning = {
  code: EncumbranceWarningCode;
  message: string;
  entityId: EntityId;
  recordId?: InventoryRecordId;
  usedSlots?: number;
  capacitySlots?: number;
};

const NORMAL_MOVEMENT: MovementRate = {
  explorationFeet: 120,
  encounterFeet: 40,
};

const LIGHTLY_ENCUMBERED_MOVEMENT: MovementRate = {
  explorationFeet: 90,
  encounterFeet: 30,
};

const ENCUMBERED_MOVEMENT: MovementRate = {
  explorationFeet: 60,
  encounterFeet: 20,
};

const HEAVILY_ENCUMBERED_MOVEMENT: MovementRate = {
  explorationFeet: 30,
  encounterFeet: 10,
};

const OVERLOADED_MOVEMENT: MovementRate = {
  explorationFeet: 0,
  encounterFeet: 0,
};

export function getEffectiveCarryState(
  record: InventoryRecord,
  records: InventoryRecord[],
): EffectiveCarryState {
  if (isExcludedFromMovementBurden(record, records)) {
    return "excluded";
  }

  const rootRecord = getTopLevelRecord(record, records);

  switch (rootRecord.location.kind) {
    case "equipped":
      return "equipped";
    case "stowedRoot":
    case "coinPurse":
      return "stowed";
    case "contents":
      return "contents";
    case "container":
      return "contents";
  }
}

export function getEquippedSlots(
  entity: Entity,
  records: InventoryRecord[],
): number {
  if (!isCharacterLikeEntity(entity)) {
    return 0;
  }

  return records
    .filter(
      (record) =>
        record.entityId === entity.id &&
        getEffectiveCarryState(record, records) === "equipped",
    )
    .reduce(
      (equippedSlots, record) =>
        equippedSlots + getMovementRecordSlotBurden(record, records),
      0,
    );
}

export function getStowedSlots(
  entity: Entity,
  records: InventoryRecord[],
): number {
  if (!isCharacterLikeEntity(entity)) {
    return 0;
  }

  return records
    .filter(
      (record) =>
        record.entityId === entity.id &&
        getEffectiveCarryState(record, records) === "stowed",
    )
    .reduce(
      (stowedSlots, record) =>
        stowedSlots + getMovementRecordSlotBurden(record, records),
      0,
    );
}

export function getMovementRateForEquippedItems(
  equippedItems: number,
): MovementRate | "overloaded" {
  if (equippedItems <= 3) {
    return NORMAL_MOVEMENT;
  }

  if (equippedItems <= 5) {
    return LIGHTLY_ENCUMBERED_MOVEMENT;
  }

  if (equippedItems <= 7) {
    return ENCUMBERED_MOVEMENT;
  }

  if (equippedItems <= 9) {
    return HEAVILY_ENCUMBERED_MOVEMENT;
  }

  return "overloaded";
}

export function getMovementRateForStowedItems(
  stowedItems: number,
): MovementRate | "overloaded" {
  if (stowedItems <= 10) {
    return NORMAL_MOVEMENT;
  }

  if (stowedItems <= 12) {
    return LIGHTLY_ENCUMBERED_MOVEMENT;
  }

  if (stowedItems <= 14) {
    return ENCUMBERED_MOVEMENT;
  }

  if (stowedItems <= 16) {
    return HEAVILY_ENCUMBERED_MOVEMENT;
  }

  return "overloaded";
}

export function getSlowerMovementRate(
  leftMovement: MovementRate,
  rightMovement: MovementRate,
): MovementRate {
  return leftMovement.explorationFeet <= rightMovement.explorationFeet
    ? leftMovement
    : rightMovement;
}

export function getCharacterEncumbrance(
  entity: Entity,
  records: InventoryRecord[],
): CharacterEncumbranceResult {
  const equippedItems = getEquippedSlots(entity, records);
  const stowedItems = getStowedSlots(entity, records);
  const equippedRate = getMovementRateForEquippedItems(equippedItems);
  const stowedRate = getMovementRateForStowedItems(stowedItems);
  const globallyOverloaded = equippedItems + stowedItems > 16;

  if (
    equippedRate === "overloaded" ||
    stowedRate === "overloaded" ||
    globallyOverloaded
  ) {
    const overloadedReason = getOverloadedReason(equippedRate, stowedRate);

    return {
      equippedItems,
      stowedItems,
      equippedRate:
        equippedRate === "overloaded" ? OVERLOADED_MOVEMENT : equippedRate,
      stowedRate: stowedRate === "overloaded" ? OVERLOADED_MOVEMENT : stowedRate,
      movement: OVERLOADED_MOVEMENT,
      overloaded: true,
      overloadedReason: overloadedReason ?? "both",
      band: "overloaded",
    };
  }

  const movement = getSlowerMovementRate(equippedRate, stowedRate);

  return {
    equippedItems,
    stowedItems,
    equippedRate,
    stowedRate,
    movement,
    overloaded: false,
    band: getEncumbranceBandForMovement(movement),
  };
}

export function getContentsCapacity(
  entity: Entity,
  records: InventoryRecord[],
): ContentsCapacityResult {
  const usedSlots = getContentsSlots(entity, records);

  if (entity.capacitySlots === undefined) {
    return {
      usedSlots,
      overloaded: false,
    };
  }

  return {
    usedSlots,
    capacitySlots: entity.capacitySlots,
    overloaded: usedSlots > entity.capacitySlots,
  };
}

export function getEncumbranceWarnings(
  entity: Entity,
  records: InventoryRecord[],
): EncumbranceWarning[] {
  return [
    ...getEntityCapacityWarnings(entity, records),
    ...getContainerCapacityWarnings(entity, records),
    ...getBackpackWarnings(entity, records),
    ...getHandsRequiredContainerWarnings(entity, records),
    ...getCharacterMovementWarnings(entity, records),
  ];
}

function getEntityCapacityWarnings(
  entity: Entity,
  records: InventoryRecord[],
): EncumbranceWarning[] {
  const usedSlots = isCharacterLikeEntity(entity)
    ? getEquippedSlots(entity, records) + getStowedSlots(entity, records)
    : getContentsCapacity(entity, records).usedSlots;

  if (entity.capacitySlots === undefined || usedSlots <= entity.capacitySlots) {
    return [];
  }

  return [
    {
      code: "entityOverCapacity",
      message: `${entity.name} is over capacity.`,
      entityId: entity.id,
      usedSlots,
      capacitySlots: entity.capacitySlots,
    },
  ];
}

function getContainerCapacityWarnings(
  entity: Entity,
  records: InventoryRecord[],
): EncumbranceWarning[] {
  return records.flatMap((record) => {
    if (record.entityId !== entity.id || !record.container) {
      return [];
    }

    const slotUsage = getContainerSlotUsage(record, records);

    if (
      slotUsage.capacitySlots === undefined ||
      slotUsage.usedSlots <= slotUsage.capacitySlots
    ) {
      return [];
    }

    return [
      {
        code: "containerOverCapacity",
        message: `${record.name} is over capacity.`,
        entityId: entity.id,
        recordId: record.id,
        usedSlots: slotUsage.usedSlots,
        capacitySlots: slotUsage.capacitySlots,
      },
    ];
  });
}

function getBackpackWarnings(
  entity: Entity,
  records: InventoryRecord[],
): EncumbranceWarning[] {
  if (
    !isCharacterLikeEntity(entity) ||
    findTopLevelStowedContainerRecords(entity.id, records).length > 0
  ) {
    return [];
  }

  return [
    {
      code: "missingBackpack",
      message: `${entity.name} is missing a top-level stowed container.`,
      entityId: entity.id,
    },
  ];
}

function getHandsRequiredContainerWarnings(
  entity: Entity,
  records: InventoryRecord[],
): EncumbranceWarning[] {
  if (!isCharacterLikeEntity(entity)) {
    return [];
  }

  return records.flatMap((record) => {
    if (
      record.entityId !== entity.id ||
      !record.container ||
      getRecordHandsRequired(record) === 0 ||
      getDirectChildRecords(record.id, records).length === 0 ||
      isHeldContainer(record)
    ) {
      return [];
    }

    return [
      {
        code: "handsRequiredContainerNotHeld",
        message: `${record.name} contains records but is not held.`,
        entityId: entity.id,
        recordId: record.id,
      },
    ];
  });
}

function getCharacterMovementWarnings(
  entity: Entity,
  records: InventoryRecord[],
): EncumbranceWarning[] {
  if (!isCharacterLikeEntity(entity)) {
    return [];
  }

  const encumbrance = getCharacterEncumbrance(entity, records);
  const totalSlots = encumbrance.equippedItems + encumbrance.stowedItems;

  if (encumbrance.overloaded) {
    return [
      {
        code: "entityOverloaded",
        message: `${entity.name} is overloaded: capacity (${totalSlots}/16 slots).`,
        entityId: entity.id,
        usedSlots: totalSlots,
      },
    ];
  }

  return [];
}

function getOverloadedReason(
  equippedRate: MovementRate | "overloaded",
  stowedRate: MovementRate | "overloaded",
): "equipped" | "stowed" | "both" | undefined {
  const equippedOverloaded = equippedRate === "overloaded";
  const stowedOverloaded = stowedRate === "overloaded";

  if (equippedOverloaded && stowedOverloaded) {
    return "both";
  }

  if (equippedOverloaded) {
    return "equipped";
  }

  if (stowedOverloaded) {
    return "stowed";
  }

  return undefined;
}

function getEncumbranceBandForMovement(
  movement: MovementRate,
): EncumbranceBand {
  switch (movement.explorationFeet) {
    case 120:
      return "normal";
    case 90:
      return "lightlyEncumbered";
    case 60:
      return "encumbered";
    case 30:
      return "heavilyEncumbered";
    default:
      return "overloaded";
  }
}

function isExcludedFromMovementBurden(
  record: InventoryRecord,
  records: InventoryRecord[],
): boolean {
  return isInsideHeldContainer(record, records);
}

function getMovementRecordSlotBurden(
  record: InventoryRecord,
  records: InventoryRecord[],
): number {
  return getEffectiveRecordSlotBurden(record, records);
}

function isHeldContainer(record: InventoryRecord): boolean {
  return (
    Boolean(record.container) &&
    record.location.kind === "equipped" &&
    isHandPlacement(record.location.placement)
  );
}

function getTopLevelRecord(
  record: InventoryRecord,
  records: InventoryRecord[],
): InventoryRecord {
  const visitedRecordIds = new Set<InventoryRecordId>([record.id]);
  let currentRecord = record;

  while (currentRecord.location.kind === "container") {
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

    currentRecord = parentRecord;
  }

  return currentRecord;
}

function isHandPlacement(placement: string): boolean {
  return (
    placement === "leftHand" ||
    placement === "rightHand" ||
    placement === "bothHands"
  );
}

import { getDirectChildRecords } from "./calculations";
import {
  createDefaultBackpack,
  type ContainerData,
  type Entity,
  type EntityId,
  type InventoryLocation,
  type InventoryRecord,
  type InventoryRecordId,
} from "./types";

export type ValidationIssueSeverity = "error" | "warning";

export type ValidationIssueCode =
  | "duplicateEntityId"
  | "duplicateInventoryRecordId"
  | "emptyEntityName"
  | "emptyInventoryRecordName"
  | "missingEntity"
  | "invalidEntityLocationType"
  | "invalidCoinLocation"
  | "invalidCoinCount"
  | "invalidInventoryQuantity"
  | "invalidInventoryBurden"
  | "invalidCoinPursePlacement"
  | "invalidBackpackPlacement"
  | "invalidTreasureContainer"
  | "invalidContainerReference"
  | "crossEntityContainment"
  | "containerCycle"
  | "nestedNonEmptyContainer"
  | "nestedContainerReceivingContents"
  | "handCollision"
  | "duplicateTopLevelStowedContainer"
  | "missingBackpack";

export type ValidationIssue = {
  severity: ValidationIssueSeverity;
  code: ValidationIssueCode;
  message: string;
  entityId?: EntityId;
  recordId?: InventoryRecordId;
  relatedRecordId?: InventoryRecordId;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

export type HandOccupancy = {
  leftHand?: InventoryRecordId;
  rightHand?: InventoryRecordId;
  bothHands?: InventoryRecordId;
  errors: string[];
};

type HandPlacement = "leftHand" | "rightHand" | "bothHands";

export type CreateInitialInventoryRecordsInput = {
  entity: Entity;
  backpackId: InventoryRecordId;
};

export function validateInventoryState(
  entities: Entity[],
  records: InventoryRecord[],
): ValidationResult {
  const issues: ValidationIssue[] = [
    ...validateUniqueEntityIds(entities),
    ...validateUniqueRecordIds(records),
    ...validateEntities(entities),
    ...validateRecordNames(records),
    ...validateNonCoinQuantityAndBurden(records),
    ...validateRecordLocations(entities, records),
    ...validateCoinRules(entities, records),
    ...validateHandOccupancy(entities, records),
    ...validateContainment(records),
    ...validateBackpackRules(entities, records),
  ];

  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function getHandOccupancy(
  entityId: EntityId,
  records: InventoryRecord[],
): HandOccupancy {
  const occupancy: HandOccupancy = {
    errors: [],
  };

  const handRecords = records.filter(
    (record) =>
      record.entityId === entityId &&
      record.location.kind === "equipped" &&
      isHandPlacement(record.location.placement),
  );

  for (const record of handRecords) {
    if (record.location.kind !== "equipped") {
      continue;
    }

    const placement = record.location.placement as HandPlacement;
    const existingRecordId = occupancy[placement];

    if (existingRecordId) {
      occupancy.errors.push(
        `${placement} is occupied by both ${existingRecordId} and ${record.id}.`,
      );
    } else {
      occupancy[placement] = record.id;
    }

  }

  if (occupancy.bothHands && (occupancy.leftHand || occupancy.rightHand)) {
    occupancy.errors.push(
      "bothHands cannot be occupied while leftHand or rightHand is occupied.",
    );
  }

  return occupancy;
}

export function findBackpackRecords(
  entityId: EntityId,
  records: InventoryRecord[],
): InventoryRecord[] {
  return findTopLevelStowedContainerRecords(entityId, records);
}

export function hasBackpack(
  entityId: EntityId,
  records: InventoryRecord[],
): boolean {
  return findBackpackRecords(entityId, records).length > 0;
}

export function findTopLevelStowedContainerRecords(
  entityId: EntityId,
  records: InventoryRecord[],
): InventoryRecord[] {
  return records.filter(
    (record) =>
      record.entityId === entityId &&
      isTopLevelStowedContainer(record),
  );
}

export function hasTopLevelStowedContainer(
  entityId: EntityId,
  records: InventoryRecord[],
): boolean {
  return findTopLevelStowedContainerRecords(entityId, records).length > 0;
}

export function createInitialInventoryRecordsForEntity({
  entity,
  backpackId,
}: CreateInitialInventoryRecordsInput): InventoryRecord[] {
  if (!isCharacterLikeEntity(entity)) {
    return [];
  }

  return [
    createDefaultBackpack({
      entityId: entity.id,
      id: backpackId,
    }),
  ];
}

export function isCharacterLikeEntity(entity: Entity): boolean {
  return entity.entityType === "character" || entity.entityType === "retainer";
}

function validateUniqueEntityIds(entities: Entity[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenEntityIds = new Set<EntityId>();

  for (const entity of entities) {
    if (seenEntityIds.has(entity.id)) {
      issues.push(
        errorIssue("duplicateEntityId", `Duplicate entity id ${entity.id}.`, {
          entityId: entity.id,
        }),
      );
    }

    seenEntityIds.add(entity.id);
  }

  return issues;
}

function validateUniqueRecordIds(records: InventoryRecord[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenRecordIds = new Set<InventoryRecordId>();

  for (const record of records) {
    if (seenRecordIds.has(record.id)) {
      issues.push(
        errorIssue(
          "duplicateInventoryRecordId",
          `Duplicate inventory record id ${record.id}.`,
          { recordId: record.id },
        ),
      );
    }

    seenRecordIds.add(record.id);
  }

  return issues;
}

function validateEntities(entities: Entity[]): ValidationIssue[] {
  return entities.flatMap((entity) =>
    !hasNonEmptyName(entity)
      ? [
          errorIssue("emptyEntityName", "Entity name must not be empty.", {
            entityId: entity.id,
          }),
        ]
      : [],
  );
}

function validateRecordNames(records: InventoryRecord[]): ValidationIssue[] {
  return records.flatMap((record) =>
    record.recordType !== "coins" && !hasNonEmptyName(record)
      ? [
          errorIssue(
            "emptyInventoryRecordName",
            "Non-coin inventory records must have a non-empty name.",
            { recordId: record.id, entityId: record.entityId },
          ),
        ]
      : [],
  );
}

function validateNonCoinQuantityAndBurden(
  records: InventoryRecord[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const record of records) {
    if (record.recordType === "coins") {
      continue;
    }

    if (!Number.isInteger(record.quantity) || record.quantity <= 0) {
      issues.push(
        errorIssue(
          "invalidInventoryQuantity",
          "Non-coin inventory records must have a positive integer quantity.",
          { recordId: record.id, entityId: record.entityId },
        ),
      );
    }

    switch (record.burden.kind) {
      case "fixed":
        if (
          typeof record.burden.slotsPerItem !== "number" ||
          !Number.isFinite(record.burden.slotsPerItem) ||
          record.burden.slotsPerItem < 0
        ) {
          issues.push(
            errorIssue(
              "invalidInventoryBurden",
              "Fixed inventory burden must have a non-negative slots-per-item value.",
              { recordId: record.id, entityId: record.entityId },
            ),
          );
        }
        break;
      case "stacked":
        if (
          !Number.isInteger(record.burden.itemsPerSlot) ||
          record.burden.itemsPerSlot <= 0
        ) {
          issues.push(
            errorIssue(
              "invalidInventoryBurden",
              "Stacked inventory burden must have a positive integer items-per-slot value.",
              { recordId: record.id, entityId: record.entityId },
            ),
          );
        }
        break;
      case "none":
        break;
    }
  }

  return issues;
}

function validateRecordLocations(
  entities: Entity[],
  records: InventoryRecord[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const entitiesById = new Map(entities.map((entity) => [entity.id, entity]));
  const recordsById = new Map(records.map((record) => [record.id, record]));

  for (const record of records) {
    const entity = entitiesById.get(record.entityId);

    if (!entity) {
      issues.push(
        errorIssue(
          "missingEntity",
          `Inventory record ${record.id} points to a missing entity.`,
          { recordId: record.id, entityId: record.entityId },
        ),
      );
      continue;
    }

    if (isCharacterLikeEntity(entity)) {
      if (record.location.kind === "contents") {
        issues.push(
          errorIssue(
            "invalidEntityLocationType",
            "Character-like entities must use equipped, stowed-root, coin-purse, or container locations.",
            { recordId: record.id, entityId: entity.id },
          ),
        );
      }
    } else if (
      record.location.kind !== "contents" &&
      record.location.kind !== "container"
    ) {
      issues.push(
        errorIssue(
          "invalidEntityLocationType",
          "Mounts, vehicles, and storage must use contents or container locations.",
          { recordId: record.id, entityId: entity.id },
        ),
      );
    }

    const recordWithPossibleContainer = record as InventoryRecord & {
      container?: ContainerData;
    };

    if (
      record.recordType === "treasure" &&
      recordWithPossibleContainer.container
    ) {
      issues.push(
        errorIssue(
          "invalidTreasureContainer",
          "Treasure records cannot be containers.",
          { recordId: record.id, entityId: entity.id },
        ),
      );
    }

    if (
      record.recordType !== "coins" &&
      record.location.kind === "coinPurse"
    ) {
      issues.push(
        errorIssue(
          "invalidCoinPursePlacement",
          "Only coin records may use coin-purse placement.",
          { recordId: record.id, entityId: entity.id },
        ),
      );
    }

    if (locationHasContainerId(record.location)) {
      const containerRecord = recordsById.get(record.location.containerId);

      if (!containerRecord) {
        issues.push(
          errorIssue(
            "invalidContainerReference",
            `Inventory record ${record.id} points to a missing container.`,
            {
              recordId: record.id,
              entityId: entity.id,
              relatedRecordId: record.location.containerId,
            },
          ),
        );
        continue;
      }

      if (!containerRecord.container) {
        issues.push(
          errorIssue(
            "invalidContainerReference",
            `Inventory record ${record.id} points to a non-container record.`,
            {
              recordId: record.id,
              entityId: entity.id,
              relatedRecordId: containerRecord.id,
            },
          ),
        );
      }

      if (containerRecord.entityId !== record.entityId) {
        issues.push(
          errorIssue(
            "crossEntityContainment",
            "Contained records must belong to the same entity as their container.",
            {
              recordId: record.id,
              entityId: entity.id,
              relatedRecordId: containerRecord.id,
            },
          ),
        );
      }
    }

    if (
      record.location.kind === "stowedRoot" &&
      !record.container
    ) {
      issues.push(
        errorIssue(
          "invalidBackpackPlacement",
          "Only containers can use stowed-root placement.",
          { recordId: record.id, entityId: entity.id },
        ),
      );
    }
  }

  return issues;
}

function validateCoinRules(
  entities: Entity[],
  records: InventoryRecord[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const entitiesById = new Map(entities.map((entity) => [entity.id, entity]));
  const characterCoinCounts = new Map<EntityId, number>();

  for (const record of records) {
    if (record.recordType !== "coins") {
      continue;
    }

    const entity = entitiesById.get(record.entityId);

    if (!entity) {
      continue;
    }

    if (isCharacterLikeEntity(entity)) {
      characterCoinCounts.set(
        entity.id,
        (characterCoinCounts.get(entity.id) ?? 0) + 1,
      );

      if (
        record.location.kind !== "coinPurse"
      ) {
        issues.push(
          errorIssue(
            "invalidCoinLocation",
            "Character-like coin records must use stowed coin-purse placement.",
            { recordId: record.id, entityId: entity.id },
          ),
        );
      }
    } else if (
      record.location.kind !== "contents" &&
      record.location.kind !== "container"
    ) {
      issues.push(
        errorIssue(
          "invalidCoinLocation",
          "Non-character coin records must use contents placement or contents container placement.",
          { recordId: record.id, entityId: entity.id },
        ),
      );
    }
  }

  for (const [entityId, coinCount] of characterCoinCounts.entries()) {
    if (coinCount > 1) {
      issues.push(
        errorIssue(
          "invalidCoinCount",
          "Character-like entities may have at most one coin record.",
          { entityId },
        ),
      );
    }
  }

  return issues;
}

function validateHandOccupancy(
  entities: Entity[],
  records: InventoryRecord[],
): ValidationIssue[] {
  return entities
    .filter(isCharacterLikeEntity)
    .flatMap((entity) =>
      getHandOccupancy(entity.id, records).errors.map((message) =>
        errorIssue("handCollision", message, { entityId: entity.id }),
      ),
    );
}

function validateContainment(records: InventoryRecord[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const record of records) {
    if (hasContainerCycle(record, records)) {
      issues.push(
        errorIssue("containerCycle", "Container references must not cycle.", {
          recordId: record.id,
          entityId: record.entityId,
        }),
      );
    }

    if (!record.container || !locationHasContainerId(record.location)) {
      continue;
    }

    const childRecords = getDirectChildRecords(record.id, records);
    const childContainerRecords = childRecords.filter(
      (childRecord) => Boolean(childRecord.container),
    );

    if (childContainerRecords.length > 0) {
      issues.push(
        errorIssue(
          "nestedNonEmptyContainer",
          "Nested containers cannot contain other containers.",
          { recordId: record.id, entityId: record.entityId },
        ),
      );
    }
  }

  for (const record of records) {
    if (!locationHasContainerId(record.location)) {
      continue;
    }

    const containerId = record.location.containerId;
    const containerRecord = records.find(
      (candidateRecord) => candidateRecord.id === containerId,
    );

    if (
      record.container &&
      containerRecord?.container &&
      locationHasContainerId(containerRecord.location)
    ) {
      issues.push(
        errorIssue(
          "nestedContainerReceivingContents",
          "Containers cannot be nested more than one level deep.",
          {
            recordId: record.id,
            entityId: record.entityId,
            relatedRecordId: containerRecord.id,
          },
        ),
      );
    }
  }

  return issues;
}

function validateBackpackRules(
  entities: Entity[],
  records: InventoryRecord[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const entity of entities.filter(isCharacterLikeEntity)) {
    const topLevelStowedContainers = findTopLevelStowedContainerRecords(
      entity.id,
      records,
    );

    if (topLevelStowedContainers.length === 0) {
      issues.push(
        warningIssue(
          "missingBackpack",
          "Character-like entities should have one top-level stowed container.",
          { entityId: entity.id },
        ),
      );
    }

    if (topLevelStowedContainers.length > 1) {
      issues.push(
        errorIssue(
          "duplicateTopLevelStowedContainer",
          "Character-like entities may not have more than one top-level stowed container.",
          { entityId: entity.id },
        ),
      );
    }
  }

  return issues;
}

function hasContainerCycle(
  record: InventoryRecord,
  records: InventoryRecord[],
): boolean {
  const visitedRecordIds = new Set<InventoryRecordId>([record.id]);
  let currentRecord = record;

  while (locationHasContainerId(currentRecord.location)) {
    const containerId = currentRecord.location.containerId;

    if (visitedRecordIds.has(containerId)) {
      return true;
    }

    visitedRecordIds.add(containerId);

    const containerRecord = records.find(
      (candidateRecord) => candidateRecord.id === containerId,
    );

    if (!containerRecord) {
      return false;
    }

    currentRecord = containerRecord;
  }

  return false;
}

function isHandPlacement(placement: string): placement is HandPlacement {
  return (
    placement === "leftHand" ||
    placement === "rightHand" ||
    placement === "bothHands"
  );
}

function isHandLocation(location: InventoryLocation): boolean {
  return (
    location.kind === "equipped" && isHandPlacement(location.placement)
  );
}

function isTopLevelStowedContainer(record: InventoryRecord): boolean {
  return Boolean(record.container) && record.location.kind === "stowedRoot";
}

function hasNonEmptyName(value: { name?: unknown }): boolean {
  return typeof value.name === "string" && value.name.trim().length > 0;
}

function locationHasContainerId(
  location: InventoryLocation,
): location is InventoryLocation & { containerId: InventoryRecordId } {
  return "containerId" in location;
}

function errorIssue(
  code: ValidationIssueCode,
  message: string,
  context: Omit<ValidationIssue, "severity" | "code" | "message"> = {},
): ValidationIssue {
  return {
    severity: "error",
    code,
    message,
    ...context,
  };
}

function warningIssue(
  code: ValidationIssueCode,
  message: string,
  context: Omit<ValidationIssue, "severity" | "code" | "message"> = {},
): ValidationIssue {
  return {
    severity: "warning",
    code,
    message,
    ...context,
  };
}

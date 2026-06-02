import { getDirectChildRecords } from "./calculations";
import {
  createDefaultBackpack,
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
  | "invalidCoinPursePlacement"
  | "invalidBackpackPlacement"
  | "invalidContainerReference"
  | "crossEntityContainment"
  | "containerCycle"
  | "nestedNonEmptyContainer"
  | "nestedContainerReceivingContents"
  | "handCollision"
  | "invalidHandPlacement"
  | "duplicateBackpack"
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
      record.location.entityId === entityId &&
      record.location.locationType === "equipped" &&
      isHandPlacement(record.location.placement),
  );

  for (const record of handRecords) {
    const placement = record.location.placement as HandPlacement;
    const existingRecordId = occupancy[placement];

    if (existingRecordId) {
      occupancy.errors.push(
        `${placement} is occupied by both ${existingRecordId} and ${record.id}.`,
      );
    } else {
      occupancy[placement] = record.id;
    }

    if (record.recordType === "weapon") {
      if (record.weapon.hands === "twoHands" && placement !== "bothHands") {
        occupancy.errors.push(
          `${record.id} is a two-handed weapon and must occupy bothHands.`,
        );
      }

      if (record.weapon.hands === "oneHand" && placement === "bothHands") {
        occupancy.errors.push(
          `${record.id} is a one-handed weapon and cannot occupy bothHands.`,
        );
      }
    }

    if (record.container?.handsRequired === 2 && placement !== "bothHands") {
      occupancy.errors.push(
        `${record.id} requires two hands and must occupy bothHands.`,
      );
    }

    if (
      record.container?.handsRequired === 1 &&
      placement !== "leftHand" &&
      placement !== "rightHand"
    ) {
      occupancy.errors.push(
        `${record.id} requires one hand and must occupy leftHand or rightHand.`,
      );
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
  return records.filter(
    (record) =>
      record.location.entityId === entityId &&
      record.container?.isBackpack === true,
  );
}

export function hasBackpack(
  entityId: EntityId,
  records: InventoryRecord[],
): boolean {
  return findBackpackRecords(entityId, records).length > 0;
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
            { recordId: record.id, entityId: record.location.entityId },
          ),
        ]
      : [],
  );
}

function validateRecordLocations(
  entities: Entity[],
  records: InventoryRecord[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const entitiesById = new Map(entities.map((entity) => [entity.id, entity]));
  const recordsById = new Map(records.map((record) => [record.id, record]));

  for (const record of records) {
    const entity = entitiesById.get(record.location.entityId);

    if (!entity) {
      issues.push(
        errorIssue(
          "missingEntity",
          `Inventory record ${record.id} points to a missing entity.`,
          { recordId: record.id, entityId: record.location.entityId },
        ),
      );
      continue;
    }

    if (isCharacterLikeEntity(entity)) {
      if (record.location.locationType === "contents") {
        issues.push(
          errorIssue(
            "invalidEntityLocationType",
            "Character-like entities must use equipped or stowed locations.",
            { recordId: record.id, entityId: entity.id },
          ),
        );
      }
    } else if (record.location.locationType !== "contents") {
      issues.push(
        errorIssue(
          "invalidEntityLocationType",
          "Mounts, vehicles, and storage must use contents locations.",
          { recordId: record.id, entityId: entity.id },
        ),
      );
    }

    if (
      record.recordType !== "coins" &&
      record.location.locationType === "stowed" &&
      record.location.placement === "coinPurse"
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

      if (containerRecord.location.entityId !== record.location.entityId) {
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

      if (
        record.location.locationType === "stowed" &&
        record.location.placement === "backpack" &&
        containerRecord.container?.isBackpack !== true
      ) {
        issues.push(
          errorIssue(
            "invalidBackpackPlacement",
            "Backpack placement must point to the entity's backpack container.",
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
      record.location.locationType === "stowed" &&
      record.location.placement === "backpack" &&
      !hasBackpack(entity.id, records)
    ) {
      issues.push(
        errorIssue(
          "invalidBackpackPlacement",
          "Non-coin records cannot use backpack placement unless a backpack exists.",
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

    const entity = entitiesById.get(record.location.entityId);

    if (!entity) {
      continue;
    }

    if (record.slotProfile.kind !== "coins") {
      issues.push(
        errorIssue("invalidCoinLocation", "Coin records must use coin slots.", {
          recordId: record.id,
          entityId: entity.id,
        }),
      );
    }

    if (isCharacterLikeEntity(entity)) {
      characterCoinCounts.set(
        entity.id,
        (characterCoinCounts.get(entity.id) ?? 0) + 1,
      );

      if (
        record.location.locationType !== "stowed" ||
        record.location.placement !== "coinPurse"
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
      record.location.locationType !== "contents" ||
      (record.location.placement !== "contents" &&
        record.location.placement !== "container")
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
      getHandOccupancy(entity.id, records).errors.map((message) => {
        const code =
          message.includes("must occupy") || message.includes("cannot occupy")
            ? "invalidHandPlacement"
            : "handCollision";

        return errorIssue(code, message, { entityId: entity.id });
      }),
    );
}

function validateContainment(records: InventoryRecord[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const record of records) {
    if (hasContainerCycle(record, records)) {
      issues.push(
        errorIssue("containerCycle", "Container references must not cycle.", {
          recordId: record.id,
          entityId: record.location.entityId,
        }),
      );
    }

    if (!record.container || !locationHasContainerId(record.location)) {
      continue;
    }

    const childRecords = getDirectChildRecords(record.id, records);

    if (childRecords.length > 0) {
      issues.push(
        errorIssue(
          "nestedNonEmptyContainer",
          "Non-empty containers cannot be placed inside another container.",
          { recordId: record.id, entityId: record.location.entityId },
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
      containerRecord?.container &&
      locationHasContainerId(containerRecord.location)
    ) {
      issues.push(
        errorIssue(
          "nestedContainerReceivingContents",
          "A container nested inside another container cannot receive contents.",
          {
            recordId: record.id,
            entityId: record.location.entityId,
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
    const backpacks = findBackpackRecords(entity.id, records);

    if (backpacks.length === 0) {
      issues.push(
        warningIssue(
          "missingBackpack",
          "Character-like entities should have one backpack container.",
          { entityId: entity.id },
        ),
      );
    }

    if (backpacks.length > 1) {
      issues.push(
        errorIssue(
          "duplicateBackpack",
          "Character-like entities may not have more than one backpack container.",
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

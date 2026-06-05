import { getRecordHandsRequired } from "./types";
import {
  normalizeEntityCharacterData,
  validateCharacterData,
} from "./characters";
import type {
  AuditLogEntry,
  AuditEventType,
  CharacterData,
  Entity,
  EntityType,
  EquippedPlacement,
  InventoryBurden,
  InventoryLocation,
  InventoryRecord,
  InventoryRecordType,
  KnownModifierTarget,
} from "./types";

export type AppState = {
  schemaVersion: 1;
  entities: Entity[];
  inventoryRecords: InventoryRecord[];
  auditLog: AuditLogEntry[];
};

export const APP_STATE_STORAGE_KEY = "simple.inventory.appState.v1";

export const EMPTY_APP_STATE: AppState = {
  schemaVersion: 1,
  entities: [],
  inventoryRecords: [],
  auditLog: [],
};

const AUDIT_EVENT_TYPES: AuditEventType[] = [
  "entityCreated",
  "entityDeleted",
  "entityActivated",
  "entityDeactivated",
  "inventoryRecordCreated",
  "inventoryRecordDeleted",
  "inventoryRecordIdentified",
  "inventoryRecordMoved",
  "coinsChanged",
  "treasureValueChanged",
];

const ENTITY_TYPES: EntityType[] = [
  "character",
  "retainer",
  "mount",
  "vehicle",
  "storage",
];

const EQUIPPED_PLACEMENTS: EquippedPlacement[] = [
  "leftHand",
  "rightHand",
  "bothHands",
  "loose",
];

const INVENTORY_RECORD_TYPES: InventoryRecordType[] = [
  "coins",
  "treasure",
  "weapon",
  "armor",
  "equipment",
];

const KNOWN_MODIFIER_TARGETS: KnownModifierTarget[] = [
  "armorClass",
  "attack",
  "damage",
  "savingThrow",
  "ability",
  "skill",
  "movement",
];

const ABILITY_SCORE_KEYS = ["str", "int", "wis", "dex", "con", "cha"] as const;
const CHARACTER_ALIGNMENTS = ["Law", "Neutrality", "Chaos", ""] as const;

export function createEmptyAppState(): AppState {
  return {
    schemaVersion: EMPTY_APP_STATE.schemaVersion,
    entities: [],
    inventoryRecords: [],
    auditLog: [],
  };
}

export function readLocalAppState(): AppState {
  if (!canUseLocalStorage()) {
    return createEmptyAppState();
  }

  try {
    const storedValue = window.localStorage.getItem(APP_STATE_STORAGE_KEY);

    if (!storedValue) {
      return createEmptyAppState();
    }

    const parsedValue: unknown = JSON.parse(storedValue);
    const parsedAppState = parseAppState(parsedValue);

    if (parsedAppState) {
      return parsedAppState;
    }
  } catch {
    return createEmptyAppState();
  }

  return createEmptyAppState();
}

export function writeLocalAppState(appState: AppState): void {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(appState));
  } catch {
    // Storage can fail in private contexts or when quota is exceeded.
  }
}

export function parseAppState(value: unknown): AppState | undefined {
  if (!isAppState(value)) {
    return undefined;
  }

  return {
    schemaVersion: 1,
    entities: normalizeEntities(value.entities),
    inventoryRecords: normalizeInventoryRecords(value.inventoryRecords),
    auditLog: normalizeAuditLog(value.auditLog),
  };
}

function normalizeEntities(entities: Entity[]): Entity[] {
  return entities.map(normalizeEntityCharacterData);
}

function normalizeInventoryRecords(records: unknown[]): InventoryRecord[] {
  return records.flatMap((record) => {
    if (!isInventoryRecordLike(record)) {
      return [];
    }

    const { slotProfile: legacySlotProfile, ...recordWithoutSlotProfile } =
      record as InventoryRecord & { slotProfile?: unknown };

    if (record.recordType === "coins") {
      return [recordWithoutSlotProfile as InventoryRecord];
    }

    const migratedRecord = {
      ...recordWithoutSlotProfile,
      quantity: normalizeInventoryQuantity(record, legacySlotProfile),
      burden: normalizeInventoryBurden(record, legacySlotProfile),
      container: normalizeContainerData(record.container),
      identification: normalizeIdentificationData(record.identification),
    } as InventoryRecord;

    return [
      {
        ...migratedRecord,
        handsRequired: getRecordHandsRequired(migratedRecord),
      },
    ];
  });
}

function normalizeInventoryQuantity(
  record: Record<string, unknown>,
  legacySlotProfile: unknown,
): number {
  if (isPositiveInteger(record.quantity)) {
    return record.quantity;
  }

  if (
    isRecordLike(legacySlotProfile) &&
    legacySlotProfile.kind === "stackable" &&
    isPositiveInteger(legacySlotProfile.quantity)
  ) {
    return legacySlotProfile.quantity;
  }

  return 1;
}

function normalizeInventoryBurden(
  record: Record<string, unknown>,
  legacySlotProfile: unknown,
): InventoryBurden {
  if (isRecordLike(record.burden)) {
    switch (record.burden.kind) {
      case "none":
        return { kind: "none" };
      case "fixed":
        return {
          kind: "fixed",
          slotsPerItem: normalizeNonNegativeNumber(
            record.burden.slotsPerItem,
            1,
          ),
        };
      case "stacked":
        return {
          kind: "stacked",
          itemsPerSlot: normalizePositiveInteger(
            record.burden.itemsPerSlot,
            1,
          ),
        };
    }
  }

  if (isRecordLike(legacySlotProfile)) {
    if (legacySlotProfile.kind === "fixed") {
      return {
        kind: "fixed",
        slotsPerItem: normalizeNonNegativeNumber(legacySlotProfile.slots, 1),
      };
    }

    if (legacySlotProfile.kind === "stackable") {
      return {
        kind: "stacked",
        itemsPerSlot: normalizePositiveInteger(legacySlotProfile.perSlot, 1),
      };
    }
  }

  return { kind: "fixed", slotsPerItem: 1 };
}

function normalizeContainerData(value: unknown) {
  if (!isRecordLike(value)) {
    return undefined;
  }

  return {
    capacitySlots: normalizeNonNegativeNumber(value.capacitySlots, 0),
    ...(value.handsRequired === 0 ||
    value.handsRequired === 1 ||
    value.handsRequired === 2
      ? { handsRequired: value.handsRequired }
      : {}),
  };
}

function normalizeAuditLog(auditLog: unknown): AuditLogEntry[] {
  return Array.isArray(auditLog) ? auditLog.filter(isAuditLogEntry) : [];
}

function isAppState(value: unknown): value is Omit<AppState, "auditLog" | "inventoryRecords"> & {
  inventoryRecords: unknown[];
  auditLog?: unknown;
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AppState>;

  if (
    candidate.schemaVersion !== 1 ||
    !Array.isArray(candidate.entities) ||
    !Array.isArray(candidate.inventoryRecords)
  ) {
    return false;
  }

  return (
    candidate.entities.every(isEntity) &&
    candidate.inventoryRecords.every(isInventoryRecordLike) &&
    (candidate.auditLog === undefined ||
      (Array.isArray(candidate.auditLog) &&
        candidate.auditLog.every(isAuditLogEntry)))
  );
}

function isEntity(value: unknown): value is Entity {
  if (!isRecordLike(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    ENTITY_TYPES.includes(value.entityType as EntityType) &&
    typeof value.active === "boolean" &&
    typeof value.sortOrder === "number" &&
    isOptionalNonNegativeNumber(value.capacitySlots) &&
    isOptionalNonNegativeNumber(value.baseMovementFeet) &&
    isOptionalCharacterData(value.character) &&
    (value.notes === undefined || typeof value.notes === "string") &&
    (value.createdAt === undefined || typeof value.createdAt === "string") &&
    (value.updatedAt === undefined || typeof value.updatedAt === "string")
  );
}

function isInventoryRecordLike(value: unknown): value is Record<string, unknown> {
  if (
    !isRecordLike(value) ||
    typeof value.id !== "string" ||
    typeof value.entityId !== "string" ||
    !INVENTORY_RECORD_TYPES.includes(value.recordType as InventoryRecordType) ||
    !isInventoryLocation(value.location) ||
    typeof value.sortOrder !== "number" ||
    (value.description !== undefined && typeof value.description !== "string") ||
    (value.notes !== undefined && typeof value.notes !== "string") ||
    (value.createdAt !== undefined && typeof value.createdAt !== "string") ||
    (value.updatedAt !== undefined && typeof value.updatedAt !== "string") ||
    !isOptionalUsesData(value.uses) ||
    !isOptionalLightData(value.light) ||
    !isOptionalModifierArray(value.modifiers)
  ) {
    return false;
  }

  if (value.recordType === "coins") {
    return isCoinData(value.coins);
  }

  const hasCurrentBurden =
    isPositiveInteger(value.quantity) && isInventoryBurden(value.burden);
  const hasLegacySlotProfile = isLegacySlotProfile(value.slotProfile);

  if (
    typeof value.name !== "string" ||
    (!hasCurrentBurden && !hasLegacySlotProfile) ||
    !isOptionalHandsRequired(value.handsRequired) ||
    !isOptionalContainerData(value.container) ||
    !isOptionalIdentificationData(value.identification)
  ) {
    return false;
  }

  switch (value.recordType) {
    case "treasure":
      return isTreasureData(value.treasure);
    case "weapon":
      return isOptionalRecordData(value.weapon);
    case "armor":
      return isOptionalRecordData(value.armor);
    case "equipment":
      return true;
  }

  return false;
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isInventoryLocation(value: unknown): value is InventoryLocation {
  if (!isRecordLike(value) || typeof value.kind !== "string") {
    return false;
  }

  switch (value.kind) {
    case "equipped":
      return EQUIPPED_PLACEMENTS.includes(value.placement as EquippedPlacement);
    case "stowedRoot":
    case "coinPurse":
    case "contents":
      return true;
    case "container":
      return typeof value.containerId === "string";
    default:
      return false;
  }
}

function isInventoryBurden(value: unknown): value is InventoryBurden {
  if (!isRecordLike(value) || typeof value.kind !== "string") {
    return false;
  }

  switch (value.kind) {
    case "none":
      return true;
    case "fixed":
      return isNonNegativeNumber(value.slotsPerItem);
    case "stacked":
      return isPositiveInteger(value.itemsPerSlot);
    default:
      return false;
  }
}

function isLegacySlotProfile(value: unknown): boolean {
  if (!isRecordLike(value)) {
    return false;
  }

  if (value.kind === "fixed") {
    return isNonNegativeNumber(value.slots);
  }

  if (value.kind === "stackable") {
    return isPositiveInteger(value.quantity) && isPositiveInteger(value.perSlot);
  }

  return false;
}

function isCoinData(value: unknown): boolean {
  if (!isRecordLike(value)) {
    return false;
  }

  return (
    isNonNegativeInteger(value.pp) &&
    isNonNegativeInteger(value.gp) &&
    isNonNegativeInteger(value.sp) &&
    isNonNegativeInteger(value.cp)
  );
}

function isTreasureData(value: unknown): boolean {
  return isRecordLike(value) && isNonNegativeNumber(value.gpValue);
}

function isOptionalRecordData(value: unknown): boolean {
  return value === undefined || isRecordLike(value);
}

function isOptionalContainerData(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }

  if (!isRecordLike(value)) {
    return false;
  }

  return (
    isNonNegativeNumber(value.capacitySlots) &&
    (value.isBackpack === undefined || typeof value.isBackpack === "boolean")
  );
}

function isOptionalIdentificationData(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }

  if (!isRecordLike(value)) {
    return false;
  }

  return (
    typeof value.identified === "boolean" &&
    (value.secretName === undefined || typeof value.secretName === "string") &&
    (value.secretDescription === undefined ||
      typeof value.secretDescription === "string") &&
    (value.unidentifiedName === undefined ||
      typeof value.unidentifiedName === "string") &&
    (value.unidentifiedDescription === undefined ||
      typeof value.unidentifiedDescription === "string")
  );
}

function normalizeIdentificationData(value: unknown) {
  if (!isRecordLike(value) || value.identified !== false) {
    return undefined;
  }

  const secretName =
    typeof value.secretName === "string"
      ? value.secretName
      : typeof value.unidentifiedName === "string"
        ? value.unidentifiedName
        : undefined;
  const secretDescription =
    typeof value.secretDescription === "string"
      ? value.secretDescription
      : typeof value.unidentifiedDescription === "string"
        ? value.unidentifiedDescription
        : undefined;

  return {
    identified: false,
    ...(secretName ? { secretName } : {}),
    ...(secretDescription ? { secretDescription } : {}),
  };
}

function isOptionalUsesData(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }

  return (
    isRecordLike(value) &&
    isNonNegativeInteger(value.current) &&
    (value.max === undefined || isNonNegativeInteger(value.max))
  );
}

function isOptionalLightData(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }

  return (
    isRecordLike(value) &&
    typeof value.isLit === "boolean" &&
    (value.lightDescription === undefined ||
      typeof value.lightDescription === "string")
  );
}

function isOptionalModifierArray(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }

  return (
    Array.isArray(value) &&
    value.every(
      (modifier) =>
        isRecordLike(modifier) &&
        (KNOWN_MODIFIER_TARGETS.includes(
          modifier.target as KnownModifierTarget,
        ) ||
          typeof modifier.target === "string") &&
        typeof modifier.value === "number" &&
        Number.isFinite(modifier.value) &&
        (modifier.label === undefined || typeof modifier.label === "string"),
    )
  );
}

function isOptionalHandsRequired(value: unknown): boolean {
  return value === undefined || value === 0 || value === 1 || value === 2;
}

function isOptionalCharacterData(value: unknown): boolean {
  return (
    value === undefined ||
    (isCharacterData(value) && validateCharacterData(value).valid)
  );
}

function isCharacterData(value: unknown): value is CharacterData {
  if (!isRecordLike(value) || !isRecordLike(value.hp)) {
    return false;
  }

  return (
    typeof value.className === "string" &&
    (value.level === null || isNonNegativeInteger(value.level)) &&
    CHARACTER_ALIGNMENTS.includes(
      value.alignment as (typeof CHARACTER_ALIGNMENTS)[number],
    ) &&
    (value.xp === null || isNonNegativeInteger(value.xp)) &&
    (value.hp.current === null || isNonNegativeInteger(value.hp.current)) &&
    (value.hp.max === null || isNonNegativeInteger(value.hp.max)) &&
    isAbilityScores(value.abilityScores) &&
    isCharacterSkills(value.skills) &&
    Array.isArray(value.languages) &&
    value.languages.every((language) => typeof language === "string") &&
    typeof value.description === "string" &&
    isCharacterFeatures(value.features)
  );
}

function isAbilityScores(value: unknown): boolean {
  if (!isRecordLike(value)) {
    return false;
  }

  return ABILITY_SCORE_KEYS.every(
    (key) => value[key] === null || isPositiveInteger(value[key]),
  );
}

function isCharacterSkills(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (skill) =>
        isRecordLike(skill) &&
        typeof skill.id === "string" &&
        typeof skill.name === "string" &&
        isPositiveInteger(skill.chanceInSix) &&
        skill.chanceInSix <= 6 &&
        (skill.description === undefined ||
          typeof skill.description === "string"),
    )
  );
}

function isCharacterFeatures(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (feature) =>
        isRecordLike(feature) &&
        typeof feature.id === "string" &&
        typeof feature.title === "string" &&
        typeof feature.description === "string",
    )
  );
}

function isOptionalNonNegativeNumber(value: unknown): boolean {
  return value === undefined || isNonNegativeNumber(value);
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  return isPositiveInteger(value) ? value : fallback;
}

function normalizeNonNegativeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isAuditLogEntry(value: unknown): value is AuditLogEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AuditLogEntry>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.actorLabel === "string" &&
    AUDIT_EVENT_TYPES.includes(candidate.eventType as AuditEventType) &&
    typeof candidate.summary === "string" &&
    (candidate.entityId === undefined || typeof candidate.entityId === "string") &&
    (candidate.recordId === undefined || typeof candidate.recordId === "string") &&
    (candidate.details === undefined || isAuditLogDetails(candidate.details))
  );
}

function isAuditLogDetails(value: unknown): boolean {
  if (!isRecordLike(value)) {
    return false;
  }

  return Object.values(value).every(
    (detailValue) =>
      detailValue === null ||
      typeof detailValue === "string" ||
      typeof detailValue === "number" ||
      typeof detailValue === "boolean",
  );
}

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && "localStorage" in window;
}

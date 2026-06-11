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
  ISODateTimeString,
  InventoryBurden,
  InventoryLocation,
  InventoryRecord,
  InventoryRecordType,
  KnownModifierTarget,
  PartyMember,
  PartyMembers,
  PartyRole,
  UserProfile,
  UserRole,
} from "./types";

export type AppState = {
  schemaVersion: 1;
  entities: Entity[];
  inventoryRecords: InventoryRecord[];
  auditLog: AuditLogEntry[];
};

export type PartyId = string;

export type PartyState = {
  schemaVersion: 1;
  party: {
    id: PartyId;
    displayName: string;
    gmUid?: string;
    members?: PartyMembers;
  };
  appState: AppState;
  userProfiles: UserProfile[];
};

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string; path?: string };

export const APP_STATE_STORAGE_KEY = "simple.inventory.appState.v1";
export const PARTY_STATE_STORAGE_KEY_PREFIX = "simple.inventory.partyState.v1.";

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

const ABILITY_SCORE_KEYS = ["strength", "intelligence", "wisdom", "dexterity", "constitution", "charisma"] as const;
const CHARACTER_ALIGNMENTS = ["Law", "Neutrality", "Chaos", ""] as const;
const USER_ROLES: UserRole[] = ["GM", "Player"];

export function createEmptyAppState(): AppState {
  return {
    schemaVersion: EMPTY_APP_STATE.schemaVersion,
    entities: [],
    inventoryRecords: [],
    auditLog: [],
  };
}

export function createPartyState({
  appState = createEmptyAppState(),
  displayName = "New Party",
  gmUid,
  members,
  partyId,
  userProfiles = [],
}: {
  appState?: AppState;
  displayName?: string;
  gmUid?: string;
  members?: PartyMembers;
  partyId: PartyId;
  userProfiles?: UserProfile[];
}): PartyState {
  return {
    schemaVersion: 1,
    party: {
      id: partyId,
      displayName: normalizePartyDisplayName(displayName),
      ...(gmUid !== undefined ? { gmUid } : {}),
      ...(members !== undefined ? { members } : {}),
    },
    appState,
    userProfiles,
  };
}

/**
 * Ensures a party has valid membership data keyed by Firebase Auth UID.
 * Called after loading a party — assigns the current user as GM if the party
 * has no membership yet (pragmatic migration for pre-permission parties).
 */
export function migratePartyMembership(
  partyState: PartyState,
  currentUid: string,
): PartyState {
  const { gmUid, members } = partyState.party;

  // Already fully initialized — do not auto-add unknown users
  if (gmUid && members && members[gmUid]?.role === "gm") {
    return partyState;
  }

  // No membership at all — assign current user as GM
  if (!gmUid) {
    const now = new Date().toISOString() as ISODateTimeString;
    return {
      ...partyState,
      party: {
        ...partyState.party,
        gmUid: currentUid,
        members: {
          ...members,
          [currentUid]: { role: "gm" as PartyRole, joinedAt: now },
        },
      },
    };
  }

  // gmUid exists but members record for GM is missing — repair
  if (gmUid && (!members || !members[gmUid])) {
    const now = new Date().toISOString() as ISODateTimeString;
    const repairedMembers: PartyMembers = {
      ...(members ?? {}),
      [gmUid]: { role: "gm" as PartyRole, joinedAt: now },
    };
    return {
      ...partyState,
      party: { ...partyState.party, members: repairedMembers },
    };
  }

  return partyState;
}

export function getLocalPartyStateStorageKey(partyId: PartyId): string {
  return `${PARTY_STATE_STORAGE_KEY_PREFIX}${partyId}`;
}

export function readLocalPartyState(partyId: PartyId): PartyState {
  if (!canUseLocalStorage()) {
    return createPartyState({ partyId });
  }

  try {
    const storedValue = window.localStorage.getItem(
      getLocalPartyStateStorageKey(partyId),
    );

    if (!storedValue) {
      return createPartyState({ partyId });
    }

    const parsedValue: unknown = JSON.parse(storedValue);
    const parsedPartyState = parsePartyState(parsedValue, partyId);

    if (parsedPartyState) {
      return parsedPartyState;
    }
  } catch {
    return createPartyState({ partyId });
  }

  return createPartyState({ partyId });
}

export function writeLocalPartyState(partyState: PartyState): void {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(
      getLocalPartyStateStorageKey(partyState.party.id),
      JSON.stringify(partyState),
    );
  } catch {
    // Storage can fail in private contexts or when quota is exceeded.
  }
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
  const result = parseAppStateResult(value);

  return result.ok ? result.value : undefined;
}

export function parseAppStateResult(value: unknown): ParseResult<AppState> {
  const validationResult = validateAppStateShape(value, "data");

  if (!validationResult.ok) {
    return validationResult;
  }

  const appState = validationResult.value;
  const entities = normalizeEntities(appState.entities);
  const inventoryRecords = normalizeInventoryRecords(appState.inventoryRecords);

  return {
    ok: true,
    value: {
      schemaVersion: 1,
      entities,
      inventoryRecords: fixRecordLocations(entities, inventoryRecords),
      auditLog: normalizeAuditLog(appState.auditLog),
    },
  };
}

export function parsePartyState(
  value: unknown,
  expectedPartyId?: PartyId,
): PartyState | undefined {
  if (!isRecordLike(value) || value.schemaVersion !== 1) {
    return undefined;
  }

  const party = value.party;

  if (!isRecordLike(party) || typeof party.id !== "string") {
    return undefined;
  }

  if (expectedPartyId !== undefined && party.id !== expectedPartyId) {
    return undefined;
  }

  const appState = parseAppState(value.appState);

  if (!appState) {
    return undefined;
  }

  return createPartyState({
    appState,
    displayName:
      typeof party.displayName === "string" ? party.displayName : "New Party",
    gmUid: typeof party.gmUid === "string" ? party.gmUid : undefined,
    members: normalizePartyMembers(party.members),
    partyId: party.id,
    userProfiles: normalizeUserProfiles(value.userProfiles),
  });
}

export function normalizePartyDisplayName(displayName: string): string {
  const trimmedName = displayName.trim();

  return trimmedName.length > 0 ? trimmedName : "New Party";
}

// Records on non-character-like entities must use "contents" or "container" locations.
// Records that violate this (e.g. from an entity-type change before transition guards
// were enforced) are remapped to "contents" so they don't permanently block operations.
function fixRecordLocations(entities: Entity[], records: InventoryRecord[]): InventoryRecord[] {
  const entitiesById = new Map(entities.map((e) => [e.id, e]));
  let changed = false;
  const fixed = records.map((record) => {
    const entity = entitiesById.get(record.entityId);
    if (!entity) return record;
    const isCharacterLike =
      entity.entityType === "character" || entity.entityType === "retainer";
    if (
      !isCharacterLike &&
      record.location.kind !== "contents" &&
      record.location.kind !== "container"
    ) {
      changed = true;
      return { ...record, location: { kind: "contents" as const } };
    }
    return record;
  });
  return changed ? fixed : records;
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

function normalizeUserProfiles(value: unknown): UserProfile[] {
  return Array.isArray(value) ? value.filter(isUserProfile) : [];
}

function normalizePartyMembers(value: unknown): PartyMembers | undefined {
  if (!isRecordLike(value)) return undefined;
  const result: PartyMembers = {};
  for (const [uid, member] of Object.entries(value)) {
    if (typeof uid !== "string" || !isRecordLike(member)) continue;
    const role = member.role;
    if (role !== "gm" && role !== "player") continue;
    result[uid] = {
      role: role as PartyRole,
      ...(typeof member.joinedAt === "string" ? { joinedAt: member.joinedAt as ISODateTimeString } : {}),
      ...(typeof member.displayName === "string" ? { displayName: member.displayName } : {}),
    } satisfies PartyMember;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function validateAppStateShape(
  value: unknown,
  rootPath: string,
): ParseResult<
  Omit<AppState, "auditLog" | "inventoryRecords"> & {
    inventoryRecords: unknown[];
    auditLog?: unknown;
  }
> {
  if (!isRecordLike(value)) {
    return {
      ok: false,
      path: rootPath,
      message: "Expected app state object.",
    };
  }

  if (value.schemaVersion !== 1) {
    return {
      ok: false,
      path: `${rootPath}.schemaVersion`,
      message:
        value.schemaVersion === undefined
          ? "Missing schemaVersion 1."
          : `Unsupported app-state schemaVersion: ${String(value.schemaVersion)}.`,
    };
  }

  if (!Array.isArray(value.entities)) {
    return {
      ok: false,
      path: `${rootPath}.entities`,
      message: '"data.entities" must be an array.',
    };
  }

  if (!Array.isArray(value.inventoryRecords)) {
    return {
      ok: false,
      path: `${rootPath}.inventoryRecords`,
      message: '"data.inventoryRecords" must be an array.',
    };
  }

  if (value.auditLog !== undefined && !Array.isArray(value.auditLog)) {
    return {
      ok: false,
      path: `${rootPath}.auditLog`,
      message: '"data.auditLog" must be an array.',
    };
  }

  for (const [index, entity] of value.entities.entries()) {
    const entityResult = validateEntityShape(entity, `${rootPath}.entities[${index}]`);

    if (!entityResult.ok) {
      return entityResult;
    }
  }

  for (const [index, record] of value.inventoryRecords.entries()) {
    const recordResult = validateInventoryRecordShape(
      record,
      `${rootPath}.inventoryRecords[${index}]`,
    );

    if (!recordResult.ok) {
      return recordResult;
    }
  }

  if (Array.isArray(value.auditLog)) {
    for (const [index, entry] of value.auditLog.entries()) {
      const entryResult = validateAuditLogEntryShape(
        entry,
        `${rootPath}.auditLog[${index}]`,
      );

      if (!entryResult.ok) {
        return entryResult;
      }
    }
  }

  return {
    ok: true,
    value: value as Omit<AppState, "auditLog" | "inventoryRecords"> & {
      inventoryRecords: unknown[];
      auditLog?: unknown;
    },
  };
}

function validateEntityShape(
  value: unknown,
  path: string,
): ParseResult<Entity> {
  if (!isRecordLike(value)) {
    return { ok: false, path, message: "Expected entity object." };
  }

  if (typeof value.id !== "string") {
    return { ok: false, path: `${path}.id`, message: "Missing required string id." };
  }

  if (typeof value.name !== "string") {
    return {
      ok: false,
      path: `${path}.name`,
      message: "Missing required string name.",
    };
  }

  if (!ENTITY_TYPES.includes(value.entityType as EntityType)) {
    return {
      ok: false,
      path: `${path}.entityType`,
      message: "Invalid entity type.",
    };
  }

  if (typeof value.active !== "boolean") {
    return {
      ok: false,
      path: `${path}.active`,
      message: "Missing required boolean active.",
    };
  }

  if (typeof value.sortOrder !== "number") {
    return {
      ok: false,
      path: `${path}.sortOrder`,
      message: "Missing required numeric sortOrder.",
    };
  }

  if (!isOptionalNonNegativeNumber(value.capacitySlots)) {
    return {
      ok: false,
      path: `${path}.capacitySlots`,
      message: "Expected non-negative number.",
    };
  }

  if (!isOptionalNonNegativeNumber(value.baseMovementFeet)) {
    return {
      ok: false,
      path: `${path}.baseMovementFeet`,
      message: "Expected non-negative number.",
    };
  }

  if (!isOptionalCharacterData(value.character)) {
    return {
      ok: false,
      path: `${path}.character`,
      message: "Invalid character data.",
    };
  }

  if (value.notes !== undefined && typeof value.notes !== "string") {
    return { ok: false, path: `${path}.notes`, message: "Expected string." };
  }

  if (value.createdAt !== undefined && typeof value.createdAt !== "string") {
    return { ok: false, path: `${path}.createdAt`, message: "Expected string." };
  }

  if (value.updatedAt !== undefined && typeof value.updatedAt !== "string") {
    return { ok: false, path: `${path}.updatedAt`, message: "Expected string." };
  }

  return { ok: true, value: value as Entity };
}

type ForbiddenFieldConfig = {
  key: string;
  label: string;
};

const FORBIDDEN_COIN_RECORD_FIELDS: ForbiddenFieldConfig[] = [
  { key: "quantity", label: "quantity" },
  { key: "burden", label: "burden" },
  { key: "treasure", label: "treasure data" },
  { key: "weapon", label: "weapon data" },
  { key: "armor", label: "armor data" },
  { key: "container", label: "container data" },
  { key: "identification", label: "identification data" },
];

function validateCoinRecordFields(
  value: Record<string, unknown>,
  path: string,
): ParseResult<void> {
  for (const field of FORBIDDEN_COIN_RECORD_FIELDS) {
    if (value[field.key] !== undefined) {
      return {
        ok: false,
        path: `${path}.${field.key}`,
        message: `Coin records must not have ${field.label}.`,
      };
    }
  }
  return { ok: true, value: undefined };
}

function validateInventoryRecordShape(
  value: unknown,
  path: string,
): ParseResult<Record<string, unknown>> {
  if (!isRecordLike(value)) {
    return { ok: false, path, message: "Expected inventory record object." };
  }

  if (typeof value.id !== "string") {
    return { ok: false, path: `${path}.id`, message: "Missing required string id." };
  }

  if (typeof value.entityId !== "string") {
    return {
      ok: false,
      path: `${path}.entityId`,
      message: "Missing required string entityId.",
    };
  }

  if (!INVENTORY_RECORD_TYPES.includes(value.recordType as InventoryRecordType)) {
    return {
      ok: false,
      path: `${path}.recordType`,
      message: "Invalid inventory record type.",
    };
  }

  const locationResult = validateInventoryLocationShape(
    value.location,
    `${path}.location`,
  );

  if (!locationResult.ok) {
    return locationResult;
  }

  if (typeof value.sortOrder !== "number") {
    return {
      ok: false,
      path: `${path}.sortOrder`,
      message: "Missing required numeric sortOrder.",
    };
  }

  if (value.description !== undefined && typeof value.description !== "string") {
    return { ok: false, path: `${path}.description`, message: "Expected string." };
  }

  if (value.notes !== undefined && typeof value.notes !== "string") {
    return { ok: false, path: `${path}.notes`, message: "Expected string." };
  }

  if (value.createdAt !== undefined && typeof value.createdAt !== "string") {
    return { ok: false, path: `${path}.createdAt`, message: "Expected string." };
  }

  if (value.updatedAt !== undefined && typeof value.updatedAt !== "string") {
    return { ok: false, path: `${path}.updatedAt`, message: "Expected string." };
  }

  if (!isOptionalUsesData(value.uses)) {
    return { ok: false, path: `${path}.uses`, message: "Invalid uses data." };
  }

  if (!isOptionalLightData(value.light)) {
    return { ok: false, path: `${path}.light`, message: "Invalid light data." };
  }

  if (!isOptionalModifierArray(value.modifiers)) {
    return {
      ok: false,
      path: `${path}.modifiers`,
      message: "Invalid modifiers.",
    };
  }

  if (value.recordType === "coins") {
    if (!isCoinData(value.coins)) {
      return { ok: false, path: `${path}.coins`, message: "Invalid coin data." };
    }

    const forbiddenFieldResult = validateCoinRecordFields(value, path);
    if (!forbiddenFieldResult.ok) {
      return forbiddenFieldResult;
    }

    return { ok: true, value };
  }

  const hasCurrentBurden =
    isPositiveInteger(value.quantity) && isInventoryBurden(value.burden);
  const hasLegacySlotProfile = isLegacySlotProfile(value.slotProfile);

  if (typeof value.name !== "string") {
    return {
      ok: false,
      path: `${path}.name`,
      message: "Missing required string name.",
    };
  }

  if (!hasCurrentBurden && !hasLegacySlotProfile) {
    return {
      ok: false,
      path: `${path}.burden`,
      message: "Missing or invalid burden.",
    };
  }

  if (!isOptionalHandsRequired(value.handsRequired)) {
    return {
      ok: false,
      path: `${path}.handsRequired`,
      message: "Invalid handsRequired.",
    };
  }

  if (!isOptionalContainerData(value.container)) {
    return {
      ok: false,
      path: `${path}.container`,
      message: "Invalid container data.",
    };
  }

  if (!isOptionalIdentificationData(value.identification)) {
    return {
      ok: false,
      path: `${path}.identification`,
      message: "Invalid identification data.",
    };
  }

  switch (value.recordType) {
    case "treasure":
      return isTreasureData(value.treasure)
        ? { ok: true, value }
        : { ok: false, path: `${path}.treasure`, message: "Invalid treasure data." };
    case "weapon":
      return isOptionalRecordData(value.weapon)
        ? { ok: true, value }
        : { ok: false, path: `${path}.weapon`, message: "Invalid weapon data." };
    case "armor":
      return isOptionalRecordData(value.armor)
        ? { ok: true, value }
        : { ok: false, path: `${path}.armor`, message: "Invalid armor data." };
    case "equipment":
      return { ok: true, value };
  }

  return {
    ok: false,
    path: `${path}.recordType`,
    message: "Invalid inventory record type.",
  };
}

function validateInventoryLocationShape(
  value: unknown,
  path: string,
): ParseResult<InventoryLocation> {
  if (!isRecordLike(value)) {
    return { ok: false, path, message: "Missing required location object." };
  }

  if (typeof value.kind !== "string") {
    return {
      ok: false,
      path: `${path}.kind`,
      message: "Missing required location kind.",
    };
  }

  switch (value.kind) {
    case "equipped":
      return EQUIPPED_PLACEMENTS.includes(value.placement as EquippedPlacement)
        ? { ok: true, value: value as InventoryLocation }
        : {
            ok: false,
            path: `${path}.placement`,
            message: "Invalid equipped placement.",
          };
    case "stowedRoot":
    case "coinPurse":
    case "contents":
      return { ok: true, value: value as InventoryLocation };
    case "container":
      return typeof value.containerId === "string"
        ? { ok: true, value: value as InventoryLocation }
        : {
            ok: false,
            path: `${path}.containerId`,
            message: "Missing required string containerId.",
          };
    default:
      return {
        ok: false,
        path: `${path}.kind`,
        message: "Invalid location kind.",
      };
  }
}

function validateAuditLogEntryShape(
  value: unknown,
  path: string,
): ParseResult<AuditLogEntry> {
  return isAuditLogEntry(value)
    ? { ok: true, value }
    : { ok: false, path, message: "Invalid audit log entry." };
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

  return isNonNegativeNumber(value.capacitySlots);
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
    isCharacterArmorClass(value.armorClass) &&
    isAbilityScores(value.abilityScores) &&
    isCharacterSkills(value.skills) &&
    Array.isArray(value.languages) &&
    value.languages.every((language) => typeof language === "string") &&
    typeof value.description === "string" &&
    isCharacterFeatures(value.features)
  );
}

function isCharacterArmorClass(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }

  return (
    isRecordLike(value) &&
    Number.isInteger(value.modifier) &&
    (value.override === null || isNonNegativeInteger(value.override))
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
        typeof feature.name === "string" &&
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
    (candidate.actorRole === undefined ||
      USER_ROLES.includes(candidate.actorRole as UserRole)) &&
    (candidate.actorUserId === undefined ||
      typeof candidate.actorUserId === "string") &&
    AUDIT_EVENT_TYPES.includes(candidate.eventType as AuditEventType) &&
    typeof candidate.summary === "string" &&
    (candidate.entityId === undefined || typeof candidate.entityId === "string") &&
    (candidate.recordId === undefined || typeof candidate.recordId === "string") &&
    (candidate.details === undefined || isAuditLogDetails(candidate.details))
  );
}

function isUserProfile(value: unknown): value is UserProfile {
  if (!isRecordLike(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.displayName === "string" &&
    USER_ROLES.includes(value.role as UserRole) &&
    (value.updatedAt === undefined || typeof value.updatedAt === "string")
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

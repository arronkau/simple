import { getRecordHandsRequired } from "./types";
import { normalizeEntityCharacterData } from "./characters";
import type {
  AuditLogEntry,
  Entity,
  InventoryBurden,
  InventoryRecord,
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

  return (
    candidate.schemaVersion === 1 &&
    Array.isArray(candidate.entities) &&
    Array.isArray(candidate.inventoryRecords)
  );
}

function isInventoryRecordLike(value: unknown): value is Record<string, unknown> {
  return (
    isRecordLike(value) &&
    typeof value.id === "string" &&
    typeof value.recordType === "string" &&
    isRecordLike(value.location) &&
    typeof value.sortOrder === "number"
  );
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  return isPositiveInteger(value) ? value : fallback;
}

function normalizeNonNegativeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
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
    typeof candidate.eventType === "string" &&
    typeof candidate.summary === "string"
  );
}

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && "localStorage" in window;
}

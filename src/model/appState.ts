import { getRecordHandsRequired } from "./types";
import { normalizeEntityCharacterData } from "./characters";
import type { AuditLogEntry, Entity, InventoryRecord } from "./types";

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

function normalizeInventoryRecords(records: InventoryRecord[]): InventoryRecord[] {
  return records.map((record) => {
    if (record.recordType === "coins") {
      return record;
    }

    return {
      ...record,
      handsRequired: getRecordHandsRequired(record),
    };
  });
}

function normalizeAuditLog(auditLog: unknown): AuditLogEntry[] {
  return Array.isArray(auditLog) ? auditLog.filter(isAuditLogEntry) : [];
}

function isAppState(value: unknown): value is Omit<AppState, "auditLog"> & {
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

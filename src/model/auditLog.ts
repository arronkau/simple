import type {
  AuditEventType,
  AuditLogDetailValue,
  AuditLogEntry,
  AuditLogEntryId,
  CoinData,
  EntityId,
  InventoryRecordId,
  ISODateTimeString,
  UserId,
  UserRole,
} from "./types";

export const DEFAULT_AUDIT_ACTOR_LABEL = "Local user";

/**
 * Target size for `AppState.auditLog` after a trim.
 *
 * The whole log lives inside the single Firestore party document, which is
 * capped at 1 MiB. Entries are a few hundred bytes each, so 500 entries stay
 * well inside that budget (roughly 150 KB worst case) while still covering
 * many sessions of play. Without a cap the log grows forever and every write
 * for the party eventually fails once the document hits the limit.
 */
export const AUDIT_LOG_MAX_ENTRIES = 500;

/**
 * Headroom above `AUDIT_LOG_MAX_ENTRIES` before a trim actually runs.
 *
 * A trim shortens the array, which the Firestore wire can only express as a
 * whole-array `set` (last-writer-wins) instead of a merging `arrayUnion`.
 * Trimming to the cap on every append past it would make every audit write
 * from then on a `set` — a permanent loss of merging, not a one-write window.
 * With slack the log is allowed to drift up to `max + slack` and is then cut
 * back to `max`, so at most one write in every `slack + 1` appends is a `set`.
 */
export const AUDIT_LOG_TRIM_SLACK = 50;

export const AUDIT_EVENT_TYPE_LABELS: Record<AuditEventType, string> = {
  coinsChanged: "Coins changed",
  entityActivated: "Entity activated",
  entityCreated: "Entity created",
  entityDeactivated: "Entity deactivated",
  entityDeleted: "Entity deleted",
  inventoryRecordCreated: "Record created",
  inventoryRecordDeleted: "Record deleted",
  inventoryRecordIdentified: "Record identified",
  inventoryRecordLit: "Light lit",
  inventoryRecordMoved: "Record moved",
  inventoryRecordSnuffed: "Light put out",
  treasureValueChanged: "Treasure value changed",
};

export type CreateAuditLogEntryInput = {
  id: AuditLogEntryId;
  createdAt: ISODateTimeString;
  eventType: AuditEventType;
  summary: string;
  actorLabel?: string;
  actorRole?: UserRole;
  actorUserId?: UserId;
  entityId?: EntityId;
  recordId?: InventoryRecordId;
  details?: Record<string, AuditLogDetailValue | undefined>;
};

export function createAuditLogEntry({
  actorLabel = DEFAULT_AUDIT_ACTOR_LABEL,
  actorRole,
  actorUserId,
  createdAt,
  details,
  entityId,
  eventType,
  id,
  recordId,
  summary,
}: CreateAuditLogEntryInput): AuditLogEntry {
  const normalizedDetails = normalizeAuditDetails(details);

  return {
    id,
    createdAt,
    actorLabel,
    ...(actorRole ? { actorRole } : {}),
    ...(actorUserId ? { actorUserId } : {}),
    eventType,
    summary,
    ...(entityId ? { entityId } : {}),
    ...(recordId ? { recordId } : {}),
    ...(Object.keys(normalizedDetails).length > 0
      ? { details: normalizedDetails }
      : {}),
  };
}

export function getAuditEventTypeLabel(eventType: AuditEventType): string {
  return AUDIT_EVENT_TYPE_LABELS[eventType];
}

export function getNewestAuditLogEntries(
  auditLog: AuditLogEntry[],
): AuditLogEntry[] {
  return [...auditLog].sort((leftEntry, rightEntry) => {
    const createdAtComparison =
      Date.parse(rightEntry.createdAt) - Date.parse(leftEntry.createdAt);

    if (createdAtComparison !== 0) {
      return createdAtComparison;
    }

    return rightEntry.id.localeCompare(leftEntry.id);
  });
}

/**
 * Trims with hysteresis: the log is left alone until it is longer than
 * `maxEntries + slack`, and is then cut back to `maxEntries`. The log is
 * stored oldest-first, so the newest entries are its tail; the kept entries
 * stay in their existing order. Returns the input array untouched whenever no
 * trim is due.
 */
export function trimAuditLog(
  auditLog: AuditLogEntry[],
  maxEntries: number = AUDIT_LOG_MAX_ENTRIES,
  slack: number = AUDIT_LOG_TRIM_SLACK,
): AuditLogEntry[] {
  if (auditLog.length <= maxEntries + slack) {
    return auditLog;
  }

  return auditLog.slice(auditLog.length - maxEntries);
}

export function getCoinDelta(
  beforeCoins: CoinData,
  afterCoins: CoinData,
): CoinData {
  return {
    pp: afterCoins.pp - beforeCoins.pp,
    gp: afterCoins.gp - beforeCoins.gp,
    sp: afterCoins.sp - beforeCoins.sp,
    cp: afterCoins.cp - beforeCoins.cp,
  };
}

export function getCoinDeltaDetails(
  deltaCoins: CoinData,
): Record<string, number> {
  return {
    deltaPp: deltaCoins.pp,
    deltaGp: deltaCoins.gp,
    deltaSp: deltaCoins.sp,
    deltaCp: deltaCoins.cp,
  };
}

export function formatCoinDelta(deltaCoins: CoinData): string {
  const parts = [
    ["pp", deltaCoins.pp],
    ["gp", deltaCoins.gp],
    ["sp", deltaCoins.sp],
    ["cp", deltaCoins.cp],
  ]
    .filter(([, value]) => value !== 0)
    .map(([label, value]) => `${formatSignedNumber(value as number)} ${label}`);

  return parts.length > 0 ? parts.join(", ") : "no denomination changes";
}

function normalizeAuditDetails(
  details: Record<string, AuditLogDetailValue | undefined> | undefined,
): Record<string, AuditLogDetailValue> {
  if (!details) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(details).filter(
      (entry): entry is [string, AuditLogDetailValue] => entry[1] !== undefined,
    ),
  );
}

function formatSignedNumber(value: number): string {
  return value > 0 ? `+${value}` : value.toString();
}

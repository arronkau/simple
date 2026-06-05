import type {
  AuditEventType,
  AuditLogDetailValue,
  AuditLogEntry,
  AuditLogEntryId,
  CoinData,
  EntityId,
  InventoryRecordId,
  ISODateTimeString,
} from "./types";

export const DEFAULT_AUDIT_ACTOR_LABEL = "Local user";

export const AUDIT_EVENT_TYPE_LABELS: Record<AuditEventType, string> = {
  coinsChanged: "Coins changed",
  entityActivated: "Entity activated",
  entityCreated: "Entity created",
  entityDeactivated: "Entity deactivated",
  entityDeleted: "Entity deleted",
  inventoryRecordCreated: "Record created",
  inventoryRecordDeleted: "Record deleted",
  inventoryRecordIdentified: "Record identified",
  inventoryRecordMoved: "Record moved",
  treasureValueChanged: "Treasure value changed",
};

export type CreateAuditLogEntryInput = {
  id: AuditLogEntryId;
  createdAt: ISODateTimeString;
  eventType: AuditEventType;
  summary: string;
  actorLabel?: string;
  entityId?: EntityId;
  recordId?: InventoryRecordId;
  details?: Record<string, AuditLogDetailValue | undefined>;
};

export function createAuditLogEntry({
  actorLabel = DEFAULT_AUDIT_ACTOR_LABEL,
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

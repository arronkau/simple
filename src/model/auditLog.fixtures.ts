import {
  AUDIT_LOG_MAX_ENTRIES,
  createAuditLogEntry,
  formatCoinDelta,
  getAuditEventTypeLabel,
  getCoinDelta,
  getCoinDeltaDetails,
  getNewestAuditLogEntries,
  trimAuditLog,
} from "./auditLog";
import type { AuditLogEntry, CoinData } from "./types";

const previousCoins: CoinData = {
  cp: 4,
  gp: 2,
  pp: 1,
  sp: 3,
};

const nextCoins: CoinData = {
  cp: 7,
  gp: 1,
  pp: 1,
  sp: 8,
};

const coinDelta = getCoinDelta(previousCoins, nextCoins);
const olderEntry = createAuditLogEntry({
  id: "audit-older",
  actorLabel: "Tester",
  createdAt: "2026-06-03T10:00:00.000Z",
  eventType: "entityCreated",
  summary: "Created entity.",
});
const newerEntry = createAuditLogEntry({
  id: "audit-newer",
  createdAt: "2026-06-03T11:00:00.000Z",
  eventType: "coinsChanged",
  summary: "Changed coins.",
  details: {},
});
const attributedEntry = createAuditLogEntry({
  id: "audit-attributed",
  actorLabel: "Morgan (GM)",
  actorRole: "GM",
  actorUserId: "user-1",
  createdAt: "2026-06-03T12:00:00.000Z",
  eventType: "entityCreated",
  summary: "Created entity.",
});

const trimEntries = makeAuditLogEntries(5);
const overflowingAuditLog = makeAuditLogEntries(AUDIT_LOG_MAX_ENTRIES + 2);
const trimmedAuditLog = trimAuditLog(overflowingAuditLog);

export const AUDIT_LOG_MANUAL_FIXTURES = [
  {
    name: "audit entries fill default actor and omit empty details",
    actual: newerEntry,
    expected: {
      id: "audit-newer",
      createdAt: "2026-06-03T11:00:00.000Z",
      actorLabel: "Local user",
      eventType: "coinsChanged",
      summary: "Changed coins.",
    },
  },
  {
    name: "audit entries preserve actor role and stable user id",
    actual: attributedEntry,
    expected: {
      id: "audit-attributed",
      createdAt: "2026-06-03T12:00:00.000Z",
      actorLabel: "Morgan (GM)",
      actorRole: "GM",
      actorUserId: "user-1",
      eventType: "entityCreated",
      summary: "Created entity.",
    },
  },
  {
    name: "audit event labels are human-readable",
    actual: getAuditEventTypeLabel("treasureValueChanged"),
    expected: "Treasure value changed",
  },
  {
    name: "audit log entries sort newest first",
    actual: getNewestAuditLogEntries([olderEntry, newerEntry]).map(
      (entry) => entry.id,
    ),
    expected: ["audit-newer", "audit-older"],
  },
  {
    name: "audit log trim keeps a log shorter than the cap untouched",
    actual: trimAuditLog(trimEntries.slice(0, 2), 3).map((entry) => entry.id),
    expected: ["audit-0", "audit-1"],
  },
  {
    name: "audit log trim keeps a log exactly at the cap untouched",
    actual: trimAuditLog(trimEntries.slice(0, 3), 3).map((entry) => entry.id),
    expected: ["audit-0", "audit-1", "audit-2"],
  },
  {
    name: "audit log trim drops the oldest entries and preserves order",
    actual: trimAuditLog(trimEntries, 3).map((entry) => entry.id),
    expected: ["audit-2", "audit-3", "audit-4"],
  },
  {
    name: "audit log trim caps at AUDIT_LOG_MAX_ENTRIES by default",
    actual: {
      length: trimmedAuditLog.length,
      firstId: trimmedAuditLog[0]?.id,
      lastId: trimmedAuditLog[trimmedAuditLog.length - 1]?.id,
    },
    expected: {
      length: AUDIT_LOG_MAX_ENTRIES,
      firstId: "audit-2",
      lastId: `audit-${AUDIT_LOG_MAX_ENTRIES + 1}`,
    },
  },
  {
    name: "coin delta helpers produce readable denomination details",
    actual: {
      delta: coinDelta,
      details: getCoinDeltaDetails(coinDelta),
      summary: formatCoinDelta(coinDelta),
    },
    expected: {
      delta: {
        pp: 0,
        gp: -1,
        sp: 5,
        cp: 3,
      },
      details: {
        deltaPp: 0,
        deltaGp: -1,
        deltaSp: 5,
        deltaCp: 3,
      },
      summary: "-1 gp, +5 sp, +3 cp",
    },
  },
];

function makeAuditLogEntries(count: number): AuditLogEntry[] {
  return Array.from({ length: count }, (_unused, index) =>
    createAuditLogEntry({
      id: `audit-${index}`,
      createdAt: "2026-06-03T10:00:00.000Z",
      eventType: "entityCreated",
      summary: `Created entity ${index}.`,
    }),
  );
}

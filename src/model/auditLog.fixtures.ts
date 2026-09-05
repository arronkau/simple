import {
  AUDIT_LOG_MAX_ENTRIES,
  AUDIT_LOG_TRIM_SLACK,
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

// Cap 3 with slack 2: nothing trims until the log passes 5 entries.
const trimEntries = makeAuditLogEntries(6);
const overflowingAuditLog = makeAuditLogEntries(
  AUDIT_LOG_MAX_ENTRIES + AUDIT_LOG_TRIM_SLACK + 1,
);
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
    actual: trimAuditLog(trimEntries.slice(0, 2), 3, 2).map((entry) => entry.id),
    expected: ["audit-0", "audit-1"],
  },
  {
    name: "audit log trim keeps a log exactly at the cap untouched",
    actual: trimAuditLog(trimEntries.slice(0, 3), 3, 2).map((entry) => entry.id),
    expected: ["audit-0", "audit-1", "audit-2"],
  },
  {
    name: "audit log trim keeps a log at the cap plus slack untouched",
    actual: trimAuditLog(trimEntries.slice(0, 5), 3, 2).map((entry) => entry.id),
    expected: ["audit-0", "audit-1", "audit-2", "audit-3", "audit-4"],
  },
  {
    name: "audit log trim past the cap plus slack cuts back to the cap in order",
    actual: trimAuditLog(trimEntries, 3, 2).map((entry) => entry.id),
    expected: ["audit-3", "audit-4", "audit-5"],
  },
  {
    name: "audit log trim uses AUDIT_LOG_MAX_ENTRIES and slack by default",
    actual: {
      length: trimmedAuditLog.length,
      firstId: trimmedAuditLog[0]?.id,
      lastId: trimmedAuditLog[trimmedAuditLog.length - 1]?.id,
      untouchedAtSlackLength: trimAuditLog(
        overflowingAuditLog.slice(0, AUDIT_LOG_MAX_ENTRIES + AUDIT_LOG_TRIM_SLACK),
      ).length,
    },
    expected: {
      length: AUDIT_LOG_MAX_ENTRIES,
      firstId: `audit-${AUDIT_LOG_TRIM_SLACK + 1}`,
      lastId: `audit-${AUDIT_LOG_MAX_ENTRIES + AUDIT_LOG_TRIM_SLACK}`,
      untouchedAtSlackLength: AUDIT_LOG_MAX_ENTRIES + AUDIT_LOG_TRIM_SLACK,
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

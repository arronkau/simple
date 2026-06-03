import {
  createAuditLogEntry,
  formatCoinDelta,
  getAuditEventTypeLabel,
  getCoinDelta,
  getCoinDeltaDetails,
  getNewestAuditLogEntries,
} from "./auditLog";
import type { CoinData } from "./types";

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

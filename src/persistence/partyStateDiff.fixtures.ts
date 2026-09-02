import type { PartyState } from "../model/appState";
import type {
  AuditLogEntry,
  Entity,
  InventoryRecord,
  UserProfile,
} from "../model/types";
import { diffPartyStates, mergeFieldUpdates } from "./partyStateDiff";

const entityA = makeEntity("entity-a", "A", 0);
const entityB = makeEntity("entity-b", "B", 1000);
const recordA = makeRecord("record-a", 0);
const recordB = makeRecord("record-b", 1000);
const profileA = makeProfile("user-a", "A");
const profileB = makeProfile("user-b", "B");
const auditA = makeAudit("audit-a", "A");
const auditB = makeAudit("audit-b", "B");

export const PARTY_STATE_DIFF_MANUAL_FIXTURES: {
  name: string;
  actual: unknown;
  expected: unknown;
}[] = [
  {
    name: "Party-state diff emits scalar and per-member updates in path order",
    actual: diffPartyStates(
      makePartyState({
        members: {
          "uid-a": { role: "player" },
          "uid-b": { role: "player" },
        },
      }),
      {
        ...makePartyState(),
        party: {
          id: "party-1",
          displayName: "Renamed",
          members: {
            "uid-a": { role: "player", displayName: "A" },
            "uid-c": { role: "player" },
          },
        },
      },
    ),
    expected: [
      { path: ["party", "displayName"], op: "set", value: "Renamed" },
      { path: ["party", "gmUid"], op: "delete" },
      { path: ["party", "inviteCode"], op: "delete" },
      {
        path: ["party", "members", "uid-a"],
        op: "set",
        value: { role: "player", displayName: "A" },
      },
      { path: ["party", "members", "uid-b"], op: "delete" },
      {
        path: ["party", "members", "uid-c"],
        op: "set",
        value: { role: "player" },
      },
    ],
  },
  {
    name: "Party-state diff emits per-id entity record and profile sets and deletes",
    actual: diffPartyStates(
      makePartyState({
        entities: [entityA, entityB],
        inventoryRecords: [recordA, recordB],
        userProfiles: [profileA, profileB],
      }),
      makePartyState({
        entities: [{ ...entityA, name: "A changed" }, makeEntity("entity-c", "C", 2000)],
        inventoryRecords: [
          { ...recordA, name: "record-a changed" },
          makeRecord("record-c", 2000),
        ],
        userProfiles: [
          { ...profileA, displayName: "A changed" },
          makeProfile("user-c", "C"),
        ],
      }),
    ),
    expected: [
      {
        path: ["appState", "entities", "entity-a"],
        op: "set",
        value: { ...entityA, name: "A changed" },
      },
      { path: ["appState", "entities", "entity-b"], op: "delete" },
      {
        path: ["appState", "entities", "entity-c"],
        op: "set",
        value: makeEntity("entity-c", "C", 2000),
      },
      {
        path: ["appState", "inventoryRecords", "record-a"],
        op: "set",
        value: { ...recordA, name: "record-a changed" },
      },
      { path: ["appState", "inventoryRecords", "record-b"], op: "delete" },
      {
        path: ["appState", "inventoryRecords", "record-c"],
        op: "set",
        value: makeRecord("record-c", 2000),
      },
      {
        path: ["userProfiles", "user-a"],
        op: "set",
        value: { ...profileA, displayName: "A changed" },
      },
      { path: ["userProfiles", "user-b"], op: "delete" },
      {
        path: ["userProfiles", "user-c"],
        op: "set",
        value: makeProfile("user-c", "C"),
      },
    ],
  },
  {
    name: "Party-state diff uses arrayUnion when audit entries are appended",
    actual: diffPartyStates(
      makePartyState({ auditLog: [auditA] }),
      makePartyState({ auditLog: [auditA, auditB] }),
    ),
    expected: [
      {
        path: ["appState", "auditLog"],
        op: "arrayUnion",
        value: [auditB],
      },
    ],
  },
  {
    name: "Party-state diff sets the audit array when history is removed or reordered",
    actual: diffPartyStates(
      makePartyState({ auditLog: [auditA, auditB] }),
      makePartyState({ auditLog: [auditB, auditA] }),
    ),
    expected: [
      {
        path: ["appState", "auditLog"],
        op: "set",
        value: [auditB, auditA],
      },
    ],
  },
  {
    name: "Party-state diff ignores model array order after canonicalization",
    actual: diffPartyStates(
      makePartyState({
        entities: [entityA, entityB],
        inventoryRecords: [recordA, recordB],
        userProfiles: [profileA, profileB],
      }),
      makePartyState({
        entities: [entityB, entityA],
        inventoryRecords: [recordB, recordA],
        userProfiles: [profileB, profileA],
      }),
    ),
    expected: [],
  },
  {
    name: "Field-update merge replaces paths and concatenates audit unions by id",
    actual: mergeFieldUpdates(
      [
        { path: ["party", "displayName"], op: "set", value: "Old" },
        { path: ["appState", "entities", "entity-a"], op: "delete" },
        { path: ["appState", "auditLog"], op: "arrayUnion", value: [auditA] },
      ],
      [
        { path: ["party", "displayName"], op: "delete" },
        {
          path: ["appState", "entities", "entity-a"],
          op: "set",
          value: entityA,
        },
        {
          path: ["appState", "auditLog"],
          op: "arrayUnion",
          value: [{ ...auditA, summary: "duplicate id" }, auditB],
        },
        { path: ["userProfiles", "user-a"], op: "set", value: profileA },
      ],
    ),
    expected: [
      { path: ["party", "displayName"], op: "delete" },
      {
        path: ["appState", "entities", "entity-a"],
        op: "set",
        value: entityA,
      },
      {
        path: ["appState", "auditLog"],
        op: "arrayUnion",
        value: [auditA, auditB],
      },
      { path: ["userProfiles", "user-a"], op: "set", value: profileA },
    ],
  },
  {
    name: "Field-update merge lets an audit set replace an earlier union",
    actual: mergeFieldUpdates(
      [{ path: ["appState", "auditLog"], op: "arrayUnion", value: [auditA] }],
      [{ path: ["appState", "auditLog"], op: "set", value: [auditB] }],
    ),
    expected: [
      { path: ["appState", "auditLog"], op: "set", value: [auditB] },
    ],
  },
  {
    name: "Field-update merge appends a later audit union to a pending set",
    actual: mergeFieldUpdates(
      [{ path: ["appState", "auditLog"], op: "set", value: [auditA] }],
      [{ path: ["appState", "auditLog"], op: "arrayUnion", value: [auditB] }],
    ),
    expected: [
      { path: ["appState", "auditLog"], op: "set", value: [auditA, auditB] },
    ],
  },
];

function makePartyState({
  auditLog = [],
  displayName = "Party",
  entities = [],
  gmUid = "uid-gm",
  inviteCode = "invite-code",
  inventoryRecords = [],
  members = { "uid-gm": { role: "gm" as const } },
  userProfiles = [],
}: {
  auditLog?: AuditLogEntry[];
  displayName?: string;
  entities?: Entity[];
  gmUid?: string;
  inviteCode?: string;
  inventoryRecords?: InventoryRecord[];
  members?: PartyState["party"]["members"];
  userProfiles?: UserProfile[];
} = {}): PartyState {
  return {
    schemaVersion: 1,
    party: {
      id: "party-1",
      displayName,
      ...(gmUid !== undefined ? { gmUid } : {}),
      ...(members !== undefined ? { members } : {}),
      ...(inviteCode !== undefined ? { inviteCode } : {}),
    },
    appState: { schemaVersion: 1, entities, inventoryRecords, auditLog },
    userProfiles,
  };
}

function makeEntity(id: string, name: string, sortOrder: number): Entity {
  return { id, name, entityType: "storage", active: true, sortOrder };
}

function makeRecord(id: string, sortOrder: number): InventoryRecord {
  return {
    id,
    entityId: "entity-a",
    recordType: "equipment",
    name: id,
    location: { kind: "contents" },
    sortOrder,
    quantity: 1,
    burden: { kind: "fixed", slotsPerItem: 1 },
  };
}

function makeProfile(id: string, displayName: string): UserProfile {
  return { id, displayName, role: "Player" };
}

function makeAudit(id: string, summary: string): AuditLogEntry {
  return {
    id,
    createdAt: "2026-01-01T00:00:00.000Z",
    actorLabel: "GM",
    eventType: "entityCreated",
    summary,
  };
}

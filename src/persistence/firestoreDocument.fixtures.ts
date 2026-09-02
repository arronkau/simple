import type { PartyState } from "../model/appState";
import type {
  AuditLogEntry,
  Entity,
  InventoryRecord,
  UserProfile,
} from "../model/types";
import {
  canonicalizePartyState,
  fromFirestorePartyDocument,
  isLegacyFirestorePartyDocument,
  toFirestorePartyDocument,
} from "./firestoreDocument";

const entityA = makeEntity("entity-a", "A", 1000);
const entityB = makeEntity("entity-b", "B", 0);
const recordA = makeRecord("record-a", 1000);
const recordB = makeRecord("record-b", 0);
const profileA = makeProfile("user-a", "A");
const profileB = makeProfile("user-b", "B");
const auditEntry = makeAudit("audit-1", "Created A");

const partyState = makePartyState({
  entities: [entityA, entityB],
  inventoryRecords: [recordA, recordB],
  userProfiles: [profileB, profileA],
});

const roundTrippedPartyState = fromFirestorePartyDocument(
  toFirestorePartyDocument(partyState),
  "party-1",
);

export const FIRESTORE_DOCUMENT_MANUAL_FIXTURES: {
  name: string;
  actual: unknown;
  expected: unknown;
}[] = [
  {
    name: "Firestore document conversion emits v2 id-keyed maps and last duplicate id wins",
    actual: toFirestorePartyDocument({
      ...partyState,
      appState: {
        ...partyState.appState,
        entities: [entityA, entityB, { ...entityA, name: "A latest", sortOrder: -1 }],
      },
    }),
    expected: {
      schemaVersion: 1,
      wireVersion: 2,
      party: {
        id: "party-1",
        displayName: "Fixture Party",
        gmUid: "uid-gm",
        members: {
          "uid-gm": { role: "gm", joinedAt: "2026-01-01T00:00:00.000Z" },
          "uid-player": { role: "player" },
        },
        inviteCode: "invite-code",
      },
      appState: {
        schemaVersion: 1,
        entities: {
          "entity-a": {
            id: "entity-a",
            name: "A latest",
            entityType: "storage",
            active: true,
            sortOrder: -1,
          },
          "entity-b": {
            id: "entity-b",
            name: "B",
            entityType: "storage",
            active: true,
            sortOrder: 0,
          },
        },
        inventoryRecords: {
          "record-b": {
            id: "record-b",
            entityId: "entity-a",
            recordType: "equipment",
            name: "record-b",
            location: { kind: "contents" },
            sortOrder: 0,
            quantity: 1,
            burden: { kind: "fixed", slotsPerItem: 1 },
          },
          "record-a": {
            id: "record-a",
            entityId: "entity-a",
            recordType: "equipment",
            name: "record-a",
            location: { kind: "contents" },
            sortOrder: 1000,
            quantity: 1,
            burden: { kind: "fixed", slotsPerItem: 1 },
          },
        },
        auditLog: [auditEntry],
      },
      userProfiles: {
        "user-a": { id: "user-a", displayName: "A", role: "Player" },
        "user-b": { id: "user-b", displayName: "B", role: "Player" },
      },
    },
  },
  {
    name: "Firestore v2 parsing orders maps and makes map keys authoritative ids",
    actual: (() => {
      const parsed = fromFirestorePartyDocument({
        schemaVersion: 1,
        wireVersion: 2,
        party: { id: "party-map", displayName: "Map Party" },
        appState: {
          schemaVersion: 1,
          entities: {
            "entity-b": { ...makeEntity("wrong-entity", "B", 1000) },
            "entity-a": { name: "A", entityType: "storage", active: true, sortOrder: 0 },
          },
          inventoryRecords: {
            "record-b": { ...makeRecord("wrong-record", 1000) },
            "record-a": { ...makeRecord("record-a", 0), id: "also-wrong" },
          },
          auditLog: [auditEntry],
        },
        userProfiles: {
          "user-b": { ...profileB, id: "wrong-user" },
          "user-a": { displayName: "A", role: "Player" },
        },
      });

      return {
        entityIds: parsed?.appState.entities.map((entity) => entity.id),
        recordIds: parsed?.appState.inventoryRecords.map((record) => record.id),
        profileIds: parsed?.userProfiles.map((profile) => profile.id),
        auditIds: parsed?.appState.auditLog.map((entry) => entry.id),
      };
    })(),
    expected: {
      entityIds: ["entity-a", "entity-b"],
      recordIds: ["record-a", "record-b"],
      profileIds: ["user-a", "user-b"],
      auditIds: ["audit-1"],
    },
  },
  {
    name: "Firestore v2 parsing sorts valid profiles before non-record map entries",
    actual: fromFirestorePartyDocument({
      schemaVersion: 1,
      wireVersion: 2,
      party: { id: "party-map", displayName: "Map Party" },
      appState: {
        schemaVersion: 1,
        entities: {},
        inventoryRecords: {},
        auditLog: [],
      },
      userProfiles: {
        b: makeProfile("b", "B"),
        junk: null,
        a: makeProfile("a", "A"),
      },
    })?.userProfiles.map((profile) => profile.id),
    expected: ["a", "b"],
  },
  {
    name: "Firestore parsing accepts the legacy array wire shape",
    actual: (() => {
      const parsed = fromFirestorePartyDocument({
        schemaVersion: 1,
        party: { id: "legacy-party", displayName: "Legacy Party" },
        appState: {
          schemaVersion: 1,
          entities: [entityA],
          inventoryRecords: [recordA],
          auditLog: [auditEntry],
        },
        userProfiles: [profileA],
      });

      return {
        partyId: parsed?.party.id,
        entityIds: parsed?.appState.entities.map((entity) => entity.id),
        recordIds: parsed?.appState.inventoryRecords.map((record) => record.id),
        profileIds: parsed?.userProfiles.map((profile) => profile.id),
      };
    })(),
    expected: {
      partyId: "legacy-party",
      entityIds: ["entity-a"],
      recordIds: ["record-a"],
      profileIds: ["user-a"],
    },
  },
  {
    name: "Firestore v2 round trip preserves invite code and members",
    actual: {
      inviteCode: roundTrippedPartyState?.party.inviteCode,
      members: roundTrippedPartyState?.party.members,
    },
    expected: {
      inviteCode: "invite-code",
      members: {
        "uid-gm": { role: "gm", joinedAt: "2026-01-01T00:00:00.000Z" },
        "uid-player": { role: "player" },
      },
    },
  },
  {
    name: "Firestore legacy detection uses wireVersion 2",
    actual: [
      isLegacyFirestorePartyDocument({ schemaVersion: 1 }),
      isLegacyFirestorePartyDocument({ wireVersion: 1 }),
      isLegacyFirestorePartyDocument({ wireVersion: 2 }),
    ],
    expected: [true, true, false],
  },
  {
    name: "Party-state canonicalization deterministically orders model arrays",
    actual: (() => {
      const canonical = canonicalizePartyState(partyState);
      return {
        entityIds: canonical.appState.entities.map((entity) => entity.id),
        recordIds: canonical.appState.inventoryRecords.map((record) => record.id),
        profileIds: canonical.userProfiles.map((profile) => profile.id),
      };
    })(),
    expected: {
      entityIds: ["entity-b", "entity-a"],
      recordIds: ["record-b", "record-a"],
      profileIds: ["user-a", "user-b"],
    },
  },
];

function makePartyState({
  entities = [],
  inventoryRecords = [],
  userProfiles = [],
}: {
  entities?: Entity[];
  inventoryRecords?: InventoryRecord[];
  userProfiles?: UserProfile[];
} = {}): PartyState {
  return {
    schemaVersion: 1,
    party: {
      id: "party-1",
      displayName: "Fixture Party",
      gmUid: "uid-gm",
      members: {
        "uid-gm": { role: "gm", joinedAt: "2026-01-01T00:00:00.000Z" },
        "uid-player": { role: "player" },
      },
      inviteCode: "invite-code",
    },
    appState: {
      schemaVersion: 1,
      entities,
      inventoryRecords,
      auditLog: [auditEntry],
    },
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

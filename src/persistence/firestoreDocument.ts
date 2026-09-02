import {
  parsePartyState,
  type PartyId,
  type PartyState,
} from "../model/appState";
import type {
  AuditLogEntry,
  Entity,
  EntityId,
  InventoryRecord,
  InventoryRecordId,
  PartyMember,
  UserId,
  UserProfile,
} from "../model/types";

export type FirestorePartyDocument = {
  schemaVersion: 1;
  wireVersion: 2;
  party: {
    id: PartyId;
    displayName: string;
    gmUid?: string;
    members?: Record<string, PartyMember>;
    inviteCode?: string;
  };
  appState: {
    schemaVersion: 1;
    entities: Record<EntityId, Entity>;
    inventoryRecords: Record<InventoryRecordId, InventoryRecord>;
    auditLog: AuditLogEntry[];
  };
  userProfiles: Record<UserId, UserProfile>;
};

export function toFirestorePartyDocument(
  partyState: PartyState,
): FirestorePartyDocument {
  const entitiesById = toIdMap(partyState.appState.entities);
  const inventoryRecordsById = toIdMap(partyState.appState.inventoryRecords);
  const userProfilesById = toIdMap(partyState.userProfiles);

  return {
    schemaVersion: 1,
    wireVersion: 2,
    party: {
      id: partyState.party.id,
      displayName: partyState.party.displayName,
      ...(partyState.party.gmUid !== undefined
        ? { gmUid: partyState.party.gmUid }
        : {}),
      ...(partyState.party.members !== undefined
        ? { members: partyState.party.members }
        : {}),
      ...(partyState.party.inviteCode !== undefined
        ? { inviteCode: partyState.party.inviteCode }
        : {}),
    },
    appState: {
      schemaVersion: 1,
      entities: sortIdMap(entitiesById, compareSortOrderThenId),
      inventoryRecords: sortIdMap(
        inventoryRecordsById,
        compareSortOrderThenId,
      ),
      auditLog: partyState.appState.auditLog,
    },
    userProfiles: sortIdMap(userProfilesById, compareId),
  };
}

export function fromFirestorePartyDocument(
  data: unknown,
  expectedPartyId?: PartyId,
): PartyState | undefined {
  if (!isRecordLike(data) || !isRecordLike(data.appState)) {
    return undefined;
  }

  const appState = data.appState;
  const converted = {
    ...data,
    appState: {
      ...appState,
      entities: fromIdMapOrArray<Entity>(
        appState.entities,
        compareSortOrderThenId,
      ),
      inventoryRecords: fromIdMapOrArray<InventoryRecord>(
        appState.inventoryRecords,
        compareSortOrderThenId,
      ),
    },
    userProfiles: fromIdMapOrArray<UserProfile>(data.userProfiles, compareId),
  };

  return parsePartyState(converted, expectedPartyId);
}

export function isLegacyFirestorePartyDocument(data: unknown): boolean {
  return !isRecordLike(data) || data.wireVersion !== 2;
}

export function canonicalizePartyState(partyState: PartyState): PartyState {
  return {
    ...partyState,
    appState: {
      ...partyState.appState,
      entities: [...partyState.appState.entities].sort(compareSortOrderThenId),
      inventoryRecords: [...partyState.appState.inventoryRecords].sort(
        compareSortOrderThenId,
      ),
    },
    userProfiles: [...partyState.userProfiles].sort(compareId),
  };
}

type Identified = { id: string };

function toIdMap<T extends Identified>(values: T[]): Map<string, T> {
  const result = new Map<string, T>();

  for (const value of values) {
    result.set(value.id, value);
  }

  return result;
}

function sortIdMap<T extends Identified>(
  valuesById: Map<string, T>,
  compare: (left: T, right: T) => number,
): Record<string, T> {
  return Object.fromEntries(
    [...valuesById.values()]
      .sort(compare)
      .map((value) => [value.id, value]),
  );
}

function fromIdMapOrArray<T extends Identified>(
  value: unknown,
  compare: (left: T, right: T) => number,
): unknown {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isRecordLike(value)) {
    return value;
  }

  return Object.entries(value)
    .map(([id, entry]) => withAuthoritativeId(id, entry))
    .sort((left, right) => {
      if (!isRecordLike(left) || !isRecordLike(right)) {
        return 0;
      }

      return compare(left as T, right as T);
    });
}

function withAuthoritativeId(id: string, value: unknown): unknown {
  if (!isRecordLike(value)) {
    return value;
  }

  return Object.assign({ id }, value, { id });
}

function compareSortOrderThenId<T extends { id: string; sortOrder: number }>(
  left: T,
  right: T,
): number {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  return compareId(left, right);
}

function compareId<T extends { id: string }>(left: T, right: T): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

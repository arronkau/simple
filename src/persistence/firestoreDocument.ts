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
      entities: toSortedIdMap(
        partyState.appState.entities,
        compareSortOrderThenId,
      ),
      inventoryRecords: toSortedIdMap(
        partyState.appState.inventoryRecords,
        compareSortOrderThenId,
      ),
      auditLog: partyState.appState.auditLog,
    },
    userProfiles: toSortedIdMap(partyState.userProfiles, compareId),
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
      entities: collapseAndSortIdentifiedValues(
        partyState.appState.entities,
        compareSortOrderThenId,
      ),
      inventoryRecords: collapseAndSortIdentifiedValues(
        partyState.appState.inventoryRecords,
        compareSortOrderThenId,
      ),
    },
    userProfiles: collapseAndSortIdentifiedValues(
      partyState.userProfiles,
      compareId,
    ),
  };
}

type Identified = { id: string };

function collapseAndSortIdentifiedValues<T extends Identified>(
  values: T[],
  compare: (left: T, right: T) => number,
): T[] {
  const valuesById = new Map<string, T>();

  for (const value of values) {
    valuesById.set(value.id, value);
  }

  return [...valuesById.values()].sort(compare);
}

function toSortedIdMap<T extends Identified>(
  values: T[],
  compare: (left: T, right: T) => number,
): Record<string, T> {
  return Object.fromEntries(
    collapseAndSortIdentifiedValues(values, compare).map((value) => [
      value.id,
      value,
    ]),
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
    .map(([id, entry]) => ({ id, value: withAuthoritativeId(id, entry) }))
    .sort((left, right) => {
      const leftIsRecord = isRecordLike(left.value);
      const rightIsRecord = isRecordLike(right.value);

      if (leftIsRecord !== rightIsRecord) {
        return leftIsRecord ? -1 : 1;
      }

      if (leftIsRecord && rightIsRecord) {
        return compare(left.value as T, right.value as T);
      }

      return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    })
    .map(({ value: entry }) => entry);
}

function withAuthoritativeId(id: string, value: unknown): unknown {
  if (!isRecordLike(value)) {
    return value;
  }

  return Object.assign({ id }, value, { id });
}

/**
 * Total order: finite sortOrders ascending, then non-finite/missing
 * sortOrders (which the parser tolerates) after them, then id. Never
 * returns NaN, so Array.sort stays deterministic on malformed input.
 */
function compareSortOrderThenId<T extends { id: string; sortOrder: number }>(
  left: T,
  right: T,
): number {
  const leftFinite = Number.isFinite(left.sortOrder);
  const rightFinite = Number.isFinite(right.sortOrder);

  if (leftFinite !== rightFinite) {
    return leftFinite ? -1 : 1;
  }

  if (leftFinite && left.sortOrder !== right.sortOrder) {
    return left.sortOrder < right.sortOrder ? -1 : 1;
  }

  return compareId(left, right);
}

function compareId<T extends { id: string }>(left: T, right: T): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

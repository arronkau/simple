import type { PartyState } from "../model/appState";
import { canonicalizePartyState } from "./firestoreDocument";

export type FieldUpdate =
  | { path: string[]; op: "set"; value: unknown }
  | { path: string[]; op: "delete" }
  | { path: string[]; op: "arrayUnion"; value: unknown[] };

export function diffPartyStates(
  previous: PartyState,
  next: PartyState,
): FieldUpdate[] {
  const canonicalPrevious = canonicalizePartyState(previous);
  const canonicalNext = canonicalizePartyState(next);
  const updates: FieldUpdate[] = [];

  addOptionalValueUpdate(
    updates,
    ["party", "displayName"],
    canonicalPrevious.party.displayName,
    canonicalNext.party.displayName,
  );
  addOptionalValueUpdate(
    updates,
    ["party", "gmUid"],
    canonicalPrevious.party.gmUid,
    canonicalNext.party.gmUid,
  );
  addOptionalValueUpdate(
    updates,
    ["party", "inviteCode"],
    canonicalPrevious.party.inviteCode,
    canonicalNext.party.inviteCode,
  );

  addRecordUpdates(
    updates,
    ["party", "members"],
    canonicalPrevious.party.members ?? {},
    canonicalNext.party.members ?? {},
  );
  addIdentifiedUpdates(
    updates,
    ["appState", "entities"],
    canonicalPrevious.appState.entities,
    canonicalNext.appState.entities,
  );
  addIdentifiedUpdates(
    updates,
    ["appState", "inventoryRecords"],
    canonicalPrevious.appState.inventoryRecords,
    canonicalNext.appState.inventoryRecords,
  );
  addIdentifiedUpdates(
    updates,
    ["userProfiles"],
    canonicalPrevious.userProfiles,
    canonicalNext.userProfiles,
  );

  const previousAuditLog = canonicalPrevious.appState.auditLog;
  const nextAuditLog = canonicalNext.appState.auditLog;
  const previousIsPrefix =
    previousAuditLog.length <= nextAuditLog.length &&
    previousAuditLog.every((entry, index) =>
      areJsonEqual(entry, nextAuditLog[index]),
    );

  if (previousIsPrefix) {
    const appendedEntries = nextAuditLog.slice(previousAuditLog.length);

    if (appendedEntries.length > 0) {
      updates.push({
        path: ["appState", "auditLog"],
        op: "arrayUnion",
        value: appendedEntries,
      });
    }
  } else {
    updates.push({
      path: ["appState", "auditLog"],
      op: "set",
      value: nextAuditLog,
    });
  }

  return updates;
}

export function mergeFieldUpdates(
  pending: FieldUpdate[],
  incoming: FieldUpdate[],
): FieldUpdate[] {
  const merged = [...pending];

  for (const update of incoming) {
    const existingIndex = merged.findIndex((candidate) =>
      arePathsEqual(candidate.path, update.path),
    );

    if (existingIndex === -1) {
      merged.push(update);
      continue;
    }

    const existing = merged[existingIndex];

    if (update.op === "set" || update.op === "delete") {
      merged[existingIndex] = update;
      continue;
    }

    if (existing.op === "arrayUnion") {
      merged[existingIndex] = {
        path: update.path,
        op: "arrayUnion",
        value: dedupeEntriesById([...existing.value, ...update.value]),
      };
      continue;
    }

    if (existing.op === "set" && Array.isArray(existing.value)) {
      merged[existingIndex] = {
        path: existing.path,
        op: "set",
        value: dedupeEntriesById([...existing.value, ...update.value]),
      };
      continue;
    }

    merged[existingIndex] = {
      path: update.path,
      op: "set",
      value: dedupeEntriesById(update.value),
    };
  }

  return merged;
}

function addOptionalValueUpdate(
  updates: FieldUpdate[],
  path: string[],
  previous: unknown,
  next: unknown,
): void {
  if (areJsonEqual(previous, next)) {
    return;
  }

  updates.push(
    next === undefined
      ? { path, op: "delete" }
      : { path, op: "set", value: next },
  );
}

function addIdentifiedUpdates<T extends { id: string }>(
  updates: FieldUpdate[],
  pathPrefix: string[],
  previous: T[],
  next: T[],
): void {
  addRecordUpdates(
    updates,
    pathPrefix,
    Object.fromEntries(previous.map((value) => [value.id, value])),
    Object.fromEntries(next.map((value) => [value.id, value])),
  );
}

function addRecordUpdates<T>(
  updates: FieldUpdate[],
  pathPrefix: string[],
  previous: Record<string, T>,
  next: Record<string, T>,
): void {
  const ids = [...new Set([...Object.keys(previous), ...Object.keys(next)])].sort();

  for (const id of ids) {
    if (!hasOwn(next, id)) {
      updates.push({ path: [...pathPrefix, id], op: "delete" });
    } else if (!hasOwn(previous, id) || !areJsonEqual(previous[id], next[id])) {
      updates.push({ path: [...pathPrefix, id], op: "set", value: next[id] });
    }
  }
}

function dedupeEntriesById(entries: unknown[]): unknown[] {
  const seenIds = new Set<string>();

  return entries.filter((entry) => {
    const id = getEntryId(entry);

    if (id === undefined) {
      return true;
    }

    if (seenIds.has(id)) {
      return false;
    }

    seenIds.add(id);
    return true;
  });
}

function getEntryId(entry: unknown): string | undefined {
  if (typeof entry !== "object" || entry === null || !("id" in entry)) {
    return undefined;
  }

  return typeof entry.id === "string" ? entry.id : undefined;
}

function arePathsEqual(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((segment, index) => segment === right[index])
  );
}

function areJsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function hasOwn<T>(value: Record<string, T>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

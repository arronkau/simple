import type { InventoryRecord, PartyRole } from "./types";

/**
 * Display-time redaction of unidentified items and GM notes.
 *
 * This is a *display* concern only. Derived calculations (AC, attack, damage,
 * encumbrance, light burn) always run on the full record — equipping an
 * unidentified item still grants its bonus; the risk is that it is cursed.
 * Never feed a redacted record back into the store or into rules math.
 */

/** An unidentified record: any non-coin record with `identified === false`. */
export function isUnidentifiedRecord(record: InventoryRecord): boolean {
  return (
    record.recordType !== "coins" &&
    record.identification?.identified === false
  );
}

/**
 * Unidentified *and* carrying something to reveal. The Identify action only
 * applies here; the "?" glyph still shows for any unidentified record.
 */
export function hasSecretIdentification(record: InventoryRecord): boolean {
  if (record.recordType === "coins") {
    return false;
  }

  const identification = record.identification;

  return (
    identification?.identified === false &&
    (Boolean(identification.secretName?.trim()) ||
      Boolean(identification.secretDescription?.trim()))
  );
}

/**
 * The record as a viewer may see it.
 *
 * - GM: unchanged.
 * - Anyone else (players, and not-yet-resolved/non-member null roles — fail
 *   closed): `notes` is dropped, always, identified or not.
 * - Anyone else, on an unidentified record: the public shell only.
 *
 * The shell keeps id, entityId, recordType, name, description, location,
 * sortOrder, quantity, burden, handsRequired, container, createdAt, updatedAt,
 * `identification: { identified: false }`, and `light: { isLit }`. It drops
 * isMagic, uses, modifiers, notes, secret name/description, light description,
 * weapon and armor detail, and treasure gp value.
 *
 * Key order of the shell is stable and matters: fixtures compare by
 * `JSON.stringify`. It is id, entityId, recordType, name, description,
 * location, sortOrder, quantity, burden, handsRequired, container,
 * identification, light, createdAt, updatedAt, then the type-specific field
 * (treasure / weapon / armor).
 */
export function getVisibleInventoryRecord(
  record: InventoryRecord,
  viewerRole: PartyRole | null | undefined,
): InventoryRecord {
  if (viewerRole === "gm") {
    return record;
  }

  // Mirrors isUnidentifiedRecord, written inline so TypeScript narrows the
  // record to the non-coin members of the union.
  if (
    record.recordType === "coins" ||
    record.identification?.identified !== false
  ) {
    return withoutNotes(record);
  }

  const shell = {
    id: record.id,
    entityId: record.entityId,
    recordType: record.recordType,
    name: record.name,
    ...(record.description !== undefined
      ? { description: record.description }
      : {}),
    location: record.location,
    sortOrder: record.sortOrder,
    quantity: record.quantity,
    burden: record.burden,
    ...(record.handsRequired !== undefined
      ? { handsRequired: record.handsRequired }
      : {}),
    ...(record.container ? { container: record.container } : {}),
    identification: { identified: false },
    ...(record.light ? { light: { isLit: record.light.isLit } } : {}),
    ...(record.createdAt !== undefined ? { createdAt: record.createdAt } : {}),
    ...(record.updatedAt !== undefined ? { updatedAt: record.updatedAt } : {}),
  };

  switch (record.recordType) {
    case "treasure":
      return {
        ...shell,
        recordType: "treasure",
        treasure: { gpValue: 0 },
      } as InventoryRecord;
    case "weapon":
      return {
        ...shell,
        recordType: "weapon",
        weapon: {},
      } as InventoryRecord;
    case "armor":
      return {
        ...shell,
        recordType: "armor",
        armor: {},
      } as InventoryRecord;
    case "equipment":
      return { ...shell, recordType: "equipment" } as InventoryRecord;
  }
}

/** GM notes are GM-only always, identified or not. */
function withoutNotes(record: InventoryRecord): InventoryRecord {
  if (record.notes === undefined) {
    return record;
  }

  const { notes: _notes, ...recordWithoutNotes } = record;

  return recordWithoutNotes as InventoryRecord;
}

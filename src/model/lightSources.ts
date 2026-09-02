import { getDirectChildRecords } from "./calculations";
import { moveInventoryRecord } from "./inventoryRecords";
import { getRecordHandsRequired } from "./types";
import type {
  Entity,
  InventoryLocation,
  InventoryRecord,
  InventoryRecordId,
  LightData,
  UsesData,
} from "./types";
import {
  findTopLevelStowedContainerRecords,
  getHandOccupancy,
  isCharacterLikeEntity,
} from "./validation";

export type LightSourceRecord = Exclude<
  InventoryRecord,
  { recordType: "coins" }
> & { light: LightData };

export type HandPlacement = "leftHand" | "rightHand" | "bothHands";

export type SnuffOutcome =
  | { kind: "burnedOut" }
  | { kind: "turnsRemaining"; turns: number };

export type LightRecordResult =
  | {
      ok: true;
      records: InventoryRecord[];
      litRecordId: InventoryRecordId;
      /** True when one item was split off a stack to be lit. */
      split: boolean;
      /** Set when the lit item was moved into a free hand. */
      handPlacement?: HandPlacement;
    }
  | { ok: false; message: string };

export type SnuffRecordResult =
  | {
      ok: true;
      records: InventoryRecord[];
      /** True when the item burned away (record removed or stack reduced). */
      consumed: boolean;
    }
  | { ok: false; message: string };

export function isLightSourceRecord(
  record: InventoryRecord,
): record is LightSourceRecord {
  return record.recordType !== "coins" && record.light !== undefined;
}

export function isLitRecord(record: InventoryRecord): boolean {
  return isLightSourceRecord(record) && record.light.isLit;
}

/**
 * Light one item. A stack splits off a single item so only that one is lit;
 * the lit item moves into a free hand when it needs one and a hand is free,
 * otherwise it stays where it is. Nothing about burn time is automated.
 */
export function lightRecord({
  entity,
  record,
  records,
  newRecordId,
}: {
  entity: Entity;
  record: InventoryRecord;
  records: InventoryRecord[];
  newRecordId: InventoryRecordId;
}): LightRecordResult {
  if (!isLightSourceRecord(record)) {
    return { ok: false, message: "Only light sources can be lit." };
  }

  if (record.light.isLit) {
    return { ok: false, message: `${record.name} is already lit.` };
  }

  if (record.quantity < 1) {
    return { ok: false, message: `${record.name} has no items to light.` };
  }

  const litLight: LightData = { ...record.light, isLit: true };
  const handPlacement = findFreeHandPlacement(entity, record, records);
  const handLocation: InventoryLocation | undefined = handPlacement
    ? { kind: "equipped", placement: handPlacement }
    : undefined;

  if (record.quantity === 1) {
    const litRecord: InventoryRecord = { ...record, light: litLight };
    const replaced = records.map((candidate) =>
      candidate.id === record.id ? litRecord : candidate,
    );

    return {
      ok: true,
      records: handLocation
        ? moveInventoryRecord({
            recordId: record.id,
            records: replaced,
            entityId: record.entityId,
            location: handLocation,
          })
        : replaced,
      litRecordId: record.id,
      split: false,
      ...(handPlacement ? { handPlacement } : {}),
    };
  }

  const litRecord: InventoryRecord = {
    ...record,
    id: newRecordId,
    quantity: 1,
    light: litLight,
  };
  const remainder: InventoryRecord = {
    ...record,
    quantity: record.quantity - 1,
  };
  const sourceInHand = isHandLocation(record.location);
  // A stack held in hand keeps the lit item in that hand; the rest of the
  // stack goes back to the pack (or loose) so the hand holds one record.
  const remainderLocation: InventoryLocation | undefined = sourceInHand
    ? getPackLocation(entity, records)
    : undefined;
  const litLocation: InventoryLocation = sourceInHand
    ? record.location
    : (handLocation ?? record.location);
  const withLit = moveInventoryRecord({
    recordId: newRecordId,
    records: [
      ...records.map((candidate) =>
        candidate.id === record.id ? remainder : candidate,
      ),
      litRecord,
    ],
    entityId: record.entityId,
    location: litLocation,
  });

  return {
    ok: true,
    records: remainderLocation
      ? moveInventoryRecord({
          recordId: record.id,
          records: withLit,
          entityId: record.entityId,
          location: remainderLocation,
        })
      : withLit,
    litRecordId: newRecordId,
    split: true,
    ...(!sourceInHand && handPlacement ? { handPlacement } : {}),
  };
}

/**
 * Put a light out. "Burned out" consumes a stacked item (torch, candle) —
 * the record is removed or the stack reduced — and leaves a fixed item
 * (lantern) unlit with zero uses. "Turns remaining" records the remaining
 * burn on the shared `uses` object and leaves the item unlit.
 */
export function snuffRecord({
  record,
  records,
  outcome,
}: {
  record: InventoryRecord;
  records: InventoryRecord[];
  outcome: SnuffOutcome;
}): SnuffRecordResult {
  if (!isLightSourceRecord(record) || !record.light.isLit) {
    return { ok: false, message: "Only a lit light source can be put out." };
  }

  const unlitLight: LightData = { ...record.light, isLit: false };

  if (outcome.kind === "turnsRemaining") {
    const turns = outcome.turns;

    if (!Number.isInteger(turns) || turns < 0) {
      return {
        ok: false,
        message: "Turns remaining must be a whole number of 0 or more.",
      };
    }

    if (record.uses?.max !== undefined && turns > record.uses.max) {
      return {
        ok: false,
        message: `Turns remaining cannot exceed ${record.uses.max}.`,
      };
    }

    const uses: UsesData = {
      current: turns,
      ...(record.uses?.max !== undefined ? { max: record.uses.max } : {}),
    };

    return {
      ok: true,
      records: records.map((candidate) =>
        candidate.id === record.id
          ? { ...record, light: unlitLight, uses }
          : candidate,
      ),
      consumed: false,
    };
  }

  if (record.burden.kind !== "stacked") {
    return {
      ok: true,
      records: records.map((candidate) =>
        candidate.id === record.id
          ? {
              ...record,
              light: unlitLight,
              ...(record.uses ? { uses: { ...record.uses, current: 0 } } : {}),
            }
          : candidate,
      ),
      consumed: false,
    };
  }

  if (record.quantity > 1) {
    return {
      ok: true,
      records: records.map((candidate) =>
        candidate.id === record.id
          ? { ...record, quantity: record.quantity - 1, light: unlitLight }
          : candidate,
      ),
      consumed: true,
    };
  }

  if (getDirectChildRecords(record.id, records).length > 0) {
    return {
      ok: false,
      message: `${record.name} still holds items and cannot burn away.`,
    };
  }

  return {
    ok: true,
    records: records.filter((candidate) => candidate.id !== record.id),
    consumed: true,
  };
}

function findFreeHandPlacement(
  entity: Entity,
  record: InventoryRecord,
  records: InventoryRecord[],
): HandPlacement | undefined {
  if (!isCharacterLikeEntity(entity) || record.entityId !== entity.id) {
    return undefined;
  }

  const handsRequired = getRecordHandsRequired(record);

  if (handsRequired === 0 || isHandLocation(record.location)) {
    return undefined;
  }

  const occupancy = getHandOccupancy(entity.id, records);

  if (occupancy.bothHands) {
    return undefined;
  }

  if (handsRequired === 2) {
    return !occupancy.leftHand && !occupancy.rightHand ? "bothHands" : undefined;
  }

  if (!occupancy.leftHand) {
    return "leftHand";
  }

  return !occupancy.rightHand ? "rightHand" : undefined;
}

function isHandLocation(location: InventoryLocation): boolean {
  return location.kind === "equipped" && location.placement !== "loose";
}

function getPackLocation(
  entity: Entity,
  records: InventoryRecord[],
): InventoryLocation {
  const pack = findTopLevelStowedContainerRecords(entity.id, records)[0];

  return pack
    ? { kind: "container", containerId: pack.id }
    : { kind: "equipped", placement: "loose" };
}

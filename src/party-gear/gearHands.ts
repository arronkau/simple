import type { InventoryRecordLocationInput } from "../model/inventoryRecords";
import { getRecordHandsRequired } from "../model/types";
import type {
  EntityId,
  InventoryRecord,
  InventoryRecordId,
} from "../model/types";
import type { GearDropTarget } from "./gearDnd";

/**
 * Hand-occupancy planning for the Party Gear board. Pure: it only describes
 * which validated moves to run, in order — the store (or the projection) runs
 * them and owns every invariant.
 */

export const HAND_PLACEMENTS = ["leftHand", "rightHand", "bothHands"] as const;

export type HandPlacement = (typeof HAND_PLACEMENTS)[number];

export type HandMove = {
  recordId: InventoryRecordId;
  location: InventoryRecordLocationInput;
};

export function isHandPlacement(
  placement: GearDropTarget["placement"],
): placement is HandPlacement {
  return (
    placement === "leftHand" ||
    placement === "rightHand" ||
    placement === "bothHands"
  );
}

/**
 * Whether a second hand actually does anything for this record. Only two kinds
 * of record benefit: a container whose capacity depends on the hands gripping
 * it (`container.capacityByHands`), and a weapon carrying the catalog-authored
 * "Versatile" quality (free-text, matched case-insensitively after trim).
 * A `handsRequired: 2` record always takes both hands, so there is nothing to
 * offer it; coins are never held.
 */
export function benefitsFromBothHands(record: InventoryRecord): boolean {
  if (record.recordType === "coins") {
    return false;
  }
  if (getRecordHandsRequired(record) === 2) {
    return false;
  }
  if (record.container?.capacityByHands) {
    return true;
  }
  return Boolean(
    record.recordType === "weapon" &&
      record.weapon.qualities?.some(
        (quality) => quality.trim().toLowerCase() === "versatile",
      ),
  );
}

/**
 * The hand placement a request actually resolves to. A `handsRequired: 2`
 * record always takes both hands; a request for both hands is honoured only
 * for a record that benefits from the second hand, and otherwise lands in the
 * right hand. Every other request is taken as given.
 */
export function resolveHandTarget(
  record: InventoryRecord,
  placement: HandPlacement,
): HandPlacement {
  if (getRecordHandsRequired(record) === 2) {
    return "bothHands";
  }
  if (placement === "bothHands" && !benefitsFromBothHands(record)) {
    return "rightHand";
  }
  return placement;
}

/**
 * Hand-occupancy management for a hand placement. The placement is resolved by
 * `resolveHandTarget` — `handsRequired: 2` upgrades to both hands, a both-hands
 * request downgrades to the right hand unless the record benefits from the
 * second hand, and anything else is taken as requested. Whatever occupied the
 * hands being claimed moves to worn first, so each validated move is legal on
 * its own.
 */
export function buildHandDropSequence(
  record: InventoryRecord,
  placement: HandPlacement,
  entityId: EntityId,
  records: InventoryRecord[],
): HandMove[] {
  const occupant = (hand: HandPlacement) =>
    records.find(
      (candidate) =>
        candidate.id !== record.id &&
        candidate.entityId === entityId &&
        candidate.location.kind === "equipped" &&
        candidate.location.placement === hand,
    );
  const loose: InventoryRecordLocationInput = {
    entityId,
    placement: "equippedLoose",
  };
  const moves: HandMove[] = [];

  const targetHand = resolveHandTarget(record, placement);
  // Claiming both hands clears every hand; claiming one clears that hand plus
  // any two-hander that was spanning both.
  const claimedHands: HandPlacement[] =
    targetHand === "bothHands"
      ? [...HAND_PLACEMENTS]
      : ["bothHands", targetHand];

  for (const hand of claimedHands) {
    const held = occupant(hand);

    if (held) {
      moves.push({ recordId: held.id, location: loose });
    }
  }

  moves.push({
    recordId: record.id,
    location: { entityId, placement: targetHand },
  });
  return moves;
}

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
 * Hand-occupancy management for a hand placement. The requested placement is
 * taken literally — `bothHands` grips with both hands, `leftHand`/`rightHand`
 * with one — and only a record with `handsRequired: 2` is upgraded to both
 * hands from a one-hand request. Whatever occupied the hands being claimed
 * moves to worn first, so each validated move is legal on its own.
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

  const targetHand: HandPlacement =
    getRecordHandsRequired(record) === 2 ? "bothHands" : placement;
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

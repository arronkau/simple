/**
 * Shared load/capacity widgets in the gear page idiom. One representation
 * everywhere: ■ pips for per-item slot burden, the thin capacity track with
 * a mono used/max readout, and the "N free" badge.
 */

import {
  getEquippedMovementBands,
  getStowedMovementBands,
  type CharacterEncumbranceResult,
} from "../model/encumbrance";
import { InfoPopover } from "../ui/InfoPopover";
import { formatStowedBandNote, MovementBandTable } from "./MovementDetails";

export type LoadTone = "ok" | "warn" | "crit";

export function capacityTone(used: number, max: number): LoadTone {
  if (used > max) {
    return "crit";
  }

  return used / max >= 0.85 ? "warn" : "ok";
}

export function SlotPips({ slots }: { slots: number }) {
  if (slots <= 0) {
    return <span className="islots faint">·</span>;
  }

  if (slots <= 3 && Number.isInteger(slots)) {
    return (
      <span className="islots">
        <b>{"■".repeat(slots)}</b>
      </span>
    );
  }

  return (
    <span className="islots">
      ■<b>×{slots}</b>
    </span>
  );
}

export function CapBar({
  used,
  max,
  tone,
}: {
  used: number;
  max?: number;
  tone: LoadTone;
}) {
  const pct = max !== undefined && max > 0
    ? Math.min(100, Math.round((100 * used) / max))
    : 0;

  return (
    <span className={`cap ${tone === "ok" ? "" : tone}`}>
      <span className="track">
        <i style={{ width: `${pct}%` }} />
      </span>
      <span className="capnum">
        {used}/{max ?? "—"}
      </span>
    </span>
  );
}

/**
 * Character load readout: equipped and stowed against their own limits (the
 * sheet has no combined limit). Each side takes its own warn/crit tone and
 * opens its movement band table when clicked; `align` anchors those panels.
 */
export function LoadReadout({
  encumbrance,
  align = "start",
}: {
  encumbrance: CharacterEncumbranceResult;
  align?: "start" | "end";
}) {
  const equippedTone = capacityTone(
    encumbrance.equippedItems,
    encumbrance.equippedCapacity,
  );
  const stowedTone = capacityTone(
    encumbrance.stowedItems,
    encumbrance.stowedCapacity,
  );

  return (
    <span className="load-readout mono" aria-label="Load">
      <InfoPopover
        align={align}
        className={`load-part ${equippedTone}`}
        label={`Equipped ${encumbrance.equippedItems} of ${encumbrance.equippedCapacity} slots. Show the equipped movement bands.`}
        summary={`Eq ${encumbrance.equippedItems}/${encumbrance.equippedCapacity}`}
      >
        <MovementBandTable
          bands={getEquippedMovementBands()}
          currentItems={encumbrance.equippedItems}
          title={`Equipped · ${encumbrance.equippedItems} of ${encumbrance.equippedCapacity}`}
        />
      </InfoPopover>
      <span className="load-sep">·</span>
      <InfoPopover
        align={align}
        className={`load-part ${stowedTone}`}
        label={`Stowed ${encumbrance.stowedItems} of ${encumbrance.stowedCapacity} slots. Show the stowed movement bands.`}
        summary={`St ${encumbrance.stowedItems}/${encumbrance.stowedCapacity}`}
      >
        <MovementBandTable
          bands={getStowedMovementBands(encumbrance.strengthModifier)}
          currentItems={encumbrance.stowedItems}
          note={formatStowedBandNote(encumbrance.strengthModifier)}
          title={`Stowed · ${encumbrance.stowedItems} of ${encumbrance.stowedCapacity}`}
        />
      </InfoPopover>
    </span>
  );
}

export function FreeBadge({ free, tone }: { free: number; tone: LoadTone }) {
  return (
    <span className={`free ${tone === "ok" ? "" : tone}`}>
      {free >= 0 ? `${free} free` : `${-free} over`}
    </span>
  );
}

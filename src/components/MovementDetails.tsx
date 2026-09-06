/**
 * Panel bodies for the movement popovers: the band table behind one side of
 * the load readout, and the breakdown behind the movement rate itself. Both
 * only format what `model/encumbrance` derives.
 */

import type {
  MovementBand,
  MovementExplanation,
  MovementRate,
} from "../model/encumbrance";
import { formatMovementPair, formatSignedNumber } from "../formatters";

export function MovementBandTable({
  title,
  bands,
  currentItems,
  note,
}: {
  title: string;
  bands: MovementBand[];
  currentItems: number;
  note?: string;
}) {
  return (
    <>
      <table className="movement-table">
        <caption>{title}</caption>
        <tbody>
          {bands.map((band) => (
            <tr
              key={band.band}
              data-current={
                currentItems >= band.minItems &&
                (band.maxItems === null || currentItems <= band.maxItems)
              }
            >
              <td className="mono">{formatBandRange(band)} items</td>
              <td className="mono">
                <MovementRateText rate={band.band === "overloaded" ? "overloaded" : band.movement} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {note ? <p className="movement-note">{note}</p> : null}
    </>
  );
}

/** The stowed table's STR line: how far this character's rows are shifted. */
export function formatStowedBandNote(strengthModifier: number): string {
  if (strengthModifier === 0) {
    return "STR modifier +0: stowed rows as printed.";
  }

  const slots = Math.abs(strengthModifier) === 1 ? "1 item" : `${Math.abs(strengthModifier)} items`;

  return strengthModifier > 0
    ? `STR ${formatSignedNumber(strengthModifier)} adds ${slots} to every stowed row.`
    : `STR ${formatSignedNumber(strengthModifier)} takes ${slots} from every stowed row.`;
}

export function MovementBreakdown({
  explanation,
}: {
  explanation: MovementExplanation;
}) {
  const overloaded = explanation.movement.explorationFeet === 0;
  const stowedLabel =
    explanation.stowed.strengthModifier === 0
      ? `Stowed ${explanation.stowed.items}/${explanation.stowed.capacity}`
      : `Stowed ${explanation.stowed.items}/${explanation.stowed.capacity} (STR ${formatSignedNumber(
          explanation.stowed.strengthModifier,
        )})`;

  return (
    <>
      <table className="movement-table">
        <caption>Move {formatMovementPair(explanation.movement)}</caption>
        <tbody>
          <tr data-limiting={explanation.limitedBy.includes("equipped")}>
            <td>Equipped {explanation.equipped.items}/{explanation.equipped.capacity}</td>
            <td className="mono">
              <MovementRateText rate={explanation.equipped.rate} />
            </td>
          </tr>
          <tr data-limiting={explanation.limitedBy.includes("stowed")}>
            <td>{stowedLabel}</td>
            <td className="mono">
              <MovementRateText rate={explanation.stowed.rate} />
            </td>
          </tr>
          {explanation.containerOverCapacity ? (
            <tr data-limiting>
              <td>Container over capacity</td>
              <td className="mono">
                <MovementRateText rate="overloaded" />
              </td>
            </tr>
          ) : null}
          {explanation.handsRequiredContainerNotHeld ? (
            <tr data-limiting>
              <td>Hands-required container not held</td>
              <td className="mono">
                <MovementRateText rate="overloaded" />
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <p className="movement-note">
        {overloaded
          ? "Any overload stops movement."
          : "Movement is the slower of equipped and stowed. Click Eq or St for the bands."}
      </p>
    </>
  );
}

function MovementRateText({ rate }: { rate: MovementRate | "overloaded" }) {
  if (rate === "overloaded" || rate.explorationFeet === 0) {
    return <span className="movement-rate-zero">can’t move</span>;
  }

  return <>{formatMovementPair(rate)}</>;
}

function formatBandRange(band: MovementBand): string {
  if (band.maxItems === null) {
    return `${band.minItems}+`;
  }

  return band.minItems === band.maxItems
    ? `${band.minItems}`
    : `${band.minItems}–${band.maxItems}`;
}

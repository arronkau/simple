import { type FormEvent, useState } from "react";
import type { SnuffOutcome } from "../model/lightSources";
import type { InventoryRecord } from "../model/types";
import { getRecordDisplayName } from "../formatters";
import { Modal } from "../ui/Modal";

/**
 * Put out a lit light source. "Burned out" consumes a torch or candle and
 * empties a lantern; "Turns remaining" records how much burn is left.
 */
export function SnuffLightModal({
  record,
  message,
  onCancel,
  onSubmit,
}: {
  record: InventoryRecord | undefined;
  message?: string;
  onCancel: () => void;
  onSubmit: (outcome: SnuffOutcome) => void;
}) {
  const uses = record && record.recordType !== "coins" ? record.uses : undefined;
  const [kind, setKind] = useState<SnuffOutcome["kind"]>("turnsRemaining");
  const [turnsText, setTurnsText] = useState(
    uses ? String(uses.current) : "",
  );

  if (!record || record.recordType === "coins" || !record.light?.isLit) {
    return null;
  }

  const name = getRecordDisplayName(record);
  const turns = Number(turnsText);
  const turnsValid =
    turnsText.trim().length > 0 &&
    Number.isInteger(turns) &&
    turns >= 0 &&
    (uses?.max === undefined || turns <= uses.max);
  const consumable = record.burden.kind === "stacked";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (kind === "burnedOut") {
      onSubmit({ kind: "burnedOut" });
      return;
    }

    if (!turnsValid) {
      return;
    }

    onSubmit({ kind: "turnsRemaining", turns });
  }

  return (
    <Modal
      size="narrow"
      subtitle={
        <>
          <p>
            {uses
              ? uses.max !== undefined
                ? `${uses.current} of ${uses.max} turns left`
                : `${uses.current} turns left`
              : "No burn time recorded"}
          </p>
          {message ? <p className="form-error">{message}</p> : null}
        </>
      }
      title={`Put out ${name}`}
      onClose={onCancel}
    >
      <form className="record-form modal-form" onSubmit={handleSubmit}>
        <div className="modal-body snuff-options">
          <label className="snuff-option">
            <input
              checked={kind === "burnedOut"}
              name="snuff-outcome"
              type="radio"
              value="burnedOut"
              onChange={() => setKind("burnedOut")}
            />
            <span>
              Burned out
              <span className="field-help">
                {consumable
                  ? `${name} is used up and removed`
                  : `${name} stays, with no burn time left`}
              </span>
            </span>
          </label>
          <label className="snuff-option">
            <input
              checked={kind === "turnsRemaining"}
              name="snuff-outcome"
              type="radio"
              value="turnsRemaining"
              onChange={() => setKind("turnsRemaining")}
            />
            <span className="snuff-turns">
              Turns remaining
              <input
                aria-label="Turns remaining"
                disabled={kind !== "turnsRemaining"}
                inputMode="numeric"
                size={4}
                type="text"
                value={turnsText}
                onChange={(event) => setTurnsText(event.target.value)}
              />
              {uses?.max !== undefined ? (
                <span className="field-help">of {uses.max}</span>
              ) : null}
            </span>
          </label>
          {kind === "turnsRemaining" && turnsText && !turnsValid ? (
            <p className="form-error">
              {uses?.max !== undefined
                ? `Enter a whole number from 0 to ${uses.max}.`
                : "Enter a whole number of 0 or more."}
            </p>
          ) : null}
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            disabled={kind === "turnsRemaining" && !turnsValid}
            type="submit"
          >
            Put out
          </button>
        </div>
      </form>
    </Modal>
  );
}

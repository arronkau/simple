import { type FormEvent } from "react";
import { getSortedEntities } from "../model/entities";
import { getDefaultCoinRecord } from "../model/inventoryRecords";
import { getRecordById } from "../model/inventoryDisplay";
import type { AppState } from "../model/appState";
import type { CoinData, EntityId, InventoryRecord } from "../model/types";
import type { CoinDenomination } from "../store/useAppStore";
import {
  COIN_DENOMINATIONS,
  EMPTY_COINS,
  type CoinSpendFormState,
  type CoinTransferFormState,
} from "../view-types";

export function CoinSpendModal({
  formState,
  message,
  record,
  onCancel,
  onChange,
  onSubmit,
}: {
  formState: CoinSpendFormState;
  message?: string;
  record: InventoryRecord | undefined;
  onCancel: () => void;
  onChange: (formState: CoinSpendFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!record || record.recordType !== "coins") {
    return null;
  }

  const validationMessage = getCoinSpendValidationMessage(
    formState.amounts,
    record.coins,
  );

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-label="Spend coins"
        aria-modal="true"
        className="modal-panel record-modal"
        role="dialog"
      >
        <form className="record-form modal-form" onSubmit={onSubmit}>
          <div className="modal-header record-form-heading">
            <div>
              <h4>Spend Coins</h4>
              {message ? <p className="form-error">{message}</p> : null}
            </div>
          </div>

          <div className="modal-body coin-spend-layout">
            <section className="coin-spend-section">
              <h5>Spend amount</h5>
              <div className="coin-spend-grid">
                <div className="coin-spend-heading">Denomination</div>
                <div className="coin-spend-heading">Available</div>
                <div className="coin-spend-heading">Spend</div>
                {COIN_DENOMINATIONS.map((denomination) => (
                  <CoinSpendRow
                    actionLabel="Spend"
                    available={record.coins[denomination]}
                    denomination={denomination}
                    key={denomination}
                    value={formState.amounts[denomination]}
                    onChange={(value) =>
                      onChange({
                        ...formState,
                        amounts: {
                          ...formState.amounts,
                          [denomination]: value,
                        },
                      })
                    }
                  />
                ))}
              </div>
              {validationMessage ? (
                <p className="form-error">{validationMessage}</p>
              ) : null}
            </section>

            <label>
              <span>Note</span>
              <span className="field-help">Optional reason for the spend</span>
              <input
                autoComplete="off"
                maxLength={160}
                value={formState.note}
                onChange={(event) =>
                  onChange({ ...formState, note: event.target.value })
                }
              />
            </label>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
            <button disabled={validationMessage !== undefined} type="submit">
              Spend coins
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function CoinTransferModal({
  appState,
  formState,
  message,
  onCancel,
  onChange,
  onSubmit,
}: {
  appState: AppState;
  formState: CoinTransferFormState;
  message?: string;
  onCancel: () => void;
  onChange: (formState: CoinTransferFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const sortedEntities = getSortedEntities(appState.entities);
  const sourceRecord = getTransferSourceCoinRecord(formState, appState);
  const sourceCoins =
    sourceRecord?.recordType === "coins" ? sourceRecord.coins : EMPTY_COINS;
  const validationMessage = getCoinTransferValidationMessage(
    formState,
    appState,
  );

  function changeSourceEntity(sourceEntityId: EntityId) {
    const destinationEntityId =
      sourceEntityId === formState.destinationEntityId
        ? sortedEntities.find((entity) => entity.id !== sourceEntityId)?.id ?? ""
        : formState.destinationEntityId;

    onChange({
      ...formState,
      sourceEntityId,
      sourceRecordId: undefined,
      destinationEntityId,
    });
  }

  function takeAll() {
    onChange({
      ...formState,
      amounts: toCoinSpendAmountInputs(sourceCoins),
    });
  }

  function changeDestinationEntity(destinationEntityId: EntityId) {
    // A hand-picked destination lands in its default coin record; the dragged
    // drop target only made sense for the entity it was dropped on.
    const { destinationLocation: _dropped, ...rest } = formState;

    onChange({
      ...rest,
      destinationEntityId,
    });
  }

  const destinationPlaceText = formatTransferDestinationPlace(
    formState,
    appState,
  );

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-label="Transfer coins"
        aria-modal="true"
        className="modal-panel record-modal"
        role="dialog"
      >
        <form className="record-form modal-form" onSubmit={onSubmit}>
          <div className="modal-header record-form-heading">
            <div>
              <h4>Transfer Coins</h4>
              <p className="form-help">Move exact denominations between entities.</p>
              {message ? <p className="form-error">{message}</p> : null}
            </div>
          </div>

          <div className="modal-body coin-spend-layout">
            <section className="coin-transfer-entities">
              <label>
                <span>Source</span>
                <select
                  value={formState.sourceEntityId}
                  onChange={(event) =>
                    changeSourceEntity(event.target.value as EntityId)
                  }
                >
                  {sortedEntities.map((entity) => (
                    <option key={entity.id} value={entity.id}>
                      {entity.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Destination</span>
                <select
                  value={formState.destinationEntityId}
                  onChange={(event) =>
                    changeDestinationEntity(event.target.value as EntityId)
                  }
                >
                  <option value="">Select destination</option>
                  {sortedEntities.map((entity) => (
                    <option key={entity.id} value={entity.id}>
                      {entity.name}
                    </option>
                  ))}
                </select>
                {destinationPlaceText ? (
                  <span className="field-help">{destinationPlaceText}</span>
                ) : null}
              </label>
            </section>

            <section className="coin-spend-section">
              <div className="coin-transfer-amount-heading">
                <h5>Transfer amount</h5>
                <button type="button" className="compact-row-action" onClick={takeAll}>
                  Take all
                </button>
              </div>
              <div className="coin-spend-grid">
                <div className="coin-spend-heading">Denomination</div>
                <div className="coin-spend-heading">Available</div>
                <div className="coin-spend-heading">Transfer</div>
                {COIN_DENOMINATIONS.map((denomination) => (
                  <CoinSpendRow
                    actionLabel="Transfer"
                    available={sourceCoins[denomination]}
                    denomination={denomination}
                    key={denomination}
                    value={formState.amounts[denomination]}
                    onChange={(value) =>
                      onChange({
                        ...formState,
                        amounts: {
                          ...formState.amounts,
                          [denomination]: value,
                        },
                      })
                    }
                  />
                ))}
              </div>
              {validationMessage ? (
                <p className="form-error">{validationMessage}</p>
              ) : null}
            </section>

            <label>
              <span>Note</span>
              <span className="field-help">Optional transfer note</span>
              <input
                autoComplete="off"
                maxLength={160}
                value={formState.note}
                onChange={(event) =>
                  onChange({ ...formState, note: event.target.value })
                }
              />
            </label>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
            <button disabled={validationMessage !== undefined} type="submit">
              Transfer coins
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function CoinSpendRow({
  actionLabel,
  available,
  denomination,
  onChange,
  value,
}: {
  actionLabel: string;
  available: number;
  denomination: CoinDenomination;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <>
      <div className="coin-spend-denomination">{denomination.toUpperCase()}</div>
      <div className="coin-spend-available">{available}</div>
      <input
        aria-label={`${actionLabel} ${denomination}`}
        min="0"
        step="1"
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </>
  );
}

// ---- Coin form utilities ----

export function createEmptyCoinSpendAmounts(): Record<CoinDenomination, string> {
  return {
    pp: "",
    gp: "",
    sp: "",
    cp: "",
  };
}

/** Coin form inputs holding an entire pile — the "take all" default. */
export function toCoinSpendAmountInputs(
  coins: CoinData,
): Record<CoinDenomination, string> {
  return {
    pp: coins.pp > 0 ? coins.pp.toString() : "",
    gp: coins.gp > 0 ? coins.gp.toString() : "",
    sp: coins.sp > 0 ? coins.sp.toString() : "",
    cp: coins.cp > 0 ? coins.cp.toString() : "",
  };
}

export function toCoinSpendAmounts(
  amounts: Record<CoinDenomination, string>,
): Partial<CoinData> {
  return {
    pp: toCoinSpendNumber(amounts.pp),
    gp: toCoinSpendNumber(amounts.gp),
    sp: toCoinSpendNumber(amounts.sp),
    cp: toCoinSpendNumber(amounts.cp),
  };
}

export function getCoinSpendValidationMessage(
  amounts: Record<CoinDenomination, string>,
  availableCoins: CoinData,
): string | undefined {
  const spendAmounts = toCoinSpendAmounts(amounts);
  const hasPositiveAmount = COIN_DENOMINATIONS.some(
    (denomination) => (spendAmounts[denomination] ?? 0) > 0,
  );

  if (!hasPositiveAmount) {
    return "Enter at least one coin amount to spend.";
  }

  const invalidDenomination = COIN_DENOMINATIONS.find((denomination) => {
    const rawValue = amounts[denomination].trim();

    return (
      rawValue.length > 0 &&
      (!Number.isInteger(Number(rawValue)) || Number(rawValue) < 0)
    );
  });

  if (invalidDenomination) {
    return "Spend amounts must be non-negative whole numbers.";
  }

  const overspentDenomination = COIN_DENOMINATIONS.find(
    (denomination) =>
      (spendAmounts[denomination] ?? 0) > availableCoins[denomination],
  );

  if (overspentDenomination) {
    return `Cannot spend more ${overspentDenomination} than available.`;
  }

  return undefined;
}

export function getCoinTransferValidationMessage(
  formState: CoinTransferFormState,
  appState: AppState,
): string | undefined {
  if (!formState.sourceEntityId) {
    return "Choose a source.";
  }

  if (!formState.destinationEntityId) {
    return "Choose a destination.";
  }

  if (formState.sourceEntityId === formState.destinationEntityId) {
    return "Choose a different destination.";
  }

  const sourceRecord = getTransferSourceCoinRecord(formState, appState);

  if (!sourceRecord || sourceRecord.recordType !== "coins") {
    return "Source has no coin record.";
  }

  const spendValidationMessage = getCoinSpendValidationMessage(
    formState.amounts,
    sourceRecord.coins,
  );

  return spendValidationMessage
    ?.replace("spend", "transfer")
    .replace("Spend", "Transfer");
}

/** "Into Sack" / "Worn" / "Contents" — where a dragged transfer will land. */
function formatTransferDestinationPlace(
  formState: CoinTransferFormState,
  appState: AppState,
): string | undefined {
  const destination = formState.destinationLocation;

  if (!destination) {
    return undefined;
  }

  switch (destination.placement) {
    case "container": {
      const container = destination.containerId
        ? getRecordById(destination.containerId, appState.inventoryRecords)
        : undefined;

      return `Into ${container?.name ?? "container"}`;
    }
    case "equippedLoose":
      return "Worn";
    case "contents":
      return "Contents";
    case "stowedRoot":
      return "Stowed";
    default:
      return undefined;
  }
}

function getTransferSourceCoinRecord(
  formState: CoinTransferFormState,
  appState: AppState,
): InventoryRecord | undefined {
  if (formState.sourceRecordId) {
    const record = getRecordById(
      formState.sourceRecordId,
      appState.inventoryRecords,
    );

    return record &&
      record.recordType === "coins" &&
      record.entityId === formState.sourceEntityId
      ? record
      : undefined;
  }

  return getDefaultCoinRecord(
    formState.sourceEntityId,
    appState.inventoryRecords,
  );
}

function toCoinSpendNumber(value: string): number {
  return value.trim().length === 0 ? 0 : Number(value);
}

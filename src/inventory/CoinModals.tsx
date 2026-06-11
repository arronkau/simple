import { type FormEvent } from "react";
import { getSortedEntities } from "../model/entities";
import { getCharacterCoinRecord } from "../model/inventoryRecords";
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
      amounts: {
        pp: sourceCoins.pp > 0 ? sourceCoins.pp.toString() : "",
        gp: sourceCoins.gp > 0 ? sourceCoins.gp.toString() : "",
        sp: sourceCoins.sp > 0 ? sourceCoins.sp.toString() : "",
        cp: sourceCoins.cp > 0 ? sourceCoins.cp.toString() : "",
      },
    });
  }

  function changeDestinationEntity(destinationEntityId: EntityId) {
    onChange({
      ...formState,
      destinationEntityId,
    });
  }

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

  return getDefaultCoinRecordForEntity(
    formState.sourceEntityId,
    appState.inventoryRecords,
  );
}

export function getDefaultCoinRecordForEntity(
  entityId: EntityId,
  records: InventoryRecord[],
): InventoryRecord | undefined {
  const coinPurseRecord = getCharacterCoinRecord(entityId, records);

  if (coinPurseRecord) {
    return coinPurseRecord;
  }

  return records
    .filter(
      (record) => record.entityId === entityId && record.recordType === "coins",
    )
    .sort((recordA, recordB) => recordA.sortOrder - recordB.sortOrder)[0];
}

function toCoinSpendNumber(value: string): number {
  return value.trim().length === 0 ? 0 : Number(value);
}

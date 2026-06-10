import { type FormEvent } from "react";
import { getRecordById } from "../model/inventoryDisplay";
import type { AppState } from "../model/appState";
import type { Entity, InventoryRecord, InventoryRecordId } from "../model/types";
import type { InventoryMutationResult } from "../store/useAppStore";
import type { RecordFormState } from "../view-types";
import { InventoryRecordForm } from "./InventoryRecordForm";

export function InventoryRecordModal({
  appState,
  entity,
  formState,
  message,
  onCancel,
  onChange,
  onDeleteRecord,
  onSpendCoins,
  onSubmit,
  onTransferCoins,
}: {
  appState: AppState;
  entity: Entity;
  formState: RecordFormState;
  message?: string;
  onCancel: () => void;
  onChange: (formState: RecordFormState) => void;
  onDeleteRecord: (record: InventoryRecord) => void;
  onSpendCoins: (record: InventoryRecord) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTransferCoins: (record: InventoryRecord) => void;
}) {
  const editingRecord = formState.recordId
    ? getRecordById(formState.recordId, appState.inventoryRecords)
    : undefined;

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-label={formState.mode === "edit" ? "Edit inventory record" : "Add inventory record"}
        aria-modal="true"
        className="modal-panel inventory-item-modal"
        role="dialog"
      >
        <InventoryRecordForm
          appState={appState}
          entity={entity}
          formState={formState}
          message={message}
          onCancel={onCancel}
          onChange={onChange}
          onDelete={
            editingRecord
              ? () => {
                  onDeleteRecord(editingRecord);
                }
              : undefined
          }
          onSpendCoins={onSpendCoins}
          onSubmit={onSubmit}
          onTransferCoins={onTransferCoins}
        />
      </section>
    </div>
  );
}

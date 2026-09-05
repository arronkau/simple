import { type FormEvent } from "react";
import { getRecordById } from "../model/inventoryDisplay";
import type { AppState } from "../model/appState";
import type { Entity, InventoryRecord, PartyRole } from "../model/types";
import { RECORD_TYPE_LABELS, type RecordFormState } from "../view-types";
import { Modal } from "../ui/Modal";
import { InventoryRecordForm } from "./InventoryRecordForm";

export function InventoryRecordModal({
  appState,
  currentUserPartyRole,
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
  currentUserPartyRole?: PartyRole | null;
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
    <Modal
      subtitle={
        <>
          <p>
            {formState.mode === "edit"
              ? `${RECORD_TYPE_LABELS[formState.recordType]} for ${entity.name}`
              : `New record for ${entity.name}`}
          </p>
          {message ? <p className="form-error">{message}</p> : null}
        </>
      }
      title={formState.mode === "edit" ? "Edit record" : "Add record"}
      onClose={onCancel}
    >
      <InventoryRecordForm
        appState={appState}
        currentUserPartyRole={currentUserPartyRole}
        entity={entity}
        formState={formState}
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
    </Modal>
  );
}

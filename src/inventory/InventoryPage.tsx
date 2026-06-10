import { type FormEvent } from "react";
import type { AppState } from "../model/appState";
import type { Entity, EntityId, InventoryRecord, InventoryRecordId } from "../model/types";
import type { EntityMutationResult, InventoryMutationResult } from "../store/useAppStore";
import type { EntityFormState, RecordFormState } from "../view-types";
import { InventoryEntityBoard } from "./InventoryBoard";
import { InventoryRecordModal } from "./InventoryRecordModal";
import { EntityCreateModal, EntityEditModal } from "../entity/EntityModals";

export function InventoryPage({
  appState,
  collapsedContainerIds,
  entityCreateModalOpen,
  editingEntityId,
  editingName,
  formState,
  recordForm,
  recordFormMessage,
  sortedEntities,
  onCancelEditing,
  onCancelCreateEntity,
  onCancelRecordForm,
  onChangeEntityForm,
  onChangeEditingName,
  onChangeRecordForm,
  onCreateEntity,
  onDeleteEntity,
  onDeleteRecord,
  onEditEntity,
  onEditRecord,
  onIdentifyRecord,
  onSaveEditing,
  onSaveRecordForm,
  onSetEntityActive,
  onSpendCoins,
  onTransferCoins,
  onStartCreateEntity,
  onStartAddRecord,
  onToggleContainerCollapsed,
}: {
  appState: AppState;
  collapsedContainerIds: Set<InventoryRecordId>;
  entityCreateModalOpen: boolean;
  editingEntityId?: EntityId;
  editingName: string;
  formState: EntityFormState;
  recordForm?: RecordFormState;
  recordFormMessage?: string;
  sortedEntities: Entity[];
  onCancelEditing: () => void;
  onCancelCreateEntity: () => void;
  onCancelRecordForm: () => void;
  onChangeEntityForm: (formState: EntityFormState) => void;
  onChangeEditingName: (name: string) => void;
  onChangeRecordForm: (formState: RecordFormState) => void;
  onCreateEntity: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteEntity: (entity: Entity) => void;
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditEntity: (entity: Entity) => void;
  onEditRecord: (record: InventoryRecord) => void;
  onIdentifyRecord: (recordId: InventoryRecordId) => InventoryMutationResult;
  onSaveEditing: (entityId: EntityId) => void;
  onSaveRecordForm: (event: FormEvent<HTMLFormElement>) => void;
  onSetEntityActive: (entityId: EntityId, active: boolean) => void;
  onSpendCoins: (record: InventoryRecord) => void;
  onTransferCoins: (record: InventoryRecord) => void;
  onStartCreateEntity: () => void;
  onStartAddRecord: (entity: Entity) => void;
  onToggleContainerCollapsed: (recordId: InventoryRecordId) => void;
}) {
  const recordFormEntity = recordForm
    ? appState.entities.find((entity) => entity.id === recordForm.entityId)
    : undefined;
  const editingEntity = editingEntityId
    ? appState.entities.find((entity) => entity.id === editingEntityId)
    : undefined;

  return (
    <section className="entity-workspace" aria-labelledby="inventory-title">
      <div className="section-heading">
        <div>
          <h2 id="inventory-title">Inventory</h2>
          <p>Party entities, inventory contents, and encumbrance summaries.</p>
        </div>
        <button type="button" onClick={onStartCreateEntity}>
          Add Entity
        </button>
      </div>

      {sortedEntities.length === 0 ? (
        <p className="empty-state">No entities yet.</p>
      ) : (
        <InventoryEntityBoard
          appState={appState}
          collapsedContainerIds={collapsedContainerIds}
          sortedEntities={sortedEntities}
          onDeleteRecord={onDeleteRecord}
          onEditEntity={onEditEntity}
          onEditRecord={onEditRecord}
          onIdentifyRecord={onIdentifyRecord}
          onSpendCoins={onSpendCoins}
          onStartAddRecord={onStartAddRecord}
          onToggleContainerCollapsed={onToggleContainerCollapsed}
        />
      )}

      {recordForm && recordFormEntity ? (
        <InventoryRecordModal
          appState={appState}
          entity={recordFormEntity}
          formState={recordForm}
          message={recordFormMessage}
          onCancel={onCancelRecordForm}
          onChange={onChangeRecordForm}
          onDeleteRecord={onDeleteRecord}
          onSpendCoins={onSpendCoins}
          onSubmit={onSaveRecordForm}
          onTransferCoins={onTransferCoins}
        />
      ) : null}

      {entityCreateModalOpen ? (
        <EntityCreateModal
          formState={formState}
          onCancel={onCancelCreateEntity}
          onChange={onChangeEntityForm}
          onSubmit={onCreateEntity}
        />
      ) : null}

      {editingEntity ? (
        <EntityEditModal
          appState={appState}
          editingName={editingName}
          entity={editingEntity}
          onCancel={onCancelEditing}
          onChangeEditingName={onChangeEditingName}
          onDeleteEntity={onDeleteEntity}
          onSaveEditing={onSaveEditing}
          onSetEntityActive={onSetEntityActive}
        />
      ) : null}
    </section>
  );
}

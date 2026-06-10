import { type FormEvent } from "react";
import {
  ENTITY_TYPE_LABELS,
  ENTITY_TYPES,
  getEditableEntityTypes,
} from "../model/entities";
import type { AppState } from "../model/appState";
import type { Entity, EntityId, EntityType } from "../model/types";
import { formatWarningState } from "../formatters";
import { type EntityFormState } from "../view-types";
import { getEntityInventoryStatus } from "./EntityStatus";

function EntityForm({
  formState,
  onChange,
}: {
  formState: EntityFormState;
  onChange: (formState: EntityFormState) => void;
}) {
  return (
    <div className="entity-form">
      <label>
        <span>Name</span>
        <input
          autoComplete="off"
          maxLength={80}
          required
          type="text"
          value={formState.name}
          onChange={(event) =>
            onChange({
              ...formState,
              name: event.target.value,
            })
          }
        />
      </label>

      <label>
        <span>Type</span>
        <select
          value={formState.entityType}
          onChange={(event) =>
            onChange({
              ...formState,
              entityType: event.target.value as EntityType,
            })
          }
        >
          {ENTITY_TYPES.map((entityType) => (
            <option key={entityType} value={entityType}>
              {ENTITY_TYPE_LABELS[entityType]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function EntityCreateModal({
  formState,
  onCancel,
  onChange,
  onSubmit,
}: {
  formState: EntityFormState;
  onCancel: () => void;
  onChange: (formState: EntityFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <form
        aria-label="Add entity"
        aria-modal="true"
        className="modal-panel entity-modal"
        role="dialog"
        onSubmit={onSubmit}
      >
        <div className="modal-header">
          <h3>Add Entity</h3>
        </div>
        <div className="modal-body">
          <EntityForm formState={formState} onChange={onChange} />
        </div>
        <div className="modal-footer">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit">Create entity</button>
        </div>
      </form>
    </div>
  );
}

export function EntityEditModal({
  appState,
  editingEntityType,
  editingName,
  entity,
  onCancel,
  onChangeEditingEntityType,
  onChangeEditingName,
  onDeleteEntity,
  onSaveEditing,
  onSetEntityActive,
}: {
  appState: AppState;
  editingEntityType: EntityType;
  editingName: string;
  entity: Entity;
  onCancel: () => void;
  onChangeEditingEntityType: (entityType: EntityType) => void;
  onChangeEditingName: (name: string) => void;
  onDeleteEntity: (entity: Entity) => void;
  onSaveEditing: (entityId: EntityId) => void;
  onSetEntityActive: (entityId: EntityId, active: boolean) => void;
}) {
  const status = getEntityInventoryStatus(entity, appState);
  const editableEntityTypes = getEditableEntityTypes(entity);
  const canEditEntityType = editableEntityTypes.length > 1;

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-label={`Edit ${entity.name}`}
        aria-modal="true"
        className="modal-panel entity-modal"
        role="dialog"
      >
        <div className="modal-header">
          <div>
            <h3>Edit Entity</h3>
            <p className="form-help">{ENTITY_TYPE_LABELS[entity.entityType]}</p>
          </div>
        </div>

        <div className="modal-body">
          <label className="edit-name">
            <span>Name</span>
            <input
              autoComplete="off"
              maxLength={80}
              required
              type="text"
              value={editingName}
              onChange={(event) => onChangeEditingName(event.target.value)}
            />
          </label>

          <label>
            <span>Type</span>
            <select
              disabled={!canEditEntityType}
              value={editingEntityType}
              onChange={(event) =>
                onChangeEditingEntityType(event.target.value as EntityType)
              }
            >
              {editableEntityTypes.map((entityType) => (
                <option key={entityType} value={entityType}>
                  {ENTITY_TYPE_LABELS[entityType]}
                </option>
              ))}
            </select>
          </label>

          <p className="form-help">
            Type controls whether this entity is treated as a character or
            retainer. Class and level stay on the character sheet.
          </p>

          <div className="entity-modal-summary">
            {status.movement ? <span>{status.movement}</span> : null}
            {status.capacity ? <span>{status.capacity}</span> : null}
            {status.warningCount > 0 ? (
              <span>
                {formatWarningState(status.warnings, status.validationIssues)}
              </span>
            ) : (
              <span>No warnings</span>
            )}
          </div>
        </div>

        <div className="modal-footer split-actions">
          <button
            className="danger-button"
            type="button"
            onClick={() => onDeleteEntity(entity)}
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => onSetEntityActive(entity.id, !entity.active)}
          >
            {entity.active ? "Deactivate" : "Reactivate"}
          </button>
          <div className="record-form-action-group">
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" onClick={() => onSaveEditing(entity.id)}>
              Save entity
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

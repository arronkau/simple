import { FormEvent, useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { APP_STATE_STORAGE_KEY } from "./model/appState";
import {
  ENTITY_TYPE_LABELS,
  ENTITY_TYPES,
  getSortedEntities,
} from "./model/entities";
import type { Entity, EntityId, EntityType } from "./model/types";
import { findBackpackRecords } from "./model/validation";
import { useAppStore } from "./store/useAppStore";

type EntityFormState = {
  name: string;
  entityType: EntityType;
};

const EMPTY_ENTITY_FORM: EntityFormState = {
  name: "",
  entityType: "character",
};

function LocalAppShell() {
  const appState = useAppStore((state) => state.appState);
  const createEntity = useAppStore((state) => state.createEntity);
  const updateEntity = useAppStore((state) => state.updateEntity);
  const setEntityActive = useAppStore((state) => state.setEntityActive);
  const deleteEntity = useAppStore((state) => state.deleteEntity);
  const resetLocalState = useAppStore((state) => state.resetLocalState);
  const sortedEntities = useMemo(
    () => getSortedEntities(appState.entities),
    [appState.entities],
  );
  const [formState, setFormState] =
    useState<EntityFormState>(EMPTY_ENTITY_FORM);
  const [editingEntityId, setEditingEntityId] = useState<EntityId | undefined>();
  const [editingName, setEditingName] = useState("");

  function handleCreateEntity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const createdEntityId = createEntity(formState);

    if (createdEntityId) {
      setFormState(EMPTY_ENTITY_FORM);
    }
  }

  function startEditing(entity: Entity) {
    setEditingEntityId(entity.id);
    setEditingName(entity.name);
  }

  function saveEditing(entityId: EntityId) {
    updateEntity(entityId, { name: editingName });
    setEditingEntityId(undefined);
    setEditingName("");
  }

  function cancelEditing() {
    setEditingEntityId(undefined);
    setEditingName("");
  }

  return (
    <main className="app-shell">
      <section className="workspace-panel" aria-labelledby="app-title">
        <div className="app-header">
          <div>
            <p className="eyebrow">Persistence: Local</p>
            <h1 id="app-title">Simple Inventory</h1>
          </div>
          <button type="button" onClick={resetLocalState}>
            Reset local state
          </button>
        </div>

        <dl className="state-summary">
          <div>
            <dt>Schema</dt>
            <dd>v{appState.schemaVersion}</dd>
          </div>
          <div>
            <dt>Entities</dt>
            <dd>{appState.entities.length}</dd>
          </div>
          <div>
            <dt>Inventory records</dt>
            <dd>{appState.inventoryRecords.length}</dd>
          </div>
        </dl>

        <section className="entity-workspace" aria-labelledby="entities-title">
          <div className="section-heading">
            <div>
              <h2 id="entities-title">Entities</h2>
              <p>Characters, retainers, mounts, vehicles, and storage.</p>
            </div>
          </div>

          <form className="entity-form" onSubmit={handleCreateEntity}>
            <label>
              <span>Name</span>
              <input
                autoComplete="off"
                maxLength={80}
                required
                type="text"
                value={formState.name}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    name: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              <span>Type</span>
              <select
                value={formState.entityType}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    entityType: event.target.value as EntityType,
                  }))
                }
              >
                {ENTITY_TYPES.map((entityType) => (
                  <option key={entityType} value={entityType}>
                    {ENTITY_TYPE_LABELS[entityType]}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit">Add entity</button>
          </form>

          {sortedEntities.length === 0 ? (
            <p className="empty-state">No entities yet.</p>
          ) : (
            <ul className="entity-list" aria-label="Entities">
              {sortedEntities.map((entity) => {
                const backpackCount = findBackpackRecords(
                  entity.id,
                  appState.inventoryRecords,
                ).length;
                const isEditing = editingEntityId === entity.id;

                return (
                  <li
                    className="entity-row"
                    data-inactive={!entity.active}
                    key={entity.id}
                  >
                    <div className="entity-main">
                      {isEditing ? (
                        <label className="edit-name">
                          <span>Name</span>
                          <input
                            autoComplete="off"
                            maxLength={80}
                            required
                            type="text"
                            value={editingName}
                            onChange={(event) =>
                              setEditingName(event.target.value)
                            }
                          />
                        </label>
                      ) : (
                        <div>
                          <h3>{entity.name}</h3>
                          <div className="entity-meta">
                            <span>{ENTITY_TYPE_LABELS[entity.entityType]}</span>
                            <span>{entity.active ? "Active" : "Inactive"}</span>
                            <span>Sort {entity.sortOrder}</span>
                          </div>
                        </div>
                      )}

                      <div className="entity-inventory-meta">
                        <span>{getEntityRecordCount(entity.id, appState)}</span>
                        <span>{getBackpackSummary(entity, backpackCount)}</span>
                      </div>
                    </div>

                    <div className="entity-actions">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => saveEditing(entity.id)}
                          >
                            Save
                          </button>
                          <button type="button" onClick={cancelEditing}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditing(entity)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEntityActive(entity.id, !entity.active)
                            }
                          >
                            {entity.active ? "Deactivate" : "Reactivate"}
                          </button>
                          <button
                            className="danger-button"
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete ${entity.name} and its inventory records?`,
                                )
                              ) {
                                deleteEntity(entity.id);
                              }
                            }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="storage-key">
          <span>Storage key</span>
          <code>{APP_STATE_STORAGE_KEY}</code>
        </div>
      </section>
    </main>
  );
}

function getEntityRecordCount(entityId: EntityId, appState: AppStateLike) {
  const count = appState.inventoryRecords.filter(
    (record) => record.location.entityId === entityId,
  ).length;

  return count === 1 ? "1 record" : `${count} records`;
}

function getBackpackSummary(entity: Entity, backpackCount: number) {
  if (entity.entityType !== "character" && entity.entityType !== "retainer") {
    return "No backpack required";
  }

  if (backpackCount === 1) {
    return "1 backpack";
  }

  return `${backpackCount} backpacks`;
}

type AppStateLike = ReturnType<typeof useAppStore.getState>["appState"];

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LocalAppShell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

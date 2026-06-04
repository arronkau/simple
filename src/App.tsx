import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { APP_STATE_STORAGE_KEY } from "./model/appState";
import {
  AUDIT_EVENT_TYPE_LABELS,
  getAuditEventTypeLabel,
  getNewestAuditLogEntries,
} from "./model/auditLog";
import {
  getCoinCount,
  getCoinGpValue,
  getContainerSlotUsage,
  getDirectChildRecords,
  getRecordSlotBurden,
} from "./model/calculations";
import {
  getCharacterEncumbrance,
  getContentsCapacity,
  getEncumbranceWarnings,
  getEquippedSlots,
  getStowedSlots,
  type EncumbranceWarning,
} from "./model/encumbrance";
import {
  ABILITY_SCORE_KEYS,
  normalizeCharacterData,
} from "./model/characters";
import {
  ENTITY_TYPE_LABELS,
  ENTITY_TYPES,
  getSortedEntities,
} from "./model/entities";
import {
  getUsableContainerRecords,
  getLocationPlacementKey,
  type InventoryRecordFormInput,
  type InventoryRecordPlacementKey,
} from "./model/inventoryRecords";
import {
  getContainerContents,
  getInventorySections,
  getOwnedRecords,
  getRecordById,
} from "./model/inventoryDisplay";
import type { AppState } from "./model/appState";
import { getRecordHandsRequired } from "./model/types";
import {
  FIREBASE_APP_STATE_COLLECTION,
  FIREBASE_APP_STATE_DOCUMENT_ID,
} from "./persistence/firebaseSync";
import type { PersistenceMode, SyncStatus } from "./persistence/types";
import type {
  AuditEventType,
  AuditLogEntry,
  CharacterAlignment,
  CharacterData,
  ContainerBurdenMode,
  Entity,
  EntityId,
  EntityType,
  HandsRequired,
  InventoryRecord,
  InventoryRecordId,
  InventoryRecordType,
} from "./model/types";
import {
  findBackpackRecords,
  isCharacterLikeEntity,
  validateInventoryState,
  type ValidationIssue,
} from "./model/validation";
import { useAppStore, type EntityMutationResult } from "./store/useAppStore";

type EntityFormState = {
  name: string;
  entityType: EntityType;
};

const EMPTY_ENTITY_FORM: EntityFormState = {
  name: "",
  entityType: "character",
};

const RECORD_TYPE_LABELS: Record<InventoryRecordType, string> = {
  coins: "Coins",
  treasure: "Treasure",
  weapon: "Weapon",
  armor: "Armor",
  equipment: "Equipment",
};

const RECORD_TYPES: InventoryRecordType[] = [
  "coins",
  "treasure",
  "weapon",
  "armor",
  "equipment",
];

type RecordFormState = {
  mode: "create" | "edit";
  entityId: EntityId;
  recordId?: InventoryRecordId;
  recordType: InventoryRecordType;
  targetEntityId: EntityId;
  placement: InventoryRecordPlacementKey;
  containerId: InventoryRecordId | "";
  name: string;
  description: string;
  pp: string;
  gp: string;
  sp: string;
  cp: string;
  gpValue: string;
  damage: string;
  range: string;
  baseArmorClass: string;
  armorBonus: string;
  burdenKind: "none" | "fixed" | "stacked";
  quantity: string;
  slotsPerItem: string;
  itemsPerSlot: string;
  isContainer: boolean;
  capacitySlots: string;
  handsRequired: "0" | "1" | "2";
  isBackpack: boolean;
  burdenMode: ContainerBurdenMode;
};

type AbilityScoreKey = (typeof ABILITY_SCORE_KEYS)[number];

type CharacterSkillFormState = {
  id: string;
  name: string;
  chanceInSix: string;
  description: string;
};

type CharacterFeatureFormState = {
  id: string;
  title: string;
  description: string;
};

type CharacterSheetFormState = {
  className: string;
  level: string;
  alignment: CharacterAlignment;
  xp: string;
  hpCurrent: string;
  hpMax: string;
  abilityScores: Record<AbilityScoreKey, string>;
  skills: CharacterSkillFormState[];
  languagesText: string;
  description: string;
  features: CharacterFeatureFormState[];
};

function LocalAppShell() {
  const appState = useAppStore((state) => state.appState);
  const persistenceMode = useAppStore((state) => state.persistenceMode);
  const syncError = useAppStore((state) => state.syncError);
  const syncStatus = useAppStore((state) => state.syncStatus);
  const createEntity = useAppStore((state) => state.createEntity);
  const updateEntity = useAppStore((state) => state.updateEntity);
  const updateCharacterData = useAppStore((state) => state.updateCharacterData);
  const setEntityActive = useAppStore((state) => state.setEntityActive);
  const deleteEntity = useAppStore((state) => state.deleteEntity);
  const createInventoryRecord = useAppStore(
    (state) => state.createInventoryRecord,
  );
  const updateInventoryRecord = useAppStore(
    (state) => state.updateInventoryRecord,
  );
  const deleteInventoryRecord = useAppStore(
    (state) => state.deleteInventoryRecord,
  );
  const resetLocalState = useAppStore((state) => state.resetLocalState);
  const sortedEntities = useMemo(
    () => getSortedEntities(appState.entities),
    [appState.entities],
  );
  const [formState, setFormState] =
    useState<EntityFormState>(EMPTY_ENTITY_FORM);
  const [editingEntityId, setEditingEntityId] = useState<EntityId | undefined>();
  const [editingName, setEditingName] = useState("");
  const [recordForm, setRecordForm] = useState<RecordFormState | undefined>();
  const [recordFormMessage, setRecordFormMessage] = useState<
    string | undefined
  >();
  const [auditEntityFilter, setAuditEntityFilter] = useState<
    EntityId | "all"
  >("all");
  const [auditEventTypeFilter, setAuditEventTypeFilter] = useState<
    AuditEventType | "all"
  >("all");

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

  function startAddingRecord(entity: Entity) {
    setRecordForm(createEmptyRecordForm(entity));
    setRecordFormMessage(undefined);
  }

  function startEditingRecord(record: InventoryRecord) {
    setRecordForm(createRecordFormFromRecord(record));
    setRecordFormMessage(undefined);
  }

  function cancelRecordForm() {
    setRecordForm(undefined);
    setRecordFormMessage(undefined);
  }

  function saveRecordForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!recordForm) {
      return;
    }

    const input = toInventoryRecordFormInput(recordForm);
    const result =
      recordForm.mode === "edit" && recordForm.recordId
        ? updateInventoryRecord(recordForm.recordId, input)
        : createInventoryRecord(recordForm.entityId, input);

    if (!result.ok) {
      setRecordFormMessage(result.message);
      return;
    }

    setRecordForm(undefined);
    setRecordFormMessage(undefined);
  }

  function removeInventoryRecord(record: InventoryRecord) {
    if (
      !window.confirm(
        getDeleteConfirmationMessage(record, appState.inventoryRecords),
      )
    ) {
      return;
    }

    const result = deleteInventoryRecord(record.id);

    if (!result.ok) {
      setRecordFormMessage(result.message);
      return;
    }

    if (recordForm?.recordId === record.id) {
      setRecordForm(undefined);
    }

    setRecordFormMessage(undefined);
  }

  return (
    <main className="app-shell">
      <section className="workspace-panel" aria-labelledby="app-title">
        <div className="app-header">
          <div>
            <p className="eyebrow">
              {formatPersistenceSummary(persistenceMode, syncStatus)}
            </p>
            <h1 id="app-title">Simple Inventory</h1>
            {syncError ? <p className="sync-message">{syncError}</p> : null}
          </div>
          <button type="button" onClick={resetLocalState}>
            Reset state
          </button>
        </div>

        <nav className="app-nav" aria-label="Primary">
          <NavLink to="/inventory">Inventory</NavLink>
          <NavLink to="/characters">Characters</NavLink>
        </nav>

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

        <Routes>
          <Route index element={<Navigate to="/inventory" replace />} />
          <Route
            path="inventory"
            element={
              <InventoryPage
                appState={appState}
                editingEntityId={editingEntityId}
                editingName={editingName}
                formState={formState}
                recordForm={recordForm}
                recordFormMessage={recordFormMessage}
                sortedEntities={sortedEntities}
                onCancelEditing={cancelEditing}
                onCancelRecordForm={cancelRecordForm}
                onChangeEntityForm={setFormState}
                onChangeEditingName={setEditingName}
                onChangeRecordForm={setRecordForm}
                onCreateEntity={handleCreateEntity}
                onDeleteEntity={deleteEntity}
                onDeleteRecord={removeInventoryRecord}
                onEditEntity={startEditing}
                onEditRecord={startEditingRecord}
                onSaveEditing={saveEditing}
                onSaveRecordForm={saveRecordForm}
                onSetEntityActive={setEntityActive}
                onStartAddRecord={startAddingRecord}
              />
            }
          />
          <Route
            path="characters"
            element={
              <CharactersPage
                appState={appState}
                sortedEntities={sortedEntities}
                onSaveCharacterData={updateCharacterData}
              />
            }
          />
          <Route path="*" element={<Navigate to="/inventory" replace />} />
        </Routes>

        <AuditLogPanel
          appState={appState}
          entityFilter={auditEntityFilter}
          eventTypeFilter={auditEventTypeFilter}
          onEntityFilterChange={setAuditEntityFilter}
          onEventTypeFilterChange={setAuditEventTypeFilter}
        />

        <div className="storage-key">
          <span>
            {persistenceMode === "firebase" ? "Firestore document" : "Storage key"}
          </span>
          <code>
            {persistenceMode === "firebase"
              ? `${FIREBASE_APP_STATE_COLLECTION}/${FIREBASE_APP_STATE_DOCUMENT_ID}`
              : APP_STATE_STORAGE_KEY}
          </code>
        </div>
      </section>
    </main>
  );
}

function InventoryPage({
  appState,
  editingEntityId,
  editingName,
  formState,
  recordForm,
  recordFormMessage,
  sortedEntities,
  onCancelEditing,
  onCancelRecordForm,
  onChangeEntityForm,
  onChangeEditingName,
  onChangeRecordForm,
  onCreateEntity,
  onDeleteEntity,
  onDeleteRecord,
  onEditEntity,
  onEditRecord,
  onSaveEditing,
  onSaveRecordForm,
  onSetEntityActive,
  onStartAddRecord,
}: {
  appState: AppState;
  editingEntityId?: EntityId;
  editingName: string;
  formState: EntityFormState;
  recordForm?: RecordFormState;
  recordFormMessage?: string;
  sortedEntities: Entity[];
  onCancelEditing: () => void;
  onCancelRecordForm: () => void;
  onChangeEntityForm: (formState: EntityFormState) => void;
  onChangeEditingName: (name: string) => void;
  onChangeRecordForm: (formState: RecordFormState) => void;
  onCreateEntity: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteEntity: (entityId: EntityId) => void;
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditEntity: (entity: Entity) => void;
  onEditRecord: (record: InventoryRecord) => void;
  onSaveEditing: (entityId: EntityId) => void;
  onSaveRecordForm: (event: FormEvent<HTMLFormElement>) => void;
  onSetEntityActive: (entityId: EntityId, active: boolean) => void;
  onStartAddRecord: (entity: Entity) => void;
}) {
  const recordFormEntity = recordForm
    ? appState.entities.find((entity) => entity.id === recordForm.entityId)
    : undefined;

  return (
    <section className="entity-workspace" aria-labelledby="inventory-title">
      <div className="section-heading">
        <div>
          <h2 id="inventory-title">Inventory</h2>
          <p>Party entities, inventory contents, and encumbrance summaries.</p>
        </div>
      </div>

      <EntityForm
        formState={formState}
        onChange={onChangeEntityForm}
        onSubmit={onCreateEntity}
      />

      {sortedEntities.length === 0 ? (
        <p className="empty-state">No entities yet.</p>
      ) : (
        <ul className="entity-list" aria-label="Inventory entities">
          {sortedEntities.map((entity) => (
            <EntityInventoryRow
              appState={appState}
              editingEntityId={editingEntityId}
              editingName={editingName}
              entity={entity}
              key={entity.id}
              onCancelEditing={onCancelEditing}
              onChangeEditingName={onChangeEditingName}
              onDeleteEntity={onDeleteEntity}
              onDeleteRecord={onDeleteRecord}
              onEditEntity={onEditEntity}
              onEditRecord={onEditRecord}
              onSaveEditing={onSaveEditing}
              onSetEntityActive={onSetEntityActive}
              onStartAddRecord={onStartAddRecord}
            />
          ))}
        </ul>
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
          onSubmit={onSaveRecordForm}
        />
      ) : null}
    </section>
  );
}

function EntityForm({
  formState,
  onChange,
  onSubmit,
}: {
  formState: EntityFormState;
  onChange: (formState: EntityFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="entity-form" onSubmit={onSubmit}>
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

      <button type="submit">Add entity</button>
    </form>
  );
}

function EntityInventoryRow({
  appState,
  editingEntityId,
  editingName,
  entity,
  onCancelEditing,
  onChangeEditingName,
  onDeleteEntity,
  onDeleteRecord,
  onEditEntity,
  onEditRecord,
  onSaveEditing,
  onSetEntityActive,
  onStartAddRecord,
}: {
  appState: AppState;
  editingEntityId?: EntityId;
  editingName: string;
  entity: Entity;
  onCancelEditing: () => void;
  onChangeEditingName: (name: string) => void;
  onDeleteEntity: (entityId: EntityId) => void;
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditEntity: (entity: Entity) => void;
  onEditRecord: (record: InventoryRecord) => void;
  onSaveEditing: (entityId: EntityId) => void;
  onSetEntityActive: (entityId: EntityId, active: boolean) => void;
  onStartAddRecord: (entity: Entity) => void;
}) {
  const backpackCount = findBackpackRecords(
    entity.id,
    appState.inventoryRecords,
  ).length;
  const isEditing = editingEntityId === entity.id;

  return (
    <li className="entity-row" data-inactive={!entity.active}>
      <EntitySummary
        appState={appState}
        editingName={editingName}
        entity={entity}
        isEditing={isEditing}
        onChangeEditingName={onChangeEditingName}
        backpackCount={backpackCount}
      />

      <div className="entity-actions">
        {isEditing ? (
          <>
            <button type="button" onClick={() => onSaveEditing(entity.id)}>
              Save
            </button>
            <button type="button" onClick={onCancelEditing}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => onEditEntity(entity)}>
              Edit
            </button>
            <button
              type="button"
              onClick={() => onSetEntityActive(entity.id, !entity.active)}
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
                  onDeleteEntity(entity.id);
                }
              }}
            >
              Delete
            </button>
          </>
        )}
      </div>

      <InventoryDisplay
        entity={entity}
        appState={appState}
        onDeleteRecord={onDeleteRecord}
        onEditRecord={onEditRecord}
        onStartAddRecord={onStartAddRecord}
      />
    </li>
  );
}

function EntitySummary({
  appState,
  backpackCount,
  editingName,
  entity,
  isEditing,
  onChangeEditingName,
}: {
  appState: AppState;
  backpackCount: number;
  editingName: string;
  entity: Entity;
  isEditing: boolean;
  onChangeEditingName: (name: string) => void;
}) {
  return (
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
            onChange={(event) => onChangeEditingName(event.target.value)}
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
  );
}

function CharactersPage({
  appState,
  sortedEntities,
  onSaveCharacterData,
}: {
  appState: AppState;
  sortedEntities: Entity[];
  onSaveCharacterData: (
    entityId: EntityId,
    characterData: CharacterData,
  ) => EntityMutationResult;
}) {
  const characterEntities = sortedEntities.filter(isCharacterLikeEntity);

  return (
    <section className="entity-workspace" aria-labelledby="characters-title">
      <div className="section-heading">
        <div>
          <h2 id="characters-title">Characters</h2>
          <p>Character and retainer sheets with compact inventory status.</p>
        </div>
      </div>

      {characterEntities.length === 0 ? (
        <p className="empty-state">No characters or retainers yet.</p>
      ) : (
        <ul className="entity-list" aria-label="Characters">
          {characterEntities.map((entity) => {
            const backpackCount = findBackpackRecords(
              entity.id,
              appState.inventoryRecords,
            ).length;

            return (
              <li
                className="entity-row character-page-row"
                data-inactive={!entity.active}
                key={entity.id}
              >
                <EntitySummary
                  appState={appState}
                  backpackCount={backpackCount}
                  editingName=""
                  entity={entity}
                  isEditing={false}
                  onChangeEditingName={() => undefined}
                />
                <CharacterInventorySummary
                  appState={appState}
                  entity={entity}
                />
                <CharacterSheetPanel
                  entity={entity}
                  onSaveCharacterData={onSaveCharacterData}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function CharacterInventorySummary({
  appState,
  entity,
}: {
  appState: AppState;
  entity: Entity;
}) {
  const ownedRecords = getOwnedRecords(entity.id, appState.inventoryRecords);
  const warnings = getEncumbranceWarnings(entity, appState.inventoryRecords);
  const validationResult = validateInventoryState(
    appState.entities,
    appState.inventoryRecords,
  );
  const validationIssues = [
    ...validationResult.errors,
    ...validationResult.warnings,
  ].filter(
    (issue) =>
      issue.entityId === entity.id ||
      (issue.recordId !== undefined &&
        ownedRecords.some((record) => record.id === issue.recordId)),
  );

  return (
    <div className="character-inventory-summary">
      <EntityInventoryHeader
        entity={entity}
        records={appState.inventoryRecords}
        warnings={warnings}
        validationIssues={validationIssues}
      />
    </div>
  );
}

function InventoryRecordModal({
  appState,
  entity,
  formState,
  message,
  onCancel,
  onChange,
  onDeleteRecord,
  onSubmit,
}: {
  appState: AppState;
  entity: Entity;
  formState: RecordFormState;
  message?: string;
  onCancel: () => void;
  onChange: (formState: RecordFormState) => void;
  onDeleteRecord: (record: InventoryRecord) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const editingRecord = formState.recordId
    ? getRecordById(formState.recordId, appState.inventoryRecords)
    : undefined;

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-label={formState.mode === "edit" ? "Edit inventory record" : "Add inventory record"}
        aria-modal="true"
        className="modal-panel"
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
          onSubmit={onSubmit}
        />
      </section>
    </div>
  );
}

function CharacterSheetPanel({
  entity,
  onSaveCharacterData,
}: {
  entity: Entity;
  onSaveCharacterData: (
    entityId: EntityId,
    characterData: CharacterData,
  ) => EntityMutationResult;
}) {
  const [formState, setFormState] = useState<CharacterSheetFormState>(() =>
    createCharacterSheetFormState(normalizeCharacterData(entity.character)),
  );
  const [message, setMessage] = useState<
    { tone: "error" | "success"; text: string } | undefined
  >();

  useEffect(() => {
    setFormState(
      createCharacterSheetFormState(normalizeCharacterData(entity.character)),
    );
  }, [entity.character]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = onSaveCharacterData(
      entity.id,
      toCharacterDataFormInput(formState),
    );

    if (!result.ok) {
      setMessage({ tone: "error", text: result.message });
      return;
    }

    setMessage({ tone: "success", text: "Character sheet saved." });
  }

  function updateAbilityScore(key: AbilityScoreKey, value: string) {
    setFormState((currentState) => ({
      ...currentState,
      abilityScores: {
        ...currentState.abilityScores,
        [key]: value,
      },
    }));
  }

  function updateSkill(
    skillId: string,
    patch: Partial<CharacterSkillFormState>,
  ) {
    setFormState((currentState) => ({
      ...currentState,
      skills: currentState.skills.map((skill) =>
        skill.id === skillId ? { ...skill, ...patch } : skill,
      ),
    }));
  }

  function updateFeature(
    featureId: string,
    patch: Partial<CharacterFeatureFormState>,
  ) {
    setFormState((currentState) => ({
      ...currentState,
      features: currentState.features.map((feature) =>
        feature.id === featureId ? { ...feature, ...patch } : feature,
      ),
    }));
  }

  return (
    <section
      className="character-sheet-panel"
      aria-label={`${entity.name} character sheet`}
    >
      <form className="character-sheet-form" onSubmit={handleSubmit}>
        <div className="record-form-heading">
          <h4>Character Sheet</h4>
          {message ? (
            <p
              className={
                message.tone === "error" ? "form-error" : "form-success"
              }
            >
              {message.text}
            </p>
          ) : null}
        </div>

        <section className="character-sheet-section">
          <h5>Identity</h5>
          <div className="character-sheet-grid">
            <label>
              <span>Class</span>
              <input
                autoComplete="off"
                maxLength={80}
                type="text"
                value={formState.className}
                onChange={(event) =>
                  setFormState({
                    ...formState,
                    className: event.target.value,
                  })
                }
              />
            </label>
            <NumberField
              label="Level"
              value={formState.level}
              onChange={(value) =>
                setFormState({ ...formState, level: value })
              }
            />
            <label>
              <span>Alignment</span>
              <select
                value={formState.alignment}
                onChange={(event) =>
                  setFormState({
                    ...formState,
                    alignment: event.target.value as CharacterAlignment,
                  })
                }
              >
                <option value="">Unspecified</option>
                <option value="Law">Law</option>
                <option value="Neutrality">Neutrality</option>
                <option value="Chaos">Chaos</option>
              </select>
            </label>
            <NumberField
              label="XP"
              value={formState.xp}
              onChange={(value) => setFormState({ ...formState, xp: value })}
            />
          </div>
        </section>

        <section className="character-sheet-section">
          <h5>HP</h5>
          <div className="character-sheet-grid compact-grid">
            <NumberField
              label="Current HP"
              value={formState.hpCurrent}
              onChange={(value) =>
                setFormState({ ...formState, hpCurrent: value })
              }
            />
            <NumberField
              label="Max HP"
              value={formState.hpMax}
              onChange={(value) =>
                setFormState({ ...formState, hpMax: value })
              }
            />
          </div>
        </section>

        <section className="character-sheet-section">
          <h5>Ability Scores</h5>
          <div className="ability-score-grid">
            {ABILITY_SCORE_KEYS.map((abilityScoreKey) => (
              <NumberField
                key={abilityScoreKey}
                label={abilityScoreKey.toUpperCase()}
                min="1"
                value={formState.abilityScores[abilityScoreKey]}
                onChange={(value) =>
                  updateAbilityScore(abilityScoreKey, value)
                }
              />
            ))}
          </div>
        </section>

        <section className="character-sheet-section">
          <div className="repeatable-heading">
            <h5>Skills</h5>
            <button
              type="button"
              onClick={() =>
                setFormState((currentState) => ({
                  ...currentState,
                  skills: [...currentState.skills, createEmptySkillFormState()],
                }))
              }
            >
              Add skill
            </button>
          </div>

          {formState.skills.length === 0 ? (
            <p className="empty-state compact">No skills</p>
          ) : (
            <div className="repeatable-list">
              {formState.skills.map((skill) => (
                <div className="repeatable-row skill-row" key={skill.id}>
                  <label>
                    <span>Name</span>
                    <input
                      autoComplete="off"
                      maxLength={80}
                      required
                      type="text"
                      value={skill.name}
                      onChange={(event) =>
                        updateSkill(skill.id, { name: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Chance</span>
                    <select
                      value={skill.chanceInSix}
                      onChange={(event) =>
                        updateSkill(skill.id, {
                          chanceInSix: event.target.value,
                        })
                      }
                    >
                      {[1, 2, 3, 4, 5, 6].map((chance) => (
                        <option key={chance} value={chance.toString()}>
                          {chance} in 6
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="wide-field">
                    <span>Description</span>
                    <input
                      autoComplete="off"
                      maxLength={160}
                      type="text"
                      value={skill.description}
                      onChange={(event) =>
                        updateSkill(skill.id, {
                          description: event.target.value,
                        })
                      }
                    />
                  </label>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() =>
                      setFormState((currentState) => ({
                        ...currentState,
                        skills: currentState.skills.filter(
                          (candidateSkill) => candidateSkill.id !== skill.id,
                        ),
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="character-sheet-section">
          <h5>Languages</h5>
          <label>
            <span>Languages</span>
            <textarea
              rows={3}
              value={formState.languagesText}
              onChange={(event) =>
                setFormState({
                  ...formState,
                  languagesText: event.target.value,
                })
              }
            />
          </label>
        </section>

        <section className="character-sheet-section">
          <div className="repeatable-heading">
            <h5>Features</h5>
            <button
              type="button"
              onClick={() =>
                setFormState((currentState) => ({
                  ...currentState,
                  features: [
                    ...currentState.features,
                    createEmptyFeatureFormState(),
                  ],
                }))
              }
            >
              Add feature
            </button>
          </div>

          {formState.features.length === 0 ? (
            <p className="empty-state compact">No features</p>
          ) : (
            <div className="repeatable-list">
              {formState.features.map((feature) => (
                <div className="repeatable-row feature-row" key={feature.id}>
                  <label>
                    <span>Title</span>
                    <input
                      autoComplete="off"
                      maxLength={80}
                      type="text"
                      value={feature.title}
                      onChange={(event) =>
                        updateFeature(feature.id, {
                          title: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="wide-field">
                    <span>Description</span>
                    <textarea
                      rows={2}
                      value={feature.description}
                      onChange={(event) =>
                        updateFeature(feature.id, {
                          description: event.target.value,
                        })
                      }
                    />
                  </label>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() =>
                      setFormState((currentState) => ({
                        ...currentState,
                        features: currentState.features.filter(
                          (candidateFeature) =>
                            candidateFeature.id !== feature.id,
                        ),
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="character-sheet-section">
          <h5>Description</h5>
          <label>
            <span>Description / notes</span>
            <textarea
              rows={4}
              value={formState.description}
              onChange={(event) =>
                setFormState({
                  ...formState,
                  description: event.target.value,
                })
              }
            />
          </label>
        </section>

        <div className="record-form-actions">
          <button type="submit">Save character sheet</button>
        </div>
      </form>
    </section>
  );
}

function InventoryDisplay({
  entity,
  appState,
  onDeleteRecord,
  onEditRecord,
  onStartAddRecord,
}: {
  entity: Entity;
  appState: AppState;
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditRecord: (record: InventoryRecord) => void;
  onStartAddRecord: (entity: Entity) => void;
}) {
  const ownedRecords = getOwnedRecords(entity.id, appState.inventoryRecords);
  const sections = getInventorySections(entity, appState.inventoryRecords);
  const validationResult = validateInventoryState(
    appState.entities,
    appState.inventoryRecords,
  );
  const entityValidationIssues = [
    ...validationResult.errors,
    ...validationResult.warnings,
  ].filter(
    (issue) =>
      issue.entityId === entity.id ||
      (issue.recordId !== undefined &&
        ownedRecords.some((record) => record.id === issue.recordId)),
  );
  const warnings = getEncumbranceWarnings(entity, appState.inventoryRecords);

  return (
    <section className="inventory-display" aria-label={`${entity.name} inventory`}>
      <div className="inventory-toolbar">
        <button type="button" onClick={() => onStartAddRecord(entity)}>
          Add record
        </button>
      </div>

      <EntityInventoryHeader
        entity={entity}
        records={appState.inventoryRecords}
        warnings={warnings}
        validationIssues={entityValidationIssues}
      />

      {entityValidationIssues.length > 0 || warnings.length > 0 ? (
        <WarningList validationIssues={entityValidationIssues} warnings={warnings} />
      ) : null}

      {sections.mode === "characterLike" ? (
        <CharacterInventoryDisplay
          sections={sections}
          records={appState.inventoryRecords}
          onDeleteRecord={onDeleteRecord}
          onEditRecord={onEditRecord}
        />
      ) : (
        <ContentsInventoryDisplay
          contents={sections.contents}
          records={appState.inventoryRecords}
          onDeleteRecord={onDeleteRecord}
          onEditRecord={onEditRecord}
        />
      )}
    </section>
  );
}

function EntityInventoryHeader({
  entity,
  records,
  warnings,
  validationIssues,
}: {
  entity: Entity;
  records: InventoryRecord[];
  warnings: EncumbranceWarning[];
  validationIssues: ValidationIssue[];
}) {
  if (isCharacterLikeEntity(entity)) {
    const encumbrance = getCharacterEncumbrance(entity, records);
    const totalSlots = encumbrance.equippedItems + encumbrance.stowedItems;

    return (
      <div className="inventory-header">
        <span>Equipped {formatSlots(encumbrance.equippedItems)}</span>
        <span>Stowed {formatSlots(encumbrance.stowedItems)}</span>
        <span>Total {formatSlots(totalSlots)}</span>
        <span>
          Move {encumbrance.movement.explorationFeet}' /
          {encumbrance.movement.encounterFeet}'
        </span>
        <span>{formatWarningState(warnings, validationIssues)}</span>
      </div>
    );
  }

  const capacity = getContentsCapacity(entity, records);

  return (
    <div className="inventory-header">
      <span>Contents {formatSlots(capacity.usedSlots)}</span>
      <span>Total {formatSlots(capacity.usedSlots)}</span>
      <span>{formatCapacity(capacity.usedSlots, capacity.capacitySlots)}</span>
      <span>{formatWarningState(warnings, validationIssues)}</span>
    </div>
  );
}

function CharacterInventoryDisplay({
  sections,
  records,
  onDeleteRecord,
  onEditRecord,
}: {
  sections: ReturnType<typeof getInventorySections> & { mode: "characterLike" };
  records: InventoryRecord[];
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditRecord: (record: InventoryRecord) => void;
}) {
  const bothHandsRecord = getRecordById(sections.handRecordIds.bothHands, records);
  const leftHandRecord = getRecordById(sections.handRecordIds.leftHand, records);
  const rightHandRecord = getRecordById(sections.handRecordIds.rightHand, records);

  return (
    <div className="inventory-sections">
      <InventorySection title="Equipped">
        <InventorySubsection title="Hands">
          {bothHandsRecord ? (
            <HandSlot
              label="Both hands"
              record={bothHandsRecord}
              records={records}
              onDeleteRecord={onDeleteRecord}
              onEditRecord={onEditRecord}
            />
          ) : (
            <div className="hand-grid">
              <HandSlot
                label="Left hand"
                record={leftHandRecord}
                records={records}
                onDeleteRecord={onDeleteRecord}
                onEditRecord={onEditRecord}
              />
              <HandSlot
                label="Right hand"
                record={rightHandRecord}
                records={records}
                onDeleteRecord={onDeleteRecord}
                onEditRecord={onEditRecord}
              />
            </div>
          )}
        </InventorySubsection>

        <InventorySubsection title="Other equipped">
          <RecordList
            records={sections.otherEquipped}
            allRecords={records}
            onDeleteRecord={onDeleteRecord}
            onEditRecord={onEditRecord}
          />
        </InventorySubsection>
      </InventorySection>

      <InventorySection title="Stowed">
        <InventorySubsection title="Coin purse">
          {sections.coinRecord ? (
            <CoinRecordRow
              record={sections.coinRecord}
              onDeleteRecord={onDeleteRecord}
              onEditRecord={onEditRecord}
            />
          ) : (
            <p className="empty-state compact">No coins</p>
          )}
        </InventorySubsection>

        <InventorySubsection title="Backpack">
          {sections.backpackRecord ? (
            <ContainerBlock
              containerRecord={sections.backpackRecord}
              records={records}
              nestedRecords={sections.backpackContents}
              onDeleteRecord={onDeleteRecord}
              onEditRecord={onEditRecord}
              titleSuffix="backpack"
            />
          ) : (
            <p className="empty-state compact">Missing backpack</p>
          )}
        </InventorySubsection>
      </InventorySection>
    </div>
  );
}

function ContentsInventoryDisplay({
  contents,
  records,
  onDeleteRecord,
  onEditRecord,
}: {
  contents: InventoryRecord[];
  records: InventoryRecord[];
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditRecord: (record: InventoryRecord) => void;
}) {
  return (
    <div className="inventory-sections">
      <InventorySection title="Contents">
        <RecordList
          records={contents}
          allRecords={records}
          onDeleteRecord={onDeleteRecord}
          onEditRecord={onEditRecord}
        />
      </InventorySection>
    </div>
  );
}

function InventoryRecordForm({
  appState,
  entity,
  formState,
  message,
  onCancel,
  onChange,
  onDelete,
  onSubmit,
}: {
  appState: AppState;
  entity: Entity;
  formState: RecordFormState;
  message?: string;
  onCancel: () => void;
  onChange: (formState: RecordFormState) => void;
  onDelete?: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const targetEntity =
    appState.entities.find(
      (candidateEntity) => candidateEntity.id === formState.targetEntityId,
    ) ?? entity;
  const targetIsCharacterLike = isCharacterLikeEntity(targetEntity);
  const containerOptions = getContainerOptions({
    entity: targetEntity,
    records: appState.inventoryRecords,
    editingRecordId: formState.recordId,
  });
  const placementOptions = getPlacementOptions({
    recordType: formState.recordType,
    targetEntity,
    records: appState.inventoryRecords,
  }).filter(
    (placementOption) =>
      placementOption.value !== "container" || containerOptions.length > 0,
  );
  const showLocationControls =
    formState.recordType !== "coins" || !targetIsCharacterLike;
  const showContainerSelect = formState.placement === "container";
  const showNonCoinFields = formState.recordType !== "coins";

  return (
    <form className="record-form" onSubmit={onSubmit}>
      <div className="record-form-heading">
        <h4>{formState.mode === "edit" ? "Edit record" : "Add record"}</h4>
        {message ? <p className="form-error">{message}</p> : null}
      </div>

      <div className="record-form-grid">
        <label>
          <span>Type</span>
          <select
            disabled={formState.mode === "edit"}
            value={formState.recordType}
            onChange={(event) => {
              const recordType = event.target.value as InventoryRecordType;

              onChange({
                ...formState,
                recordType,
                handsRequired: getDefaultHandsRequired(recordType).toString() as
                  | "0"
                  | "1"
                  | "2",
                placement: "default",
                containerId: "",
              });
            }}
          >
            {RECORD_TYPES.map((recordType) => (
              <option key={recordType} value={recordType}>
                {RECORD_TYPE_LABELS[recordType]}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Owner</span>
          <select
            value={formState.targetEntityId}
            onChange={(event) =>
              onChange({
                ...formState,
                targetEntityId: event.target.value,
                placement: "default",
                containerId: "",
              })
            }
          >
            {getSortedEntities(appState.entities).map((candidateEntity) => (
              <option key={candidateEntity.id} value={candidateEntity.id}>
                {candidateEntity.name}
              </option>
            ))}
          </select>
        </label>

        {showLocationControls ? (
          <label>
            <span>Placement</span>
            <select
              value={formState.placement}
              onChange={(event) =>
                onChange({
                  ...formState,
                  placement: event.target.value as InventoryRecordPlacementKey,
                  containerId: "",
                })
              }
            >
              {placementOptions.map((placementOption) => (
                <option
                  key={placementOption.value}
                  value={placementOption.value}
                >
                  {placementOption.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {showContainerSelect ? (
          <label>
            <span>Container</span>
            <select
              required
              value={formState.containerId}
              onChange={(event) =>
                onChange({ ...formState, containerId: event.target.value })
              }
            >
              <option value="">Select container</option>
              {containerOptions.map((containerRecord) => (
                <option key={containerRecord.id} value={containerRecord.id}>
                  {getRecordDisplayName(containerRecord)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {formState.recordType === "coins" ? (
          <>
            <NumberField
              label="PP"
              value={formState.pp}
              onChange={(value) => onChange({ ...formState, pp: value })}
            />
            <NumberField
              label="GP"
              value={formState.gp}
              onChange={(value) => onChange({ ...formState, gp: value })}
            />
            <NumberField
              label="SP"
              value={formState.sp}
              onChange={(value) => onChange({ ...formState, sp: value })}
            />
            <NumberField
              label="CP"
              value={formState.cp}
              onChange={(value) => onChange({ ...formState, cp: value })}
            />
          </>
        ) : null}

        {showNonCoinFields ? (
          <>
            <label className="wide-field">
              <span>Name</span>
              <input
                autoComplete="off"
                maxLength={100}
                required
                type="text"
                value={formState.name}
                onChange={(event) =>
                  onChange({ ...formState, name: event.target.value })
                }
              />
            </label>

            <label className="wide-field">
              <span>Description</span>
              <input
                autoComplete="off"
                maxLength={160}
                type="text"
                value={formState.description}
                onChange={(event) =>
                  onChange({ ...formState, description: event.target.value })
                }
              />
            </label>

            <label>
              <span>Burden type</span>
              <select
                value={formState.burdenKind}
                onChange={(event) =>
                  onChange({
                    ...formState,
                    burdenKind: event.target.value as
                      | "none"
                      | "fixed"
                      | "stacked",
                  })
                }
              >
                <option value="none">No slots</option>
                <option value="fixed">Fixed slots per item</option>
                <option value="stacked">Stackable items per slot</option>
              </select>
            </label>

            <NumberField
              label="Quantity"
              value={formState.quantity}
              onChange={(value) =>
                onChange({ ...formState, quantity: value })
              }
            />

            {formState.burdenKind === "fixed" ? (
              <NumberField
                label="Slots per item"
                step="0.25"
                value={formState.slotsPerItem}
                onChange={(value) =>
                  onChange({ ...formState, slotsPerItem: value })
                }
              />
            ) : null}

            {formState.burdenKind === "stacked" ? (
              <NumberField
                label="Items per slot"
                value={formState.itemsPerSlot}
                onChange={(value) =>
                  onChange({ ...formState, itemsPerSlot: value })
                }
              />
            ) : null}
          </>
        ) : null}

        {formState.recordType === "treasure" ? (
          <NumberField
            label="GP value"
            step="0.01"
            value={formState.gpValue}
            onChange={(value) => onChange({ ...formState, gpValue: value })}
          />
        ) : null}

        {formState.recordType !== "coins" ? (
          <label>
            <span>Hands required</span>
            <select
              value={formState.handsRequired}
              onChange={(event) =>
                onChange({
                  ...formState,
                  handsRequired: event.target.value as "0" | "1" | "2",
                })
              }
            >
              <option value="0">None</option>
              <option value="1">One</option>
              <option value="2">Two</option>
            </select>
          </label>
        ) : null}

        {formState.recordType === "weapon" ? (
          <>
            <label>
              <span>Damage</span>
              <input
                autoComplete="off"
                maxLength={40}
                type="text"
                value={formState.damage}
                onChange={(event) =>
                  onChange({ ...formState, damage: event.target.value })
                }
              />
            </label>
            <label>
              <span>Range</span>
              <input
                autoComplete="off"
                maxLength={40}
                type="text"
                value={formState.range}
                onChange={(event) =>
                  onChange({ ...formState, range: event.target.value })
                }
              />
            </label>
          </>
        ) : null}

        {formState.recordType === "armor" ? (
          <>
            <NumberField
              label="Base AC"
              value={formState.baseArmorClass}
              onChange={(value) =>
                onChange({ ...formState, baseArmorClass: value })
              }
            />
            <NumberField
              label="Armor bonus"
              value={formState.armorBonus}
              onChange={(value) =>
                onChange({ ...formState, armorBonus: value })
              }
            />
          </>
        ) : null}

        {formState.recordType !== "coins" &&
        formState.recordType !== "treasure" ? (
          <label className="checkbox-field">
            <input
              checked={formState.isContainer}
              type="checkbox"
              onChange={(event) =>
                onChange({ ...formState, isContainer: event.target.checked })
              }
            />
            <span>Container</span>
          </label>
        ) : null}

        {formState.isContainer &&
        formState.recordType !== "coins" &&
        formState.recordType !== "treasure" ? (
          <>
            <NumberField
              label="Capacity"
              step="0.25"
              value={formState.capacitySlots}
              onChange={(value) =>
                onChange({ ...formState, capacitySlots: value })
              }
            />
            <label>
              <span>Burden</span>
              <select
                value={formState.burdenMode}
                onChange={(event) =>
                  onChange({
                    ...formState,
                    burdenMode: event.target.value as ContainerBurdenMode,
                  })
                }
              >
                <option value="contentsOnlyWhenLoaded">Contents only</option>
                <option value="containerPlusContents">Container plus contents</option>
                <option value="fixedOnly">Fixed only</option>
              </select>
            </label>
            <label className="checkbox-field">
              <input
                checked={formState.isBackpack}
                type="checkbox"
                onChange={(event) =>
                  onChange({ ...formState, isBackpack: event.target.checked })
                }
              />
              <span>Backpack</span>
            </label>
          </>
        ) : null}
      </div>

      <div className="record-form-actions">
        <button type="submit">
          {formState.mode === "edit" ? "Save record" : "Create record"}
        </button>
        {onDelete ? (
          <button className="danger-button" type="button" onClick={onDelete}>
            Delete
          </button>
        ) : null}
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function NumberField({
  label,
  min = "0",
  onChange,
  step = "1",
  value,
}: {
  label: string;
  min?: string;
  onChange: (value: string) => void;
  step?: string;
  value: string;
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        min={min}
        step={step}
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function InventorySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="inventory-section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function InventorySubsection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="inventory-subsection">
      <h5>{title}</h5>
      {children}
    </div>
  );
}

function HandSlot({
  label,
  record,
  records,
  onDeleteRecord,
  onEditRecord,
}: {
  label: string;
  record?: InventoryRecord;
  records: InventoryRecord[];
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditRecord: (record: InventoryRecord) => void;
}) {
  return (
    <div className="hand-slot">
      <span>{label}</span>
      {record ? (
        <RecordRow
          record={record}
          allRecords={records}
          onDeleteRecord={onDeleteRecord}
          onEditRecord={onEditRecord}
        />
      ) : (
        <p className="empty-state compact">Empty hand</p>
      )}
    </div>
  );
}

function RecordList({
  records,
  allRecords,
  onDeleteRecord,
  onEditRecord,
}: {
  records: InventoryRecord[];
  allRecords: InventoryRecord[];
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditRecord: (record: InventoryRecord) => void;
}) {
  if (records.length === 0) {
    return <p className="empty-state compact">Empty</p>;
  }

  return (
    <ul className="record-list">
      {records.map((record) => (
        <li key={record.id}>
          <RecordRow
            record={record}
            allRecords={allRecords}
            onDeleteRecord={onDeleteRecord}
            onEditRecord={onEditRecord}
          />
        </li>
      ))}
    </ul>
  );
}

function RecordRow({
  record,
  allRecords,
  onDeleteRecord,
  onEditRecord,
}: {
  record: InventoryRecord;
  allRecords: InventoryRecord[];
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditRecord: (record: InventoryRecord) => void;
}) {
  if (record.recordType === "coins") {
    return (
      <CoinRecordRow
        record={record}
        onDeleteRecord={onDeleteRecord}
        onEditRecord={onEditRecord}
      />
    );
  }

  if (record.container) {
    return (
      <ContainerBlock
        containerRecord={record}
        records={allRecords}
        nestedRecords={getContainerContents(record, allRecords)}
        onDeleteRecord={onDeleteRecord}
        onEditRecord={onEditRecord}
      />
    );
  }

  return (
    <div className="record-row">
      <div>
        <strong>{getRecordDisplayName(record)}</strong>
        <RecordMeta record={record} allRecords={allRecords} />
      </div>
      <RecordActions
        record={record}
        onDeleteRecord={onDeleteRecord}
        onEditRecord={onEditRecord}
      />
    </div>
  );
}

function ContainerBlock({
  containerRecord,
  records,
  nestedRecords,
  onDeleteRecord,
  onEditRecord,
  titleSuffix,
}: {
  containerRecord: InventoryRecord;
  records: InventoryRecord[];
  nestedRecords: InventoryRecord[];
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditRecord: (record: InventoryRecord) => void;
  titleSuffix?: string;
}) {
  const slotUsage = getContainerSlotUsage(containerRecord, records);

  return (
    <div className="container-block">
      <div className="record-row">
        <div>
          <strong>{getRecordDisplayName(containerRecord)}</strong>
          {titleSuffix ? <span className="quiet-label"> {titleSuffix}</span> : null}
          <div className="record-meta">
            <span>{formatCapacity(slotUsage.usedSlots, slotUsage.capacitySlots)}</span>
            <span>{formatContainerHeldState(containerRecord)}</span>
          </div>
        </div>
        <RecordActions
          record={containerRecord}
          onDeleteRecord={onDeleteRecord}
          onEditRecord={onEditRecord}
        />
      </div>
      <RecordList
        records={nestedRecords}
        allRecords={records}
        onDeleteRecord={onDeleteRecord}
        onEditRecord={onEditRecord}
      />
    </div>
  );
}

function CoinRecordRow({
  record,
  onDeleteRecord,
  onEditRecord,
}: {
  record: InventoryRecord;
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditRecord: (record: InventoryRecord) => void;
}) {
  if (record.recordType !== "coins") {
    return null;
  }

  return (
    <div className="record-row">
      <div>
        <strong>Coins</strong>
        <div className="record-meta">
          <span>{formatCoinDenominations(record)}</span>
          <span>{formatGpValue(getCoinGpValue(record.coins))} gp</span>
          <span>{formatSlots(getRecordSlotBurden(record))}</span>
        </div>
      </div>
      <RecordActions
        record={record}
        onDeleteRecord={onDeleteRecord}
        onEditRecord={onEditRecord}
      />
    </div>
  );
}

function RecordActions({
  record,
  onDeleteRecord,
  onEditRecord,
}: {
  record: InventoryRecord;
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditRecord: (record: InventoryRecord) => void;
}) {
  return (
    <div className="record-actions">
      <button type="button" onClick={() => onEditRecord(record)}>
        Edit
      </button>
      <button
        className="danger-button"
        type="button"
        onClick={() => onDeleteRecord(record)}
      >
        Delete
      </button>
    </div>
  );
}

function RecordMeta({
  record,
  allRecords,
}: {
  record: InventoryRecord;
  allRecords: InventoryRecord[];
}) {
  const metadata = getRecordMetadata(record, allRecords);

  if (metadata.length === 0) {
    return null;
  }

  return (
    <div className="record-meta">
      {metadata.map((metadataItem) => (
        <span key={metadataItem}>{metadataItem}</span>
      ))}
    </div>
  );
}

function WarningList({
  validationIssues,
  warnings,
}: {
  validationIssues: ValidationIssue[];
  warnings: EncumbranceWarning[];
}) {
  return (
    <ul className="warning-list">
      {validationIssues.map((issue) => (
        <li key={`validation-${issue.code}-${issue.recordId ?? issue.entityId}`}>
          {issue.message}
        </li>
      ))}
      {warnings.map((warning) => (
        <li key={`warning-${warning.code}-${warning.recordId ?? warning.entityId}`}>
          {warning.message}
        </li>
      ))}
    </ul>
  );
}

function AuditLogPanel({
  appState,
  entityFilter,
  eventTypeFilter,
  onEntityFilterChange,
  onEventTypeFilterChange,
}: {
  appState: AppState;
  entityFilter: EntityId | "all";
  eventTypeFilter: AuditEventType | "all";
  onEntityFilterChange: (entityId: EntityId | "all") => void;
  onEventTypeFilterChange: (eventType: AuditEventType | "all") => void;
}) {
  const filteredEntries = getFilteredAuditLogEntries(
    appState.auditLog,
    entityFilter,
    eventTypeFilter,
  );

  return (
    <section className="audit-panel" aria-labelledby="audit-title">
      <div className="section-heading">
        <div>
          <h2 id="audit-title">Audit Log</h2>
          <p>{formatAuditEntryCount(appState.auditLog.length)}</p>
        </div>
      </div>

      <div className="audit-filters">
        <label>
          <span>Entity</span>
          <select
            value={entityFilter}
            onChange={(event) =>
              onEntityFilterChange(event.target.value as EntityId | "all")
            }
          >
            <option value="all">All entities</option>
            {getAuditEntityFilterOptions(appState).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Event</span>
          <select
            value={eventTypeFilter}
            onChange={(event) =>
              onEventTypeFilterChange(
                event.target.value as AuditEventType | "all",
              )
            }
          >
            <option value="all">All events</option>
            {Object.entries(AUDIT_EVENT_TYPE_LABELS).map(([eventType, label]) => (
              <option key={eventType} value={eventType}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filteredEntries.length === 0 ? (
        <p className="empty-state compact">No audit entries</p>
      ) : (
        <ul className="audit-list" aria-label="Audit entries">
          {filteredEntries.map((entry) => (
            <li className="audit-entry" key={entry.id}>
              <div className="audit-entry-heading">
                <strong>{entry.summary}</strong>
                <time dateTime={entry.createdAt}>
                  {formatAuditTimestamp(entry.createdAt)}
                </time>
              </div>
              <div className="record-meta">
                <span>{getAuditEventTypeLabel(entry.eventType)}</span>
                <span>{entry.actorLabel}</span>
                {entry.entityId ? (
                  <span>{getAuditEntityLabel(entry, appState.entities)}</span>
                ) : null}
              </div>
              {entry.details && Object.keys(entry.details).length > 0 ? (
                <dl className="audit-details">
                  {Object.entries(entry.details).map(([key, value]) => (
                    <div key={key}>
                      <dt>{formatAuditDetailLabel(key)}</dt>
                      <dd>{formatAuditDetailValue(value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function getFilteredAuditLogEntries(
  auditLog: AuditLogEntry[],
  entityFilter: EntityId | "all",
  eventTypeFilter: AuditEventType | "all",
): AuditLogEntry[] {
  return getNewestAuditLogEntries(auditLog).filter((entry) => {
    if (entityFilter !== "all" && entry.entityId !== entityFilter) {
      return false;
    }

    return eventTypeFilter === "all" || entry.eventType === eventTypeFilter;
  });
}

export function getAuditEntityFilterOptions(
  appState: AppState,
): Array<{ label: string; value: EntityId }> {
  const optionsById = new Map<EntityId, string>();

  getSortedEntities(appState.entities).forEach((entity) => {
    optionsById.set(entity.id, entity.name);
  });

  appState.auditLog.forEach((entry) => {
    if (entry.entityId && !optionsById.has(entry.entityId)) {
      optionsById.set(entry.entityId, entry.entityId);
    }
  });

  return [...optionsById.entries()].map(([value, label]) => ({ label, value }));
}

function getEntityRecordCount(entityId: EntityId, appState: AppStateLike) {
  const count = appState.inventoryRecords.filter(
    (record) => record.location.entityId === entityId,
  ).length;

  return formatRecordCount(count);
}

function formatRecordCount(count: number) {
  return count === 1 ? "1 record" : `${count} records`;
}

function formatAuditEntryCount(count: number) {
  return count === 1 ? "1 entry" : `${count} entries`;
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

export function getRecordDisplayName(record: InventoryRecord) {
  if (record.recordType === "coins") {
    return "Coins";
  }

  if (record.identification?.identified === false) {
    return record.identification.unidentifiedName ?? "Unidentified Item";
  }

  return record.name;
}

export function getDeleteConfirmationMessage(
  record: InventoryRecord,
  allRecords: InventoryRecord[] = [],
) {
  if (record.recordType === "coins") {
    if (getCoinCount(record.coins) > 0) {
      return `Confirm delete coin record containing ${formatCoinDenominations(record)} worth ${formatGpValue(
        getCoinGpValue(record.coins),
      )} gp?`;
    }

    return "Confirm delete empty coin record?";
  }

  const displayName = getRecordDisplayName(record);

  if (record.recordType === "treasure") {
    if (record.treasure.gpValue > 0) {
      return `Confirm delete treasure "${displayName}" worth ${formatGpValue(
        record.treasure.gpValue,
      )} gp?`;
    }

    return `Confirm delete treasure "${displayName}" with no recorded gp value?`;
  }

  if (record.container?.isBackpack === true) {
    return `Confirm delete backpack "${displayName}" with ${formatSlots(
      record.container.capacitySlots,
    )} capacity? This may make stowed inventory invalid.`;
  }

  if (record.container) {
    const childCount = getDirectChildRecords(record.id, allRecords).length;

    if (childCount > 0) {
      return `Confirm delete non-empty container "${displayName}" containing ${formatRecordCount(
        childCount,
      )}? This is blocked until the contents are moved.`;
    }

    return `Confirm delete empty container "${displayName}" with ${formatSlots(
      record.container.capacitySlots,
    )} capacity?`;
  }

  return `Confirm delete "${displayName}"?`;
}

function getRecordMetadata(
  record: InventoryRecord,
  allRecords: InventoryRecord[],
): string[] {
  const metadata: string[] = [];
  const slots = getRecordSlotBurden(record);

  if (record.recordType === "treasure") {
    metadata.push(`${formatGpValue(record.treasure.gpValue)} gp`);
  }

  if (record.recordType !== "coins") {
    if (record.quantity > 1) {
      metadata.push(`x${record.quantity}`);
    }

    metadata.push(formatSlots(slots));

    const handsRequired = getRecordHandsRequired(record);

    if (handsRequired > 0) {
      metadata.push(formatHandsRequired(handsRequired));
    }
  }

  if (record.recordType === "weapon") {
    if (record.weapon.damage) {
      metadata.push(record.weapon.damage);
    }

    if (record.weapon.range) {
      metadata.push(record.weapon.range);
    }
  }

  if (record.recordType === "armor") {
    if (record.armor.baseArmorClass !== undefined) {
      metadata.push(`AC ${record.armor.baseArmorClass}`);
    }

    if (record.armor.armorBonus !== undefined) {
      metadata.push(`+${record.armor.armorBonus} AC`);
    }

    if (
      record.location.locationType === "equipped" &&
      record.location.placement === "loose"
    ) {
      metadata.push("Active");
    }
  }

  if (record.uses) {
    metadata.push(
      record.uses.max === undefined
        ? `${record.uses.current} uses`
        : `${record.uses.current}/${record.uses.max} uses`,
    );
  }

  if (record.light) {
    metadata.push(record.light.isLit ? "Lit" : "Unlit");
  }

  if (record.container) {
    const slotUsage = getContainerSlotUsage(record, allRecords);
    metadata.push(formatCapacity(slotUsage.usedSlots, slotUsage.capacitySlots));
  }

  return metadata;
}

function formatCoinDenominations(record: InventoryRecord) {
  if (record.recordType !== "coins" || getCoinCount(record.coins) === 0) {
    return "No coins";
  }

  const allDenominations: Array<[string, number]> = [
    ["pp", record.coins.pp],
    ["gp", record.coins.gp],
    ["sp", record.coins.sp],
    ["cp", record.coins.cp],
  ];
  const denominations = allDenominations.filter(([, count]) => count > 0);

  return denominations.map(([label, count]) => `${count} ${label}`).join(", ");
}

function formatSlots(slots: number) {
  return slots === 1 ? "1 slot" : `${slots} slots`;
}

function formatCapacity(usedSlots: number, capacitySlots: number | undefined) {
  if (capacitySlots === undefined) {
    return `${formatSlots(usedSlots)} used`;
  }

  return `${usedSlots}/${capacitySlots} slots`;
}

function formatGpValue(value: number) {
  return Number.isInteger(value)
    ? value.toString()
    : Number(value.toFixed(2)).toString();
}

function formatHandsRequired(handsRequired: HandsRequired) {
  return handsRequired === 1 ? "One hand" : "Two hands";
}

function formatWarningState(
  warnings: EncumbranceWarning[],
  validationIssues: ValidationIssue[],
) {
  const count = warnings.length + validationIssues.length;

  if (count === 0) {
    return "No warnings";
  }

  return count === 1 ? "1 warning" : `${count} warnings`;
}

function formatContainerHeldState(record: InventoryRecord) {
  const handsRequired = getRecordHandsRequired(record);

  if (!record.container || handsRequired === 0) {
    return "No hands required";
  }

  if (
    record.location.locationType === "equipped" &&
    (record.location.placement === "leftHand" ||
      record.location.placement === "rightHand" ||
      record.location.placement === "bothHands")
  ) {
    return `Held in ${record.location.placement}`;
  }

  return handsRequired === 1 ? "1 hand required" : "2 hands required";
}

function getAuditEntityLabel(entry: AuditLogEntry, entities: Entity[]): string {
  if (!entry.entityId) {
    return "No entity";
  }

  return (
    entities.find((entity) => entity.id === entry.entityId)?.name ??
    entry.entityId
  );
}

function formatAuditTimestamp(createdAt: string): string {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return createdAt;
  }

  return date.toLocaleString();
}

function formatAuditDetailLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase())
    .replace(/\bGp\b/g, "GP")
    .replace(/\bPp\b/g, "PP")
    .replace(/\bSp\b/g, "SP")
    .replace(/\bCp\b/g, "CP")
    .replace(/\bId\b/g, "ID");
}

function formatAuditDetailValue(value: string | number | boolean | null): string {
  if (value === null) {
    return "None";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return value.toString();
}

function createCharacterSheetFormState(
  characterData: CharacterData,
): CharacterSheetFormState {
  const normalizedCharacterData = normalizeCharacterData(characterData);

  return {
    className: normalizedCharacterData.className,
    level: formatNullableNumberInput(normalizedCharacterData.level),
    alignment: normalizedCharacterData.alignment,
    xp: formatNullableNumberInput(normalizedCharacterData.xp),
    hpCurrent: formatNullableNumberInput(normalizedCharacterData.hp.current),
    hpMax: formatNullableNumberInput(normalizedCharacterData.hp.max),
    abilityScores: ABILITY_SCORE_KEYS.reduce<Record<AbilityScoreKey, string>>(
      (abilityScores, key) => ({
        ...abilityScores,
        [key]: formatNullableNumberInput(
          normalizedCharacterData.abilityScores[key],
        ),
      }),
      {
        str: "",
        int: "",
        wis: "",
        dex: "",
        con: "",
        cha: "",
      },
    ),
    skills: normalizedCharacterData.skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      chanceInSix: skill.chanceInSix.toString(),
      description: skill.description ?? "",
    })),
    languagesText: normalizedCharacterData.languages.join("\n"),
    description: normalizedCharacterData.description,
    features: normalizedCharacterData.features.map((feature) => ({
      id: feature.id,
      title: feature.title,
      description: feature.description,
    })),
  };
}

function toCharacterDataFormInput(
  formState: CharacterSheetFormState,
): CharacterData {
  return {
    className: formState.className.trim(),
    level: parseNullableIntegerInput(formState.level),
    alignment: formState.alignment,
    xp: parseNullableIntegerInput(formState.xp),
    hp: {
      current: parseNullableIntegerInput(formState.hpCurrent),
      max: parseNullableIntegerInput(formState.hpMax),
    },
    abilityScores: ABILITY_SCORE_KEYS.reduce<CharacterData["abilityScores"]>(
      (abilityScores, key) => ({
        ...abilityScores,
        [key]: parseNullableIntegerInput(formState.abilityScores[key]),
      }),
      {
        str: null,
        int: null,
        wis: null,
        dex: null,
        con: null,
        cha: null,
      },
    ),
    skills: formState.skills.map((skill) => ({
      id: skill.id,
      name: skill.name.trim(),
      chanceInSix: parseIntegerInput(skill.chanceInSix),
      ...(skill.description.trim()
        ? { description: skill.description.trim() }
        : {}),
    })),
    languages: parseLanguagesInput(formState.languagesText),
    description: formState.description.trim(),
    features: formState.features
      .map((feature) => ({
        id: feature.id,
        title: feature.title.trim(),
        description: feature.description.trim(),
      }))
      .filter((feature) => feature.title || feature.description),
  };
}

function createEmptySkillFormState(): CharacterSkillFormState {
  return {
    id: createFormRowId("skill"),
    name: "",
    chanceInSix: "1",
    description: "",
  };
}

function createEmptyFeatureFormState(): CharacterFeatureFormState {
  return {
    id: createFormRowId("feature"),
    title: "",
    description: "",
  };
}

function parseLanguagesInput(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((language) => language.trim())
    .filter((language) => language.length > 0);
}

function parseNullableIntegerInput(value: string): number | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  return parseIntegerInput(trimmedValue);
}

function parseIntegerInput(value: string): number {
  const parsedValue = Number(value);

  return Number.isInteger(parsedValue) ? parsedValue : Number.NaN;
}

function formatNullableNumberInput(value: number | null): string {
  return value === null ? "" : value.toString();
}

function createFormRowId(prefix: "feature" | "skill"): string {
  const randomId =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  return `${prefix}-${randomId}`;
}

function createEmptyRecordForm(entity: Entity): RecordFormState {
  return {
    mode: "create",
    entityId: entity.id,
    recordType: "equipment",
    targetEntityId: entity.id,
    placement: "default",
    containerId: "",
    name: "",
    description: "",
    pp: "0",
    gp: "0",
    sp: "0",
    cp: "0",
    gpValue: "0",
    damage: "",
    range: "",
    baseArmorClass: "",
    armorBonus: "",
    burdenKind: "fixed",
    quantity: "1",
    slotsPerItem: "1",
    itemsPerSlot: "1",
    isContainer: false,
    capacitySlots: "0",
    handsRequired: "0",
    isBackpack: false,
    burdenMode: "contentsOnlyWhenLoaded",
  };
}

function createRecordFormFromRecord(record: InventoryRecord): RecordFormState {
  const baseForm = createEmptyRecordForm({
    id: record.location.entityId,
    name: "",
    entityType: "character",
    active: true,
    sortOrder: 0,
  });
  const slotState = getRecordFormSlotState(record);

  return {
    ...baseForm,
    mode: "edit",
    entityId: record.location.entityId,
    recordId: record.id,
    recordType: record.recordType,
    targetEntityId: record.location.entityId,
    placement: getLocationPlacementKey(record.location),
    containerId: "containerId" in record.location ? record.location.containerId : "",
    name: record.recordType === "coins" ? "" : record.name,
    description: record.description ?? "",
    pp: record.recordType === "coins" ? record.coins.pp.toString() : "0",
    gp: record.recordType === "coins" ? record.coins.gp.toString() : "0",
    sp: record.recordType === "coins" ? record.coins.sp.toString() : "0",
    cp: record.recordType === "coins" ? record.coins.cp.toString() : "0",
    gpValue:
      record.recordType === "treasure" ? record.treasure.gpValue.toString() : "0",
    damage: record.recordType === "weapon" ? record.weapon.damage ?? "" : "",
    range: record.recordType === "weapon" ? record.weapon.range ?? "" : "",
    baseArmorClass:
      record.recordType === "armor" && record.armor.baseArmorClass !== undefined
        ? record.armor.baseArmorClass.toString()
        : "",
    armorBonus:
      record.recordType === "armor" && record.armor.armorBonus !== undefined
        ? record.armor.armorBonus.toString()
        : "",
    ...slotState,
    isContainer: Boolean(record.container),
    capacitySlots: record.container?.capacitySlots.toString() ?? "0",
    handsRequired: getRecordHandsRequired(record).toString() as
      | "0"
      | "1"
      | "2",
    isBackpack: record.container?.isBackpack === true,
    burdenMode: record.container?.burdenMode ?? "contentsOnlyWhenLoaded",
  };
}

function toInventoryRecordFormInput(
  formState: RecordFormState,
): InventoryRecordFormInput {
  const location = {
    entityId: formState.targetEntityId,
    placement: formState.placement,
    ...(formState.containerId ? { containerId: formState.containerId } : {}),
  };
  const sharedInput = {
    recordType: formState.recordType,
    description: formState.description,
    location,
  };

  if (formState.recordType === "coins") {
    return {
      ...sharedInput,
      recordType: "coins",
      coins: {
        pp: parseNumberInput(formState.pp),
        gp: parseNumberInput(formState.gp),
        sp: parseNumberInput(formState.sp),
        cp: parseNumberInput(formState.cp),
      },
    };
  }

  const burden =
    formState.burdenKind === "none"
      ? { kind: "none" as const }
      : formState.burdenKind === "stacked"
        ? {
            kind: "stacked" as const,
            itemsPerSlot: parseNumberInput(formState.itemsPerSlot, 1),
          }
        : {
            kind: "fixed" as const,
            slotsPerItem: parseNumberInput(formState.slotsPerItem, 1),
          };
  const handsRequired = Number(formState.handsRequired) as HandsRequired;
  const nonCoinSharedInput = {
    ...sharedInput,
    quantity: parseNumberInput(formState.quantity, 1),
    burden,
    handsRequired,
  };
  const container =
    formState.isContainer &&
    formState.recordType !== "treasure"
      ? {
          capacitySlots: parseNumberInput(formState.capacitySlots),
          isBackpack: formState.isBackpack,
          burdenMode: formState.burdenMode,
        }
      : undefined;

  if (formState.recordType === "treasure") {
    return {
      ...nonCoinSharedInput,
      recordType: "treasure",
      name: formState.name,
      gpValue: parseNumberInput(formState.gpValue),
    };
  }

  if (formState.recordType === "weapon") {
    return {
      ...nonCoinSharedInput,
      recordType: "weapon",
      name: formState.name,
      container,
      weapon: {
        damage: formState.damage,
        range: formState.range,
      },
    };
  }

  if (formState.recordType === "armor") {
    return {
      ...nonCoinSharedInput,
      recordType: "armor",
      name: formState.name,
      container,
      armor: {
        ...(formState.baseArmorClass
          ? { baseArmorClass: parseNumberInput(formState.baseArmorClass) }
          : {}),
        ...(formState.armorBonus
          ? { armorBonus: parseNumberInput(formState.armorBonus) }
          : {}),
      },
    };
  }

  return {
    ...nonCoinSharedInput,
    recordType: "equipment",
    name: formState.name,
    container,
  };
}

function getDefaultHandsRequired(recordType: InventoryRecordType): HandsRequired {
  return recordType === "weapon" ? 1 : 0;
}

function getContainerOptions({
  editingRecordId,
  entity,
  records,
}: {
  editingRecordId?: InventoryRecordId;
  entity: Entity;
  records: InventoryRecord[];
}) {
  return getUsableContainerRecords({ editingRecordId, entity, records });
}

function getPlacementOptions({
  recordType,
  records,
  targetEntity,
}: {
  recordType: InventoryRecordType;
  records: InventoryRecord[];
  targetEntity: Entity;
}): Array<{ value: InventoryRecordPlacementKey; label: string }> {
  if (recordType === "coins") {
    return isCharacterLikeEntity(targetEntity)
      ? [{ value: "coinPurse", label: "Coin purse" }]
      : [
          { value: "contents", label: "Contents" },
          { value: "container", label: "Container" },
        ];
  }

  if (!isCharacterLikeEntity(targetEntity)) {
    return [
      { value: "contents", label: "Contents" },
      { value: "container", label: "Container" },
    ];
  }

  const options: Array<{ value: InventoryRecordPlacementKey; label: string }> = [
    { value: "equippedLoose", label: "Equipped loose" },
    { value: "leftHand", label: "Left hand" },
    { value: "rightHand", label: "Right hand" },
    { value: "bothHands", label: "Both hands" },
  ];

  if (findBackpackRecords(targetEntity.id, records).length > 0) {
    options.push({ value: "backpack", label: "Backpack" });
  }

  options.push({ value: "container", label: "Container" });

  return options;
}

function getRecordFormSlotState(record: InventoryRecord) {
  if (record.recordType === "coins") {
    return {
      burdenKind: "fixed" as const,
      quantity: "1",
      slotsPerItem: "1",
      itemsPerSlot: "1",
    };
  }

  switch (record.burden.kind) {
    case "none":
      return {
        burdenKind: "none" as const,
        quantity: record.quantity.toString(),
        slotsPerItem: "1",
        itemsPerSlot: "1",
      };
    case "fixed":
      return {
        burdenKind: "fixed" as const,
        quantity: record.quantity.toString(),
        slotsPerItem: record.burden.slotsPerItem.toString(),
        itemsPerSlot: "1",
      };
    case "stacked":
      return {
        burdenKind: "stacked" as const,
        quantity: record.quantity.toString(),
        slotsPerItem: "1",
        itemsPerSlot: record.burden.itemsPerSlot.toString(),
      };
  }
}

function parseNumberInput(value: string, fallback = 0) {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function formatPersistenceSummary(
  persistenceMode: PersistenceMode,
  syncStatus: SyncStatus,
): string {
  if (persistenceMode === "local") {
    return "Persistence: Local";
  }

  return `Persistence: Firebase / ${SYNC_STATUS_LABELS[syncStatus]}`;
}

const SYNC_STATUS_LABELS: Record<SyncStatus, string> = {
  authenticating: "Authenticating",
  connecting: "Connecting",
  error: "Error",
  local: "Local",
  saving: "Saving",
  synced: "Synced",
  syncing: "Syncing",
};

type AppStateLike = ReturnType<typeof useAppStore.getState>["appState"];

export default function App() {
  return (
    <Routes>
      <Route path="/*" element={<LocalAppShell />} />
      <Route path="*" element={<Navigate to="/inventory" replace />} />
    </Routes>
  );
}

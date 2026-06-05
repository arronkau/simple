import {
  ChangeEvent,
  FormEvent,
  Fragment,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { KeyboardCoordinateGetter } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ItemStatusIcon,
  ItemTypeIcon,
  type IconTone,
  type ItemStatusIconName,
  type ItemTypeIconName,
} from "./components/InventoryIcons";
import {
  entityDefaultDropId,
  gapDropId,
  resolveRecordDrop,
  slotDropId,
  type DragZone,
  type RecordDragData,
  type RecordDropData,
} from "./model/inventoryDnd";
import { APP_STATE_STORAGE_KEY, parseAppState } from "./model/appState";
import {
  DEFAULT_AUDIT_ACTOR_LABEL,
  AUDIT_EVENT_TYPE_LABELS,
  getAuditEventTypeLabel,
  getNewestAuditLogEntries,
} from "./model/auditLog";
import {
  getCoinCount,
  getCoinGpValue,
  getDirectChildRecords,
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
  createInventoryRecordInputFromStandardItem,
  filterStandardItems,
} from "./model/standardItems";
import {
  getContainerContents,
  getInventorySections,
  getOwnedRecords,
  getRecordById,
} from "./model/inventoryDisplay";
import {
  getInventoryRowDisplay,
  formatCoinDenominations as formatCoinDenominationsValue,
  type InventoryRowStatus,
} from "./model/inventoryRowDisplay";
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
  CoinData,
  Entity,
  EntityId,
  EntityType,
  HandsRequired,
  InventoryRecord,
  InventoryRecordId,
  InventoryRecordType,
  KnownModifierTarget,
  Modifier,
} from "./model/types";
import {
  findTopLevelStowedContainerRecords,
  isCharacterLikeEntity,
  validateInventoryState,
  type ValidationIssue,
} from "./model/validation";
import {
  useAppStore,
  type EntityMutationResult,
  type InventoryMutationResult,
} from "./store/useAppStore";
import type { CoinDenomination } from "./store/useAppStore";

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

const COIN_DENOMINATIONS: CoinDenomination[] = ["pp", "gp", "sp", "cp"];

const MODIFIER_TARGET_OPTIONS: Array<{
  label: string;
  value: KnownModifierTarget | "ability:str" | "ability:int" | "ability:wis" | "ability:dex" | "ability:con" | "ability:cha" | "other";
}> = [
  { label: "AC", value: "armorClass" },
  { label: "Attack", value: "attack" },
  { label: "Damage", value: "damage" },
  { label: "Saves", value: "savingThrow" },
  { label: "Strength", value: "ability:str" },
  { label: "Intelligence", value: "ability:int" },
  { label: "Wisdom", value: "ability:wis" },
  { label: "Dexterity", value: "ability:dex" },
  { label: "Constitution", value: "ability:con" },
  { label: "Charisma", value: "ability:cha" },
  { label: "Movement", value: "movement" },
  { label: "Other", value: "other" },
];

type ModifierFormRow = {
  id: string;
  target: string;
  value: string;
  label: string;
};

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
  stackable: boolean;
  quantity: string;
  slotsPerItem: string;
  itemsPerSlot: string;
  showMovement: boolean;
  isContainer: boolean;
  capacitySlots: string;
  handsRequired: "0" | "1" | "2";
  isUnidentified: boolean;
  secretName: string;
  secretDescription: string;
  isLight: boolean;
  lightDescription: string;
  isLit: boolean;
  trackUses: boolean;
  usesCurrent: string;
  usesMax: string;
  addModifiers: boolean;
  modifiers: ModifierFormRow[];
  notesEnabled: boolean;
  notes: string;
  addWeaponQualities: boolean;
  qualities: string;
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

type CoinSpendFormState = {
  recordId: InventoryRecordId;
  amounts: Record<CoinDenomination, string>;
  note: string;
};

type ManageMessage = {
  tone: "error" | "success";
  text: string;
};

type AppStateExport = {
  version: 1;
  exportedAt: string;
  data: AppState;
};

function LocalAppShell() {
  const location = useLocation();
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
  const identifyInventoryRecord = useAppStore(
    (state) => state.identifyInventoryRecord,
  );
  const spendCoins = useAppStore((state) => state.spendCoins);
  const deleteInventoryRecord = useAppStore(
    (state) => state.deleteInventoryRecord,
  );
  const replaceAppState = useAppStore((state) => state.replaceAppState);
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
  const [coinSpendForm, setCoinSpendForm] = useState<
    CoinSpendFormState | undefined
  >();
  const [recordFormMessage, setRecordFormMessage] = useState<
    string | undefined
  >();
  const [entityCreateModalOpen, setEntityCreateModalOpen] = useState(false);
  const [coinSpendMessage, setCoinSpendMessage] = useState<
    string | undefined
  >();
  const [auditEntityFilter, setAuditEntityFilter] = useState<
    EntityId | "all"
  >("all");
  const [auditEventTypeFilter, setAuditEventTypeFilter] = useState<
    AuditEventType | "all"
  >("all");
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [collapsedContainerIds, setCollapsedContainerIds] = useState<
    Set<InventoryRecordId>
  >(() => new Set());

  function toggleContainerCollapsed(recordId: InventoryRecordId) {
    setCollapsedContainerIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(recordId)) {
        nextIds.delete(recordId);
      } else {
        nextIds.add(recordId);
      }

      return nextIds;
    });
  }

  function handleCreateEntity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const createdEntityId = createEntity(formState);

    if (createdEntityId) {
      setFormState(EMPTY_ENTITY_FORM);
      setEntityCreateModalOpen(false);
    }
  }

  function startCreatingEntity() {
    setFormState(EMPTY_ENTITY_FORM);
    setEntityCreateModalOpen(true);
  }

  function cancelCreatingEntity() {
    setEntityCreateModalOpen(false);
    setFormState(EMPTY_ENTITY_FORM);
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

  function startSpendingCoins(record: InventoryRecord) {
    if (record.recordType !== "coins") {
      return;
    }

    setCoinSpendForm({
      recordId: record.id,
      amounts: createEmptyCoinSpendAmounts(),
      note: "",
    });
    setCoinSpendMessage(undefined);
  }

  function cancelSpendingCoins() {
    setCoinSpendForm(undefined);
    setCoinSpendMessage(undefined);
  }

  function saveCoinSpendForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!coinSpendForm) {
      return;
    }

    const result = spendCoins(coinSpendForm.recordId, {
      amounts: toCoinSpendAmounts(coinSpendForm.amounts),
      note: coinSpendForm.note,
    });

    if (!result.ok) {
      setCoinSpendMessage(result.message);
      return;
    }

    setCoinSpendForm(undefined);
    setCoinSpendMessage(undefined);
  }

  const isInventoryRoute = location.pathname.startsWith("/inventory");
  const workspaceClassName = `workspace-panel${
    isInventoryRoute ? " inventory-workspace-panel" : ""
  }`;

  return (
    <main className="app-shell">
      <section className={workspaceClassName} aria-labelledby="app-title">
        <div className="app-header">
          <div>
            <p className="eyebrow">
              {formatPersistenceSummary(persistenceMode, syncStatus)}
            </p>
            <h1 id="app-title">Simple Inventory</h1>
            {syncError ? <p className="sync-message">{syncError}</p> : null}
          </div>
          <button type="button" onClick={() => setManageModalOpen(true)}>
            Manage
          </button>
        </div>

        <nav className="app-nav" aria-label="Primary">
          <NavLink to="/party">Party</NavLink>
          <NavLink to="/inventory">Inventory</NavLink>
          <NavLink to="/characters">Characters</NavLink>
          <NavLink to="/audit">Audit Log</NavLink>
        </nav>

        <Routes>
          <Route index element={<Navigate to="/party" replace />} />
          <Route
            path="party"
            element={
              <PartyPage
                appState={appState}
                sortedEntities={sortedEntities}
              />
            }
          />
          <Route
            path="inventory"
            element={
              <InventoryPage
                appState={appState}
                collapsedContainerIds={collapsedContainerIds}
                entityCreateModalOpen={entityCreateModalOpen}
                editingEntityId={editingEntityId}
                editingName={editingName}
                formState={formState}
                recordForm={recordForm}
                recordFormMessage={recordFormMessage}
                sortedEntities={sortedEntities}
                onCancelEditing={cancelEditing}
                onCancelCreateEntity={cancelCreatingEntity}
                onCancelRecordForm={cancelRecordForm}
                onChangeEntityForm={setFormState}
                onChangeEditingName={setEditingName}
                onChangeRecordForm={setRecordForm}
                onCreateEntity={handleCreateEntity}
                onDeleteEntity={deleteEntity}
                onDeleteRecord={removeInventoryRecord}
                onEditEntity={startEditing}
                onEditRecord={startEditingRecord}
                onIdentifyRecord={identifyInventoryRecord}
                onSaveEditing={saveEditing}
                onSaveRecordForm={saveRecordForm}
                onSetEntityActive={setEntityActive}
                onSpendCoins={startSpendingCoins}
                onStartCreateEntity={startCreatingEntity}
                onStartAddRecord={startAddingRecord}
                onToggleContainerCollapsed={toggleContainerCollapsed}
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
          <Route
            path="audit"
            element={
              <AuditPage
                appState={appState}
                entityFilter={auditEntityFilter}
                eventTypeFilter={auditEventTypeFilter}
                onEntityFilterChange={setAuditEntityFilter}
                onEventTypeFilterChange={setAuditEventTypeFilter}
              />
            }
          />
          <Route path="*" element={<Navigate to="/inventory" replace />} />
        </Routes>

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

        {manageModalOpen ? (
          <ManageDataModal
            appState={appState}
            onClose={() => setManageModalOpen(false)}
            onImportAppState={replaceAppState}
            onReset={() => {
              resetLocalState();
              setManageModalOpen(false);
            }}
          />
        ) : null}

        {coinSpendForm ? (
          <CoinSpendModal
            formState={coinSpendForm}
            message={coinSpendMessage}
            record={getRecordById(coinSpendForm.recordId, appState.inventoryRecords)}
            onCancel={cancelSpendingCoins}
            onChange={setCoinSpendForm}
            onSubmit={saveCoinSpendForm}
          />
        ) : null}
      </section>
    </main>
  );
}

function ManageDataModal({
  appState,
  onClose,
  onImportAppState,
  onReset,
}: {
  appState: AppState;
  onClose: () => void;
  onImportAppState: (appState: AppState) => void;
  onReset: () => void;
}) {
  const [importMessage, setImportMessage] = useState<ManageMessage | undefined>();
  const [pendingImportAppState, setPendingImportAppState] = useState<
    AppState | undefined
  >();
  const [importConfirmation, setImportConfirmation] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");
  const importEnabled =
    pendingImportAppState !== undefined && importConfirmation === "import";
  const resetEnabled = resetConfirmation === "delete";

  function exportAppData() {
    const exportData: AppStateExport = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: appState,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `simple-export-${formatExportDate(new Date())}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function importAppData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const parsedValue: unknown = JSON.parse(await file.text());
      const importedAppState = parseImportedAppState(parsedValue);

      if (!importedAppState) {
        setPendingImportAppState(undefined);
        setImportConfirmation("");
        setImportMessage({
          tone: "error",
          text: "Import failed. Choose a JSON export with a valid app state.",
        });
        return;
      }

      setPendingImportAppState(importedAppState);
      setImportConfirmation("");
      setImportMessage({
        tone: "success",
        text: "Import file is valid. Type import to replace current data.",
      });
    } catch {
      setPendingImportAppState(undefined);
      setImportConfirmation("");
      setImportMessage({
        tone: "error",
        text: "Import failed. The selected file is not valid JSON.",
      });
    }
  }

  function confirmImport() {
    if (!pendingImportAppState || !importEnabled) {
      return;
    }

    onImportAppState(pendingImportAppState);
    setPendingImportAppState(undefined);
    setImportConfirmation("");
    setImportMessage({ tone: "success", text: "Import complete." });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-label="Manage data"
        aria-modal="true"
        className="modal-panel manage-modal"
        role="dialog"
      >
        <div className="manage-heading">
          <div>
            <h2>Manage Data</h2>
            <p>Export, import, or reset the current app data.</p>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <section className="manage-section">
          <div>
            <h3>Export</h3>
            <p>Download a JSON file that can be imported later.</p>
          </div>
          <button type="button" onClick={exportAppData}>
            Export JSON
          </button>
        </section>

        <section className="manage-section">
          <div>
            <h3>Import</h3>
            <p>
              Import replaces all current app data. Export a backup first. Type
              import to continue.
            </p>
          </div>
          <label className="file-button">
            <span>Import JSON</span>
            <input accept="application/json,.json" type="file" onChange={importAppData} />
          </label>
          {pendingImportAppState ? (
            <>
              <label>
                <span>Type import to confirm</span>
                <input
                  autoComplete="off"
                  value={importConfirmation}
                  onChange={(event) =>
                    setImportConfirmation(event.target.value)
                  }
                />
              </label>
              <button
                className="danger-button"
                disabled={!importEnabled}
                type="button"
                onClick={confirmImport}
              >
                Replace data
              </button>
            </>
          ) : null}
          {importMessage ? (
            <p
              className={
                importMessage.tone === "error" ? "form-error" : "form-success"
              }
            >
              {importMessage.text}
            </p>
          ) : null}
        </section>

        <section className="manage-section danger-section">
          <div>
            <h3>Reset Data</h3>
            <p>Delete all current app data and return to the default empty state.</p>
          </div>
          <label>
            <span>Type delete to confirm</span>
            <input
              autoComplete="off"
              value={resetConfirmation}
              onChange={(event) => setResetConfirmation(event.target.value)}
            />
          </label>
          <button
            className="danger-button"
            disabled={!resetEnabled}
            type="button"
            onClick={onReset}
          >
            Reset data
          </button>
        </section>
      </section>
    </div>
  );
}

function AuditPage({
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
  return (
    <section className="entity-workspace" aria-labelledby="audit-page-title">
      <AuditLogPanel
        appState={appState}
        entityFilter={entityFilter}
        eventTypeFilter={eventTypeFilter}
        onEntityFilterChange={onEntityFilterChange}
        onEventTypeFilterChange={onEventTypeFilterChange}
        titleId="audit-page-title"
      />
    </section>
  );
}

function InventoryPage({
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
  onDeleteEntity: (entityId: EntityId) => void;
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditEntity: (entity: Entity) => void;
  onEditRecord: (record: InventoryRecord) => void;
  onIdentifyRecord: (recordId: InventoryRecordId) => InventoryMutationResult;
  onSaveEditing: (entityId: EntityId) => void;
  onSaveRecordForm: (event: FormEvent<HTMLFormElement>) => void;
  onSetEntityActive: (entityId: EntityId, active: boolean) => void;
  onSpendCoins: (record: InventoryRecord) => void;
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
          onSubmit={onSaveRecordForm}
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

function EntityForm({
  formState,
  onChange,
  onSubmit,
  submitLabel = "Add entity",
}: {
  formState: EntityFormState;
  onChange: (formState: EntityFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel?: string;
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

      <button type="submit">{submitLabel}</button>
    </form>
  );
}

function EntityCreateModal({
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
      <section
        aria-label="Add entity"
        aria-modal="true"
        className="modal-panel entity-modal"
        role="dialog"
      >
        <div className="record-form-heading">
          <h3>Add Entity</h3>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
        <EntityForm
          formState={formState}
          onChange={onChange}
          onSubmit={onSubmit}
          submitLabel="Create entity"
        />
      </section>
    </div>
  );
}

function EntityEditModal({
  appState,
  editingName,
  entity,
  onCancel,
  onChangeEditingName,
  onDeleteEntity,
  onSaveEditing,
  onSetEntityActive,
}: {
  appState: AppState;
  editingName: string;
  entity: Entity;
  onCancel: () => void;
  onChangeEditingName: (name: string) => void;
  onDeleteEntity: (entityId: EntityId) => void;
  onSaveEditing: (entityId: EntityId) => void;
  onSetEntityActive: (entityId: EntityId, active: boolean) => void;
}) {
  const status = getEntityInventoryStatus(entity, appState);

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-label={`Edit ${entity.name}`}
        aria-modal="true"
        className="modal-panel entity-modal"
        role="dialog"
      >
        <div className="record-form-heading">
          <div>
            <h3>Edit Entity</h3>
            <p className="form-help">{ENTITY_TYPE_LABELS[entity.entityType]}</p>
          </div>
          <button type="button" onClick={onCancel}>
            Close
          </button>
        </div>

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

        <div className="entity-modal-summary">
          {status.movement ? <span>{status.movement}</span> : null}
          {status.capacity ? <span>{status.capacity}</span> : null}
          {status.warningCount > 0 ? (
            <span>{formatWarningState(status.warnings, status.validationIssues)}</span>
          ) : (
            <span>No warnings</span>
          )}
        </div>

        <div className="record-form-actions">
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
          <button
            type="button"
            onClick={() => onSetEntityActive(entity.id, !entity.active)}
          >
            {entity.active ? "Deactivate" : "Reactivate"}
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" onClick={() => onSaveEditing(entity.id)}>
            Save entity
          </button>
        </div>
      </section>
    </div>
  );
}

/**
 * Collision detection scoped to record drop targets. Prefers pointer-within
 * for precise gaps and falls back to closest-center so empty zones remain
 * reachable.
 */
const dragTypeScopedCollisionDetection: CollisionDetection = (args) => {
  // Keyboard dragging has no pointer coordinates. The fine-grained gap drop
  // zones are great for pointer precision but make keyboard navigation snap
  // erratically (often back onto the dragged row), so we drop them for keyboard
  // and let the move land cleanly on item/slot targets instead.
  const isKeyboard = args.pointerCoordinates === null;
  const droppableContainers = args.droppableContainers.filter((container) => {
    if (container.data.current?.type !== "record") {
      return false;
    }

    return !(isKeyboard && container.data.current?.kind === "gap");
  });
  const scopedArgs = { ...args, droppableContainers };
  const pointerCollisions = pointerWithin(scopedArgs);

  return pointerCollisions.length > 0
    ? pointerCollisions
    : closestCenter(scopedArgs);
};

const inventoryKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  return sortableKeyboardCoordinates(event, args);
};

type EntityRowCallbacks = {
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditEntity: (entity: Entity) => void;
  onEditRecord: (record: InventoryRecord) => void;
  onIdentifyRecord: (recordId: InventoryRecordId) => InventoryMutationResult;
  onSpendCoins: (record: InventoryRecord) => void;
  onStartAddRecord: (entity: Entity) => void;
  onToggleContainerCollapsed: (recordId: InventoryRecordId) => void;
};

function InventoryEntityBoard({
  appState,
  collapsedContainerIds,
  sortedEntities,
  onDeleteRecord,
  onEditEntity,
  onEditRecord,
  onIdentifyRecord,
  onSpendCoins,
  onStartAddRecord,
  onToggleContainerCollapsed,
}: {
  appState: AppState;
  collapsedContainerIds: Set<InventoryRecordId>;
  sortedEntities: Entity[];
} & EntityRowCallbacks) {
  const moveInventoryRecord = useAppStore((state) => state.moveInventoryRecord);
  const swapInventoryRecords = useAppStore(
    (state) => state.swapInventoryRecords,
  );
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | undefined>();
  const [dragMessage, setDragMessage] = useState<string | undefined>();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: inventoryKeyboardCoordinates }),
  );

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as RecordDragData | undefined;

    if (!data || data.type !== "record") {
      return;
    }

    setActiveDrag({ type: "record", recordId: data.recordId });
    setDragMessage(undefined);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(undefined);

    const activeData = event.active.data.current as RecordDragData | undefined;
    const overData = event.over?.data.current as RecordDropData | undefined;

    if (!activeData || activeData.type !== "record") {
      return;
    }

    const resolution = resolveRecordDrop(
      activeData,
      overData?.type === "record" ? (overData as RecordDropData) : undefined,
    );

    if (!resolution) {
      return;
    }

    if (resolution.kind === "move") {
      const result = moveInventoryRecord(resolution.recordId, resolution.location);

      if (!result.ok) {
        setDragMessage(result.message);
      }

      return;
    }

    const swapResult = swapInventoryRecords(
      resolution.recordIdA,
      resolution.recordIdB,
    );

    if (!swapResult.ok) {
      const fallbackResult = moveInventoryRecord(
        resolution.fallback.recordId,
        resolution.fallback.location,
      );

      if (!fallbackResult.ok) {
        setDragMessage(fallbackResult.message);
      }
    }
  }

  const activeRecord =
    activeDrag?.type === "record"
      ? getRecordById(activeDrag.recordId, appState.inventoryRecords)
      : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={dragTypeScopedCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(undefined)}
    >
      <ul
        className="entity-list inventory-entity-grid"
        aria-label="Inventory entities"
      >
        {sortedEntities.map((entity) => (
          <EntityInventoryRow
            appState={appState}
            collapsedContainerIds={collapsedContainerIds}
            entity={entity}
            key={entity.id}
            onDeleteRecord={onDeleteRecord}
            onEditEntity={onEditEntity}
            onEditRecord={onEditRecord}
            onIdentifyRecord={onIdentifyRecord}
            onSpendCoins={onSpendCoins}
            onStartAddRecord={onStartAddRecord}
            onToggleContainerCollapsed={onToggleContainerCollapsed}
          />
        ))}
      </ul>

      <DragOverlay>
        {activeRecord ? (
          <div className="record-row drag-overlay-card">
            <InventoryRowSummary
              record={activeRecord}
              allRecords={appState.inventoryRecords}
            />
          </div>
        ) : null}
      </DragOverlay>

      <div className="drag-live-region" role="status" aria-live="polite">
        {dragMessage ?? ""}
      </div>
    </DndContext>
  );
}

function EntityInventoryRow({
  appState,
  collapsedContainerIds,
  entity,
  onDeleteRecord,
  onEditEntity,
  onEditRecord,
  onIdentifyRecord,
  onSpendCoins,
  onStartAddRecord,
  onToggleContainerCollapsed,
}: {
  appState: AppState;
  collapsedContainerIds: Set<InventoryRecordId>;
  entity: Entity;
} & EntityRowCallbacks) {
  return (
    <li
      className="entity-row"
      data-inactive={!entity.active}
    >
      <EntityDefaultDropZone entityId={entity.id}>
        <EntitySummary
          appState={appState}
          entity={entity}
          onEditEntity={onEditEntity}
        />
      </EntityDefaultDropZone>

      <InventoryDisplay
        entity={entity}
        appState={appState}
        collapsedContainerIds={collapsedContainerIds}
        onDeleteRecord={onDeleteRecord}
        onEditRecord={onEditRecord}
        onIdentifyRecord={onIdentifyRecord}
        onSpendCoins={onSpendCoins}
        onStartAddRecord={onStartAddRecord}
        onToggleContainerCollapsed={onToggleContainerCollapsed}
      />
    </li>
  );
}

function EntitySummary({
  appState,
  entity,
  onEditEntity,
}: {
  appState: AppState;
  entity: Entity;
  onEditEntity?: (entity: Entity) => void;
}) {
  const status = getEntityInventoryStatus(entity, appState);

  return (
    <div className="entity-main">
      <div className="entity-card-heading">
        <div className="entity-card-title">
          <div>
            {onEditEntity ? (
              <button
                className="entity-title-button"
                type="button"
                onClick={() => onEditEntity(entity)}
              >
                {entity.name}
              </button>
            ) : (
              <h3>{entity.name}</h3>
            )}
            {!entity.active ? (
              <p className="entity-subtle-status">Inactive</p>
            ) : null}
          </div>
        </div>
        <EntityStatusSummary status={status} />
      </div>
    </div>
  );
}

type EntityInventoryStatus = {
  capacity?: string;
  movement?: string;
  validationIssues: ValidationIssue[];
  warningCount: number;
  warnings: EncumbranceWarning[];
};

const GENERIC_MISSING_BACKPACK_MESSAGE =
  "Character-like entities should have one top-level stowed container.";

function getDisplayValidationIssues(
  validationIssues: ValidationIssue[],
): ValidationIssue[] {
  return validationIssues.filter(
    (issue) =>
      !(
        issue.code === "missingBackpack" &&
        issue.message === GENERIC_MISSING_BACKPACK_MESSAGE
      ),
  );
}

function getEntityInventoryStatus(
  entity: Entity,
  appState: AppState,
): EntityInventoryStatus {
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
  const displayValidationIssues = getDisplayValidationIssues(validationIssues);
  const warningCount = warnings.length + displayValidationIssues.length;

  if (isCharacterLikeEntity(entity)) {
    const encumbrance = getCharacterEncumbrance(entity, appState.inventoryRecords);

    return {
      movement: formatMovementFeet(encumbrance.movement.explorationFeet),
      validationIssues: displayValidationIssues,
      warningCount,
      warnings,
    };
  }

  const capacity = getContentsCapacity(entity, appState.inventoryRecords);

  return {
    capacity: formatCapacity(capacity.usedSlots, capacity.capacitySlots),
    validationIssues: displayValidationIssues,
    warningCount,
    warnings,
  };
}

function EntityStatusSummary({ status }: { status: EntityInventoryStatus }) {
  if (!status.movement && status.warningCount === 0) {
    return null;
  }

  return (
    <div className="entity-status-summary">
      {status.movement ? <span>{status.movement}</span> : null}
      <WarningDetailsButton
        validationIssues={status.validationIssues}
        warnings={status.warnings}
      />
    </div>
  );
}

type PartyOverviewCard = {
  abilityScores: PartyAbilityScoreDisplay[];
  ac: string;
  id: EntityId;
  name: string;
  entityType: EntityType;
  classLevel: string;
  hp: string;
  hurt: boolean;
  movement: string;
  movementFeet: number;
  languages: string;
  hands: string[];
  validationIssues: ValidationIssue[];
  warningCount: number;
  warningSummary: string;
  warnings: EncumbranceWarning[];
};

type PartyAbilityScoreDisplay = {
  label: string;
  value: string;
};

function PartyPage({
  appState,
  sortedEntities,
}: {
  appState: AppState;
  sortedEntities: Entity[];
}) {
  const cards = getPartyOverviewCards(appState, sortedEntities);
  const movementFeet = cards.reduce(
    (slowestMovement, card) => Math.min(slowestMovement, card.movementFeet),
    Number.POSITIVE_INFINITY,
  );

  return (
    <section className="entity-workspace" aria-labelledby="party-title">
      <div className="section-heading">
        <div>
          <h2 id="party-title">
            Party {cards.length > 0 ? `(${formatMovementFeet(movementFeet)})` : ""}
          </h2>
          <p>Table-facing character and retainer status.</p>
        </div>
        <NavLink className="text-link-button" to="/inventory">
          Inventory
        </NavLink>
      </div>

      {cards.length === 0 ? (
        <p className="empty-state">No characters or retainers yet.</p>
      ) : (
        <ul className="party-card-grid" aria-label="Party overview">
          {cards.map((card) => (
            <li
              className="party-card"
              data-warning-state={card.warningCount > 0}
              key={card.id}
            >
              <div className="party-card-heading">
                <div>
                  <h3>{card.name}</h3>
                  <p>{card.classLevel}</p>
                </div>
                <div className="party-card-status">
                  <span>{card.movement}</span>
                  <WarningDetailsButton
                    validationIssues={card.validationIssues}
                    warnings={card.warnings}
                  />
                </div>
              </div>

              <div className="party-stat-grid">
                <span>HP {card.hp}</span>
                <span>{card.ac}</span>
              </div>

              <div className="party-ability-row" aria-label="Ability scores">
                {card.abilityScores.map((score) => (
                  <span key={score.label}>
                    <strong>{score.label}</strong>
                    {score.value}
                  </span>
                ))}
              </div>

              <div className="party-card-section">
                <span>Hands</span>
                <div className="party-hands-list">
                  {[0, 1].map((index) => (
                    <span key={index}>{card.hands[index] ?? "\u00a0"}</span>
                  ))}
                </div>
              </div>
              <div className="party-card-section">
                <span>Languages</span>
                <p>{card.languages}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function getPartyOverviewCards(
  appState: AppState,
  sortedEntities: Entity[] = getSortedEntities(appState.entities),
): PartyOverviewCard[] {
  const validationResult = validateInventoryState(
    appState.entities,
    appState.inventoryRecords,
  );

  return sortedEntities.filter(isCharacterLikeEntity).map((entity) => {
    const character = normalizeCharacterData(entity.character);
    const ownedRecords = getOwnedRecords(entity.id, appState.inventoryRecords);
    const sections = getInventorySections(entity, appState.inventoryRecords);
    const encumbrance = getCharacterEncumbrance(entity, appState.inventoryRecords);
    const warnings = getEncumbranceWarnings(entity, appState.inventoryRecords);
    const validationIssues = getDisplayValidationIssues([
      ...validationResult.errors,
      ...validationResult.warnings,
    ].filter(
      (issue) =>
        issue.entityId === entity.id ||
        (issue.recordId !== undefined &&
          ownedRecords.some((record) => record.id === issue.recordId)),
    ));

    return {
      id: entity.id,
      name: entity.name,
      entityType: entity.entityType,
      classLevel: formatPartyClassLevel(character),
      hp: formatPartyHp(character),
      hurt: isPartyMemberHurt(character),
      movement: formatMovementFeet(encumbrance.movement.explorationFeet),
      movementFeet: encumbrance.movement.explorationFeet,
      languages: formatPartyLanguages(character),
      hands:
        sections.mode === "characterLike"
          ? formatPartyHands(sections, appState.inventoryRecords)
          : [],
      abilityScores: formatPartyAbilityScores(character),
      ac: "AC 10",
      validationIssues,
      warningCount: warnings.length + validationIssues.length,
      warningSummary: formatWarningState(warnings, validationIssues),
      warnings,
    };
  });
}

function formatPartyClassLevel(character: CharacterData): string {
  const className = character.className.trim() || "No class";
  const alignment = formatPartyAlignment(character.alignment);
  const classLabel = alignment ? `${alignment} ${className}` : className;

  if (character.level === null) {
    return classLabel;
  }

  return `${classLabel} ${character.level}`;
}

function formatPartyAlignment(alignment: CharacterAlignment): string {
  switch (alignment) {
    case "Law":
      return "Lawful";
    case "Neutrality":
      return "Neutral";
    case "Chaos":
      return "Chaotic";
    case "":
      return "";
  }
}

function formatPartyHp(character: CharacterData): string {
  return `${formatNullablePartyNumber(character.hp.current)}/${formatNullablePartyNumber(
    character.hp.max,
  )}`;
}

function isPartyMemberHurt(character: CharacterData): boolean {
  return (
    character.hp.current !== null &&
    character.hp.max !== null &&
    character.hp.current < character.hp.max
  );
}

function formatPartyLanguages(character: CharacterData): string {
  return character.languages.length > 0 ? character.languages.join(", ") : "None";
}

function formatPartyAbilityScores(
  character: CharacterData,
): PartyAbilityScoreDisplay[] {
  const scores = character.abilityScores;

  return [
    { label: "S", value: formatNullablePartyNumber(scores.str) },
    { label: "I", value: formatNullablePartyNumber(scores.int) },
    { label: "W", value: formatNullablePartyNumber(scores.wis) },
    { label: "D", value: formatNullablePartyNumber(scores.dex) },
    { label: "C", value: formatNullablePartyNumber(scores.con) },
    { label: "Ch", value: formatNullablePartyNumber(scores.cha) },
  ];
}

function formatPartyHands(
  sections: ReturnType<typeof getInventorySections> & { mode: "characterLike" },
  records: InventoryRecord[],
): string[] {
  const bothHandsRecord = getRecordById(sections.handRecordIds.bothHands, records);

  if (bothHandsRecord) {
    return [`Both: ${getPartyRecordLabel(bothHandsRecord, records, true)}`];
  }

  const leftHandRecord = getRecordById(sections.handRecordIds.leftHand, records);
  const rightHandRecord = getRecordById(sections.handRecordIds.rightHand, records);

  return [
    `L: ${
      leftHandRecord ? getPartyRecordLabel(leftHandRecord, records, true) : "Empty"
    }`,
    `R: ${
      rightHandRecord
        ? getPartyRecordLabel(rightHandRecord, records, true)
        : "Empty"
    }`,
  ];
}

function getPartyRecordLabel(
  record: InventoryRecord,
  records: InventoryRecord[],
  includeStatuses = false,
): string {
  const display = getInventoryRowDisplay(record, records);
  const statuses = includeStatuses
    ? display.statusIcons.map((status) => `[${getInventoryRowStatusText(status)}]`)
    : [];

  return [display.primaryText, ...statuses].join(" ");
}

function formatNullablePartyNumber(value: number | null): string {
  return value === null ? "—" : value.toString();
}

function formatMovementFeet(feet: number): string {
  return `${feet}'`;
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
          {characterEntities.map((entity) => (
            <li
              className="entity-row character-page-row"
              data-inactive={!entity.active}
              key={entity.id}
            >
              <EntitySummary
                appState={appState}
                entity={entity}
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
          ))}
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

type ActiveDrag = { type: "record"; recordId: InventoryRecordId };

function getRecordZone(record: InventoryRecord): DragZone {
  return {
    entityId: record.entityId,
    placement: getLocationPlacementKey(record.location),
    ...("containerId" in record.location
      ? { containerId: record.location.containerId }
      : {}),
  };
}

function DragHandle({
  attributes,
  listeners,
  setActivatorNodeRef,
  label,
  icon,
  iconTone,
  className = "drag-handle",
}: {
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown> | undefined;
  setActivatorNodeRef?: (element: HTMLElement | null) => void;
  label: string;
  icon: ItemTypeIconName;
  iconTone: IconTone;
  className?: string;
}) {
  return (
    <button
      ref={setActivatorNodeRef}
      type="button"
      className={className}
      aria-label={label}
      {...attributes}
      {...listeners}
    >
      <ItemTypeIcon name={icon} tone={iconTone} />
    </button>
  );
}

function InventoryTypeIconMarker({ record }: { record: InventoryRecord }) {
  return (
    <span className="item-type-icon-marker" aria-hidden="true">
      <ItemTypeIcon
        name={getInventoryRecordTypeIcon(record)}
        tone={getInventoryRecordTypeIconTone(record)}
      />
    </span>
  );
}

function SortableRecordItem({
  record,
  index,
  zone,
  children,
}: {
  record: InventoryRecord;
  index: number;
  zone: DragZone;
  children: (handle: ReactNode) => ReactNode;
}) {
  const data: RecordDragData = {
    type: "record",
    kind: "item",
    recordId: record.id,
    zone,
    index,
  };
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: record.id, data });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };
  const handle = (
    <DragHandle
      attributes={attributes as unknown as Record<string, unknown>}
      listeners={listeners as unknown as Record<string, unknown> | undefined}
      setActivatorNodeRef={setActivatorNodeRef}
      label={`Reorder ${getRecordDisplayName(record)}`}
      icon={getInventoryRecordTypeIcon(record)}
      iconTone={getInventoryRecordTypeIconTone(record)}
    />
  );

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`record-list-item${isDragging ? " dragging" : ""}${isOver ? " drop-over" : ""}`}
      data-record-id={record.id}
    >
      {children(handle)}
    </li>
  );
}

function DraggableRecordItem({
  record,
  zone,
  children,
}: {
  record: InventoryRecord;
  zone: DragZone;
  children: (handle: ReactNode) => ReactNode;
}) {
  const data: RecordDragData = {
    type: "record",
    kind: "item",
    recordId: record.id,
    zone,
    index: 0,
  };
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: record.id, data });
  const style = {
    transform: CSS.Translate.toString(transform),
  };
  const handle = (
    <DragHandle
      attributes={attributes as unknown as Record<string, unknown>}
      listeners={listeners as unknown as Record<string, unknown> | undefined}
      setActivatorNodeRef={setActivatorNodeRef}
      label={`Move ${getRecordDisplayName(record)}`}
      icon={getInventoryRecordTypeIcon(record)}
      iconTone={getInventoryRecordTypeIconTone(record)}
    />
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`record-draggable${isDragging ? " dragging" : ""}`}
    >
      {children(handle)}
    </div>
  );
}

function GapDropZone({
  zone,
  index,
  empty = false,
}: {
  zone: DragZone;
  index: number;
  empty?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: gapDropId(zone, index),
    data: { type: "record", kind: "gap", zone, index },
  });

  if (empty) {
    return (
      <div
        ref={setNodeRef}
        className={`record-list-empty-drop-target${isOver ? " drop-over" : ""}`}
        data-drop-zone="empty-list"
      >
        <p className="empty-state compact">Empty</p>
      </div>
    );
  }

  return (
    <li
      ref={setNodeRef}
      className={`record-drop-zone${isOver ? " drop-over" : ""}`}
      aria-hidden="true"
      data-drop-zone="gap"
    />
  );
}

function SlotDropZone({
  entityId,
  placement,
  className,
  children,
}: {
  entityId: EntityId;
  placement: ReturnType<typeof getLocationPlacementKey>;
  className: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: slotDropId(entityId, placement),
    data: { type: "record", kind: "slot", entityId, placement },
  });

  return (
    <div
      ref={setNodeRef}
      className={className}
      data-drop-over={isOver}
    >
      {children}
    </div>
  );
}

function EntityDefaultDropZone({
  entityId,
  children,
}: {
  entityId: EntityId;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: entityDefaultDropId(entityId),
    data: { type: "record", kind: "entityDefault", entityId },
  });

  return (
    <div
      ref={setNodeRef}
      className={`entity-default-drop${isOver ? " drop-over" : ""}`}
    >
      {children}
    </div>
  );
}

function InventoryDisplay({
  entity,
  appState,
  collapsedContainerIds,
  onDeleteRecord,
  onEditRecord,
  onIdentifyRecord,
  onSpendCoins,
  onStartAddRecord,
  onToggleContainerCollapsed,
}: {
  entity: Entity;
  appState: AppState;
  collapsedContainerIds: Set<InventoryRecordId>;
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditRecord: (record: InventoryRecord) => void;
  onIdentifyRecord: (recordId: InventoryRecordId) => InventoryMutationResult;
  onSpendCoins: (record: InventoryRecord) => void;
  onStartAddRecord: (entity: Entity) => void;
  onToggleContainerCollapsed: (recordId: InventoryRecordId) => void;
}) {
  const sections = getInventorySections(entity, appState.inventoryRecords);

  return (
    <section className="inventory-display" aria-label={`${entity.name} inventory`}>
      <div className="inventory-toolbar">
        <button type="button" onClick={() => onStartAddRecord(entity)}>
          Add record
        </button>
      </div>

      {sections.mode === "characterLike" ? (
        <CharacterInventoryDisplay
          entityId={entity.id}
          sections={sections}
          records={appState.inventoryRecords}
          collapsedContainerIds={collapsedContainerIds}
          onDeleteRecord={onDeleteRecord}
          onEditRecord={onEditRecord}
          onIdentifyRecord={onIdentifyRecord}
          onSpendCoins={onSpendCoins}
          onToggleContainerCollapsed={onToggleContainerCollapsed}
        />
      ) : (
        <ContentsInventoryDisplay
          entityId={entity.id}
          contents={sections.contents}
          capacity={getContentsCapacity(entity, appState.inventoryRecords)}
          records={appState.inventoryRecords}
          collapsedContainerIds={collapsedContainerIds}
          onDeleteRecord={onDeleteRecord}
          onEditRecord={onEditRecord}
          onIdentifyRecord={onIdentifyRecord}
          onSpendCoins={onSpendCoins}
          onToggleContainerCollapsed={onToggleContainerCollapsed}
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
  entityId,
  sections,
  records,
  collapsedContainerIds,
  onDeleteRecord,
  onEditRecord,
  onIdentifyRecord,
  onSpendCoins,
  onToggleContainerCollapsed,
}: {
  entityId: EntityId;
  sections: ReturnType<typeof getInventorySections> & { mode: "characterLike" };
  records: InventoryRecord[];
  collapsedContainerIds: Set<InventoryRecordId>;
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditRecord: (record: InventoryRecord) => void;
  onIdentifyRecord: (recordId: InventoryRecordId) => InventoryMutationResult;
  onSpendCoins: (record: InventoryRecord) => void;
  onToggleContainerCollapsed: (recordId: InventoryRecordId) => void;
}) {
  const coinPurseZone: DragZone = { entityId, placement: "coinPurse" };

  return (
    <div className="inventory-sections">
      <InventorySection title="Equipped">
        <InventorySubsection title="Hands">
          <HandRows
            entityId={entityId}
            sections={sections}
            records={records}
            onEditRecord={onEditRecord}
            onIdentifyRecord={onIdentifyRecord}
            onSpendCoins={onSpendCoins}
          />
        </InventorySubsection>

        <InventorySubsection title="Other equipped">
          <RecordList
            zone={{ entityId, placement: "equippedLoose" }}
            records={sections.otherEquipped}
            allRecords={records}
            collapsedContainerIds={collapsedContainerIds}
            onDeleteRecord={onDeleteRecord}
            onEditRecord={onEditRecord}
            onIdentifyRecord={onIdentifyRecord}
            onSpendCoins={onSpendCoins}
            onToggleContainerCollapsed={onToggleContainerCollapsed}
          />
        </InventorySubsection>
      </InventorySection>

      <InventorySection title="Stowed">
        <InventorySubsection title="Coin purse">
          <SlotDropZone
            entityId={entityId}
            placement="coinPurse"
            className="coin-purse-slot"
          >
            {sections.coinRecord ? (
              <DraggableRecordItem
                record={sections.coinRecord}
                zone={coinPurseZone}
              >
                {(handle) => (
                  <CoinRecordRow
                    record={sections.coinRecord!}
                    dragHandle={handle}
                    onEditRecord={onEditRecord}
                    onSpendCoins={onSpendCoins}
                  />
                )}
              </DraggableRecordItem>
            ) : (
              <p className="empty-state compact">No coins</p>
            )}
          </SlotDropZone>
        </InventorySubsection>

        <InventorySubsection title="Stowed container">
          {sections.backpackRecord ? (
            <ContainerBlock
              entityId={entityId}
              containerRecord={sections.backpackRecord}
              records={records}
              nestedRecords={sections.backpackContents}
              collapsedContainerIds={collapsedContainerIds}
              onDeleteRecord={onDeleteRecord}
              onEditRecord={onEditRecord}
              onIdentifyRecord={onIdentifyRecord}
              onSpendCoins={onSpendCoins}
              onToggleContainerCollapsed={onToggleContainerCollapsed}
            />
          ) : (
            <p className="empty-state compact">Missing stowed container</p>
          )}
        </InventorySubsection>
      </InventorySection>
    </div>
  );
}

function ContentsInventoryDisplay({
  entityId,
  capacity,
  contents,
  records,
  collapsedContainerIds,
  onDeleteRecord,
  onEditRecord,
  onIdentifyRecord,
  onSpendCoins,
  onToggleContainerCollapsed,
}: {
  entityId: EntityId;
  capacity: ReturnType<typeof getContentsCapacity>;
  contents: InventoryRecord[];
  records: InventoryRecord[];
  collapsedContainerIds: Set<InventoryRecordId>;
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditRecord: (record: InventoryRecord) => void;
  onIdentifyRecord: (recordId: InventoryRecordId) => InventoryMutationResult;
  onSpendCoins: (record: InventoryRecord) => void;
  onToggleContainerCollapsed: (recordId: InventoryRecordId) => void;
}) {
  return (
    <div className="inventory-sections">
      <InventorySection
        title="Contents"
        meta={formatCapacity(capacity.usedSlots, capacity.capacitySlots)}
      >
        <RecordList
          zone={{ entityId, placement: "contents" }}
          records={contents}
          allRecords={records}
          collapsedContainerIds={collapsedContainerIds}
          onDeleteRecord={onDeleteRecord}
          onEditRecord={onEditRecord}
          onIdentifyRecord={onIdentifyRecord}
          onSpendCoins={onSpendCoins}
          onToggleContainerCollapsed={onToggleContainerCollapsed}
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
  const containerOptions = getContainerOptions({
    entity: targetEntity,
    isContainer: formState.isContainer,
    records: appState.inventoryRecords,
    editingRecordId: formState.recordId,
  });
  const placementOptions = getPlacementOptions({
    isContainer: formState.isContainer,
    recordType: formState.recordType,
    targetEntity,
    records: appState.inventoryRecords,
  }).filter(
    (placementOption) =>
      placementOption.value !== "container" || containerOptions.length > 0,
  );
  const showLocationControls = formState.showMovement;
  const showContainerSelect = formState.placement === "container";
  const showNonCoinFields = formState.recordType !== "coins";
  const showContainerFields =
    formState.recordType !== "coins" && formState.recordType !== "treasure";
  const showIdentificationFields =
    formState.recordType === "weapon" ||
    formState.recordType === "armor" ||
    formState.recordType === "equipment";
  const standardItemSuggestions = getStandardItemSuggestions(formState);
  const locationSummary = formatRecordFormLocationSummary({
    containerOptions,
    formState,
    placementOptions,
    targetEntity,
  });

  return (
    <form className="record-form" onSubmit={onSubmit}>
      <div className="record-form-heading">
        <div>
          <h4>{formState.mode === "edit" ? "Edit item" : "Add item"}</h4>
          {message ? <p className="form-error">{message}</p> : null}
        </div>
        {formState.mode === "edit" ? (
          <span className="record-type-badge">
            {RECORD_TYPE_LABELS[formState.recordType]}
          </span>
        ) : (
          <label className="record-type-select">
            <span>Type</span>
            <select
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
        )}
      </div>

      <div className="record-form-body">
        {formState.recordType === "coins" ? (
          <section className="record-form-section">
            <h5>Coins</h5>
            <div className="record-detail-grid four-column">
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
            </div>
          </section>
        ) : null}

        {showNonCoinFields ? (
          <>
            <section className="record-form-section">
              <h5>Basic</h5>
              <div className="record-basic-grid">
                <div className="autocomplete-field">
                  <label>
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
                  {standardItemSuggestions.length > 0 ? (
                    <div
                      className="autocomplete-suggestions"
                      aria-label="Standard item suggestions"
                    >
                      {standardItemSuggestions.map((item) => (
                        <button
                          key={item.slug}
                          type="button"
                          onClick={() => {
                            const input =
                              createInventoryRecordInputFromStandardItem(
                                item.slug,
                              );

                            if (input) {
                              onChange(
                                applyInventoryRecordInputToFormState(
                                  formState,
                                  input,
                                ),
                              );
                            }
                          }}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <NumberField
                  label="Quantity"
                  value={formState.quantity}
                  onChange={(value) =>
                    onChange({ ...formState, quantity: value })
                  }
                />
              </div>
            </section>

            <section className="record-form-section">
              <h5>Slots</h5>
              <div className="record-slots-grid">
                <NumberField
                  label={
                    formState.stackable ? "Items per slot" : "Slots per item"
                  }
                  step={formState.stackable ? "1" : "0.25"}
                  value={
                    formState.stackable
                      ? formState.itemsPerSlot
                      : formState.slotsPerItem
                  }
                  onChange={(value) =>
                    onChange(
                      formState.stackable
                        ? { ...formState, itemsPerSlot: value }
                        : { ...formState, slotsPerItem: value },
                    )
                  }
                />

                <label className="checkbox-field">
                  <input
                    checked={formState.stackable}
                    type="checkbox"
                    onChange={(event) =>
                      onChange({
                        ...formState,
                        stackable: event.target.checked,
                      })
                    }
                  />
                  <span>Stackable</span>
                </label>
              </div>
            </section>

            <section className="record-form-section">
              <label>
                <span>Description</span>
                <textarea
                  className="description-field"
                  maxLength={160}
                  rows={4}
                  value={formState.description}
                  onChange={(event) =>
                    onChange({ ...formState, description: event.target.value })
                  }
                />
              </label>
            </section>
          </>
        ) : null}

        {formState.recordType === "treasure" ? (
          <section className="record-form-section">
            <h5>Treasure details</h5>
            <div className="record-detail-grid two-column">
              <NumberField
                label="GP value"
                step="0.01"
                value={formState.gpValue}
                onChange={(value) =>
                  onChange({ ...formState, gpValue: value })
                }
              />
            </div>
          </section>
        ) : null}

        {formState.recordType === "weapon" ? (
          <section className="record-form-section">
            <h5>Weapon details</h5>
            <div className="record-detail-grid three-column">
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
            </div>
          </section>
        ) : null}

        {formState.recordType === "armor" ? (
          <section className="record-form-section">
            <h5>Armor details</h5>
            <div className="record-detail-grid two-column">
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
            </div>
          </section>
        ) : null}

        {showNonCoinFields ? (
          <section className="record-form-section">
            <h5>Traits</h5>
            <div className="record-traits-grid">
              {showContainerFields ? (
                <label className="checkbox-field">
                  <input
                    checked={formState.isContainer}
                    type="checkbox"
                    onChange={(event) =>
                      onChange({
                        ...formState,
                        isContainer: event.target.checked,
                      })
                    }
                  />
                  <span>Container</span>
                </label>
              ) : null}
              {showIdentificationFields ? (
                <label className="checkbox-field">
                  <input
                    checked={formState.isUnidentified}
                    type="checkbox"
                    onChange={(event) =>
                      onChange({
                        ...formState,
                        isUnidentified: event.target.checked,
                      })
                    }
                  />
                  <span>Unidentified</span>
                </label>
              ) : null}
              <label className="checkbox-field">
                <input
                  checked={formState.isLight}
                  type="checkbox"
                  onChange={(event) =>
                    onChange({
                      ...formState,
                      isLight: event.target.checked,
                      trackUses: event.target.checked,
                    })
                  }
                />
                <span>Light source</span>
              </label>
              {!formState.isLight ? (
                <label className="checkbox-field">
                  <input
                    checked={formState.trackUses}
                    type="checkbox"
                    onChange={(event) =>
                      onChange({
                        ...formState,
                        trackUses: event.target.checked,
                      })
                    }
                  />
                  <span>Track uses / charges</span>
                </label>
              ) : null}
            </div>
          </section>
        ) : null}

        {formState.isContainer && showContainerFields ? (
          <section className="record-form-section">
            <h5>Container details</h5>
            <div className="record-detail-grid three-column">
              <NumberField
                label="Container capacity"
                step="0.25"
                value={formState.capacitySlots}
                onChange={(value) =>
                  onChange({ ...formState, capacitySlots: value })
                }
              />
              <label>
                <span>Hands required to carry</span>
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
            </div>
          </section>
        ) : null}

        {formState.isUnidentified && showIdentificationFields ? (
          <section className="record-form-section">
            <h5>Identification details</h5>
            <div className="record-detail-grid two-column">
              <label>
                <span>Secret name</span>
                <input
                  autoComplete="off"
                  maxLength={100}
                  type="text"
                  value={formState.secretName}
                  onChange={(event) =>
                    onChange({
                      ...formState,
                      secretName: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>Secret description</span>
                <input
                  autoComplete="off"
                  maxLength={160}
                  type="text"
                  value={formState.secretDescription}
                  onChange={(event) =>
                    onChange({
                      ...formState,
                      secretDescription: event.target.value,
                    })
                  }
                />
              </label>
            </div>
          </section>
        ) : null}

        {formState.isLight && showNonCoinFields ? (
          <section className="record-form-section">
            <h5>Light source details</h5>
            <div className="record-detail-grid four-column">
              <label className="wide-field">
                <span>Light description</span>
                <input
                  autoComplete="off"
                  maxLength={120}
                  type="text"
                  value={formState.lightDescription}
                  onChange={(event) =>
                    onChange({
                      ...formState,
                      lightDescription: event.target.value,
                    })
                  }
                />
              </label>
              <label className="checkbox-field">
                <input
                  checked={formState.isLit}
                  type="checkbox"
                  onChange={(event) =>
                    onChange({ ...formState, isLit: event.target.checked })
                  }
                />
                <span>Currently lit</span>
              </label>
              <NumberField
                label="Current uses"
                value={formState.usesCurrent}
                onChange={(value) =>
                  onChange({ ...formState, usesCurrent: value })
                }
              />
              <NumberField
                label="Max uses"
                value={formState.usesMax}
                onChange={(value) =>
                  onChange({ ...formState, usesMax: value })
                }
              />
            </div>
          </section>
        ) : null}

        {formState.trackUses && !formState.isLight && showNonCoinFields ? (
          <section className="record-form-section">
            <h5>Uses / charges</h5>
            <div className="record-detail-grid two-column">
              <NumberField
                label="Current uses"
                value={formState.usesCurrent}
                onChange={(value) =>
                  onChange({ ...formState, usesCurrent: value })
                }
              />
              <NumberField
                label="Max uses"
                value={formState.usesMax}
                onChange={(value) =>
                  onChange({ ...formState, usesMax: value })
                }
              />
            </div>
          </section>
        ) : null}

        {showNonCoinFields ? (
          <section className="record-form-section">
            <h5>Modifiers</h5>
            <label className="checkbox-field">
              <input
                checked={formState.addModifiers}
                type="checkbox"
                onChange={(event) =>
                  onChange({
                    ...formState,
                    addModifiers: event.target.checked,
                  })
                }
              />
              <span>This item modifies a stat</span>
            </label>
            {formState.addModifiers ? (
              <div className="modifier-list">
                {formState.modifiers.map((modifierRow) => (
                  <div className="modifier-row" key={modifierRow.id}>
                    <label>
                      <span>Target</span>
                      <select
                        value={modifierRow.target}
                        onChange={(event) =>
                          onChange({
                            ...formState,
                            modifiers: formState.modifiers.map(
                              (candidateRow) =>
                                candidateRow.id === modifierRow.id
                                  ? {
                                      ...candidateRow,
                                      target: event.target.value,
                                    }
                                  : candidateRow,
                            ),
                          })
                        }
                      >
                        {MODIFIER_TARGET_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <NumberField
                      label="Value"
                      min="-99"
                      value={modifierRow.value}
                      onChange={(value) =>
                        onChange({
                          ...formState,
                          modifiers: formState.modifiers.map((candidateRow) =>
                            candidateRow.id === modifierRow.id
                              ? { ...candidateRow, value }
                              : candidateRow,
                          ),
                        })
                      }
                    />
                    <label>
                      <span>Label</span>
                      <input
                        autoComplete="off"
                        maxLength={80}
                        type="text"
                        value={modifierRow.label}
                        onChange={(event) =>
                          onChange({
                            ...formState,
                            modifiers: formState.modifiers.map(
                              (candidateRow) =>
                                candidateRow.id === modifierRow.id
                                  ? {
                                      ...candidateRow,
                                      label: event.target.value,
                                    }
                                  : candidateRow,
                            ),
                          })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...formState,
                          modifiers: formState.modifiers.filter(
                            (candidateRow) =>
                              candidateRow.id !== modifierRow.id,
                          ),
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...formState,
                      modifiers: [
                        ...formState.modifiers,
                        createEmptyModifierFormRow(),
                      ],
                    })
                  }
                >
                  Add modifier
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {formState.recordType === "weapon" ? (
          <section className="record-form-section">
            <h5>Weapon qualities</h5>
            <label className="checkbox-field">
              <input
                checked={formState.addWeaponQualities}
                type="checkbox"
                onChange={(event) =>
                  onChange({
                    ...formState,
                    addWeaponQualities: event.target.checked,
                  })
                }
              />
              <span>Add weapon qualities</span>
            </label>
            {formState.addWeaponQualities ? (
              <label>
                <span>Qualities</span>
                <input
                  autoComplete="off"
                  maxLength={160}
                  type="text"
                  value={formState.qualities}
                  onChange={(event) =>
                    onChange({ ...formState, qualities: event.target.value })
                  }
                />
              </label>
            ) : null}
          </section>
        ) : null}

        {showNonCoinFields ? (
          <section className="record-form-section">
            <h5>Private / GM notes</h5>
            <label className="checkbox-field">
              <input
                checked={formState.notesEnabled}
                type="checkbox"
                onChange={(event) =>
                  onChange({
                    ...formState,
                    notesEnabled: event.target.checked,
                  })
                }
              />
              <span>Add GM notes</span>
            </label>
            {formState.notesEnabled ? (
              <label>
                <span>GM notes</span>
                <textarea
                  maxLength={1000}
                  rows={3}
                  value={formState.notes}
                  onChange={(event) =>
                    onChange({ ...formState, notes: event.target.value })
                  }
                />
              </label>
            ) : null}
          </section>
        ) : null}

        <section className="record-form-section">
          <div className="record-location-heading">
            <div>
              <h5>Location</h5>
              <p>Currently: {locationSummary}</p>
            </div>
            {!formState.showMovement ? (
              <button
                type="button"
                onClick={() => onChange({ ...formState, showMovement: true })}
              >
                Move item...
              </button>
            ) : null}
          </div>
          {showLocationControls ? (
            <div className="record-location-controls">
              <label>
                <span>Owner / Holder</span>
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
                  {getSortedEntities(appState.entities).map(
                    (candidateEntity) => (
                      <option
                        key={candidateEntity.id}
                        value={candidateEntity.id}
                      >
                        {candidateEntity.name}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label>
                <span>Location</span>
                <select
                  value={formState.placement}
                  onChange={(event) =>
                    onChange({
                      ...formState,
                      placement: event.target
                        .value as InventoryRecordPlacementKey,
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
              {showContainerSelect ? (
                <label>
                  <span>Container</span>
                  <select
                    required
                    value={formState.containerId}
                    onChange={(event) =>
                      onChange({
                        ...formState,
                        containerId: event.target.value,
                      })
                    }
                  >
                    <option value="">Select container</option>
                    {containerOptions.map((containerRecord) => (
                      <option
                        key={containerRecord.id}
                        value={containerRecord.id}
                      >
                        {getRecordDisplayName(containerRecord)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>

      <div className="record-form-actions">
        <div>
          {onDelete ? (
            <button className="danger-button" type="button" onClick={onDelete}>
              Delete
            </button>
          ) : null}
        </div>
        <div className="record-form-action-group">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit">
            {formState.mode === "edit" ? "Save record" : "Create record"}
          </button>
        </div>
      </div>
    </form>
  );
}

function CoinSpendModal({
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
        <form className="record-form" onSubmit={onSubmit}>
          <div className="record-form-heading">
            <h4>Spend Coins</h4>
            {message ? <p className="form-error">{message}</p> : null}
          </div>

          <div className="coin-spend-layout">
            <section className="coin-spend-section">
              <h5>Spend amount</h5>
              <div className="coin-spend-grid">
                <div className="coin-spend-heading">Denomination</div>
                <div className="coin-spend-heading">Available</div>
                <div className="coin-spend-heading">Spend</div>
                {COIN_DENOMINATIONS.map((denomination) => (
                  <CoinSpendRow
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

          <div className="record-form-actions">
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

function CoinSpendRow({
  available,
  denomination,
  onChange,
  value,
}: {
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
        aria-label={`Spend ${denomination}`}
        min="0"
        step="1"
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </>
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
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="inventory-section">
      <div className="inventory-section-heading">
        <h4>{title}</h4>
        {meta ? <span>{meta}</span> : null}
      </div>
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

function HandRows({
  entityId,
  sections,
  records,
  onEditRecord,
  onIdentifyRecord,
  onSpendCoins,
}: {
  entityId: EntityId;
  sections: ReturnType<typeof getInventorySections> & { mode: "characterLike" };
  records: InventoryRecord[];
  onEditRecord: (record: InventoryRecord) => void;
  onIdentifyRecord: (recordId: InventoryRecordId) => InventoryMutationResult;
  onSpendCoins: (record: InventoryRecord) => void;
}) {
  const bothHandsRecord = getRecordById(sections.handRecordIds.bothHands, records);

  if (bothHandsRecord) {
    return (
      <div className="hand-rows">
        <HandRow
          entityId={entityId}
          placement="bothHands"
          label="Both"
          record={bothHandsRecord}
          records={records}
          doubleHeight
          onEditRecord={onEditRecord}
          onIdentifyRecord={onIdentifyRecord}
          onSpendCoins={onSpendCoins}
        />
      </div>
    );
  }

  return (
    <div className="hand-rows">
      <HandRow
        entityId={entityId}
        placement="leftHand"
        label="Left"
        record={getRecordById(sections.handRecordIds.leftHand, records)}
        records={records}
        onEditRecord={onEditRecord}
        onIdentifyRecord={onIdentifyRecord}
        onSpendCoins={onSpendCoins}
      />
      <HandRow
        entityId={entityId}
        placement="rightHand"
        label="Right"
        record={getRecordById(sections.handRecordIds.rightHand, records)}
        records={records}
        onEditRecord={onEditRecord}
        onIdentifyRecord={onIdentifyRecord}
        onSpendCoins={onSpendCoins}
      />
    </div>
  );
}

function HandRow({
  entityId,
  placement,
  doubleHeight = false,
  label,
  record,
  records,
  onEditRecord,
  onIdentifyRecord,
  onSpendCoins,
}: {
  entityId: EntityId;
  placement: "leftHand" | "rightHand" | "bothHands";
  doubleHeight?: boolean;
  label: string;
  record?: InventoryRecord;
  records: InventoryRecord[];
  onEditRecord?: (record: InventoryRecord) => void;
  onIdentifyRecord?: (recordId: InventoryRecordId) => InventoryMutationResult;
  onSpendCoins?: (record: InventoryRecord) => void;
}) {
  return (
    <SlotDropZone
      entityId={entityId}
      placement={placement}
      className={`hand-row${doubleHeight ? " hand-row-double" : ""}`}
    >
      <span className="hand-row-label">{label}</span>
      {record ? (
        <DraggableRecordItem record={record} zone={{ entityId, placement }}>
          {(handle) => (
            <div
              className="record-row record-drop-surface hand-record-card"
              data-record-id={record.id}
            >
              {handle}
              <InventoryRowSummary
                record={record}
                allRecords={records}
                onOpenRecord={onEditRecord}
              />
              {onSpendCoins && record.recordType === "coins" ? (
                <button
                  className="compact-row-action"
                  type="button"
                  onClick={() => onSpendCoins(record)}
                >
                  Spend
                </button>
              ) : null}
              {onIdentifyRecord && canIdentifyRecord(record) ? (
                <button
                  className="compact-row-action"
                  type="button"
                  onClick={() => onIdentifyRecord(record.id)}
                >
                  Identify
                </button>
              ) : null}
            </div>
          )}
        </DraggableRecordItem>
      ) : (
        <span className="hand-row-empty">Empty</span>
      )}
    </SlotDropZone>
  );
}

function RecordList({
  zone,
  records,
  allRecords,
  collapsedContainerIds,
  onDeleteRecord,
  onEditRecord,
  onIdentifyRecord,
  onSpendCoins,
  onToggleContainerCollapsed,
}: {
  zone: DragZone;
  records: InventoryRecord[];
  allRecords: InventoryRecord[];
  collapsedContainerIds: Set<InventoryRecordId>;
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditRecord: (record: InventoryRecord) => void;
  onIdentifyRecord: (recordId: InventoryRecordId) => InventoryMutationResult;
  onSpendCoins: (record: InventoryRecord) => void;
  onToggleContainerCollapsed: (recordId: InventoryRecordId) => void;
}) {
  if (records.length === 0) {
    return <GapDropZone zone={zone} index={0} empty />;
  }

  return (
    <ul className="record-list" data-drop-zone="record-list">
      <SortableContext
        items={records.map((record) => record.id)}
        strategy={verticalListSortingStrategy}
      >
        <GapDropZone zone={zone} index={0} />
        {records.map((record, index) => (
          <Fragment key={record.id}>
            <SortableRecordItem record={record} index={index} zone={zone}>
              {(handle) => (
                <RecordRow
                  record={record}
                  dragHandle={handle}
                  allRecords={allRecords}
                  collapsedContainerIds={collapsedContainerIds}
                  onDeleteRecord={onDeleteRecord}
                  onEditRecord={onEditRecord}
                  onIdentifyRecord={onIdentifyRecord}
                  onSpendCoins={onSpendCoins}
                  onToggleContainerCollapsed={onToggleContainerCollapsed}
                />
              )}
            </SortableRecordItem>
            <GapDropZone zone={zone} index={index + 1} />
          </Fragment>
        ))}
      </SortableContext>
    </ul>
  );
}

function RecordRow({
  record,
  dragHandle,
  allRecords,
  collapsedContainerIds,
  onDeleteRecord,
  onEditRecord,
  onIdentifyRecord,
  onSpendCoins,
  onToggleContainerCollapsed,
}: {
  record: InventoryRecord;
  dragHandle?: ReactNode;
  allRecords: InventoryRecord[];
  collapsedContainerIds: Set<InventoryRecordId>;
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditRecord: (record: InventoryRecord) => void;
  onIdentifyRecord: (recordId: InventoryRecordId) => InventoryMutationResult;
  onSpendCoins: (record: InventoryRecord) => void;
  onToggleContainerCollapsed: (recordId: InventoryRecordId) => void;
}) {
  if (record.recordType === "coins") {
    return (
      <CoinRecordRow
        record={record}
        dragHandle={dragHandle}
        onEditRecord={onEditRecord}
        onSpendCoins={onSpendCoins}
      />
    );
  }

  if (record.container) {
    return (
      <ContainerBlock
        entityId={record.entityId}
        containerRecord={record}
        dragHandle={dragHandle}
        records={allRecords}
        nestedRecords={getContainerContents(record, allRecords)}
        collapsedContainerIds={collapsedContainerIds}
        onDeleteRecord={onDeleteRecord}
        onEditRecord={onEditRecord}
        onIdentifyRecord={onIdentifyRecord}
        onSpendCoins={onSpendCoins}
        onToggleContainerCollapsed={onToggleContainerCollapsed}
      />
    );
  }

  return (
    <div className="record-row record-drop-surface" data-record-id={record.id}>
      {dragHandle ?? <InventoryTypeIconMarker record={record} />}
      <InventoryRowSummary
        record={record}
        allRecords={allRecords}
        onOpenRecord={onEditRecord}
      />
      {canIdentifyRecord(record) ? (
        <button
          className="compact-row-action"
          type="button"
          onClick={() => onIdentifyRecord(record.id)}
        >
          Identify
        </button>
      ) : null}
    </div>
  );
}

/**
 * Droppable wrapper for a container header that is not itself a sortable item
 * (e.g. the stowed-root backpack). Dropping onto it appends inside the container.
 */
function ContainerHeaderDrop({
  entityId,
  containerId,
  children,
}: {
  entityId: EntityId;
  containerId: InventoryRecordId;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `container-header__${containerId}`,
    data: {
      type: "record",
      kind: "container",
      entityId,
      containerId,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`container-header-drop${isOver ? " drop-over" : ""}`}
    >
      {children}
    </div>
  );
}

function ContainerBlock({
  entityId,
  containerRecord,
  dragHandle,
  records,
  nestedRecords,
  collapsedContainerIds,
  onDeleteRecord,
  onEditRecord,
  onIdentifyRecord,
  onSpendCoins,
  onToggleContainerCollapsed,
}: {
  entityId: EntityId;
  containerRecord: InventoryRecord;
  dragHandle?: ReactNode;
  records: InventoryRecord[];
  nestedRecords: InventoryRecord[];
  collapsedContainerIds: Set<InventoryRecordId>;
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditRecord: (record: InventoryRecord) => void;
  onIdentifyRecord: (recordId: InventoryRecordId) => InventoryMutationResult;
  onSpendCoins: (record: InventoryRecord) => void;
  onToggleContainerCollapsed: (recordId: InventoryRecordId) => void;
}) {
  const isCollapsed = collapsedContainerIds.has(containerRecord.id);
  const collapseLabel = isCollapsed ? "Expand" : "Collapse";

  const headerRow = (
    <div
      className="record-row record-drop-surface container-header-row"
      data-record-id={containerRecord.id}
    >
      {dragHandle ?? <InventoryTypeIconMarker record={containerRecord} />}
      <button
        className="container-toggle"
        type="button"
        aria-label={`${collapseLabel} ${getRecordDisplayName(containerRecord)}`}
        aria-expanded={!isCollapsed}
        onClick={() => onToggleContainerCollapsed(containerRecord.id)}
      >
        {isCollapsed ? "+" : "-"}
      </button>
      <InventoryRowSummary
        record={containerRecord}
        allRecords={records}
        extraStatusIcons={
          isCollapsed
            ? getCollapsedContainerStatusIcons(containerRecord, records)
            : undefined
        }
        onOpenRecord={onEditRecord}
      />
      {canIdentifyRecord(containerRecord) ? (
        <button
          className="compact-row-action"
          type="button"
          onClick={() => onIdentifyRecord(containerRecord.id)}
        >
          Identify
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="container-block" data-container-record-id={containerRecord.id}>
      <ContainerHeaderDrop entityId={entityId} containerId={containerRecord.id}>
        {headerRow}
      </ContainerHeaderDrop>
      {isCollapsed ? null : (
        <div className="container-contents">
          <RecordList
            zone={{
              entityId,
              placement: "container",
              containerId: containerRecord.id,
            }}
            records={nestedRecords}
            allRecords={records}
            collapsedContainerIds={collapsedContainerIds}
            onDeleteRecord={onDeleteRecord}
            onEditRecord={onEditRecord}
            onIdentifyRecord={onIdentifyRecord}
            onSpendCoins={onSpendCoins}
            onToggleContainerCollapsed={onToggleContainerCollapsed}
          />
        </div>
      )}
    </div>
  );
}

function CoinRecordRow({
  record,
  dragHandle,
  onEditRecord,
  onSpendCoins,
}: {
  record: InventoryRecord;
  dragHandle?: ReactNode;
  onEditRecord: (record: InventoryRecord) => void;
  onSpendCoins: (record: InventoryRecord) => void;
}) {
  if (record.recordType !== "coins") {
    return null;
  }

  return (
    <div className="record-row record-drop-surface" data-record-id={record.id}>
      {dragHandle ?? <InventoryTypeIconMarker record={record} />}
      <InventoryRowSummary
        record={record}
        allRecords={[record]}
        onOpenRecord={onEditRecord}
      />
      <button
        className="compact-row-action"
        type="button"
        onClick={() => onSpendCoins(record)}
      >
        Spend
      </button>
    </div>
  );
}

function InventoryRowSummary({
  record,
  allRecords,
  extraStatusIcons,
  onOpenRecord,
}: {
  record: InventoryRecord;
  allRecords: InventoryRecord[];
  extraStatusIcons?: InventoryRowStatus[];
  onOpenRecord?: (record: InventoryRecord) => void;
}) {
  const display = getInventoryRowDisplay(record, allRecords);
  const statusIcons = getUniqueInventoryRowStatuses([
    ...display.statusIcons,
    ...(extraStatusIcons ?? []),
  ]);

  return (
    <div className="record-summary">
      <div className="record-summary-main">
        {onOpenRecord ? (
          <button
            className="record-title-button"
            type="button"
            onClick={() => onOpenRecord(record)}
          >
            {display.primaryText}
          </button>
        ) : (
          <strong>{display.primaryText}</strong>
        )}
        {statusIcons.map((status) => (
          <span
            className="record-status-icon"
            key={status}
            title={getInventoryRowStatusTitle(status)}
          >
            <ItemStatusIcon
              name={getInventoryRowStatusIcon(status)}
              tone={getInventoryRowStatusTone(status)}
            />
          </span>
        ))}
        {display.secondaryText ? (
          <span className="record-secondary">· {display.secondaryText}</span>
        ) : null}
      </div>
      <span className="record-right-meta">{display.rightText}</span>
    </div>
  );
}

const INVENTORY_ROW_STATUS_ORDER: InventoryRowStatus[] = [
  "lit",
  "unidentified",
  "activeAc",
  "overCapacity",
];

function getCollapsedContainerStatusIcons(
  containerRecord: InventoryRecord,
  records: InventoryRecord[],
): InventoryRowStatus[] {
  const descendantStatuses = getContainerDescendantRecords(
    containerRecord,
    records,
  ).flatMap((record) => getInventoryRowDisplay(record, records).statusIcons);

  return getUniqueInventoryRowStatuses(descendantStatuses);
}

function getContainerDescendantRecords(
  containerRecord: InventoryRecord,
  records: InventoryRecord[],
  visitedContainerIds = new Set<InventoryRecordId>(),
): InventoryRecord[] {
  if (visitedContainerIds.has(containerRecord.id)) {
    return [];
  }

  visitedContainerIds.add(containerRecord.id);

  return getContainerContents(containerRecord, records).flatMap((record) => [
    record,
    ...(record.container
      ? getContainerDescendantRecords(record, records, visitedContainerIds)
      : []),
  ]);
}

function getUniqueInventoryRowStatuses(
  statuses: InventoryRowStatus[],
): InventoryRowStatus[] {
  const statusSet = new Set(statuses);

  return INVENTORY_ROW_STATUS_ORDER.filter((status) => statusSet.has(status));
}

function getInventoryRowStatusIcon(
  status: InventoryRowStatus,
): ItemStatusIconName {
  switch (status) {
    case "lit":
      return "lit";
    case "unidentified":
      return "unidentified";
    case "activeAc":
      return "activeAc";
    case "overCapacity":
      return "overCapacity";
  }
}

function getInventoryRowStatusTone(status: InventoryRowStatus): IconTone {
  switch (status) {
    case "lit":
      return "lit";
    case "unidentified":
      return "unidentified";
    case "activeAc":
      return "active";
    case "overCapacity":
      return "critical";
  }
}

function getInventoryRowStatusTitle(status: InventoryRowStatus): string {
  switch (status) {
    case "lit":
      return "Light source is lit";
    case "unidentified":
      return "Unidentified item";
    case "activeAc":
      return "Contributes to armor class";
    case "overCapacity":
      return "Container is over capacity";
  }
}

function getInventoryRowStatusText(status: InventoryRowStatus): string {
  switch (status) {
    case "lit":
      return "lit";
    case "unidentified":
      return "unidentified";
    case "activeAc":
      return "active AC";
    case "overCapacity":
      return "over capacity";
  }
}

function getInventoryRecordTypeIcon(record: InventoryRecord): ItemTypeIconName {
  if (record.recordType === "coins") {
    return "coins";
  }

  if (record.recordType === "treasure") {
    return "treasure";
  }

  if (record.recordType === "weapon") {
    return "weapon";
  }

  if (record.recordType === "armor") {
    return "armor";
  }

  if (record.container) {
    return "container";
  }

  if (record.light) {
    return "light";
  }

  return "equipment";
}

function getInventoryRecordTypeIconTone(record: InventoryRecord): IconTone {
  return isMagicInventoryRecord(record) ? "magic" : "muted";
}

function isMagicInventoryRecord(record: InventoryRecord): boolean {
  if (record.modifiers && record.modifiers.length > 0) {
    return true;
  }

  if (
    record.recordType === "weapon" &&
    record.weapon.qualities?.some((quality) => quality.toLowerCase() === "magic")
  ) {
    return true;
  }

  return record.recordType === "armor" && (record.armor.armorBonus ?? 0) > 0;
}

function WarningDetailsButton({
  validationIssues,
  warnings,
}: {
  validationIssues: ValidationIssue[];
  warnings: EncumbranceWarning[];
}) {
  const warningCount = validationIssues.length + warnings.length;

  if (warningCount === 0) {
    return null;
  }

  const messages = [...validationIssues, ...warnings].map(
    (warning) => warning.message,
  );
  const severity = getWarningDisplaySeverity(validationIssues, warnings);
  const warningIcon = getWarningDetailsIcon(validationIssues, warnings);

  return (
    <details className="warning-details" data-severity={severity}>
      <summary
        title={messages.join("\n")}
        aria-label={`${formatWarningState(warnings, validationIssues)}: ${messages.join(
          " ",
        )}`}
      >
        <ItemStatusIcon name={warningIcon.name} tone={warningIcon.tone} />
      </summary>
      <div className="warning-details-panel">
        <ul>
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function getWarningDetailsIcon(
  validationIssues: ValidationIssue[],
  warnings: EncumbranceWarning[],
): { name: ItemStatusIconName; tone: IconTone } {
  if (warnings.some((warning) => warning.code === "entityOverloaded")) {
    return { name: "overloaded", tone: "critical" };
  }

  if (warnings.some((warning) => warning.code === "containerOverCapacity")) {
    return { name: "overCapacity", tone: "critical" };
  }

  if (
    warnings.some(
      (warning) => warning.code === "handsRequiredContainerNotHeld",
    )
  ) {
    return { name: "containerNotHeld", tone: "critical" };
  }

  if (
    validationIssues.some((issue) => issue.code === "missingBackpack") ||
    warnings.some((warning) => warning.code === "missingBackpack")
  ) {
    return { name: "missingStowedContainer", tone: "warning" };
  }

  return getWarningDisplaySeverity(validationIssues, warnings) === "error"
    ? { name: "overloaded", tone: "critical" }
    : { name: "missingStowedContainer", tone: "warning" };
}

function getWarningDisplaySeverity(
  validationIssues: ValidationIssue[],
  warnings: EncumbranceWarning[],
): "error" | "warning" {
  return validationIssues.some((issue) => issue.severity === "error") ||
    warnings.some((warning) =>
      [
        "containerOverCapacity",
        "handsRequiredContainerNotHeld",
        "entityOverloaded",
      ].includes(warning.code),
    )
    ? "error"
    : "warning";
}

function AuditLogPanel({
  appState,
  entityFilter,
  eventTypeFilter,
  onEntityFilterChange,
  onEventTypeFilterChange,
  titleId = "audit-title",
}: {
  appState: AppState;
  entityFilter: EntityId | "all";
  eventTypeFilter: AuditEventType | "all";
  onEntityFilterChange: (entityId: EntityId | "all") => void;
  onEventTypeFilterChange: (eventType: AuditEventType | "all") => void;
  titleId?: string;
}) {
  const filteredEntries = getFilteredAuditLogEntries(
    appState.auditLog,
    entityFilter,
    eventTypeFilter,
  );

  return (
    <section className="audit-panel" aria-labelledby={titleId}>
      <div className="section-heading">
        <div>
          <h2 id={titleId}>Audit Log</h2>
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
            <AuditLogRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AuditLogRow({ entry }: { entry: AuditLogEntry }) {
  const display = getAuditEntryDisplay(entry);

  return (
    <li className="audit-entry">
      <div className="audit-entry-body">
        <p className="audit-entry-summary">{display.summary}</p>
        <p className="audit-entry-meta">
          <time dateTime={entry.createdAt}>{display.timestamp}</time>
          {display.metaLabels.length > 0 ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{display.metaLabels.join(" · ")}</span>
            </>
          ) : null}
        </p>
      </div>
    </li>
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

export function parseImportedAppState(value: unknown): AppState | undefined {
  const directAppState = parseAppState(value);

  if (directAppState) {
    return directAppState;
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidateExport = value as Partial<AppStateExport>;

  if (candidateExport.version !== 1 || !("data" in candidateExport)) {
    return undefined;
  }

  return parseAppState(candidateExport.data);
}

function formatExportDate(date: Date): string {
  return date.toISOString().slice(0, 10);
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

function formatRecordCount(count: number) {
  return count === 1 ? "1 record" : `${count} records`;
}

function formatAuditEntryCount(count: number) {
  return count === 1 ? "1 entry" : `${count} entries`;
}

export function getRecordDisplayName(record: InventoryRecord) {
  if (record.recordType === "coins") {
    return "Coins";
  }

  return record.name;
}

function canIdentifyRecord(record: InventoryRecord): boolean {
  if (record.recordType === "coins" || record.recordType === "treasure") {
    return false;
  }

  return (
    record.identification?.identified === false &&
    (Boolean(record.identification.secretName?.trim()) ||
      Boolean(record.identification.secretDescription?.trim()))
  );
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

  if (record.container && record.location.kind === "stowedRoot") {
    return `Confirm delete stowed container "${displayName}" with ${formatSlots(
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

function formatCoinDenominations(record: InventoryRecord) {
  if (record.recordType !== "coins") {
    return "Coins";
  }

  return formatCoinDenominationsValue(record.coins);
}

function createEmptyCoinSpendAmounts(): Record<CoinDenomination, string> {
  return {
    pp: "",
    gp: "",
    sp: "",
    cp: "",
  };
}

function toCoinSpendAmounts(
  amounts: Record<CoinDenomination, string>,
): Partial<CoinData> {
  return {
    pp: toCoinSpendNumber(amounts.pp),
    gp: toCoinSpendNumber(amounts.gp),
    sp: toCoinSpendNumber(amounts.sp),
    cp: toCoinSpendNumber(amounts.cp),
  };
}

function getCoinSpendValidationMessage(
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

function toCoinSpendNumber(value: string): number {
  return value.trim().length === 0 ? 0 : Number(value);
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

export function getAuditEntryDisplay(entry: AuditLogEntry) {
  const metaLabels = [getAuditEventTypeLabel(entry.eventType)];

  if (entry.actorLabel !== DEFAULT_AUDIT_ACTOR_LABEL) {
    metaLabels.push(entry.actorLabel);
  }

  return {
    summary: entry.summary,
    timestamp: formatAuditTimestamp(entry.createdAt),
    metaLabels,
  };
}

function formatAuditTimestamp(createdAt: string): string {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return createdAt;
  }

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
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

function createFormRowId(prefix: "feature" | "modifier" | "skill"): string {
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
    stackable: false,
    quantity: "1",
    slotsPerItem: "1",
    itemsPerSlot: "1",
    showMovement: false,
    isContainer: false,
    capacitySlots: "0",
    handsRequired: "0",
    isUnidentified: false,
    secretName: "",
    secretDescription: "",
    isLight: false,
    lightDescription: "",
    isLit: false,
    trackUses: false,
    usesCurrent: "0",
    usesMax: "",
    addModifiers: false,
    modifiers: [createEmptyModifierFormRow()],
    notesEnabled: false,
    notes: "",
    addWeaponQualities: false,
    qualities: "",
  };
}

function createRecordFormFromRecord(record: InventoryRecord): RecordFormState {
  const baseForm = createEmptyRecordForm({
    id: record.entityId,
    name: "",
    entityType: "character",
    active: true,
    sortOrder: 0,
  });
  const slotState = getRecordFormSlotState(record);

  return {
    ...baseForm,
    mode: "edit",
    entityId: record.entityId,
    recordId: record.id,
    recordType: record.recordType,
    targetEntityId: record.entityId,
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
    showMovement: isRecordLocationIncomplete(record),
    isContainer: Boolean(record.container),
    capacitySlots: record.container?.capacitySlots.toString() ?? "0",
    handsRequired: getRecordHandsRequired(record).toString() as
      | "0"
      | "1"
      | "2",
    isUnidentified: record.identification?.identified === false,
    secretName: record.identification?.secretName ?? "",
    secretDescription: record.identification?.secretDescription ?? "",
    isLight: Boolean(record.light),
    lightDescription: record.light?.lightDescription ?? "",
    isLit: record.light?.isLit === true,
    trackUses: Boolean(record.uses),
    usesCurrent: record.uses?.current.toString() ?? "0",
    usesMax: record.uses?.max?.toString() ?? "",
    addModifiers: Boolean(record.modifiers && record.modifiers.length > 0),
    modifiers:
      record.modifiers && record.modifiers.length > 0
        ? record.modifiers.map(createModifierFormRowFromModifier)
        : [createEmptyModifierFormRow()],
    notesEnabled: Boolean(record.notes),
    notes: record.notes ?? "",
    addWeaponQualities:
      record.recordType === "weapon" &&
      Boolean(record.weapon.qualities && record.weapon.qualities.length > 0),
    qualities:
      record.recordType === "weapon" ? record.weapon.qualities?.join(", ") ?? "" : "",
  };
}

function getStandardItemSuggestions(formState: RecordFormState) {
  const query = formState.name.trim();

  if (
    formState.mode !== "create" ||
    formState.recordType === "coins" ||
    formState.recordType === "treasure" ||
    query.length < 2
  ) {
    return [];
  }

  const normalizedQuery = normalizeAutocompleteText(query);
  const exactMatch = filterStandardItems(query).some(
    (item) => normalizeAutocompleteText(item.name) === normalizedQuery,
  );

  if (exactMatch) {
    return [];
  }

  return filterStandardItems(query).slice(0, 8);
}

function formatRecordFormLocationSummary({
  containerOptions,
  formState,
  placementOptions,
  targetEntity,
}: {
  containerOptions: InventoryRecord[];
  formState: RecordFormState;
  placementOptions: Array<{ value: InventoryRecordPlacementKey; label: string }>;
  targetEntity: Entity;
}): string {
  const placementLabel =
    placementOptions.find((option) => option.value === formState.placement)
      ?.label ?? "Default placement";

  if (formState.placement !== "container") {
    return `${targetEntity.name} - ${placementLabel}`;
  }

  const containerRecord = containerOptions.find(
    (record) => record.id === formState.containerId,
  );
  const containerName = containerRecord
    ? getRecordDisplayName(containerRecord)
    : "Select container";

  return `${targetEntity.name} - ${placementLabel} - ${containerName}`;
}

function applyInventoryRecordInputToFormState(
  formState: RecordFormState,
  input: InventoryRecordFormInput,
): RecordFormState {
  const burden = input.burden ?? { kind: "fixed", slotsPerItem: 1 };
  const isStackable = burden.kind === "stacked";
  const slotsPerItem = burden.kind === "fixed" ? burden.slotsPerItem : 0;
  const itemsPerSlot = burden.kind === "stacked" ? burden.itemsPerSlot : 1;
  const uses = input.uses;
  const handsRequired = (input.handsRequired ?? getDefaultHandsRequired(
    input.recordType,
  )).toString() as "0" | "1" | "2";

  return {
    ...formState,
    recordType: input.recordType,
    name: input.name ?? "",
    description: input.description ?? "",
    gpValue: "0",
    damage: input.recordType === "weapon" ? input.weapon?.damage ?? "" : "",
    range: input.recordType === "weapon" ? input.weapon?.range ?? "" : "",
    baseArmorClass:
      input.recordType === "armor" && input.armor?.baseArmorClass !== undefined
        ? input.armor.baseArmorClass.toString()
        : "",
    armorBonus:
      input.recordType === "armor" && input.armor?.armorBonus !== undefined
        ? input.armor.armorBonus.toString()
        : "",
    stackable: isStackable,
    quantity: (input.quantity ?? 1).toString(),
    slotsPerItem: slotsPerItem.toString(),
    itemsPerSlot: itemsPerSlot.toString(),
    isContainer: Boolean(input.container),
    capacitySlots: (input.container?.capacitySlots ?? 0).toString(),
    handsRequired,
    isUnidentified: false,
    secretName: "",
    secretDescription: "",
    isLight: Boolean(input.light),
    lightDescription: input.light?.lightDescription ?? "",
    isLit: input.light?.isLit === true,
    trackUses: Boolean(uses),
    usesCurrent: (uses?.current ?? 0).toString(),
    usesMax: uses?.max?.toString() ?? "",
    addModifiers: false,
    modifiers: [createEmptyModifierFormRow()],
    notesEnabled: false,
    notes: "",
    addWeaponQualities:
      input.recordType === "weapon" &&
      Boolean(input.weapon?.qualities && input.weapon.qualities.length > 0),
    qualities:
      input.recordType === "weapon"
        ? input.weapon?.qualities?.join(", ") ?? ""
        : "",
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
    formState.stackable
        ? {
            kind: "stacked" as const,
            itemsPerSlot: parseNumberInput(formState.itemsPerSlot, 1),
          }
        : {
            kind: "fixed" as const,
            slotsPerItem: parseNumberInput(formState.slotsPerItem, 1),
          };
  const handsRequired = Number(formState.handsRequired) as HandsRequired;
  const uses =
    formState.isLight || formState.trackUses
      ? {
          current: parseNumberInput(formState.usesCurrent),
          ...(formState.usesMax
            ? { max: parseNumberInput(formState.usesMax) }
            : {}),
        }
      : undefined;
  const nonCoinSharedInput = {
    ...sharedInput,
    description: formState.description,
    quantity: parseNumberInput(formState.quantity, 1),
    burden,
    handsRequired,
    ...(formState.isLight
      ? {
          light: {
            isLit: formState.isLit,
            lightDescription: formState.lightDescription,
          },
          uses,
        }
      : formState.trackUses
        ? { uses }
        : {}),
    ...(formState.addModifiers
      ? { modifiers: formState.modifiers.map(toModifierInput) }
      : {}),
    ...(formState.notesEnabled ? { notes: formState.notes } : {}),
  };
  const container =
    formState.isContainer &&
    formState.recordType !== "treasure"
      ? {
          capacitySlots: parseNumberInput(formState.capacitySlots),
          handsRequired,
        }
      : undefined;
  const identification =
    formState.isUnidentified &&
    formState.recordType !== "treasure"
      ? {
          identified: false,
          secretName: formState.secretName,
          secretDescription: formState.secretDescription,
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
      identification,
      weapon: {
        damage: formState.damage,
        range: formState.range,
        ...(formState.addWeaponQualities
          ? { qualities: parseQualityList(formState.qualities) }
          : {}),
      },
    };
  }

  if (formState.recordType === "armor") {
    return {
      ...nonCoinSharedInput,
      recordType: "armor",
      name: formState.name,
      container,
      identification,
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
    identification,
  };
}

function getDefaultHandsRequired(recordType: InventoryRecordType): HandsRequired {
  return recordType === "weapon" ? 1 : 0;
}

function normalizeAutocompleteText(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getContainerOptions({
  editingRecordId,
  entity,
  isContainer,
  records,
}: {
  editingRecordId?: InventoryRecordId;
  entity: Entity;
  isContainer: boolean;
  records: InventoryRecord[];
}) {
  return getUsableContainerRecords({
    editingRecordId,
    entity,
    isContainer,
    records,
  });
}

function getPlacementOptions({
  isContainer,
  recordType,
  records,
  targetEntity,
}: {
  isContainer: boolean;
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

  if (isContainer) {
    options.push({ value: "stowedRoot", label: "Stowed container" });
  }

  options.push({ value: "container", label: "Inside container" });

  return options;
}

function getRecordFormSlotState(record: InventoryRecord) {
  if (record.recordType === "coins") {
      return {
        stackable: false,
        quantity: "1",
        slotsPerItem: "1",
        itemsPerSlot: "1",
      };
  }

  switch (record.burden.kind) {
    case "none":
      return {
        stackable: false,
        quantity: record.quantity.toString(),
        slotsPerItem: "0",
        itemsPerSlot: "1",
      };
    case "fixed":
      return {
        stackable: false,
        quantity: record.quantity.toString(),
        slotsPerItem: record.burden.slotsPerItem.toString(),
        itemsPerSlot: "1",
      };
    case "stacked":
      return {
        stackable: true,
        quantity: record.quantity.toString(),
        slotsPerItem: "1",
        itemsPerSlot: record.burden.itemsPerSlot.toString(),
      };
  }
}

function createEmptyModifierFormRow(): ModifierFormRow {
  return {
    id: createFormRowId("modifier"),
    target: "armorClass",
    value: "0",
    label: "",
  };
}

function createModifierFormRowFromModifier(modifier: Modifier): ModifierFormRow {
  return {
    id: createFormRowId("modifier"),
    target: modifier.target,
    value: modifier.value.toString(),
    label: modifier.label ?? "",
  };
}

function toModifierInput(modifierRow: ModifierFormRow): Modifier {
  return {
    target: modifierRow.target,
    value: parseNumberInput(modifierRow.value),
    ...(modifierRow.label.trim() ? { label: modifierRow.label } : {}),
  };
}

function parseQualityList(qualities: string): string[] {
  return qualities
    .split(",")
    .map((quality) => quality.trim())
    .filter((quality) => quality.length > 0);
}

function isRecordLocationIncomplete(record: InventoryRecord): boolean {
  return "containerId" in record.location && record.location.containerId.length === 0;
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

export default function App() {
  return (
    <Routes>
      <Route path="/*" element={<LocalAppShell />} />
      <Route path="*" element={<Navigate to="/inventory" replace />} />
    </Routes>
  );
}

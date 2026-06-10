import {
  ChangeEvent,
  FormEvent,
  Fragment,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
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
  resolveRecordDropWithInventory,
  slotDropId,
  type DragZone,
  type RecordDragData,
  type RecordDropData,
} from "./model/inventoryDnd";
import {
  getLocalPartyStateStorageKey,
  parseAppState,
  parseAppStateResult,
  type ParseResult,
  type PartyId,
} from "./model/appState";
import {
  AUDIT_EVENT_TYPE_LABELS,
  getNewestAuditLogEntries,
} from "./model/auditLog";
import {
  getCharacterArmorClass,
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
  ABILITY_SCORE_LABELS,
  normalizeCharacterData,
} from "./model/characters";
import { getCharacterSaveLookup } from "./model/saveTables";
import {
  ENTITY_TYPE_LABELS,
  ENTITY_TYPES,
  getSortedEntities,
} from "./model/entities";
import {
  getCharacterCoinRecord,
  getUsableContainerRecords,
  getLocationPlacementKey,
  type InventoryRecordFormInput,
  type InventoryRecordPlacementKey,
} from "./model/inventoryRecords";
import {
  createInventoryRecordInputFromStandardItem,
  filterStandardItems,
  type StandardItemCatalogEntry,
} from "./model/standardItems";
import {
  getContainerContents,
  getInventorySections,
  getOwnedRecords,
  getRecordById,
} from "./model/inventoryDisplay";
import {
  getInventoryRowDisplay,
  type InventoryRowStatus,
} from "./model/inventoryRowDisplay";
import type { AppState } from "./model/appState";
import { getRecordHandsRequired } from "./model/types";
import { FIREBASE_PARTY_STATE_COLLECTION } from "./persistence/firebaseSync";
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
  Modifier,
  UserProfile,
  UserRole,
} from "./model/types";
import {
  findTopLevelStowedContainerRecords,
  isCharacterLikeEntity,
  validateInventoryState,
  type ValidationIssue,
} from "./model/validation";
import {
  useAppStore,
  createPartyId,
  type EntityMutationResult,
  type InventoryMutationResult,
} from "./store/useAppStore";
import type { CoinDenomination } from "./store/useAppStore";
import {
  COIN_DENOMINATIONS,
  EMPTY_COINS,
  EMPTY_ENTITY_FORM,
  MODIFIER_TARGET_OPTIONS,
  RECORD_TYPE_LABELS,
  RECORD_TYPES,
  type AbilityScoreKey,
  type AppStateExport,
  type CharacterFeatureFormState,
  type CharacterSheetFormState,
  type CharacterSkillFormState,
  type CoinSpendFormState,
  type CoinTransferFormState,
  type DeleteConfirmationState,
  type EntityFormState,
  type ManageMessage,
  type ModifierFormRow,
  type PartyAbilityScoreDisplay,
  type PartyOverviewCard,
  type RecordFormState,
  type UserProfileFormState,
} from "./view-types";
import {
  formatCapacity,
  formatGpValue,
  formatMovementFeet,
  formatNullableNumberInput,
  formatNullablePartyNumber,
  formatPartyAbilityScores,
  formatPartyAlignment,
  formatPartyArmorClass,
  formatPartyClassLevel,
  formatPartyHands,
  formatPartyHp,
  formatPartyLanguages,
  formatSignedNumber,
  formatSlots,
  formatWarningState,
  getAuditEntryDisplay,
  getCollapsedContainerStatusIcons,
  getDeleteConfirmationMessage,
  getInventoryRecordTypeIcon,
  getInventoryRecordTypeIconTone,
  getInventoryRowStatusIcon,
  getInventoryRowStatusTitle,
  getInventoryRowStatusTone,
  getInventoryRowStatusText,
  getRecordDisplayName,
  getUniqueInventoryRowStatuses,
  isMagicInventoryRecord,
  isPartyMemberHurt,
} from "./formatters";

function LocalAppShell() {
  const location = useLocation();
  const { partyId } = useParams<{ partyId: PartyId }>();
  const appState = useAppStore((state) => state.appState);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const partyDisplayName = useAppStore((state) => state.partyDisplayName);
  const activePartyId = useAppStore((state) => state.partyId);
  const persistenceMode = useAppStore((state) => state.persistenceMode);
  const syncError = useAppStore((state) => state.syncError);
  const syncStatus = useAppStore((state) => state.syncStatus);
  const renameParty = useAppStore((state) => state.renameParty);
  const setCurrentParty = useAppStore((state) => state.setCurrentParty);
  const updateCurrentUserProfile = useAppStore(
    (state) => state.updateCurrentUserProfile,
  );
  const userProfiles = useAppStore((state) => state.userProfiles);
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
  const transferCoins = useAppStore((state) => state.transferCoins);
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
  const [coinTransferForm, setCoinTransferForm] = useState<
    CoinTransferFormState | undefined
  >();
  const [recordFormMessage, setRecordFormMessage] = useState<
    string | undefined
  >();
  const [entityCreateModalOpen, setEntityCreateModalOpen] = useState(false);
  const [coinSpendMessage, setCoinSpendMessage] = useState<
    string | undefined
  >();
  const [coinTransferMessage, setCoinTransferMessage] = useState<
    string | undefined
  >();
  const [auditEntityFilter, setAuditEntityFilter] = useState<
    EntityId | "all"
  >("all");
  const [auditEventTypeFilter, setAuditEventTypeFilter] = useState<
    AuditEventType | "all"
  >("all");
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [identityModalOpen, setIdentityModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<
    DeleteConfirmationState | undefined
  >();
  const [collapsedContainerIds, setCollapsedContainerIds] = useState<
    Set<InventoryRecordId>
  >(() => new Set());
  const currentUserProfile = userProfiles.find(
    (profile) => profile.id === currentUserId,
  );
  const identityReady = canEditUserIdentity(persistenceMode, syncStatus);
  const identityRequired = identityReady && currentUserProfile === undefined;

  useEffect(() => {
    if (partyId) {
      setCurrentParty(partyId);
    }
  }, [partyId, setCurrentParty]);

  if (!partyId) {
    return <Navigate to={`/party/${createPartyId()}`} replace />;
  }

  function openIdentityModal() {
    setIdentityModalOpen(true);
  }

  function saveIdentity(input: UserProfileFormState) {
    updateCurrentUserProfile(input);
    setIdentityModalOpen(false);
  }

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

  function requestDeleteEntity(entity: Entity) {
    setDeleteConfirmation({ kind: "entity", entity });
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

  function requestDeleteInventoryRecord(record: InventoryRecord) {
    setDeleteConfirmation({ kind: "record", record });
  }

  function confirmDelete() {
    if (!deleteConfirmation) {
      return;
    }

    if (deleteConfirmation.kind === "entity") {
      deleteEntity(deleteConfirmation.entity.id);
      if (editingEntityId === deleteConfirmation.entity.id) {
        setEditingEntityId(undefined);
        setEditingName("");
      }
      setDeleteConfirmation(undefined);
      return;
    }

    const result = deleteInventoryRecord(deleteConfirmation.record.id);

    if (!result.ok) {
      setRecordFormMessage(result.message);
      setDeleteConfirmation(undefined);
      return;
    }

    if (recordForm?.recordId === deleteConfirmation.record.id) {
      setRecordForm(undefined);
    }

    setRecordFormMessage(undefined);
    setDeleteConfirmation(undefined);
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

  function startTransferringCoins(record: InventoryRecord) {
    if (record.recordType !== "coins") {
      return;
    }

    const destinationEntityId =
      sortedEntities.find((entity) => entity.id !== record.entityId)?.id ?? "";

    setCoinTransferForm({
      sourceEntityId: record.entityId,
      destinationEntityId,
      amounts: createEmptyCoinSpendAmounts(),
      note: "",
    });
    setCoinTransferMessage(undefined);
  }

  function cancelTransferringCoins() {
    setCoinTransferForm(undefined);
    setCoinTransferMessage(undefined);
  }

  function saveCoinTransferForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!coinTransferForm) {
      return;
    }

    const result = transferCoins({
      sourceEntityId: coinTransferForm.sourceEntityId,
      destinationEntityId: coinTransferForm.destinationEntityId,
      amounts: toCoinSpendAmounts(coinTransferForm.amounts),
      note: coinTransferForm.note,
    });

    if (!result.ok) {
      setCoinTransferMessage(result.message);
      return;
    }

    if (recordForm?.recordType === "coins") {
      setRecordForm(undefined);
      setRecordFormMessage(undefined);
    }

    setCoinTransferForm(undefined);
    setCoinTransferMessage(undefined);
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

    if (recordForm?.recordType === "coins") {
      setRecordForm(undefined);
      setRecordFormMessage(undefined);
    }

    setCoinSpendForm(undefined);
    setCoinSpendMessage(undefined);
  }

  const isWideWorkspaceRoute = [
    `/party/${partyId}`,
    `/party/${partyId}/inventory`,
    `/party/${partyId}/characters`,
    `/party/${partyId}/audit`,
  ].some((routePath) => location.pathname.startsWith(routePath));
  const workspaceClassName = `workspace-panel${
    isWideWorkspaceRoute ? " wide-workspace-panel" : ""
  }`;

  return (
    <main className="app-shell">
      <section className={workspaceClassName} aria-labelledby="app-title">
        <div className="app-header">
          <div>
            <p className="eyebrow">
              {formatPersistenceSummary(persistenceMode, syncStatus)}
            </p>
            <h1 id="app-title">{partyDisplayName}</h1>
            {syncError ? <p className="sync-message">{syncError}</p> : null}
          </div>
          <div className="header-actions">
            <button
              disabled={!identityReady}
              type="button"
              onClick={openIdentityModal}
            >
              {currentUserProfile
                ? `${currentUserProfile.displayName} (${currentUserProfile.role})`
                : "Set User"}
            </button>
            <button type="button" onClick={() => setManageModalOpen(true)}>
              Manage
            </button>
          </div>
        </div>

        <nav className="app-nav" aria-label="Primary">
          <NavLink to={`/party/${partyId}`} end>
            Party
          </NavLink>
          <NavLink to={`/party/${partyId}/inventory`}>Inventory</NavLink>
          <NavLink to={`/party/${partyId}/characters`}>Characters</NavLink>
          <NavLink to={`/party/${partyId}/audit`}>Audit Log</NavLink>
        </nav>

        <Routes>
          <Route
            index
            element={
              <PartyPage
                appState={appState}
                inventoryPath={`/party/${partyId}/inventory`}
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
                onDeleteEntity={requestDeleteEntity}
                onDeleteRecord={requestDeleteInventoryRecord}
                onEditEntity={startEditing}
                onEditRecord={startEditingRecord}
                onIdentifyRecord={identifyInventoryRecord}
                onSaveEditing={saveEditing}
                onSaveRecordForm={saveRecordForm}
                onSetEntityActive={setEntityActive}
                onSpendCoins={startSpendingCoins}
                onTransferCoins={startTransferringCoins}
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
          <Route
            path="*"
            element={<Navigate to={`/party/${partyId}/inventory`} replace />}
          />
        </Routes>

        <div className="storage-key">
          <span>
            {persistenceMode === "firebase" ? "Firestore document" : "Storage key"}
          </span>
          <code>
            {persistenceMode === "firebase"
              ? `${FIREBASE_PARTY_STATE_COLLECTION}/${activePartyId}`
              : getLocalPartyStateStorageKey(activePartyId)}
          </code>
        </div>

        {manageModalOpen ? (
          <ManageDataModal
            appState={appState}
            partyDisplayName={partyDisplayName}
            partyId={activePartyId}
            onClose={() => setManageModalOpen(false)}
            onImportAppState={replaceAppState}
            onRenameParty={renameParty}
            onReset={() => {
              resetLocalState();
              setManageModalOpen(false);
            }}
          />
        ) : null}

        {identityReady && (identityRequired || identityModalOpen) ? (
          <UserIdentityModal
            profile={currentUserProfile}
            required={identityRequired}
            onCancel={() => setIdentityModalOpen(false)}
            onSubmit={saveIdentity}
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

        {coinTransferForm ? (
          <CoinTransferModal
            appState={appState}
            formState={coinTransferForm}
            message={coinTransferMessage}
            onCancel={cancelTransferringCoins}
            onChange={setCoinTransferForm}
            onSubmit={saveCoinTransferForm}
          />
        ) : null}

        {deleteConfirmation ? (
          <DeleteConfirmationModal
            confirmation={deleteConfirmation}
            inventoryRecords={appState.inventoryRecords}
            onCancel={() => setDeleteConfirmation(undefined)}
            onConfirm={confirmDelete}
          />
        ) : null}
      </section>
    </main>
  );
}

function ManageDataModal({
  appState,
  partyDisplayName,
  partyId,
  onClose,
  onImportAppState,
  onRenameParty,
  onReset,
}: {
  appState: AppState;
  partyDisplayName: string;
  partyId: PartyId;
  onClose: () => void;
  onImportAppState: (appState: AppState) => void;
  onRenameParty: (displayName: string) => void;
  onReset: () => void;
}) {
  const [importMessage, setImportMessage] = useState<ManageMessage | undefined>();
  const [pendingImportAppState, setPendingImportAppState] = useState<
    AppState | undefined
  >();
  const [importConfirmation, setImportConfirmation] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [editingPartyName, setEditingPartyName] = useState(partyDisplayName);
  const importEnabled =
    pendingImportAppState !== undefined && importConfirmation === "import";
  const resetEnabled = resetConfirmation === "delete";
  const partyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/party/${partyId}`
      : `/party/${partyId}`;

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

    let parsedValue: unknown;

    try {
      parsedValue = JSON.parse(await file.text());
    } catch (error) {
      setPendingImportAppState(undefined);
      setImportConfirmation("");
      setImportMessage({
        tone: "error",
        text: formatJsonImportParseError(error),
      });
      return;
    }

    let importResult: ParseResult<AppState>;

    try {
      importResult = parseImportedAppStateResult(parsedValue);
    } catch (error) {
      console.error("Import app-state validation failed", error);
      setPendingImportAppState(undefined);
      setImportConfirmation("");
      setImportMessage({
        tone: "error",
        text:
          "Import failed. The file is valid JSON, but the app state could not be imported.",
      });
      return;
    }

    if (!importResult.ok) {
      setPendingImportAppState(undefined);
      setImportConfirmation("");
      setImportMessage({
        tone: "error",
        text: formatImportValidationError(importResult),
      });
      return;
    }

    setPendingImportAppState(importResult.value);
    setImportConfirmation("");
    setImportMessage({
      tone: "success",
      text: "Import file is valid. Type import to replace current data.",
    });
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
        <div className="modal-header">
          <div>
            <h2>Manage Data</h2>
            <p>Rename, share, export, import, or reset the current party.</p>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-body">
          <section className="manage-section">
            <div>
              <h3>Party</h3>
              <p>Rename this party or share its stable URL.</p>
            </div>
            <label>
              <span>Party name</span>
              <input
                value={editingPartyName}
                onChange={(event) => setEditingPartyName(event.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={() => onRenameParty(editingPartyName)}
            >
              Save name
            </button>
            <label>
              <span>Party URL</span>
              <input readOnly value={partyUrl} />
            </label>
          </section>

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
                Import replaces all current app data. Export a backup first.
                Type import to continue.
              </p>
            </div>
            <label className="file-button">
              <span>Import JSON</span>
              <input
                accept="application/json,.json"
                type="file"
                onChange={importAppData}
              />
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
                  importMessage.tone === "error"
                    ? "form-error"
                    : "form-success"
                }
              >
                {importMessage.text}
              </p>
            ) : null}
          </section>

          <section className="manage-section danger-section">
            <div>
              <h3>Reset Data</h3>
              <p>
                Delete all current app data and return to the default empty
                state.
              </p>
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
        </div>
      </section>
    </div>
  );
}

function UserIdentityModal({
  profile,
  required,
  onCancel,
  onSubmit,
}: {
  profile?: UserProfile;
  required: boolean;
  onCancel: () => void;
  onSubmit: (input: UserProfileFormState) => void;
}) {
  const [formState, setFormState] = useState<UserProfileFormState>({
    displayName: profile?.displayName ?? "",
    role: profile?.role ?? "Player",
  });
  const displayNameValid = formState.displayName.trim().length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!displayNameValid) {
      return;
    }

    onSubmit(formState);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-label="User identity"
        aria-modal="true"
        className="modal-panel manage-modal"
        role="dialog"
      >
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="modal-header">
            <div>
              <h2>{profile ? "Edit User" : "Join Party"}</h2>
              <p>Name yourself for this party.</p>
            </div>
            {required ? null : (
              <button type="button" onClick={onCancel}>
                Close
              </button>
            )}
          </div>

          <div className="modal-body">
            <section className="manage-section">
              <label>
                <span>Display name</span>
                <input
                  autoFocus
                  autoComplete="name"
                  value={formState.displayName}
                  onChange={(event) =>
                    setFormState((currentState) => ({
                      ...currentState,
                      displayName: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Role</span>
                <select
                  value={formState.role}
                  onChange={(event) =>
                    setFormState((currentState) => ({
                      ...currentState,
                      role: event.target.value as UserRole,
                    }))
                  }
                >
                  <option value="Player">Player</option>
                  <option value="GM">GM</option>
                </select>
              </label>

              {!displayNameValid ? (
                <p className="form-error">Enter a display name.</p>
              ) : null}
            </section>
          </div>

          <div className="modal-footer">
            {required ? null : (
              <button type="button" onClick={onCancel}>
                Cancel
              </button>
            )}
            <button disabled={!displayNameValid} type="submit">
              Save user
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function DeleteConfirmationModal({
  confirmation,
  inventoryRecords,
  onCancel,
  onConfirm,
}: {
  confirmation: DeleteConfirmationState;
  inventoryRecords: InventoryRecord[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const title =
    confirmation.kind === "entity" ? "Delete Entity" : "Delete Item";
  const message =
    confirmation.kind === "entity"
      ? `Delete ${confirmation.entity.name} and all of its inventory records?`
      : getDeleteConfirmationMessage(confirmation.record, inventoryRecords);
  const targetName =
    confirmation.kind === "entity"
      ? confirmation.entity.name
      : getRecordDisplayName(confirmation.record);

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-label={title}
        aria-modal="true"
        className="modal-panel manage-modal"
        role="dialog"
      >
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            <p>{targetName}</p>
          </div>
          <button type="button" onClick={onCancel}>
            Close
          </button>
        </div>

        <div className="modal-body">
          <section className="manage-section danger-section">
            <p>{message}</p>
          </section>
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="danger-button" type="button" onClick={onConfirm}>
            Delete
          </button>
        </div>
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
  onDeleteEntity: (entity: Entity) => void;
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

    const resolution = resolveRecordDropWithInventory(
      activeData,
      overData?.type === "record" ? (overData as RecordDropData) : undefined,
      appState.inventoryRecords,
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

    if (resolution.kind === "twoHandSwap") {
      const displacedResult = moveInventoryRecord(
        resolution.displacedRecordId,
        resolution.displacedLocation,
      );

      if (!displacedResult.ok) {
        setDragMessage(displacedResult.message);
        return;
      }

      const twoHandedResult = moveInventoryRecord(
        resolution.twoHandedRecordId,
        resolution.twoHandedLocation,
      );

      if (!twoHandedResult.ok) {
        setDragMessage(twoHandedResult.message);
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

function PartyPage({
  appState,
  inventoryPath,
  sortedEntities,
}: {
  appState: AppState;
  inventoryPath: string;
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
        <NavLink className="text-link-button" to={inventoryPath}>
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
    const armorClass = getCharacterArmorClass(
      entity,
      appState.inventoryRecords,
      character,
    );
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
      ac: formatPartyArmorClass(armorClass.armorClass),
      validationIssues,
      warningCount: warnings.length + validationIssues.length,
      warningSummary: formatWarningState(warnings, validationIssues),
      warnings,
    };
  });
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
  const [selectedEntityId, setSelectedEntityId] = useState<EntityId | undefined>(
    () => characterEntities[0]?.id,
  );
  const selectedEntity =
    characterEntities.find((entity) => entity.id === selectedEntityId) ??
    characterEntities[0];

  useEffect(() => {
    if (
      characterEntities.length > 0 &&
      !characterEntities.some((entity) => entity.id === selectedEntityId)
    ) {
      setSelectedEntityId(characterEntities[0]?.id);
    }
  }, [characterEntities, selectedEntityId]);

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
        <div className="character-page-layout">
          <aside className="character-selector" aria-label="Characters">
            {characterEntities.map((entity) => {
              const character = normalizeCharacterData(entity.character);

              return (
                <button
                  data-active={entity.id === selectedEntity?.id}
                  key={entity.id}
                  type="button"
                  onClick={() => setSelectedEntityId(entity.id)}
                >
                  <span>{entity.name}</span>
                  <small>{formatPartyClassLevel(character)}</small>
                </button>
              );
            })}
          </aside>

          {selectedEntity ? (
            <article
              className="character-detail"
              data-inactive={!selectedEntity.active}
            >
              <EntitySummary appState={appState} entity={selectedEntity} />
              <CharacterInventorySummary appState={appState} entity={selectedEntity} />
              <CharacterSheetPanel
                appState={appState}
                entity={selectedEntity}
                onSaveCharacterData={onSaveCharacterData}
              />
            </article>
          ) : null}
        </div>
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

function CharacterSheetPanel({
  appState,
  entity,
  onSaveCharacterData,
}: {
  appState: AppState;
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

  const normalizedCharacter = normalizeCharacterData(entity.character);
  const armorClass = getCharacterArmorClass(
    entity,
    appState.inventoryRecords,
    normalizedCharacter,
  );
  const encumbrance = getCharacterEncumbrance(entity, appState.inventoryRecords);
  const saveLookup = getCharacterSaveLookup(
    formState.className,
    parseNullableIntegerInput(formState.level),
  );

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

        <section className="character-sheet-section character-reference-section">
          <h5>Table Reference</h5>
          <div className="character-reference-grid">
            <div className="reference-stat">
              <span>HP</span>
              <strong>
                {formatPartyHp({
                  ...normalizedCharacter,
                  hp: {
                    current: parseNullableIntegerInput(formState.hpCurrent),
                    max: parseNullableIntegerInput(formState.hpMax),
                  },
                })}
              </strong>
            </div>
            <div className="reference-stat">
              <span>AC</span>
              <strong>{formatNullablePartyNumber(armorClass.armorClass)}</strong>
            </div>
            <div className="reference-stat">
              <span>Move</span>
              <strong>{formatMovementFeet(encumbrance.movement.explorationFeet)}</strong>
            </div>
            <div className="reference-stat">
              <span>XP</span>
              <strong>
                {formatNullablePartyNumber(parseNullableIntegerInput(formState.xp))}
              </strong>
            </div>
            <div className="reference-stat">
              <span>Attack</span>
              <strong>
                {saveLookup.ok ? formatSignedNumber(saveLookup.attackBonus) : "—"}
              </strong>
            </div>
          </div>

          <div className="saving-throw-panel">
            <div className="saving-throw-heading">
              <span>Saves</span>
              {!saveLookup.ok ? <p>{saveLookup.message}</p> : null}
            </div>
            <div className="saving-throw-grid">
              {saveLookup.saves.map((save) => (
                <span key={save.key}>
                  <strong>{save.label}</strong>
                  {Number.isFinite(save.value) ? save.value : "—"}
                </span>
              ))}
            </div>
          </div>
        </section>

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
          <h5>Armor Class</h5>
          <div className="character-sheet-grid compact-grid">
            <NumberField
              label="AC modifier"
              min="-99"
              value={formState.armorClassModifier}
              onChange={(value) =>
                setFormState({ ...formState, armorClassModifier: value })
              }
            />
            <NumberField
              label="Manual AC"
              value={formState.armorClassOverride}
              onChange={(value) =>
                setFormState({ ...formState, armorClassOverride: value })
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
                label={ABILITY_SCORE_LABELS[abilityScoreKey]}
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
            <h5>Class Abilities / Features</h5>
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
              Add ability
            </button>
          </div>

          {formState.features.length === 0 ? (
            <p className="empty-state compact">No class abilities</p>
          ) : (
            <div className="repeatable-list">
              {formState.features.map((feature) => (
                <div className="repeatable-row feature-row" key={feature.id}>
                  <label>
                    <span>Name</span>
                    <input
                      autoComplete="off"
                      maxLength={80}
                      type="text"
                      value={feature.name}
                      onChange={(event) =>
                        updateFeature(feature.id, {
                          name: event.target.value,
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
        <HandRows
          entityId={entityId}
          sections={sections}
          records={records}
          onEditRecord={onEditRecord}
          onIdentifyRecord={onIdentifyRecord}
          onSpendCoins={onSpendCoins}
        />

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
      </InventorySection>

      <InventorySection title="Stowed">
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
                />
              )}
            </DraggableRecordItem>
          ) : (
            <p className="empty-state compact">No coins</p>
          )}
        </SlotDropZone>

        {sections.topLevelStowedContainerRecord ? (
          <ContainerBlock
            entityId={entityId}
            containerRecord={sections.topLevelStowedContainerRecord}
            records={records}
            nestedRecords={sections.topLevelStowedContainerContents}
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
  onDelete?: () => void;
  onSpendCoins?: (record: InventoryRecord) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTransferCoins?: (record: InventoryRecord) => void;
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
  const [itemSuggestionsOpen, setItemSuggestionsOpen] = useState(false);
  const [highlightedItemSuggestionIndex, setHighlightedItemSuggestionIndex] =
    useState(0);
  const autocompleteRef = useRef<HTMLDivElement | null>(null);
  const autocompleteListboxId = useId();
  const highlightedItemSuggestion =
    itemSuggestionsOpen && standardItemSuggestions.length > 0
      ? standardItemSuggestions[highlightedItemSuggestionIndex]
      : undefined;
  const highlightedItemSuggestionId = highlightedItemSuggestion
    ? `${autocompleteListboxId}-${highlightedItemSuggestion.slug}`
    : undefined;
  const showItemSuggestions =
    itemSuggestionsOpen && standardItemSuggestions.length > 0;
  const locationSummary = formatRecordFormLocationSummary({
    containerOptions,
    formState,
    placementOptions,
    targetEntity,
  });
  const coinActionRecord = formState.recordId
    ? getRecordById(formState.recordId, appState.inventoryRecords)
    : undefined;

  useEffect(() => {
    if (standardItemSuggestions.length === 0) {
      setItemSuggestionsOpen(false);
      setHighlightedItemSuggestionIndex(0);
      return;
    }

    setHighlightedItemSuggestionIndex((currentIndex) =>
      Math.min(currentIndex, standardItemSuggestions.length - 1),
    );
  }, [standardItemSuggestions.length]);

  useEffect(() => {
    function closeSuggestionsOnOutsidePointerDown(event: PointerEvent) {
      if (
        autocompleteRef.current &&
        event.target instanceof Node &&
        !autocompleteRef.current.contains(event.target)
      ) {
        setItemSuggestionsOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeSuggestionsOnOutsidePointerDown);

    return () => {
      document.removeEventListener(
        "pointerdown",
        closeSuggestionsOnOutsidePointerDown,
      );
    };
  }, []);

  function selectStandardItemSuggestion(item: StandardItemCatalogEntry) {
    const input = createInventoryRecordInputFromStandardItem(item.slug);

    if (input) {
      onChange(applyInventoryRecordInputToFormState(formState, input));
    }

    setItemSuggestionsOpen(false);
  }

  function handleItemNameKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (standardItemSuggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setItemSuggestionsOpen(true);
      setHighlightedItemSuggestionIndex((currentIndex) =>
        itemSuggestionsOpen
          ? (currentIndex + 1) % standardItemSuggestions.length
          : 0,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setItemSuggestionsOpen(true);
      setHighlightedItemSuggestionIndex((currentIndex) =>
        itemSuggestionsOpen
          ? (currentIndex - 1 + standardItemSuggestions.length) %
            standardItemSuggestions.length
          : standardItemSuggestions.length - 1,
      );
      return;
    }

    if (event.key === "Enter" && itemSuggestionsOpen) {
      event.preventDefault();
      selectStandardItemSuggestion(
        standardItemSuggestions[highlightedItemSuggestionIndex],
      );
      return;
    }

    if (event.key === "Escape" && itemSuggestionsOpen) {
      event.preventDefault();
      setItemSuggestionsOpen(false);
    }
  }

  function changeRecordType(recordType: InventoryRecordType) {
    if (formState.mode === "edit" || recordType === formState.recordType) {
      return;
    }

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
  }

  return (
    <form className="record-form modal-form" onSubmit={onSubmit}>
      <div className="modal-header record-form-heading">
        <div>
          <h4>{formState.mode === "edit" ? "Edit item" : "Add item"}</h4>
          <p className="form-help">
            {formState.mode === "edit"
              ? `${RECORD_TYPE_LABELS[formState.recordType]} for ${entity.name}`
              : `New item for ${entity.name}`}
          </p>
          {message ? <p className="form-error">{message}</p> : null}
        </div>
      </div>

      <div
        aria-label="Item type"
        className="record-type-tabs"
        role="tablist"
      >
        {RECORD_TYPES.map((recordType) => {
          const active = recordType === formState.recordType;

          return (
            <button
              aria-disabled={formState.mode === "edit"}
              aria-selected={active}
              data-active={active}
              key={recordType}
              role="tab"
              type="button"
              onClick={() => changeRecordType(recordType)}
            >
              {RECORD_TYPE_LABELS[recordType]}
            </button>
          );
        })}
      </div>

      <div className="modal-body record-form-body">
        <section className="record-form-section record-core-section">
          {formState.recordType === "coins" ? (
            <div className="record-coin-grid">
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
          ) : (
            <>
              <div className="record-core-grid">
                <div className="autocomplete-field" ref={autocompleteRef}>
                  <label>
                    <span>Name</span>
                    <input
                      aria-activedescendant={highlightedItemSuggestionId}
                      aria-autocomplete="list"
                      aria-controls={
                        showItemSuggestions ? autocompleteListboxId : undefined
                      }
                      aria-expanded={showItemSuggestions}
                      aria-haspopup="listbox"
                      autoComplete="off"
                      maxLength={100}
                      required
                      role="combobox"
                      type="text"
                      value={formState.name}
                      onChange={(event) => {
                        onChange({ ...formState, name: event.target.value });
                        setItemSuggestionsOpen(true);
                        setHighlightedItemSuggestionIndex(0);
                      }}
                      onFocus={() => {
                        if (standardItemSuggestions.length > 0) {
                          setItemSuggestionsOpen(true);
                          setHighlightedItemSuggestionIndex(0);
                        }
                      }}
                      onKeyDown={handleItemNameKeyDown}
                    />
                  </label>
                  {showItemSuggestions ? (
                    <div
                      id={autocompleteListboxId}
                      className="autocomplete-suggestions"
                      aria-label="Standard item suggestions"
                      role="listbox"
                    >
                      {standardItemSuggestions.map((item, itemIndex) => (
                        <button
                          id={`${autocompleteListboxId}-${item.slug}`}
                          aria-selected={
                            itemIndex === highlightedItemSuggestionIndex
                          }
                          className={
                            itemIndex === highlightedItemSuggestionIndex
                              ? "highlighted"
                              : undefined
                          }
                          key={item.slug}
                          role="option"
                          type="button"
                          onClick={() => selectStandardItemSuggestion(item)}
                          onMouseDown={(event) => {
                            event.preventDefault();
                          }}
                          onMouseEnter={() => {
                            setHighlightedItemSuggestionIndex(itemIndex);
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
              </div>

              <label className="record-description-field">
                <span>Description</span>
                <textarea
                  className="description-field"
                  maxLength={160}
                  rows={3}
                  value={formState.description}
                  onChange={(event) =>
                    onChange({ ...formState, description: event.target.value })
                  }
                />
              </label>
            </>
          )}
        </section>

        {showNonCoinFields ? (
          <section className="record-form-section">
            <h5>Options</h5>
            <div className="record-options-grid">
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
              {formState.recordType === "weapon" ? (
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
              ) : null}
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
            </div>
          </section>
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

        {formState.addModifiers && showNonCoinFields ? (
          <section className="record-form-section">
            <h5>Modifiers</h5>
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
                          (candidateRow) => candidateRow.id !== modifierRow.id,
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
          </section>
        ) : null}

        {formState.recordType === "weapon" && formState.addWeaponQualities ? (
          <section className="record-form-section">
            <h5>Weapon qualities</h5>
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
          </section>
        ) : null}

        {formState.notesEnabled && showNonCoinFields ? (
          <section className="record-form-section">
            <h5>Private / GM notes</h5>
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

      <div className="modal-footer split-actions">
        <div>
          {coinActionRecord?.recordType === "coins" ? (
            <div className="record-form-action-group left-actions">
              {onSpendCoins ? (
                <button
                  type="button"
                  onClick={() => onSpendCoins(coinActionRecord)}
                >
                  Spend coins
                </button>
              ) : null}
              {onTransferCoins ? (
                <button
                  type="button"
                  onClick={() => onTransferCoins(coinActionRecord)}
                >
                  Transfer coins
                </button>
              ) : null}
            </div>
          ) : null}
          {onDelete && coinActionRecord?.recordType !== "coins" ? (
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

function CoinTransferModal({
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
  const sourceRecord = getDefaultCoinRecordForEntity(
    formState.sourceEntityId,
    appState.inventoryRecords,
  );
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
      destinationEntityId,
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
              <h5>Transfer amount</h5>
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
          label="Hands"
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
}: {
  record: InventoryRecord;
  dragHandle?: ReactNode;
  onEditRecord: (record: InventoryRecord) => void;
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
      {display.rightKind === "burden" ? (
        <SlotPipIndicator slots={getRecordSlotBurden(record)} />
      ) : (
        <span className="record-right-meta">{display.rightText}</span>
      )}
    </div>
  );
}

function SlotPipIndicator({ slots }: { slots: number }) {
  const description = formatSlots(slots);

  return (
    <span
      aria-label={description}
      className="slot-pip-indicator"
      title={description}
    >
      {getSlotPipContent(slots)}
    </span>
  );
}

function getSlotPipContent(slots: number): ReactNode {
  if (slots <= 0) {
    return "○";
  }

  if (slots === 1) {
    return "●";
  }

  if (slots === 2) {
    return "●●";
  }

  if (slots === 3) {
    return "●●●";
  }

  return (
    <>
      ●×<span className="slot-pip-multiplier">{slots}</span>
    </>
  );
}

function WarningDetailsButton({
  validationIssues,
  warnings,
}: {
  validationIssues: ValidationIssue[];
  warnings: EncumbranceWarning[];
}) {
  const warningCount = validationIssues.length + warnings.length;
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!detailsRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (warningCount === 0) {
    return null;
  }

  const messages = [...validationIssues, ...warnings].map(
    (warning) => warning.message,
  );
  const severity = getWarningDisplaySeverity(validationIssues, warnings);
  const warningIcon = getWarningDetailsIcon(validationIssues, warnings);

  return (
    <details
      ref={detailsRef}
      className="warning-details"
      data-severity={severity}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
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
  const result = parseImportedAppStateResult(value);

  return result.ok ? result.value : undefined;
}

export function parseImportedAppStateResult(
  value: unknown,
): ParseResult<AppState> {
  const directAppState = parseAppStateResult(value);

  if (directAppState.ok) {
    return directAppState;
  }

  if (!value || typeof value !== "object") {
    return {
      ok: false,
      message: "Expected app export object.",
    };
  }

  const candidateExport = value as Partial<AppStateExport>;

  if (!("data" in candidateExport)) {
    return {
      ok: false,
      path: "data",
      message: 'Missing top-level "data" object.',
    };
  }

  if (candidateExport.version !== 1) {
    return {
      ok: false,
      path: "version",
      message:
        candidateExport.version === undefined
          ? "Missing top-level export version."
          : `Unsupported export version: ${String(candidateExport.version)}.`,
    };
  }

  if (typeof candidateExport.exportedAt !== "string") {
    return {
      ok: false,
      path: "exportedAt",
      message: 'Missing top-level "exportedAt" timestamp.',
    };
  }

  if (!candidateExport.data || typeof candidateExport.data !== "object") {
    return {
      ok: false,
      path: "data",
      message: 'Missing top-level "data" object.',
    };
  }

  return parseAppStateResult(candidateExport.data);
}

function formatJsonImportParseError(error: unknown): string {
  const detail =
    error instanceof Error && error.message.length <= 160
      ? ` JSON parse error: ${error.message}.`
      : "";

  return `Import failed. The selected file is not valid JSON.${detail}`;
}

function formatImportValidationError(result: Extract<ParseResult<AppState>, { ok: false }>): string {
  return `Import failed. ${result.path ? `${result.path}: ` : ""}${result.message}`;
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

function formatAuditEntryCount(count: number) {
  return count === 1 ? "1 entry" : `${count} entries`;
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

function getCoinTransferValidationMessage(
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

  const sourceRecord = getDefaultCoinRecordForEntity(
    formState.sourceEntityId,
    appState.inventoryRecords,
  );

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

function getDefaultCoinRecordForEntity(
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
    armorClassModifier: normalizedCharacterData.armorClass.modifier.toString(),
    armorClassOverride: formatNullableNumberInput(
      normalizedCharacterData.armorClass.override,
    ),
    abilityScores: ABILITY_SCORE_KEYS.reduce<Record<AbilityScoreKey, string>>(
      (abilityScores, key) => ({
        ...abilityScores,
        [key]: formatNullableNumberInput(
          normalizedCharacterData.abilityScores[key],
        ),
      }),
      {
        strength: "",
        intelligence: "",
        wisdom: "",
        dexterity: "",
        constitution: "",
        charisma: "",
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
      name: feature.name,
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
    armorClass: {
      modifier: formState.armorClassModifier.trim()
        ? parseIntegerInput(formState.armorClassModifier)
        : 0,
      override: parseNullableIntegerInput(formState.armorClassOverride),
    },
    abilityScores: ABILITY_SCORE_KEYS.reduce<CharacterData["abilityScores"]>(
      (abilityScores, key) => ({
        ...abilityScores,
        [key]: parseNullableIntegerInput(formState.abilityScores[key]),
      }),
      {
        strength: null,
        intelligence: null,
        wisdom: null,
        dexterity: null,
        constitution: null,
        charisma: null,
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
        name: feature.name.trim(),
        description: feature.description.trim(),
      }))
      .filter((feature) => feature.name || feature.description),
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
    name: "",
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

function canEditUserIdentity(
  persistenceMode: PersistenceMode,
  syncStatus: SyncStatus,
): boolean {
  return (
    persistenceMode === "local" ||
    syncStatus === "local" ||
    syncStatus === "synced" ||
    syncStatus === "error"
  );
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
      <Route path="/" element={<NewPartyRedirect />} />
      <Route path="/party" element={<NewPartyRedirect />} />
      <Route path="/party/:partyId/*" element={<LocalAppShell />} />
      <Route path="*" element={<NewPartyRedirect />} />
    </Routes>
  );
}

function NewPartyRedirect() {
  const partyId = useAppStore((state) => state.partyId);

  return <Navigate to={`/party/${partyId}`} replace />;
}

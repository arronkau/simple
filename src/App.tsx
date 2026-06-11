import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import {
  getLocalPartyStateStorageKey,
  type PartyId,
} from "./model/appState";
import { getSortedEntities } from "./model/entities";
import { getRecordById } from "./model/inventoryDisplay";
import type { AppState } from "./model/appState";
import type {
  AuditEventType,
  Entity,
  EntityId,
  InventoryRecord,
} from "./model/types";
import { FIREBASE_PARTY_STATE_COLLECTION } from "./persistence/firebaseSync";
import type { PersistenceMode, SyncStatus } from "./persistence/types";
import { ManageDataModal } from "./modals/ManageDataModal";
import { UserIdentityModal } from "./modals/UserIdentityModal";
import { DeleteConfirmationModal } from "./modals/DeleteConfirmationModal";
import { AuditPage } from "./audit/AuditPage";
import { useAppStore, createPartyId } from "./store/useAppStore";
import {
  EMPTY_ENTITY_FORM,
  type CoinSpendFormState,
  type CoinTransferFormState,
  type DeleteConfirmationState,
  type EntityFormState,
  type RecordFormState,
  type UserProfileFormState,
} from "./view-types";
import { EntityCreateModal, EntityEditModal } from "./entity/EntityModals";
import { InventoryRecordModal } from "./inventory/InventoryRecordModal";
import { PartyGearPage } from "./party-gear/PartyGearPage";
import { PartyPage } from "./pages/PartyPage";
import { CharactersPage } from "./pages/CharactersPage";
import {
  CoinSpendModal,
  CoinTransferModal,
  createEmptyCoinSpendAmounts,
  toCoinSpendAmounts,
} from "./inventory/CoinModals";
import {
  createEmptyRecordForm,
  createRecordFormFromRecord,
  toInventoryRecordFormInput,
} from "./inventory/InventoryRecordForm";

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
  const gmUid = useAppStore((state) => state.gmUid);
  const members = useAppStore((state) => state.members);
  const currentUserPartyRole = gmUid && members
    ? (currentUserId === gmUid ? "gm" as const : (members[currentUserId]?.role ?? null))
    : null;
  const sortedEntities = useMemo(
    () => getSortedEntities(appState.entities),
    [appState.entities],
  );
  const [formState, setFormState] =
    useState<EntityFormState>(EMPTY_ENTITY_FORM);
  const [editingEntityId, setEditingEntityId] = useState<EntityId | undefined>();
  const [editingName, setEditingName] = useState("");
  const [editingEntityType, setEditingEntityType] = useState<Entity["entityType"]>("character");
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
    setEditingEntityType(entity.entityType);
  }

  function saveEditing(entityId: EntityId) {
    updateEntity(entityId, {
      name: editingName,
      entityType: editingEntityType,
    });
    setEditingEntityId(undefined);
    setEditingName("");
    setEditingEntityType("character");
  }

  function cancelEditing() {
    setEditingEntityId(undefined);
    setEditingName("");
    setEditingEntityType("character");
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
        setEditingEntityType("character");
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

  const editingEntity = editingEntityId
    ? appState.entities.find((entity) => entity.id === editingEntityId)
    : undefined;

  const isWideWorkspaceRoute = [
    `/party/${partyId}`,
    `/party/${partyId}/inventory`,
    `/party/${partyId}/gear`,
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
          <NavLink to={`/party/${partyId}/gear`}>Inventory</NavLink>
          <NavLink to={`/party/${partyId}/characters`}>Characters</NavLink>
          <NavLink to={`/party/${partyId}/audit`}>Audit Log</NavLink>
        </nav>

        <Routes>
          <Route
            index
            element={
              <PartyPage
                appState={appState}
                inventoryPath={`/party/${partyId}/gear`}
                sortedEntities={sortedEntities}
              />
            }
          />
          <Route
            path="gear"
            element={
              <PartyGearPage
                currentUserPartyRole={currentUserPartyRole}
                onStartCreateEntity={startCreatingEntity}
                onStartAddRecord={startAddingRecord}
                onEditEntity={startEditing}
                onEditRecord={startEditingRecord}
                onIdentifyRecord={identifyInventoryRecord}
                onSpendCoins={startSpendingCoins}
              />
            }
          />
          <Route
            path="characters"
            element={
              <CharactersPage
                appState={appState}
                sortedEntities={sortedEntities}
                onEditEntity={startEditing}
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
            element={<Navigate to={`/party/${partyId}/gear`} replace />}
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
            currentUserPartyRole={currentUserPartyRole}
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

        {recordForm
          ? (() => {
              const recordFormEntity = appState.entities.find(
                (entity) => entity.id === recordForm.entityId,
              );

              return recordFormEntity ? (
                <InventoryRecordModal
                  appState={appState}
                  currentUserPartyRole={currentUserPartyRole}
                  entity={recordFormEntity}
                  formState={recordForm}
                  message={recordFormMessage}
                  onCancel={cancelRecordForm}
                  onChange={setRecordForm}
                  onDeleteRecord={requestDeleteInventoryRecord}
                  onSpendCoins={startSpendingCoins}
                  onSubmit={saveRecordForm}
                  onTransferCoins={startTransferringCoins}
                />
              ) : null;
            })()
          : null}

        {entityCreateModalOpen ? (
          <EntityCreateModal
            formState={formState}
            onCancel={cancelCreatingEntity}
            onChange={setFormState}
            onSubmit={handleCreateEntity}
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


        {editingEntity ? (
          <EntityEditModal
            appState={appState}
            editingEntityType={editingEntityType}
            editingName={editingName}
            entity={editingEntity}
            onCancel={cancelEditing}
            onChangeEditingEntityType={setEditingEntityType}
            onChangeEditingName={setEditingName}
            onDeleteEntity={requestDeleteEntity}
            onSaveEditing={saveEditing}
            onSetEntityActive={setEntityActive}
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

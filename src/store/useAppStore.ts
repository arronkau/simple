import { create } from "zustand";
import {
  applyEntityUpdate,
  createEntity,
  getNextEntitySortOrder,
  getSortedEntities,
  isCharacterLikeEntityType,
  type UpdateEntityInput,
} from "../model/entities";
import {
  adjustCharacterHp,
  adjustCharacterSpellMemorized,
  adjustCharacterXp,
  normalizeCharacterData,
  validateCharacterData,
} from "../model/characters";
import {
  createPartyState,
  createEmptyAppState,
  deleteLocalPartyState,
  forgetIndexedParty,
  migratePartyMembership,
  normalizePartyDisplayName,
  readLocalPartyStateResult,
  repairPartyMembership,
  readPartyIndex,
  rememberOpenedParty,
  renameIndexedParty,
  writeLocalPartyState,
  type AppState,
  type PartyId,
  type PartyIndexEntry,
  type PartyState,
} from "../model/appState";
import {
  PermissionError,
  assertEntityAction,
  assertInventoryAction,
  assertPartyAction,
  getProtectedInventoryFieldViolations,
  resolvePartyRole,
  type EntityAction,
  type InventoryAction,
  type PartyAction,
} from "../model/permissions";
import {
  createAuditLogEntry,
  formatCoinDelta,
  getCoinDelta,
  getCoinDeltaDetails,
  trimAuditLog,
  type CreateAuditLogEntryInput,
} from "../model/auditLog";
import { getCoinCount, getContainerCapacity } from "../model/calculations";
import {
  hasSecretIdentification,
  isUnidentifiedRecord,
} from "../model/recordVisibility";
import {
  lightRecord,
  snuffRecord,
  type SnuffOutcome,
} from "../model/lightSources";
import {
  createInventoryRecordFromInput,
  createInventoryLocation,
  getDefaultCoinRecord,
  getMoveDescendantRecordIds,
  isContainerRecordEmpty,
  mergeCoinData,
  moveInventoryRecord,
  updateInventoryRecordFromInput,
  type InventoryRecordFormInput,
  type InventoryRecordLocationInput,
} from "../model/inventoryRecords";
import type {
  AuditLogEntryId,
  CoinData,
  CoinsRecord,
  CharacterData,
  Entity,
  EntityId,
  EntityType,
  InventoryLocation,
  InventoryRecord,
  InventoryRecordId,
  PartyMembers,
  PartyRole,
  UserId,
  UserProfile,
  UserRole,
} from "../model/types";
import {
  createInitialInventoryRecordsForEntity,
  validateInventoryState,
} from "../model/validation";
import {
  createInviteCode,
  ensurePartyInviteCode,
  getInviteCodeFromSearch,
  INVITE_QUERY_PARAM,
} from "../model/partyInvite";
import { getRuntimeFirebaseConfig } from "../persistence/firebaseConfig";
import {
  deletePartyDocument,
  formatFirebaseError,
  linkOrSignInWithGoogle,
  signOutFirebase,
  startFirebaseAppStateSync,
  type FirebaseAuthAccount,
  type FirebaseWriter,
  type RemoteSnapshotMetadata,
} from "../persistence/firebaseSync";
import {
  classifyFirebaseWriteFailure,
  deriveSnapshotSyncStatus,
  getPermissionDeniedWriteMessage,
  runFirebaseWriteForGeneration,
  shouldBlockUnloadForFirebaseWrites,
} from "../persistence/firebaseWriteLifecycle";
import { canonicalizePartyState } from "../persistence/firestoreDocument";
import {
  diffPartyStates,
  mergeFieldUpdates,
  type FieldUpdate,
} from "../persistence/partyStateDiff";
import { createRetryScheduler } from "../persistence/retryBackoff";
import { createSyncWindowListeners } from "../persistence/syncWindowListeners";
import type { PersistenceMode, SyncStatus } from "../persistence/types";

export type AccountActionResult = { ok: true } | { ok: false; message: string };

export type PartyActionResult = { ok: true } | { ok: false; message: string };

export type DeletePartyResult =
  | { ok: true; nextPartyId: PartyId }
  | { ok: false; message: string };

type AppStore = {
  appState: AppState;
  authAccount?: FirebaseAuthAccount;
  currentUserId: UserId;
  gmUid?: string;
  inviteCode?: string;
  members?: PartyMembers;
  parties: PartyIndexEntry[];
  partyDisplayName: string;
  partyId: PartyId;
  persistenceMode: PersistenceMode;
  storageWarning?: string;
  syncError?: string;
  syncStatus: SyncStatus;
  updateCurrentUserProfile: (input: UserProfileInput) => void;
  renameParty: (displayName: string) => void;
  regenerateInviteCode: () => void;
  clearAuditLog: () => PartyActionResult;
  signInWithGoogle: () => Promise<AccountActionResult>;
  signOutAccount: () => Promise<AccountActionResult>;
  setCurrentParty: (partyId: PartyId) => void;
  createParty: () => PartyId;
  forgetParty: (
    partyId: PartyId,
    options?: { deleteStoredData?: boolean },
  ) => PartyActionResult;
  deleteCurrentParty: () => Promise<DeletePartyResult>;
  userProfiles: UserProfile[];
  createEntity: (input: CreateEntityStoreInput) => EntityId | undefined;
  updateEntity: (
    entityId: EntityId,
    input: UpdateEntityInput,
  ) => EntityMutationResult;
  updateCharacterData: (
    entityId: EntityId,
    characterData: CharacterData,
  ) => EntityMutationResult;
  adjustCharacterHp: (entityId: EntityId, delta: number) => EntityMutationResult;
  adjustCharacterXp: (entityId: EntityId, delta: number) => EntityMutationResult;
  adjustCharacterSpellMemorized: (
    entityId: EntityId,
    spellId: string,
    delta: number,
  ) => EntityMutationResult;
  setEntityActive: (entityId: EntityId, active: boolean) => void;
  deleteEntity: (entityId: EntityId) => void;
  createInventoryRecord: (
    entityId: EntityId,
    input: InventoryRecordFormInput,
  ) => InventoryMutationResult;
  updateInventoryRecord: (
    recordId: InventoryRecordId,
    input: InventoryRecordFormInput,
  ) => InventoryMutationResult;
  moveInventoryRecord: (
    recordId: InventoryRecordId,
    location: InventoryRecordLocationInput,
  ) => InventoryMutationResult;
  moveInventoryRecords: (
    moves: { recordId: InventoryRecordId; location: InventoryRecordLocationInput }[],
  ) => InventoryMutationResult;
  swapInventoryRecords: (
    recordIdA: InventoryRecordId,
    recordIdB: InventoryRecordId,
  ) => InventoryMutationResult;
  reorderEntity: (entityId: EntityId, targetIndex: number) => void;
  identifyInventoryRecord: (
    recordId: InventoryRecordId,
  ) => InventoryMutationResult;
  lightInventoryRecord: (recordId: InventoryRecordId) => InventoryMutationResult;
  snuffInventoryRecord: (
    recordId: InventoryRecordId,
    outcome: SnuffOutcome,
  ) => InventoryMutationResult;
  spendCoins: (
    recordId: InventoryRecordId,
    input: SpendCoinsInput,
  ) => InventoryMutationResult;
  transferCoins: (input: TransferCoinsInput) => InventoryMutationResult;
  deleteInventoryRecord: (
    recordId: InventoryRecordId,
  ) => InventoryMutationResult;
  replaceAppState: (appState: AppState) => void;
  resetLocalState: () => void;
};

type CreateEntityStoreInput = {
  name: string;
  entityType: EntityType;
};

type UserProfileInput = {
  displayName: string;
  role: UserRole;
};

export type CoinDenomination = keyof CoinData;

export type SpendCoinsInput = {
  amounts?: Partial<CoinData>;
  denomination?: CoinDenomination;
  amount?: number;
  note?: string;
};

export type TransferCoinsInput = {
  amounts: Partial<CoinData>;
  destinationEntityId: EntityId;
  note?: string;
  sourceEntityId: EntityId;
  /** Draw from this coin record instead of the entity's default one. */
  sourceRecordId?: InventoryRecordId;
};

export type InventoryMutationResult =
  | { ok: true; recordId?: InventoryRecordId }
  | { ok: false; message: string };

export type EntityMutationResult =
  | { ok: true }
  | { ok: false; message: string };

type AuditLogEntryInput = Omit<CreateAuditLogEntryInput, "createdAt" | "id">;

const COIN_DENOMINATIONS: CoinDenomination[] = ["pp", "gp", "sp", "cp"];
const LOCAL_USER_ID_STORAGE_KEY = "simple.inventory.localUserId.v1";
const LAST_PARTY_ID_STORAGE_KEY = "simple.inventory.lastPartyId.v1";

const firebaseConfig = getRuntimeFirebaseConfig();
const persistenceMode: PersistenceMode = firebaseConfig ? "firebase" : "local";
const initialPartyId = getInitialPartyId();
const initialCurrentUserId = readLocalUserId();
const initialPartyRead = readLocalPartyStateResult(initialPartyId);
const initialPartyState = prepareLoadedPartyState(
  initialPartyRead.partyState,
  initialCurrentUserId,
);

writeLocalPartyState(initialPartyState);

export const useAppStore = create<AppStore>((set) => ({
  appState: initialPartyState.appState,
  currentUserId: initialCurrentUserId,
  gmUid: initialPartyState.party.gmUid,
  inviteCode: initialPartyState.party.inviteCode,
  members: initialPartyState.party.members,
  parties: readPartyIndex(),
  partyDisplayName: initialPartyState.party.displayName,
  partyId: initialPartyState.party.id,
  persistenceMode,
  storageWarning: initialPartyRead.warning,
  syncError: undefined,
  syncStatus: persistenceMode === "firebase" ? "connecting" : "local",
  userProfiles: initialPartyState.userProfiles,
  updateCurrentUserProfile: (input) => {
    set((state) => {
      const displayName = normalizeUserDisplayName(input.displayName);
      const profile: UserProfile = {
        id: state.currentUserId,
        displayName,
        role: input.role,
        updatedAt: new Date().toISOString(),
      };
      const existingProfile = state.userProfiles.find(
        (candidateProfile) => candidateProfile.id === state.currentUserId,
      );

      return {
        userProfiles: existingProfile
          ? state.userProfiles.map((candidateProfile) =>
              candidateProfile.id === state.currentUserId
                ? profile
                : candidateProfile,
            )
          : [...state.userProfiles, profile],
      };
    });
  },
  renameParty: (displayName) => {
    set((state) => {
      const role = getStateUserRole(state);
      try {
        assertStorePartyAction(role, "editPartySettings");
      } catch {
        return state;
      }
      const partyDisplayName = normalizePartyDisplayName(displayName);

      return {
        partyDisplayName,
        parties: renameIndexedParty(state.partyId, partyDisplayName),
      };
    });
  },
  regenerateInviteCode: () => {
    set((state) => {
      const role = getStateUserRole(state);
      try {
        assertStorePartyAction(role, "manageMembership");
      } catch {
        return state;
      }
      return { inviteCode: createInviteCode() };
    });
  },
  clearAuditLog: () => {
    const role = getStateUserRole(useAppStore.getState());

    try {
      assertStorePartyAction(role, "clearAuditLog");
    } catch (error) {
      return {
        ok: false,
        message: formatPartyActionRefusal(
          error,
          "Only the GM can clear the audit log.",
        ),
      };
    }

    // The clear itself is not logged: MODEL_SPEC excludes reset state from the
    // audit log, and an entry describing the clear would survive it anyway.
    set((state) => ({ appState: { ...state.appState, auditLog: [] } }));

    return { ok: true };
  },
  signInWithGoogle: async () => {
    if (!firebaseConfig) {
      return { ok: false, message: "Sign-in requires Firebase mode." };
    }

    const result = await linkOrSignInWithGoogle(firebaseConfig);

    if (!result.ok) {
      return result;
    }

    useAppStore.setState({ authAccount: result.account });

    if (result.uidChanged) {
      // A different Firebase user is now signed in; membership and role must
      // be re-resolved against the party document under that UID.
      resetFirebaseWriteQueue();
      void startConfiguredFirebaseSync();
    }

    return { ok: true };
  },
  signOutAccount: async () => {
    if (!firebaseConfig) {
      return { ok: false, message: "Sign-out requires Firebase mode." };
    }

    try {
      await signOutFirebase(firebaseConfig);
    } catch (error) {
      return { ok: false, message: formatSyncError(error) };
    }

    useAppStore.setState({ authAccount: undefined });
    // Sync restarts under a fresh anonymous UID.
    resetFirebaseWriteQueue();
    void startConfiguredFirebaseSync();
    return { ok: true };
  },
  setCurrentParty: (partyId) => {
    // In Firebase mode the party is only remembered once it has actually been
    // read (see applyRemotePartyState), so "/" never redirects to a party the
    // user was denied.
    if (persistenceMode !== "firebase") {
      writeLastPartyId(partyId);
    }

    let partyChanged = false;
    set((state) => {
      if (state.partyId === partyId) {
        // Re-selecting the open party is still an open: keep it on top of
        // the recent list.
        return { parties: rememberOpenedParty(partyId, state.partyDisplayName) };
      }

      partyChanged = true;

      const partyRead = readLocalPartyStateResult(partyId);
      const partyState = prepareLoadedPartyState(
        partyRead.partyState,
        state.currentUserId,
      );

      stopConfiguredFirebaseSync();
      resetFirebaseWriteQueue();

      return {
        appState: partyState.appState,
        gmUid: partyState.party.gmUid,
        inviteCode: partyState.party.inviteCode,
        members: partyState.party.members,
        parties: rememberOpenedParty(partyId, partyState.party.displayName),
        userProfiles: partyState.userProfiles,
        partyDisplayName: partyState.party.displayName,
        partyId: partyState.party.id,
        storageWarning: partyRead.warning,
        syncError: undefined,
        syncStatus: persistenceMode === "firebase" ? "connecting" : "local",
      };
    });

    // Re-selecting the current party (e.g. the route effect on mount) must
    // not restart sync: a restart supersedes any in-flight write.
    if (partyChanged && firebaseConfig && canStartFirebaseSync()) {
      void startConfiguredFirebaseSync();
    }
  },
  createParty: () => {
    const partyId = createPartyId();
    const partyState = createPartyState({ partyId });

    // Local mode owns party creation outright. In Firebase mode the party
    // document is created by the existing sync path once the party opens.
    if (persistenceMode === "local") {
      writeLocalPartyState(partyState);
    }

    set({
      parties: rememberOpenedParty(partyId, partyState.party.displayName),
    });

    return partyId;
  },
  forgetParty: (partyId, options): PartyActionResult => {
    if (partyId === useAppStore.getState().partyId) {
      return {
        ok: false,
        message: "Open another party before forgetting this one.",
      };
    }

    if (options?.deleteStoredData) {
      deleteLocalPartyState(partyId);
      clearLastPartyId(partyId);
    }

    set({ parties: forgetIndexedParty(partyId) });

    return { ok: true };
  },
  deleteCurrentParty: async (): Promise<DeletePartyResult> => {
    const state = useAppStore.getState();
    const role = getStateUserRole(state);

    try {
      assertStorePartyAction(role, "deleteParty");
    } catch (error) {
      return {
        ok: false,
        message: formatPartyActionRefusal(
          error,
          "Only the GM can delete this party.",
        ),
      };
    }

    const deletedPartyId = state.partyId;

    // Stop the subscription first: a subscribed client treats a missing party
    // document as one it must create, and would write this party straight back.
    stopConfiguredFirebaseSync();
    resetFirebaseWriteQueue();

    if (firebaseConfig) {
      const deleteResult = await deletePartyDocument(
        firebaseConfig,
        deletedPartyId,
      );

      if (!deleteResult.ok) {
        // Nothing was deleted, so put the party back on sync.
        if (canStartFirebaseSync()) {
          void startConfiguredFirebaseSync();
        }

        return deleteResult;
      }
    }

    deleteLocalPartyState(deletedPartyId);
    clearLastPartyId(deletedPartyId);

    const remainingParties = forgetIndexedParty(deletedPartyId);

    set({ parties: remainingParties });

    // The caller navigates to this party, which loads it through the route.
    const nextPartyId =
      remainingParties[0]?.id ?? useAppStore.getState().createParty();

    return { ok: true, nextPartyId };
  },
  createEntity: (input) => {
    const name = input.name.trim();

    if (name.length === 0) {
      return undefined;
    }

    const role = getStateUserRole(useAppStore.getState());
    try {
      assertStoreEntityAction(role, "createEntity");
    } catch {
      return undefined;
    }

    const entityId = createId("entity");
    const backpackId = createId("record");

    set((state) => {
      const entity = createEntity({
        id: entityId,
        name,
        entityType: input.entityType,
        sortOrder: getNextEntitySortOrder(state.appState.entities),
      });

      const inventoryRecords = createInitialInventoryRecordsForEntity({
        entity,
        backpackId,
      });
      const nextAppState = appendAuditLogEntries(
        {
          ...state.appState,
          entities: [...state.appState.entities, entity],
          inventoryRecords: [
            ...state.appState.inventoryRecords,
            ...inventoryRecords,
          ],
        },
        [
          {
            entityId,
            eventType: "entityCreated",
            summary: `Created ${entity.entityType} "${entity.name}".`,
            details: {
              entityType: entity.entityType,
            },
          },
        ],
      );

      return {
        appState: nextAppState,
      };
    });

    return entityId;
  },
  updateEntity: (entityId, input) => {
    // Same permission gate as before; it now reports the refusal instead of
    // swallowing it, so the character sheet can show why nothing was saved.
    const role = getStateUserRole(useAppStore.getState());
    try {
      assertStoreEntityAction(role, "editEntity");
    } catch (e) {
      return {
        ok: false,
        message:
          e instanceof PermissionError ? e.message : "Permission denied.",
      };
    }

    let result: EntityMutationResult = {
      ok: false,
      message: "Entity was not found.",
    };

    set((state) => {
      const existingEntity = state.appState.entities.find(
        (entity) => entity.id === entityId,
      );

      if (!existingEntity) {
        return state;
      }

      const nextEntity = applyEntityUpdate(existingEntity, input);
      const nextAppState = {
        ...state.appState,
        entities: state.appState.entities.map((entity) =>
          entity.id === entityId ? nextEntity : entity,
        ),
      };

      result = { ok: true };

      return {
        appState: appendAuditLogEntries(
          nextAppState,
          createEntityActiveAuditEntries(existingEntity, nextEntity),
        ),
      };
    });

    return result;
  },
  updateCharacterData: (entityId, characterData) => {
    let result: EntityMutationResult = {
      ok: false,
      message: "Entity was not found.",
    };

    const role = getStateUserRole(useAppStore.getState());
    try {
      assertStoreEntityAction(role, "editEntity");
    } catch (e) {
      return { ok: false, message: e instanceof PermissionError ? e.message : "Permission denied." };
    }

    set((state) => {
      const existingEntity = state.appState.entities.find(
        (entity) => entity.id === entityId,
      );

      if (!existingEntity) {
        return state;
      }

      if (!isCharacterLikeEntityType(existingEntity.entityType)) {
        result = {
          ok: false,
          message: "Character sheets are only available for characters and retainers.",
        };
        return state;
      }

      const validationResult = validateCharacterData(characterData);

      if (!validationResult.valid) {
        result = {
          ok: false,
          message: validationResult.errors[0] ?? "Invalid character sheet.",
        };
        return state;
      }

      const nextEntity: Entity = {
        ...existingEntity,
        character: normalizeCharacterData(characterData),
      };

      result = { ok: true };

      return {
        appState: {
          ...state.appState,
          entities: state.appState.entities.map((entity) =>
            entity.id === entityId ? nextEntity : entity,
          ),
        },
      };
    });

    return result;
  },
  adjustCharacterHp: (entityId, delta) =>
    applyCharacterDataAdjustment(entityId, (characterData) =>
      adjustCharacterHp(characterData, delta),
    ),
  adjustCharacterXp: (entityId, delta) =>
    applyCharacterDataAdjustment(entityId, (characterData) =>
      adjustCharacterXp(characterData, delta),
    ),
  adjustCharacterSpellMemorized: (entityId, spellId, delta) =>
    applyCharacterDataAdjustment(entityId, (characterData) =>
      adjustCharacterSpellMemorized(characterData, spellId, delta),
    ),
  setEntityActive: (entityId, active) => {
    set((state) => {
      const role = getStateUserRole(state);
      try {
        assertStoreEntityAction(role, "editEntity");
      } catch {
        return state;
      }

      const existingEntity = state.appState.entities.find(
        (entity) => entity.id === entityId,
      );

      if (!existingEntity || existingEntity.active === active) {
        return state;
      }

      const nextEntity: Entity = { ...existingEntity, active };
      const nextAppState = {
        ...state.appState,
        entities: state.appState.entities.map((entity) =>
          entity.id === entityId ? nextEntity : entity,
        ),
      };

      return {
        appState: appendAuditLogEntries(
          nextAppState,
          createEntityActiveAuditEntries(existingEntity, nextEntity),
        ),
      };
    });
  },
  deleteEntity: (entityId) => {
    set((state) => {
      const role = getStateUserRole(state);
      try {
        assertStoreEntityAction(role, "deleteEntity");
      } catch {
        return state;
      }

      const entity = state.appState.entities.find(
        (candidateEntity) => candidateEntity.id === entityId,
      );

      if (!entity) {
        return state;
      }

      const deletedRecordCount = state.appState.inventoryRecords.filter(
        (record) => record.entityId === entityId,
      ).length;
      const nextAppState = {
        ...state.appState,
        entities: state.appState.entities.filter(
          (candidateEntity) => candidateEntity.id !== entityId,
        ),
        inventoryRecords: state.appState.inventoryRecords.filter(
          (record) => record.entityId !== entityId,
        ),
      };

      return {
        appState: appendAuditLogEntries(nextAppState, [
          {
            entityId,
            eventType: "entityDeleted",
            summary: `Deleted ${entity.entityType} "${entity.name}".`,
            details: {
              entityType: entity.entityType,
              deletedRecordCount,
            },
          },
        ]),
      };
    });
  },
  createInventoryRecord: (entityId, input) => {
    let result: InventoryMutationResult = {
      ok: false,
      message: "Entity was not found.",
    };

    const role = getStateUserRole(useAppStore.getState());
    try {
      assertStoreInventoryAction(role, "addItem");
    } catch (e) {
      return { ok: false, message: e instanceof PermissionError ? e.message : "Permission denied." };
    }

    // Secret identification fields are GM-only. Fail closed: only a confirmed
    // GM may write them. The UI hides these fields from non-GMs, so a non-GM
    // can only reach here by bypassing it. (Normal creates without secret fields
    // are unaffected — the guard only trips when secret fields are present.)
    if (role !== "gm") {
      const violations = getProtectedInventoryFieldViolations(input);
      if (violations.length > 0) {
        return { ok: false, message: "Players cannot edit hidden unidentified-record fields." };
      }
    }

    set((state) => {
      const targetEntityId = input.location?.entityId ?? entityId;
      const entity = state.appState.entities.find(
        (candidateEntity) => candidateEntity.id === targetEntityId,
      );

      if (!entity) {
        return state;
      }

      // Adding coins without naming a spot tops up the entity's default pile on
      // any entity type; an explicit placement always makes a new record.
      const existingDefaultCoinRecord =
        input.recordType === "coins" &&
        (input.location?.placement ?? "default") === "default"
          ? getDefaultCoinRecord(entity.id, state.appState.inventoryRecords)
          : undefined;

      if (
        input.recordType === "coins" &&
        existingDefaultCoinRecord?.recordType === "coins"
      ) {
        const previousCoins = existingDefaultCoinRecord.coins;
        const nextCoins = mergeCoinData(previousCoins, input.coins);
        const nextInventoryRecords = state.appState.inventoryRecords.map(
          (record) => {
            if (
              record.id !== existingDefaultCoinRecord.id ||
              record.recordType !== "coins"
            ) {
              return record;
            }

            return {
              ...record,
              coins: nextCoins,
            };
          },
        );
        const validationResult = validateInventoryState(
          state.appState.entities,
          nextInventoryRecords,
        );

        if (!validationResult.valid) {
          result = {
            ok: false,
            message: validationResult.errors[0]?.message ?? "Invalid record.",
          };
          return state;
        }

        result = { ok: true, recordId: existingDefaultCoinRecord.id };
        const coinDelta = getCoinDelta(previousCoins, nextCoins);

        return {
          appState: appendAuditLogEntries(
            {
              ...state.appState,
              inventoryRecords: nextInventoryRecords,
            },
            hasCoinDelta(coinDelta)
              ? [
                  createCoinChangeAuditEntryInput({
                    entity,
                    recordId: existingDefaultCoinRecord.id,
                    previousCoins,
                    nextCoins,
                  }),
                ]
              : [],
          ),
        };
      }

      const recordId = createId("record");
      const buildResult = createInventoryRecordFromInput({
        entity,
        id: recordId,
        records: state.appState.inventoryRecords,
        input: {
          ...input,
          // GM notes are GM-only: a non-GM create never writes them.
          ...(role === "gm" ? {} : { notes: undefined }),
          location: {
            ...(input.location ?? { placement: "default" }),
            entityId: entity.id,
          },
        },
      });

      if (!buildResult.ok) {
        result = buildResult;
        return state;
      }

      const nextInventoryRecords = [
        ...state.appState.inventoryRecords,
        buildResult.record,
      ];
      const validationResult = validateInventoryState(
        state.appState.entities,
        nextInventoryRecords,
      );

      if (!validationResult.valid) {
        result = {
          ok: false,
          message: validationResult.errors[0]?.message ?? "Invalid record.",
        };
        return state;
      }

      result = { ok: true, recordId };

      return {
        appState: appendAuditLogEntries(
          {
            ...state.appState,
            inventoryRecords: nextInventoryRecords,
          },
          [
            {
              entityId: buildResult.record.entityId,
              eventType: "inventoryRecordCreated",
              recordId,
              summary: `Created ${getInventoryRecordAuditLabel(
                buildResult.record,
              )} for ${formatEntityName(entity)}.`,
              details: createInventoryRecordDetails(
                buildResult.record,
                state.appState.entities,
              ),
            },
          ],
        ),
      };
    });

    return result;
  },
  updateInventoryRecord: (recordId, input) => {
    let result: InventoryMutationResult = {
      ok: false,
      message: "Inventory record was not found.",
    };

    const role = getStateUserRole(useAppStore.getState());
    try {
      assertStoreInventoryAction(role, "editItem");
    } catch (e) {
      return { ok: false, message: e instanceof PermissionError ? e.message : "Permission denied." };
    }

    // Fail closed: only a confirmed GM may write secret identification fields.
    if (role !== "gm") {
      const violations = getProtectedInventoryFieldViolations(input);
      if (violations.length > 0) {
        return { ok: false, message: "Players cannot edit hidden unidentified-record fields." };
      }
    }

    const storedRecord = useAppStore
      .getState()
      .appState.inventoryRecords.find(
        (candidateRecord) => candidateRecord.id === recordId,
      );

    // Unidentified items are read-only for players; the GM edits them. Players
    // can still move, light, and snuff them through their own actions.
    if (role !== "gm" && storedRecord && isUnidentifiedRecord(storedRecord)) {
      return { ok: false, message: "Only the GM can edit an unidentified record." };
    }

    // GM notes are GM-only always: a player save carries the stored notes
    // through unchanged rather than wiping the field it never saw.
    const guardedInput: InventoryRecordFormInput =
      role === "gm" ? input : { ...input, notes: storedRecord?.notes };

    set((state) => {
      const record = state.appState.inventoryRecords.find(
        (candidateRecord) => candidateRecord.id === recordId,
      );
      const targetEntityId = input.location?.entityId ?? record?.entityId;
      const entity = state.appState.entities.find(
        (candidateEntity) => candidateEntity.id === targetEntityId,
      );

      if (!record || !entity) {
        return state;
      }

      const buildResult = updateInventoryRecordFromInput({
        record,
        records: state.appState.inventoryRecords,
        entity,
        input: {
          ...guardedInput,
          location: {
            ...(guardedInput.location ?? { placement: "default" }),
            entityId: entity.id,
          },
        },
      });

      if (!buildResult.ok) {
        result = buildResult;
        return state;
      }

      const replacedInventoryRecords = state.appState.inventoryRecords.map(
        (candidateRecord) =>
          candidateRecord.id === recordId ? buildResult.record : candidateRecord,
      );
      const nextInventoryRecords =
        record.entityId === buildResult.record.entityId &&
        areInventoryLocationsEqual(record.location, buildResult.record.location)
        ? replacedInventoryRecords
        : moveInventoryRecord({
            recordId,
            records: replacedInventoryRecords,
            entityId: buildResult.record.entityId,
            location: buildResult.record.location,
          }).map((candidateRecord) =>
            candidateRecord.id === recordId
              ? {
                  ...buildResult.record,
                  sortOrder: candidateRecord.sortOrder,
                  location: candidateRecord.location,
                }
              : candidateRecord,
          );
      const validationResult = validateInventoryState(
        state.appState.entities,
        nextInventoryRecords,
      );

      if (!validationResult.valid) {
        result = {
          ok: false,
          message: validationResult.errors[0]?.message ?? "Invalid record.",
        };
        return state;
      }

      result = { ok: true, recordId };
      const nextRecord =
        nextInventoryRecords.find(
          (candidateRecord) => candidateRecord.id === recordId,
        ) ?? buildResult.record;

      return {
        appState: appendAuditLogEntries(
          {
            ...state.appState,
            inventoryRecords: nextInventoryRecords,
          },
          createInventoryUpdateAuditEntries({
            entity,
            previousRecord: record,
            nextRecord,
            entities: state.appState.entities,
          }),
        ),
      };
    });

    return result;
  },
  moveInventoryRecord: (recordId, location) => {
    let result: InventoryMutationResult = {
      ok: false,
      message: "Inventory record was not found.",
    };

    const role = getStateUserRole(useAppStore.getState());
    try {
      assertStoreInventoryAction(role, "moveItem");
    } catch (e) {
      return { ok: false, message: e instanceof PermissionError ? e.message : "Permission denied." };
    }

    set((state) => {
      const record = state.appState.inventoryRecords.find(
        (candidateRecord) => candidateRecord.id === recordId,
      );
      const entity = state.appState.entities.find(
        (candidateEntity) => candidateEntity.id === location.entityId,
      );

      if (!record || !entity) {
        return state;
      }

      const locationResult = createInventoryLocation({
        entity,
        recordType: record.recordType,
        records: state.appState.inventoryRecords,
        location,
        isContainer: Boolean(record.container),
        editingRecordId: recordId,
      });

      if (!locationResult.ok) {
        result = locationResult;
        return state;
      }

      const nextInventoryRecords = moveInventoryRecord({
        recordId,
        records: state.appState.inventoryRecords,
        entityId: entity.id,
        location: locationResult.location,
        targetIndex: location.targetIndex,
      });
      const validationResult = validateInventoryState(
        state.appState.entities,
        nextInventoryRecords,
      );

      if (!validationResult.valid) {
        result = {
          ok: false,
          message: validationResult.errors[0]?.message ?? "Invalid move.",
        };
        return state;
      }

      result = { ok: true, recordId };
      const nextRecord =
        nextInventoryRecords.find(
          (candidateRecord) => candidateRecord.id === recordId,
        ) ?? record;

      return {
        appState: appendAuditLogEntries(
          {
            ...state.appState,
            inventoryRecords: nextInventoryRecords,
          },
          record.entityId === nextRecord.entityId
            ? []
            : [
                createInventoryMoveAuditEntryInput({
                  record: nextRecord,
                  entities: state.appState.entities,
                  previousEntityId: record.entityId,
                  previousLocation: record.location,
                  nextEntityId: nextRecord.entityId,
                  nextLocation: nextRecord.location,
                }),
              ],
        ),
      };
    });

    return result;
  },
  moveInventoryRecords: (moves) => {
    let result: InventoryMutationResult = {
      ok: false,
      message: "No moves to apply.",
    };

    if (moves.length === 0) {
      return result;
    }

    const role = getStateUserRole(useAppStore.getState());
    try {
      assertStoreInventoryAction(role, "moveItem");
    } catch (e) {
      return { ok: false, message: e instanceof PermissionError ? e.message : "Permission denied." };
    }

    // Apply every move in one mutation so the board re-renders once, with no
    // intermediate hand-occupancy states flashing. Only the final state is
    // validated, so legal end states with illegal intermediates are allowed.
    set((state) => {
      let workingRecords = state.appState.inventoryRecords;
      const auditEntries: AuditLogEntryInput[] = [];

      for (const move of moves) {
        const record = workingRecords.find(
          (candidateRecord) => candidateRecord.id === move.recordId,
        );
        const entity = state.appState.entities.find(
          (candidateEntity) => candidateEntity.id === move.location.entityId,
        );

        if (!record || !entity) {
          result = { ok: false, message: "Inventory record was not found." };
          return state;
        }

        const locationResult = createInventoryLocation({
          entity,
          recordType: record.recordType,
          records: workingRecords,
          location: move.location,
          isContainer: Boolean(record.container),
          editingRecordId: move.recordId,
        });

        if (!locationResult.ok) {
          result = locationResult;
          return state;
        }

        const previousEntityId = record.entityId;
        const previousLocation = record.location;

        workingRecords = moveInventoryRecord({
          recordId: move.recordId,
          records: workingRecords,
          entityId: entity.id,
          location: locationResult.location,
          targetIndex: move.location.targetIndex,
        });

        const nextRecord = workingRecords.find(
          (candidateRecord) => candidateRecord.id === move.recordId,
        );

        if (nextRecord && previousEntityId !== nextRecord.entityId) {
          auditEntries.push(
            createInventoryMoveAuditEntryInput({
              entities: state.appState.entities,
              record: nextRecord,
              previousEntityId,
              previousLocation,
              nextEntityId: nextRecord.entityId,
              nextLocation: nextRecord.location,
            }),
          );
        }
      }

      const validationResult = validateInventoryState(
        state.appState.entities,
        workingRecords,
      );

      if (!validationResult.valid) {
        result = {
          ok: false,
          message: validationResult.errors[0]?.message ?? "Invalid move.",
        };
        return state;
      }

      result = { ok: true };

      return {
        appState: appendAuditLogEntries(
          {
            ...state.appState,
            inventoryRecords: workingRecords,
          },
          auditEntries,
        ),
      };
    });

    return result;
  },
  swapInventoryRecords: (recordIdA, recordIdB) => {
    if (recordIdA === recordIdB) {
      return { ok: true, recordId: recordIdA };
    }

    let result: InventoryMutationResult = {
      ok: false,
      message: "Inventory record was not found.",
    };

    const role = getStateUserRole(useAppStore.getState());
    try {
      assertStoreInventoryAction(role, "moveItem");
    } catch (e) {
      return { ok: false, message: e instanceof PermissionError ? e.message : "Permission denied." };
    }

    set((state) => {
      const recordA = state.appState.inventoryRecords.find(
        (candidateRecord) => candidateRecord.id === recordIdA,
      );
      const recordB = state.appState.inventoryRecords.find(
        (candidateRecord) => candidateRecord.id === recordIdB,
      );

      if (!recordA || !recordB) {
        return state;
      }

      const descendantsOfA = getMoveDescendantRecordIds(
        recordIdA,
        state.appState.inventoryRecords,
      );
      const descendantsOfB = getMoveDescendantRecordIds(
        recordIdB,
        state.appState.inventoryRecords,
      );

      if (descendantsOfA.has(recordIdB) || descendantsOfB.has(recordIdA)) {
        result = {
          ok: false,
          message: "Cannot swap a container with its own contents.",
        };
        return state;
      }

      const nextInventoryRecords = state.appState.inventoryRecords.map(
        (candidateRecord) => {
          if (candidateRecord.id === recordIdA) {
            return {
              ...candidateRecord,
              entityId: recordB.entityId,
              location: recordB.location,
              sortOrder: recordB.sortOrder,
            };
          }

          if (candidateRecord.id === recordIdB) {
            return {
              ...candidateRecord,
              entityId: recordA.entityId,
              location: recordA.location,
              sortOrder: recordA.sortOrder,
            };
          }

          if (descendantsOfA.has(candidateRecord.id)) {
            return { ...candidateRecord, entityId: recordB.entityId };
          }

          if (descendantsOfB.has(candidateRecord.id)) {
            return { ...candidateRecord, entityId: recordA.entityId };
          }

          return candidateRecord;
        },
      );
      const validationResult = validateInventoryState(
        state.appState.entities,
        nextInventoryRecords,
      );

      if (!validationResult.valid) {
        result = {
          ok: false,
          message: validationResult.errors[0]?.message ?? "Invalid swap.",
        };
        return state;
      }

      result = { ok: true, recordId: recordIdA };

      const swapAuditEntries: AuditLogEntryInput[] = [];
      const swapPairs: Array<{
        record: InventoryRecord;
        nextEntityId: EntityId;
        nextLocation: InventoryLocation;
      }> = [
        {
          record: recordA,
          nextEntityId: recordB.entityId,
          nextLocation: recordB.location,
        },
        {
          record: recordB,
          nextEntityId: recordA.entityId,
          nextLocation: recordA.location,
        },
      ];

      for (const { record, nextEntityId, nextLocation } of swapPairs) {
        if (
          record.entityId !== nextEntityId
        ) {
          swapAuditEntries.push(
            createInventoryMoveAuditEntryInput({
              entities: state.appState.entities,
              record,
              previousEntityId: record.entityId,
              previousLocation: record.location,
              nextEntityId,
              nextLocation,
            }),
          );
        }
      }

      return {
        appState: appendAuditLogEntries(
          {
            ...state.appState,
            inventoryRecords: nextInventoryRecords,
          },
          swapAuditEntries,
        ),
      };
    });

    return result;
  },
  reorderEntity: (entityId, targetIndex) => {
    set((state) => {
      const sortedEntities = getSortedEntities(state.appState.entities);
      const currentIndex = sortedEntities.findIndex(
        (entity) => entity.id === entityId,
      );

      if (currentIndex === -1) {
        return state;
      }

      const clampedIndex = Math.max(
        0,
        Math.min(targetIndex, sortedEntities.length - 1),
      );

      if (clampedIndex === currentIndex) {
        return state;
      }

      const reorderedEntities = [...sortedEntities];
      const [movedEntity] = reorderedEntities.splice(currentIndex, 1);
      reorderedEntities.splice(clampedIndex, 0, movedEntity);
      const sortOrderByEntityId = new Map(
        reorderedEntities.map((entity, index) => [entity.id, index * 1000]),
      );

      return {
        appState: {
          ...state.appState,
          entities: state.appState.entities.map((entity) => {
            const nextSortOrder = sortOrderByEntityId.get(entity.id);

            return nextSortOrder === undefined
              ? entity
              : { ...entity, sortOrder: nextSortOrder };
          }),
        },
      };
    });
  },
  identifyInventoryRecord: (recordId) => {
    let result: InventoryMutationResult = {
      ok: false,
      message: "Inventory record was not found.",
    };

    const role = getStateUserRole(useAppStore.getState());
    try {
      assertStoreInventoryAction(role, "identifyItem");
    } catch (e) {
      return { ok: false, message: e instanceof PermissionError ? e.message : "Permission denied." };
    }

    set((state) => {
      const record = state.appState.inventoryRecords.find(
        (candidateRecord) => candidateRecord.id === recordId,
      );

      if (!record || record.recordType === "coins") {
        return state;
      }

      if (!hasSecretIdentification(record)) {
        result = {
          ok: false,
          message: "Record has no secret identification fields.",
        };
        return state;
      }

      const entity = state.appState.entities.find(
        (candidateEntity) => candidateEntity.id === record.entityId,
      );

      if (!entity) {
        result = {
          ok: false,
          message: "Entity was not found.",
        };
        return state;
      }

      const nextRecord = revealInventoryRecord(record);
      const nextInventoryRecords = state.appState.inventoryRecords.map(
        (candidateRecord) =>
          candidateRecord.id === recordId ? nextRecord : candidateRecord,
      );
      const validationResult = validateInventoryState(
        state.appState.entities,
        nextInventoryRecords,
      );

      if (!validationResult.valid) {
        result = {
          ok: false,
          message:
            validationResult.errors[0]?.message ?? "Invalid identification.",
        };
        return state;
      }

      result = { ok: true, recordId };

      return {
        appState: appendAuditLogEntries(
          {
            ...state.appState,
            inventoryRecords: nextInventoryRecords,
          },
          [
            createIdentifyInventoryRecordAuditEntryInput({
              entity,
              nextRecord,
              previousRecord: record,
            }),
          ],
        ),
      };
    });

    return result;
  },
  lightInventoryRecord: (recordId) => {
    let result: InventoryMutationResult = {
      ok: false,
      message: "Inventory record was not found.",
    };

    const role = getStateUserRole(useAppStore.getState());
    try {
      assertStoreInventoryAction(role, "editItem");
    } catch (e) {
      return { ok: false, message: e instanceof PermissionError ? e.message : "Permission denied." };
    }

    set((state) => {
      const record = state.appState.inventoryRecords.find(
        (candidateRecord) => candidateRecord.id === recordId,
      );
      const entity = state.appState.entities.find(
        (candidateEntity) => candidateEntity.id === record?.entityId,
      );

      if (!record || !entity) {
        return state;
      }

      const lightResult = lightRecord({
        entity,
        record,
        records: state.appState.inventoryRecords,
        newRecordId: createId("record"),
      });

      if (!lightResult.ok) {
        result = lightResult;
        return state;
      }

      const validationResult = validateInventoryState(
        state.appState.entities,
        lightResult.records,
      );

      if (!validationResult.valid) {
        result = {
          ok: false,
          message: validationResult.errors[0]?.message ?? "Cannot light this item.",
        };
        return state;
      }

      const litRecord = lightResult.records.find(
        (candidateRecord) => candidateRecord.id === lightResult.litRecordId,
      );

      result = { ok: true, recordId: lightResult.litRecordId };

      return {
        appState: appendAuditLogEntries(
          {
            ...state.appState,
            inventoryRecords: lightResult.records,
          },
          litRecord
            ? [
                {
                  entityId: entity.id,
                  eventType: "inventoryRecordLit",
                  recordId: litRecord.id,
                  summary: `Lit ${getInventoryRecordAuditLabel(litRecord)} for ${formatEntityName(entity)}.`,
                  details: {
                    ...createInventoryRecordDetails(
                      litRecord,
                      state.appState.entities,
                    ),
                    splitFromStack: lightResult.split,
                  },
                },
              ]
            : [],
        ),
      };
    });

    return result;
  },
  snuffInventoryRecord: (recordId, outcome) => {
    let result: InventoryMutationResult = {
      ok: false,
      message: "Inventory record was not found.",
    };

    const role = getStateUserRole(useAppStore.getState());
    try {
      assertStoreInventoryAction(role, "editItem");
    } catch (e) {
      return { ok: false, message: e instanceof PermissionError ? e.message : "Permission denied." };
    }

    set((state) => {
      const record = state.appState.inventoryRecords.find(
        (candidateRecord) => candidateRecord.id === recordId,
      );
      const entity = state.appState.entities.find(
        (candidateEntity) => candidateEntity.id === record?.entityId,
      );

      if (!record || !entity) {
        return state;
      }

      const snuffResult = snuffRecord({
        record,
        records: state.appState.inventoryRecords,
        outcome,
      });

      if (!snuffResult.ok) {
        result = snuffResult;
        return state;
      }

      const validationResult = validateInventoryState(
        state.appState.entities,
        snuffResult.records,
      );

      if (!validationResult.valid) {
        result = {
          ok: false,
          message: validationResult.errors[0]?.message ?? "Cannot put out this item.",
        };
        return state;
      }

      result = { ok: true, recordId };

      return {
        appState: appendAuditLogEntries(
          {
            ...state.appState,
            inventoryRecords: snuffResult.records,
          },
          [
            {
              entityId: entity.id,
              eventType: "inventoryRecordSnuffed",
              recordId,
              summary: `Put out ${getInventoryRecordAuditLabel(record)} for ${formatEntityName(entity)} (${
                outcome.kind === "burnedOut"
                  ? "burned out"
                  : `${outcome.turns} turns remaining`
              }).`,
              details: {
                ...createInventoryRecordDetails(record, state.appState.entities),
                outcome: outcome.kind,
                ...(outcome.kind === "turnsRemaining"
                  ? { turnsRemaining: outcome.turns }
                  : {}),
                consumed: snuffResult.consumed,
              },
            },
          ],
        ),
      };
    });

    return result;
  },
  spendCoins: (recordId, input) => {
    let result: InventoryMutationResult = {
      ok: false,
      message: "Coin record was not found.",
    };

    const role = getStateUserRole(useAppStore.getState());
    try {
      assertStoreInventoryAction(role, "editCoins");
    } catch (e) {
      return { ok: false, message: e instanceof PermissionError ? e.message : "Permission denied." };
    }

    set((state) => {
      const record = state.appState.inventoryRecords.find(
        (candidateRecord) => candidateRecord.id === recordId,
      );

      if (!record || record.recordType !== "coins") {
        return state;
      }

      const entity = state.appState.entities.find(
        (candidateEntity) => candidateEntity.id === record.entityId,
      );

      if (!entity) {
        result = {
          ok: false,
          message: "Entity was not found.",
        };
        return state;
      }

      const spendAmounts = normalizeSpendAmounts(input);

      if (!spendAmounts.ok) {
        result = {
          ok: false,
          message: spendAmounts.message,
        };
        return state;
      }

      const overspentDenomination = COIN_DENOMINATIONS.find(
        (denomination) =>
          record.coins[denomination] < spendAmounts.amounts[denomination],
      );

      if (overspentDenomination) {
        result = {
          ok: false,
          message: `Cannot spend more ${overspentDenomination} than available.`,
        };
        return state;
      }

      const previousCoins = record.coins;
      const nextCoins: CoinData = {
        pp: record.coins.pp - spendAmounts.amounts.pp,
        gp: record.coins.gp - spendAmounts.amounts.gp,
        sp: record.coins.sp - spendAmounts.amounts.sp,
        cp: record.coins.cp - spendAmounts.amounts.cp,
      };
      const spentInventoryRecords = state.appState.inventoryRecords.map(
        (candidateRecord) =>
          candidateRecord.id === record.id && candidateRecord.recordType === "coins"
            ? { ...candidateRecord, coins: nextCoins }
            : candidateRecord,
      );
      const drainResult = removeDrainedCoinRecord({
        records: spentInventoryRecords,
        record,
        nextCoins,
        entity,
        entities: state.appState.entities,
        reason: "spend",
      });
      const nextInventoryRecords = drainResult.records;
      const validationResult = validateInventoryState(
        state.appState.entities,
        nextInventoryRecords,
      );

      if (!validationResult.valid) {
        result = {
          ok: false,
          message: validationResult.errors[0]?.message ?? "Invalid spend.",
        };
        return state;
      }

      result = { ok: true, recordId };

      return {
        appState: appendAuditLogEntries(
          {
            ...state.appState,
            inventoryRecords: nextInventoryRecords,
          },
          [
            createCoinSpendAuditEntryInput({
              amounts: spendAmounts.amounts,
              entity,
              nextCoins,
              note: input.note,
              previousCoins,
              recordId,
            }),
            ...drainResult.auditEntries,
          ],
        ),
      };
    });

    return result;
  },
  transferCoins: (input) => {
    let result: InventoryMutationResult = {
      ok: false,
      message: "Coin transfer could not be completed.",
    };

    const role = getStateUserRole(useAppStore.getState());
    try {
      assertStoreInventoryAction(role, "editCoins");
    } catch (e) {
      return { ok: false, message: e instanceof PermissionError ? e.message : "Permission denied." };
    }

    set((state) => {
      const sourceEntity = state.appState.entities.find(
        (entity) => entity.id === input.sourceEntityId,
      );
      const destinationEntity = state.appState.entities.find(
        (entity) => entity.id === input.destinationEntityId,
      );

      if (!sourceEntity) {
        result = {
          ok: false,
          message: "Source entity was not found.",
        };
        return state;
      }

      if (!destinationEntity) {
        result = {
          ok: false,
          message: "Destination entity was not found.",
        };
        return state;
      }

      if (sourceEntity.id === destinationEntity.id) {
        result = {
          ok: false,
          message: "Choose a different destination.",
        };
        return state;
      }

      const transferAmounts = normalizeSpendAmounts({ amounts: input.amounts });

      if (!transferAmounts.ok) {
        result = {
          ok: false,
          message: transferAmounts.message.replace("spend", "transfer"),
        };
        return state;
      }

      const sourceRecord = input.sourceRecordId
        ? state.appState.inventoryRecords.find(
            (record) => record.id === input.sourceRecordId,
          )
        : getDefaultCoinRecord(
            sourceEntity.id,
            state.appState.inventoryRecords,
          );

      if (
        !sourceRecord ||
        sourceRecord.recordType !== "coins" ||
        sourceRecord.entityId !== sourceEntity.id
      ) {
        result = {
          ok: false,
          message: "Source has no coin record.",
        };
        return state;
      }

      const overspentDenomination = COIN_DENOMINATIONS.find(
        (denomination) =>
          sourceRecord.coins[denomination] <
          transferAmounts.amounts[denomination],
      );

      if (overspentDenomination) {
        result = {
          ok: false,
          message: `Cannot transfer more ${overspentDenomination} than available.`,
        };
        return state;
      }

      const destinationRecord = getDefaultCoinRecord(
        destinationEntity.id,
        state.appState.inventoryRecords,
      );
      const previousSourceCoins = sourceRecord.coins;
      const nextSourceCoins: CoinData = {
        pp: sourceRecord.coins.pp - transferAmounts.amounts.pp,
        gp: sourceRecord.coins.gp - transferAmounts.amounts.gp,
        sp: sourceRecord.coins.sp - transferAmounts.amounts.sp,
        cp: sourceRecord.coins.cp - transferAmounts.amounts.cp,
      };
      let nextInventoryRecords = state.appState.inventoryRecords.map((record) =>
        record.id === sourceRecord.id && record.recordType === "coins"
          ? { ...record, coins: nextSourceCoins }
          : record,
      );
      let destinationRecordId = destinationRecord?.id;
      let previousDestinationCoins: CoinData = {
        pp: 0,
        gp: 0,
        sp: 0,
        cp: 0,
      };
      let nextDestinationCoins: CoinData;

      if (destinationRecord && destinationRecord.recordType === "coins") {
        previousDestinationCoins = destinationRecord.coins;
        nextDestinationCoins = mergeCoinData(
          destinationRecord.coins,
          transferAmounts.amounts,
        );
        nextInventoryRecords = nextInventoryRecords.map((record) =>
          record.id === destinationRecord.id && record.recordType === "coins"
            ? { ...record, coins: nextDestinationCoins }
            : record,
        );
      } else {
        destinationRecordId = createId("record");
        const buildResult = createInventoryRecordFromInput({
          entity: destinationEntity,
          id: destinationRecordId,
          records: nextInventoryRecords,
          input: {
            recordType: "coins",
            coins: transferAmounts.amounts,
            location: {
              entityId: destinationEntity.id,
              placement: "default",
            },
          },
        });

        if (!buildResult.ok) {
          result = buildResult;
          return state;
        }

        nextDestinationCoins =
          buildResult.record.recordType === "coins"
            ? buildResult.record.coins
            : { pp: 0, gp: 0, sp: 0, cp: 0 };
        nextInventoryRecords = [...nextInventoryRecords, buildResult.record];
      }

      if (!destinationRecordId) {
        result = {
          ok: false,
          message: "Destination coin record was not found.",
        };
        return state;
      }

      const drainResult = removeDrainedCoinRecord({
        records: nextInventoryRecords,
        record: sourceRecord,
        nextCoins: nextSourceCoins,
        entity: sourceEntity,
        entities: state.appState.entities,
        reason: "transfer",
      });

      nextInventoryRecords = drainResult.records;

      const validationResult = validateInventoryState(
        state.appState.entities,
        nextInventoryRecords,
      );

      if (!validationResult.valid) {
        result = {
          ok: false,
          message: validationResult.errors[0]?.message ?? "Invalid transfer.",
        };
        return state;
      }

      result = { ok: true, recordId: sourceRecord.id };

      return {
        appState: appendAuditLogEntries(
          {
            ...state.appState,
            inventoryRecords: nextInventoryRecords,
          },
          [
            createCoinTransferAuditEntryInput({
              amounts: transferAmounts.amounts,
              destinationEntity,
              destinationRecordId,
              nextDestinationCoins,
              nextSourceCoins,
              note: input.note,
              previousDestinationCoins,
              previousSourceCoins,
              sourceEntity,
              sourceRecordId: sourceRecord.id,
            }),
            ...drainResult.auditEntries,
          ],
        ),
      };
    });

    return result;
  },
  deleteInventoryRecord: (recordId) => {
    let result: InventoryMutationResult = {
      ok: false,
      message: "Inventory record was not found.",
    };

    const role = getStateUserRole(useAppStore.getState());
    try {
      assertStoreInventoryAction(role, "deleteItem");
    } catch (e) {
      return { ok: false, message: e instanceof PermissionError ? e.message : "Permission denied." };
    }

    set((state) => {
      const record = state.appState.inventoryRecords.find(
        (candidateRecord) => candidateRecord.id === recordId,
      );

      if (!record) {
        return state;
      }

      if (
        record.container &&
        (!isContainerRecordEmpty(record.id, state.appState.inventoryRecords) ||
          getMoveDescendantRecordIds(record.id, state.appState.inventoryRecords)
            .size > 0)
      ) {
        result = {
          ok: false,
          message: "Non-empty containers cannot be deleted.",
        };
        return state;
      }

      const nextInventoryRecords = state.appState.inventoryRecords.filter(
        (candidateRecord) => candidateRecord.id !== recordId,
      );
      const validationResult = validateInventoryState(
        state.appState.entities,
        nextInventoryRecords,
      );

      if (!validationResult.valid) {
        result = {
          ok: false,
          message: validationResult.errors[0]?.message ?? "Invalid delete.",
        };
        return state;
      }

      result = { ok: true, recordId };
      const entity = state.appState.entities.find(
        (candidateEntity) => candidateEntity.id === record.entityId,
      );

      return {
        appState: appendAuditLogEntries(
          {
            ...state.appState,
            inventoryRecords: nextInventoryRecords,
          },
          [
            {
              entityId: record.entityId,
              eventType: "inventoryRecordDeleted",
              recordId,
              summary: `Deleted ${getInventoryRecordAuditLabel(record)} from ${
                entity ? formatEntityName(entity) : record.entityId
              }.`,
              details: createInventoryRecordDetails(
                record,
                state.appState.entities,
              ),
            },
          ],
        ),
      };
    });

    return result;
  },
  replaceAppState: (appState) => {
    const role = getStateUserRole(useAppStore.getState());
    try {
      assertStorePartyAction(role, "importParty");
    } catch {
      return;
    }
    set({ appState });
  },
  resetLocalState: () => {
    const role = getStateUserRole(useAppStore.getState());
    try {
      assertStorePartyAction(role, "editPartySettings");
    } catch {
      return;
    }
    set({ appState: createEmptyAppState() });
  },
}));

const FIREBASE_WRITE_RETRY_DELAY_MS = 1000;
const FIREBASE_WRITE_MAX_RETRY_DELAY_MS = 30_000;

let applyingRemotePartyState = false;
let firebaseUnsubscribe: (() => void) | undefined;
let firebaseWriter: FirebaseWriter | undefined;
let firebaseOfflineWritesDurable = false;
let pendingFirebaseFieldUpdates: FieldUpdate[] = [];
let writingFirebaseFieldUpdates = false;
let firebaseSyncGeneration = 0;
// Local state must never be written to Firebase before we know the remote
// state. Otherwise a client that just loaded (e.g. a joining player whose
// local party is empty) would clobber the real party document. This stays
// false until the first remote snapshot has been processed.
let firebaseFirstSnapshotHandled = false;
// The last party state received from Firestore. A write the rules reject is
// rolled back to it, so local state cannot keep an edit the server refused.
let lastRemotePartyState: PartyState | undefined;

// A failed write must retry on its own: nothing else re-sends it, and waiting
// for the user's next edit would leave the batch unsent indefinitely.
const firebaseWriteRetries = createRetryScheduler({
  maxRetryDelayMs: FIREBASE_WRITE_MAX_RETRY_DELAY_MS,
  onRetry: () => {
    void flushFirebasePartyStateWrite();
  },
  retryDelayMs: FIREBASE_WRITE_RETRY_DELAY_MS,
});

const firebaseSyncWindowListeners = createSyncWindowListeners({
  onOnline: () => {
    // Connectivity is back: retry now instead of waiting out the backoff.
    firebaseWriteRetries.reset();
    void flushFirebasePartyStateWrite();
  },
  onPageHide: () => {
    if (writingFirebaseFieldUpdates) {
      handOffPendingFirebaseFieldUpdates();
      return;
    }

    void flushFirebasePartyStateWrite();
  },
  shouldBlockUnload: () =>
    shouldBlockUnloadForFirebaseWrites({
      offlineWritesDurable: firebaseOfflineWritesDurable,
      pendingUpdateCount: pendingFirebaseFieldUpdates.length,
      writeInFlight: writingFirebaseFieldUpdates,
    }),
});

useAppStore.subscribe((state, previousState) => {
  if (
    state.appState === previousState.appState &&
    state.gmUid === previousState.gmUid &&
    state.inviteCode === previousState.inviteCode &&
    state.members === previousState.members &&
    state.partyDisplayName === previousState.partyDisplayName &&
    state.partyId === previousState.partyId &&
    state.userProfiles === previousState.userProfiles
  ) {
    return;
  }

  const partyState = getPartyStateFromStoreState(state);

  writeLocalPartyState(partyState);

  if (applyingRemotePartyState) {
    applyingRemotePartyState = false;
    return;
  }

  if (state.persistenceMode === "firebase") {
    const previousPartyState = getPartyStateFromStoreState(previousState);
    queueFirebaseFieldUpdates(
      diffPartyStates(previousPartyState, partyState),
    );
  }
});

if (firebaseConfig && canStartFirebaseSync()) {
  void startConfiguredFirebaseSync();
}

function createId(prefix: "entity"): EntityId;
function createId(prefix: "record"): InventoryRecordId;
function createId(prefix: "audit"): AuditLogEntryId;
function createId(
  prefix: "audit" | "entity" | "record",
): AuditLogEntryId | EntityId | InventoryRecordId {
  const randomId =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  return `${prefix}-${randomId}`;
}

function appendAuditLogEntries(
  appState: AppState,
  entries: AuditLogEntryInput[],
): AppState {
  if (entries.length === 0) {
    return appState;
  }

  return {
    ...appState,
    auditLog: trimAuditLog([
      ...appState.auditLog,
      ...entries.map((entry) =>
        createAuditLogEntry({
          ...getCurrentAuditActor(),
          ...entry,
          createdAt: new Date().toISOString(),
          id: createId("audit"),
        }),
      ),
    ]),
  };
}

function createEntityActiveAuditEntries(
  previousEntity: Entity,
  nextEntity: Entity,
): AuditLogEntryInput[] {
  if (previousEntity.active === nextEntity.active) {
    return [];
  }

  const active = nextEntity.active;

  return [
    {
      entityId: nextEntity.id,
      eventType: active ? "entityActivated" : "entityDeactivated",
      summary: `${active ? "Activated" : "Deactivated"} ${formatEntityName(
        nextEntity,
      )}.`,
      details: {
        previousActive: previousEntity.active,
        nextActive: nextEntity.active,
      },
    },
  ];
}

function createInventoryUpdateAuditEntries(input: {
  entities: Entity[];
  entity: Entity;
  nextRecord: InventoryRecord;
  previousRecord: InventoryRecord;
}): AuditLogEntryInput[] {
  const entries: AuditLogEntryInput[] = [];

  if (
    input.previousRecord.entityId !== input.nextRecord.entityId ||
    !areInventoryLocationsEqual(
      input.previousRecord.location,
      input.nextRecord.location,
    )
  ) {
    entries.push(
      createInventoryMoveAuditEntryInput({
        entities: input.entities,
        nextEntityId: input.nextRecord.entityId,
        nextLocation: input.nextRecord.location,
        previousEntityId: input.previousRecord.entityId,
        previousLocation: input.previousRecord.location,
        record: input.nextRecord,
      }),
    );
  }

  if (
    input.previousRecord.recordType === "coins" &&
    input.nextRecord.recordType === "coins"
  ) {
    const coinDelta = getCoinDelta(
      input.previousRecord.coins,
      input.nextRecord.coins,
    );

    if (hasCoinDelta(coinDelta)) {
      entries.push(
        createCoinChangeAuditEntryInput({
          entity: input.entity,
          nextCoins: input.nextRecord.coins,
          previousCoins: input.previousRecord.coins,
          recordId: input.nextRecord.id,
        }),
      );
    }
  }

  if (
    input.previousRecord.recordType === "treasure" &&
    input.nextRecord.recordType === "treasure" &&
    input.previousRecord.treasure.gpValue !== input.nextRecord.treasure.gpValue
  ) {
    // The summary is rendered verbatim to every viewer, so the gp value of an
    // unidentified treasure stays out of it. `details` is GM-facing data that
    // no page renders, so the numbers are still recorded there.
    const label = getInventoryRecordAuditLabel(input.nextRecord);

    entries.push({
      entityId: input.nextRecord.entityId,
      eventType: "treasureValueChanged",
      recordId: input.nextRecord.id,
      summary: isUnidentifiedRecord(input.nextRecord)
        ? `Changed treasure value for ${label}.`
        : `Changed treasure value for ${label} from ${
            input.previousRecord.treasure.gpValue
          } gp to ${input.nextRecord.treasure.gpValue} gp.`,
      details: {
        previousGpValue: input.previousRecord.treasure.gpValue,
        nextGpValue: input.nextRecord.treasure.gpValue,
      },
    });
  }

  return entries;
}

function createCoinChangeAuditEntryInput(input: {
  entity: Entity;
  nextCoins: CoinData;
  previousCoins: CoinData;
  recordId: InventoryRecordId;
}): AuditLogEntryInput {
  const delta = getCoinDelta(input.previousCoins, input.nextCoins);

  return {
    entityId: input.entity.id,
    eventType: "coinsChanged",
    recordId: input.recordId,
    summary: `Changed coins for ${formatEntityName(input.entity)}: ${formatCoinDelta(
      delta,
    )}.`,
    details: {
      previousPp: input.previousCoins.pp,
      previousGp: input.previousCoins.gp,
      previousSp: input.previousCoins.sp,
      previousCp: input.previousCoins.cp,
      nextPp: input.nextCoins.pp,
      nextGp: input.nextCoins.gp,
      nextSp: input.nextCoins.sp,
      nextCp: input.nextCoins.cp,
      ...getCoinDeltaDetails(delta),
    },
  };
}

function createCoinSpendAuditEntryInput(input: {
  amounts: CoinData;
  entity: Entity;
  nextCoins: CoinData;
  note?: string;
  previousCoins: CoinData;
  recordId: InventoryRecordId;
}): AuditLogEntryInput {
  const note = input.note?.trim();

  return {
    entityId: input.entity.id,
    eventType: "coinsChanged",
    recordId: input.recordId,
    summary: `${input.entity.name} spent ${formatCoinSpendAmounts(
      input.amounts,
    )}${note ? ` — ${note}` : ""}.`,
    details: {
      spendPp: input.amounts.pp,
      spendGp: input.amounts.gp,
      spendSp: input.amounts.sp,
      spendCp: input.amounts.cp,
      spendNote: note || undefined,
      previousPp: input.previousCoins.pp,
      previousGp: input.previousCoins.gp,
      previousSp: input.previousCoins.sp,
      previousCp: input.previousCoins.cp,
      nextPp: input.nextCoins.pp,
      nextGp: input.nextCoins.gp,
      nextSp: input.nextCoins.sp,
      nextCp: input.nextCoins.cp,
      ...getCoinDeltaDetails(getCoinDelta(input.previousCoins, input.nextCoins)),
    },
  };
}

function createCoinTransferAuditEntryInput(input: {
  amounts: CoinData;
  destinationEntity: Entity;
  destinationRecordId: InventoryRecordId;
  nextDestinationCoins: CoinData;
  nextSourceCoins: CoinData;
  note?: string;
  previousDestinationCoins: CoinData;
  previousSourceCoins: CoinData;
  sourceEntity: Entity;
  sourceRecordId: InventoryRecordId;
}): AuditLogEntryInput {
  const note = input.note?.trim();

  return {
    entityId: input.sourceEntity.id,
    eventType: "coinsChanged",
    recordId: input.sourceRecordId,
    summary: `Transferred ${formatCoinSpendAmounts(input.amounts)} from ${
      input.sourceEntity.name
    } to ${input.destinationEntity.name}${note ? ` — ${note}` : ""}.`,
    details: {
      sourceEntityId: input.sourceEntity.id,
      destinationEntityId: input.destinationEntity.id,
      destinationRecordId: input.destinationRecordId,
      transferPp: input.amounts.pp,
      transferGp: input.amounts.gp,
      transferSp: input.amounts.sp,
      transferCp: input.amounts.cp,
      transferNote: note || undefined,
      previousSourcePp: input.previousSourceCoins.pp,
      previousSourceGp: input.previousSourceCoins.gp,
      previousSourceSp: input.previousSourceCoins.sp,
      previousSourceCp: input.previousSourceCoins.cp,
      nextSourcePp: input.nextSourceCoins.pp,
      nextSourceGp: input.nextSourceCoins.gp,
      nextSourceSp: input.nextSourceCoins.sp,
      nextSourceCp: input.nextSourceCoins.cp,
      previousDestinationPp: input.previousDestinationCoins.pp,
      previousDestinationGp: input.previousDestinationCoins.gp,
      previousDestinationSp: input.previousDestinationCoins.sp,
      previousDestinationCp: input.previousDestinationCoins.cp,
      nextDestinationPp: input.nextDestinationCoins.pp,
      nextDestinationGp: input.nextDestinationCoins.gp,
      nextDestinationSp: input.nextDestinationCoins.sp,
      nextDestinationCp: input.nextDestinationCoins.cp,
    },
  };
}

function createIdentifyInventoryRecordAuditEntryInput(input: {
  entity: Entity;
  nextRecord: InventoryRecord;
  previousRecord: InventoryRecord;
}): AuditLogEntryInput {
  const identifiedAs =
    input.previousRecord.recordType !== "coins" &&
    input.previousRecord.identification?.secretName
      ? ` as ${input.nextRecord.recordType !== "coins" ? input.nextRecord.name : "coins"}`
      : "";

  return {
    entityId: input.entity.id,
    eventType: "inventoryRecordIdentified",
    recordId: input.nextRecord.id,
    summary: `Identified ${getInventoryRecordPublicLabel(
      input.previousRecord,
    )}${identifiedAs}.`,
    details: {
      previousName:
        input.previousRecord.recordType === "coins"
          ? "coins"
          : input.previousRecord.name,
      nextName:
        input.nextRecord.recordType === "coins" ? "coins" : input.nextRecord.name,
      previousDescription: input.previousRecord.description,
      nextDescription: input.nextRecord.description,
    },
  };
}

function revealInventoryRecord(record: InventoryRecord): InventoryRecord {
  if (record.recordType === "coins") {
    return record;
  }

  const secretName = record.identification?.secretName?.trim();
  const secretDescription = record.identification?.secretDescription?.trim();
  const { identification: _identification, ...recordWithoutIdentification } =
    record;

  return {
    ...recordWithoutIdentification,
    ...(secretName ? { name: secretName } : {}),
    ...(secretDescription ? { description: secretDescription } : {}),
  } as InventoryRecord;
}

function normalizeSpendAmounts(
  input: SpendCoinsInput,
):
  | { ok: true; amounts: CoinData }
  | { ok: false; message: string } {
  const rawAmounts = input.amounts ?? {};
  const amounts: CoinData = {
    pp: normalizeSpendAmount(rawAmounts.pp),
    gp: normalizeSpendAmount(rawAmounts.gp),
    sp: normalizeSpendAmount(rawAmounts.sp),
    cp: normalizeSpendAmount(rawAmounts.cp),
  };

  if (
    input.amounts === undefined &&
    input.denomination !== undefined &&
    input.amount !== undefined
  ) {
    if (!isSpendCoinDenomination(input.denomination)) {
      return { ok: false, message: "Choose a valid coin type." };
    }

    amounts[input.denomination] = input.amount;
  }

  if (
    COIN_DENOMINATIONS.some(
      (denomination) =>
        !Number.isInteger(amounts[denomination]) ||
        amounts[denomination] < 0,
    )
  ) {
    return {
      ok: false,
      message: "Spend amounts must be non-negative whole numbers.",
    };
  }

  if (
    !COIN_DENOMINATIONS.some((denomination) => amounts[denomination] > 0)
  ) {
    return {
      ok: false,
      message: "Enter at least one coin amount to spend.",
    };
  }

  return { ok: true, amounts };
}

function normalizeSpendAmount(value: number | undefined): number {
  return value ?? 0;
}

function formatCoinSpendAmounts(amounts: CoinData): string {
  return COIN_DENOMINATIONS.filter((denomination) => amounts[denomination] > 0)
    .map((denomination) => `${amounts[denomination]} ${denomination}`)
    .join(", ");
}

/**
 * A coins record drained to zero is removed on every entity type, so no empty
 * "Coins" row lingers and no phantom child makes its container look loaded.
 * The next transfer in recreates one at the default location. `records` must
 * already carry `nextCoins`; the returned list drops the record when drained.
 */
function removeDrainedCoinRecord(input: {
  records: InventoryRecord[];
  record: CoinsRecord;
  nextCoins: CoinData;
  entity: Entity;
  entities: Entity[];
  reason: "spend" | "transfer";
}): { records: InventoryRecord[]; auditEntries: AuditLogEntryInput[] } {
  if (getCoinCount(input.nextCoins) !== 0) {
    return { records: input.records, auditEntries: [] };
  }

  const drainedRecord: InventoryRecord = {
    ...input.record,
    coins: input.nextCoins,
  };

  return {
    records: input.records.filter((record) => record.id !== input.record.id),
    auditEntries: [
      {
        entityId: input.entity.id,
        eventType: "inventoryRecordDeleted" as const,
        recordId: input.record.id,
        summary: `Deleted ${getInventoryRecordAuditLabel(
          drainedRecord,
        )} from ${formatEntityName(input.entity)} (emptied by ${input.reason}).`,
        details: createInventoryRecordDetails(
          drainedRecord,
          input.entities,
        ),
      },
    ],
  };
}

function createInventoryMoveAuditEntryInput(input: {
  entities: Entity[];
  nextEntityId: EntityId;
  nextLocation: InventoryLocation;
  previousEntityId: EntityId;
  previousLocation: InventoryLocation;
  record: InventoryRecord;
}): AuditLogEntryInput {
  return {
    entityId: input.nextEntityId,
    eventType: "inventoryRecordMoved",
    recordId: input.record.id,
    summary: `Moved ${getInventoryRecordAuditLabel(
      input.record,
    )} from ${formatInventoryLocation(
      input.previousEntityId,
      input.previousLocation,
      input.entities,
    )} to ${formatInventoryLocation(
      input.nextEntityId,
      input.nextLocation,
      input.entities,
    )}.`,
    details: {
      fromEntityId: input.previousEntityId,
      toEntityId: input.nextEntityId,
      fromLocation: formatInventoryLocation(
        input.previousEntityId,
        input.previousLocation,
        input.entities,
      ),
      toLocation: formatInventoryLocation(
        input.nextEntityId,
        input.nextLocation,
        input.entities,
      ),
    },
  };
}

function createInventoryRecordDetails(
  record: InventoryRecord,
  entities: Entity[],
): Record<string, string | number | boolean | null> {
  const details: Record<string, string | number | boolean | null> = {
    location: formatInventoryLocation(record.entityId, record.location, entities),
    recordType: record.recordType,
  };

  if (record.recordType === "treasure") {
    details.gpValue = record.treasure.gpValue;
  }

  if (record.container) {
    const capacitySlots = getContainerCapacity(record);

    if (capacitySlots !== undefined) {
      details.capacitySlots = capacitySlots;
    }
  }

  return details;
}

function formatEntityName(entity: Entity): string {
  return `"${entity.name}"`;
}

function getInventoryRecordAuditLabel(record: InventoryRecord): string {
  if (record.recordType === "coins") {
    return "coins";
  }

  return `"${record.name}"`;
}

function getInventoryRecordPublicLabel(record: InventoryRecord): string {
  return record.recordType === "coins" ? "coins" : record.name;
}

function formatInventoryLocation(
  entityId: EntityId,
  location: InventoryLocation,
  entities: Entity[],
): string {
  const entity = entities.find(
    (candidateEntity) => candidateEntity.id === entityId,
  );
  const entityLabel = entity ? entity.name : entityId;
  const containerLabel =
    "containerId" in location ? ` in ${location.containerId}` : "";
  const placement =
    location.kind === "equipped" ? location.placement : location.kind;

  return `${entityLabel} ${placement}${containerLabel}`;
}

function hasCoinDelta(delta: CoinData): boolean {
  return delta.pp !== 0 || delta.gp !== 0 || delta.sp !== 0 || delta.cp !== 0;
}

function isSpendCoinDenomination(
  value: string,
): value is CoinDenomination {
  return value === "pp" || value === "gp" || value === "sp" || value === "cp";
}

function areInventoryLocationsEqual(
  leftLocation: InventoryLocation,
  rightLocation: InventoryLocation,
): boolean {
  const leftContainerId =
    "containerId" in leftLocation ? leftLocation.containerId : undefined;
  const rightContainerId =
    "containerId" in rightLocation ? rightLocation.containerId : undefined;

  return (
    leftLocation.kind === rightLocation.kind &&
    getInventoryLocationPlacement(leftLocation) ===
      getInventoryLocationPlacement(rightLocation) &&
    leftContainerId === rightContainerId
  );
}

function getInventoryLocationPlacement(location: InventoryLocation): string {
  return location.kind === "equipped" ? location.placement : location.kind;
}

function canStartFirebaseSync(): boolean {
  return typeof window !== "undefined";
}

async function startConfiguredFirebaseSync(): Promise<void> {
  if (!firebaseConfig) {
    return;
  }

  firebaseSyncGeneration += 1;
  const activeSyncGeneration = firebaseSyncGeneration;
  stopConfiguredFirebaseSync();
  // Unload/online handling belongs to a running sync session; stop() above
  // removed the previous session's handlers, so this cannot stack up.
  firebaseSyncWindowListeners.start();
  // Re-gate writes for the new connection until its first snapshot lands.
  // Any write still in flight belongs to the previous generation: its
  // settlement is ignored, so release the write flag here.
  firebaseFirstSnapshotHandled = false;
  writingFirebaseFieldUpdates = false;

  const activePartyId = useAppStore.getState().partyId;
  // Every callback from a superseded start must be a no-op, otherwise a
  // late auth failure or snapshot from the old connection can overwrite the
  // status or state of the new one.
  const isActiveSync = () =>
    firebaseSyncGeneration === activeSyncGeneration &&
    useAppStore.getState().partyId === activePartyId;
  const unsubscribe = await startFirebaseAppStateSync({
    config: firebaseConfig,
    getCurrentPartyState: () =>
      getPartyStateFromStoreState(useAppStore.getState()),
    inviteCode: getInviteCodeFromLocation(),
    onError: (message) => {
      if (!isActiveSync()) {
        return;
      }

      setSyncMetadata("error", message);
    },
    onAuthAccount: (authAccount) => {
      if (!isActiveSync()) {
        return;
      }

      useAppStore.setState({ authAccount });
    },
    onJoined: () => {
      if (!isActiveSync()) {
        return;
      }

      removeInviteCodeFromLocation();
    },
    onPartyDeleted: (partyId) => {
      if (!isActiveSync()) {
        return;
      }

      useAppStore.setState({ parties: forgetDeletedParty(partyId) });
    },
    onAuthUserId: (userId) => {
      if (!isActiveSync()) {
        return;
      }

      // Auth only establishes identity. Membership and `gmUid` belong to the
      // remote document: they arrive with the first snapshot, or are written by
      // the document-creation path with this UID as GM. Claiming GM here would
      // make any visitor the GM of a party they may not even be able to read.
      useAppStore.setState({ currentUserId: userId });
    },
    onReadyToWrite: (writer) => {
      if (!isActiveSync()) {
        return;
      }

      firebaseWriter = writer;
      firebaseOfflineWritesDurable = writer.offlineWritesDurable;
      void flushFirebasePartyStateWrite();
    },
    onRemotePartyState: (partyState, metadata) => {
      if (!isActiveSync() || partyState.party.id !== activePartyId) {
        return;
      }

      applyRemotePartyState(partyState, metadata);
    },
    onStatusChange: (syncStatus) => {
      if (!isActiveSync()) {
        return;
      }

      setSyncMetadata(syncStatus);
    },
    partyId: activePartyId,
  });

  if (isActiveSync()) {
    firebaseUnsubscribe = unsubscribe;
  } else {
    unsubscribe();
  }
}

function stopConfiguredFirebaseSync(): void {
  firebaseSyncWindowListeners.stop();
  firebaseWriteRetries.cancel();
  firebaseUnsubscribe?.();
  firebaseUnsubscribe = undefined;
}

function resetFirebaseWriteQueue(): void {
  handOffPendingFirebaseFieldUpdates();
  firebaseSyncGeneration += 1;
  firebaseWriter = undefined;
  firebaseOfflineWritesDurable = false;
  firebaseWriteRetries.reset();
  lastRemotePartyState = undefined;
  pendingFirebaseFieldUpdates = [];
  writingFirebaseFieldUpdates = false;
  firebaseFirstSnapshotHandled = false;
}

/**
 * Last chance to get queued updates to Firestore before the queue is dropped
 * (sign-in, sign-out, party switch) or the page goes away. The write belongs to
 * a generation that is about to be superseded, so its result is ignored; what
 * matters is that the Firestore SDK has taken it, which makes it durable
 * whenever the persistent cache is active.
 *
 * Updates queued before the writer exists or before the first snapshot cannot
 * be sent at all — they stay in localStorage and the next snapshot is
 * authoritative for the party document (see SYNC_SPEC.md).
 */
function handOffPendingFirebaseFieldUpdates(): void {
  if (
    !firebaseWriter ||
    !firebaseFirstSnapshotHandled ||
    pendingFirebaseFieldUpdates.length === 0
  ) {
    return;
  }

  const updates = pendingFirebaseFieldUpdates;
  pendingFirebaseFieldUpdates = [];
  void firebaseWriter.applyFieldUpdates(updates).catch(() => undefined);
}

function queueFirebaseFieldUpdates(updates: FieldUpdate[]): void {
  pendingFirebaseFieldUpdates = mergeFieldUpdates(
    pendingFirebaseFieldUpdates,
    updates,
  );

  if (!firebaseWriter || pendingFirebaseFieldUpdates.length === 0) {
    return;
  }

  void flushFirebasePartyStateWrite();
}

async function flushFirebasePartyStateWrite(): Promise<void> {
  if (
    !firebaseWriter ||
    pendingFirebaseFieldUpdates.length === 0 ||
    writingFirebaseFieldUpdates ||
    // Never write local state before the first remote snapshot is processed.
    !firebaseFirstSnapshotHandled
  ) {
    return;
  }

  const writer = firebaseWriter;
  const writeGeneration = firebaseSyncGeneration;
  const updates = pendingFirebaseFieldUpdates;
  pendingFirebaseFieldUpdates = [];
  writingFirebaseFieldUpdates = true;
  setSyncMetadata("saving");

  await runFirebaseWriteForGeneration({
    generation: writeGeneration,
    getCurrentGeneration: () => firebaseSyncGeneration,
    write: () => writer.applyFieldUpdates(updates),
    onSuccess: () => {
      writingFirebaseFieldUpdates = false;
      firebaseWriteRetries.reset();

      if (pendingFirebaseFieldUpdates.length > 0) {
        void flushFirebasePartyStateWrite();
        return;
      }

      // The write promise settles on server acknowledgement, so the document
      // is now committed, not just echoed locally.
      setSyncMetadata("synced");
    },
    onFailure: (error) => {
      writingFirebaseFieldUpdates = false;

      // Rules rejected the batch; repeating it can only fail again. Drop it and
      // roll local state back to the last thing the server sent us.
      if (classifyFirebaseWriteFailure(error) === "permission-denied") {
        pendingFirebaseFieldUpdates = [];
        firebaseWriteRetries.reset();
        restoreLastRemotePartyState();
        setSyncMetadata(
          "error",
          getPermissionDeniedWriteMessage(
            getStateUserRole(useAppStore.getState()),
          ),
        );
        return;
      }

      pendingFirebaseFieldUpdates = mergeFieldUpdates(
        updates,
        pendingFirebaseFieldUpdates,
      );
      const retryDelayMs = firebaseWriteRetries.recordFailure();

      setSyncMetadata(
        "error",
        `${formatSyncError(error)} Retrying in ${Math.round(
          retryDelayMs / 1000,
        )}s.`,
      );
    },
  });
}

function applyRemotePartyState(
  partyState: PartyState,
  metadata: RemoteSnapshotMetadata,
): void {
  // The remote document is authoritative on first contact. Any local write
  // queued before we saw it (e.g. an empty party from a freshly-loaded client)
  // must be discarded so it can't overwrite the real party.
  if (!firebaseFirstSnapshotHandled) {
    firebaseFirstSnapshotHandled = true;
    pendingFirebaseFieldUpdates = [];
  }

  const snapshotSyncStatus = deriveSnapshotSyncStatus({
    fromCache: metadata.fromCache,
    hasPendingWrites: metadata.hasPendingWrites,
    pendingUpdateCount: pendingFirebaseFieldUpdates.length,
    retryPending: firebaseWriteRetries.hasPendingRetry(),
    writeInFlight: writingFirebaseFieldUpdates,
  });

  if (snapshotSyncStatus) {
    setSyncMetadata(snapshotSyncStatus);
  }

  // A snapshot carrying unacknowledged local writes is this client's own echo.
  // It shows what the Firestore SDK holds, which is behind any update still
  // queued here and ahead of what the server has confirmed, so it moves the
  // status only. The acknowledgement snapshot carries the same content plus
  // anything another client changed meanwhile.
  if (metadata.hasPendingWrites) {
    return;
  }

  // The document was readable, so this party is safe to reopen by default.
  writeLastPartyId(partyState.party.id);

  const currentState = useAppStore.getState();
  // Repair only: GM identity comes from the document, never from the reader.
  const resolvedPartyState = repairPartyMembership(partyState);
  lastRemotePartyState = resolvedPartyState;

  applyPartyStateFromRemote(resolvedPartyState);

  // A rename by the GM (or the party's real name arriving with the first
  // snapshot) is still a rename: keep this device's party list in step.
  if (currentState.partyDisplayName !== resolvedPartyState.party.displayName) {
    useAppStore.setState({
      parties: renameIndexedParty(
        resolvedPartyState.party.id,
        resolvedPartyState.party.displayName,
      ),
    });
  }

  // A GM client gives a pre-invite party its first invite code. This is a
  // real local change (not a remote apply) so it is written back to Firestore.
  const partyStateWithInvite = ensurePartyInviteCode(
    resolvedPartyState,
    currentState.currentUserId,
  );

  if (partyStateWithInvite.party.inviteCode !== resolvedPartyState.party.inviteCode) {
    useAppStore.setState({ inviteCode: partyStateWithInvite.party.inviteCode });
  }
}

function applyPartyStateFromRemote(partyState: PartyState): void {
  const currentPartyState = getPartyStateFromStoreState(useAppStore.getState());

  if (arePartyStatesEqual(currentPartyState, partyState)) {
    return;
  }

  applyingRemotePartyState = true;
  useAppStore.setState({
    appState: partyState.appState,
    gmUid: partyState.party.gmUid,
    inviteCode: partyState.party.inviteCode,
    members: partyState.party.members,
    partyDisplayName: partyState.party.displayName,
    userProfiles: partyState.userProfiles,
  });
}

/**
 * Rolls local state back to the last snapshot after the server refused a write.
 * Without this the client would keep showing an edit that does not exist in the
 * party document and has no way of ever getting there.
 */
function restoreLastRemotePartyState(): void {
  if (!lastRemotePartyState) {
    return;
  }

  applyPartyStateFromRemote(lastRemotePartyState);
}

function setSyncMetadata(syncStatus: SyncStatus, syncError?: string): void {
  useAppStore.setState({
    syncError: syncStatus === "error" ? syncError : undefined,
    syncStatus,
  });
}

function arePartyStatesEqual(
  leftPartyState: PartyState,
  rightPartyState: PartyState,
): boolean {
  return (
    JSON.stringify(canonicalizePartyState(leftPartyState)) ===
    JSON.stringify(canonicalizePartyState(rightPartyState))
  );
}

function getPartyStateFromStoreState(
  state: Pick<
    AppStore,
    | "appState"
    | "gmUid"
    | "inviteCode"
    | "members"
    | "partyDisplayName"
    | "partyId"
    | "userProfiles"
  >,
): PartyState {
  return createPartyState({
    appState: state.appState,
    displayName: state.partyDisplayName,
    gmUid: state.gmUid,
    inviteCode: state.inviteCode,
    members: state.members,
    partyId: state.partyId,
    userProfiles: state.userProfiles,
  });
}

function getStateUserRole(
  state: Pick<AppStore, "currentUserId" | "gmUid" | "members">,
): PartyRole | null {
  return resolvePartyRole(state.currentUserId, state.gmUid, state.members);
}

/**
 * Prepares a party loaded from localStorage. A local party belongs to the local
 * user, so membership is migrated and an invite code ensured. In Firebase mode
 * `gmUid` and `members` come from the remote document, so the cached copy is
 * used as-is (only a missing GM member entry is repaired) and a visitor who
 * cannot read the party never becomes its GM locally.
 */
function prepareLoadedPartyState(
  partyState: PartyState,
  currentUserId: UserId,
): PartyState {
  if (persistenceMode === "firebase") {
    return repairPartyMembership(partyState);
  }

  return ensurePartyInviteCode(
    migratePartyMembership(partyState, currentUserId),
    currentUserId,
  );
}

/**
 * Role a store action is checked against. A local party has no remote
 * membership document, so an unresolved role acts as a player. In Firebase mode
 * an unresolved role means the party document has not been read yet — or the
 * read was denied — and the action is refused instead of being downgraded to a
 * player action.
 */
export function resolveActionRole(
  role: PartyRole | null,
  mode: PersistenceMode,
): PartyRole | null {
  if (role) {
    return role;
  }

  return mode === "firebase" ? null : "player";
}

export function formatUnresolvedRoleMessage(syncStatus: SyncStatus): string {
  return syncStatus === "error"
    ? "You are not a member of this party. Ask the GM for an invite link."
    : "This party has not finished loading. Try again in a moment.";
}

function requireActionRole(role: PartyRole | null): PartyRole {
  const actionRole = resolveActionRole(role, persistenceMode);

  if (!actionRole) {
    throw new PermissionError(
      formatUnresolvedRoleMessage(useAppStore.getState().syncStatus),
      "not-party-member",
    );
  }

  return actionRole;
}

/**
 * Message for a party action the store refused. An unresolved role — Firebase
 * mode before the first snapshot, or a read the rules denied — is not the same
 * as being a player, so its own explanation is kept rather than being reported
 * as a GM-only restriction.
 */
export function formatPartyActionRefusal(
  error: unknown,
  gmOnlyMessage: string,
): string {
  return error instanceof PermissionError && error.code === "not-party-member"
    ? error.message
    : gmOnlyMessage;
}

function assertStorePartyAction(
  role: PartyRole | null,
  action: PartyAction,
): void {
  assertPartyAction(requireActionRole(role), action);
}

function assertStoreEntityAction(
  role: PartyRole | null,
  action: EntityAction,
): void {
  assertEntityAction(requireActionRole(role), action);
}

function assertStoreInventoryAction(
  role: PartyRole | null,
  action: InventoryAction,
): void {
  assertInventoryAction(requireActionRole(role), action);
}

/**
 * Quick-control mutations read the latest store state at mutation time and
 * rewrite only the adjusted field, so they cannot clobber concurrent edits to
 * unrelated character-sheet fields.
 */
function applyCharacterDataAdjustment(
  entityId: EntityId,
  adjust: (characterData: CharacterData) => CharacterData,
): EntityMutationResult {
  const state = useAppStore.getState();
  const existingEntity = state.appState.entities.find(
    (entity) => entity.id === entityId,
  );

  if (!existingEntity) {
    return { ok: false, message: "Entity was not found." };
  }

  if (!isCharacterLikeEntityType(existingEntity.entityType)) {
    return {
      ok: false,
      message: "Character sheets are only available for characters and retainers.",
    };
  }

  return state.updateCharacterData(
    entityId,
    adjust(normalizeCharacterData(existingEntity.character)),
  );
}

function getInitialPartyId(): PartyId {
  if (typeof window === "undefined") {
    return createPartyId();
  }

  return getPartyIdFromPathname(window.location.pathname) ?? readLastPartyId() ?? createPartyId();
}

function getInviteCodeFromLocation(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return getInviteCodeFromSearch(window.location.search);
}

function removeInviteCodeFromLocation(): void {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.delete(INVITE_QUERY_PARAM);
  window.history.replaceState(window.history.state, "", url);
}

function getPartyIdFromPathname(pathname: string): PartyId | undefined {
  const [, partySegment, partyId] = pathname.split("/");

  if (partySegment !== "party" || !partyId) {
    return undefined;
  }

  return partyId;
}

export function createPartyId(): PartyId {
  const randomId =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  return `party-${randomId.replaceAll("-", "")}`;
}

function readLastPartyId(): PartyId | undefined {
  if (typeof window === "undefined" || !("localStorage" in window)) {
    return undefined;
  }

  try {
    const stored = window.localStorage.getItem(LAST_PARTY_ID_STORAGE_KEY);
    return stored && stored.trim().length > 0 ? (stored as PartyId) : undefined;
  } catch {
    return undefined;
  }
}

function writeLastPartyId(partyId: PartyId): void {
  if (typeof window === "undefined" || !("localStorage" in window)) {
    return;
  }

  try {
    window.localStorage.setItem(LAST_PARTY_ID_STORAGE_KEY, partyId);
  } catch {
    // Storage can fail in private contexts or when quota is exceeded.
  }
}

/**
 * Drops every local trace of a party whose document was deleted remotely: the
 * cached party state, the party-index entry, and the last-opened id. Without
 * this the client keeps pointing at the deleted id, and the next visit to "/"
 * reopens it — a fresh subscription cannot tell a deleted party from a new one
 * and would create it again, this time with the visitor as GM. The sync error
 * banner raised alongside this is what tells the user what happened.
 */
export function forgetDeletedParty(partyId: PartyId): PartyIndexEntry[] {
  clearLastPartyId(partyId);
  deleteLocalPartyState(partyId);

  return forgetIndexedParty(partyId);
}

/** Forgets the last-opened party when it is the one being deleted. */
function clearLastPartyId(partyId: PartyId): void {
  if (typeof window === "undefined" || !("localStorage" in window)) {
    return;
  }

  try {
    if (window.localStorage.getItem(LAST_PARTY_ID_STORAGE_KEY) === partyId) {
      window.localStorage.removeItem(LAST_PARTY_ID_STORAGE_KEY);
    }
  } catch {
    // Storage can fail in private contexts.
  }
}

function readLocalUserId(): UserId {
  if (typeof window === "undefined" || !("localStorage" in window)) {
    return createLocalUserId();
  }

  try {
    const storedUserId = window.localStorage.getItem(LOCAL_USER_ID_STORAGE_KEY);

    if (storedUserId && storedUserId.trim().length > 0) {
      return storedUserId;
    }

    const userId = createLocalUserId();
    window.localStorage.setItem(LOCAL_USER_ID_STORAGE_KEY, userId);

    return userId;
  } catch {
    return createLocalUserId();
  }
}

function createLocalUserId(): UserId {
  const randomId =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  return `local-user-${randomId.replaceAll("-", "")}`;
}

function normalizeUserDisplayName(displayName: string): string {
  const trimmedName = displayName.trim();

  return trimmedName.length > 0 ? trimmedName : "Player";
}

function getCurrentAuditActor(): Pick<
  CreateAuditLogEntryInput,
  "actorLabel" | "actorRole" | "actorUserId"
> {
  const state = useAppStore.getState();
  const profile = state.userProfiles.find(
    (candidateProfile) => candidateProfile.id === state.currentUserId,
  );

  if (!profile) {
    return {
      actorLabel: "Anonymous user",
      actorUserId: state.currentUserId,
    };
  }

  return {
    actorLabel: `${profile.displayName} (${profile.role})`,
    actorRole: profile.role,
    actorUserId: profile.id,
  };
}

function formatSyncError(error: unknown): string {
  // One formatter for every surfaced sync failure, so the store never shows a
  // raw Firestore message where the sync layer has a readable one.
  return formatFirebaseError(error);
}

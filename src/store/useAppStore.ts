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
  normalizeCharacterData,
  validateCharacterData,
} from "../model/characters";
import {
  createPartyState,
  createEmptyAppState,
  migratePartyMembership,
  normalizePartyDisplayName,
  readLocalPartyState,
  writeLocalPartyState,
  type AppState,
  type PartyId,
  type PartyState,
} from "../model/appState";
import {
  PermissionError,
  assertEntityAction,
  assertInventoryAction,
  assertPartyAction,
  resolvePartyRole,
} from "../model/permissions";
import {
  createAuditLogEntry,
  formatCoinDelta,
  getCoinDelta,
  getCoinDeltaDetails,
  type CreateAuditLogEntryInput,
} from "../model/auditLog";
import {
  createInventoryRecordFromInput,
  createInventoryLocation,
  getCharacterCoinRecord,
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
import { getRuntimeFirebaseConfig } from "../persistence/firebaseConfig";
import {
  startFirebaseAppStateSync,
  type FirebaseWritePartyState,
} from "../persistence/firebaseSync";
import type { PersistenceMode, SyncStatus } from "../persistence/types";

type AppStore = {
  appState: AppState;
  currentUserId: UserId;
  gmUid?: string;
  members?: PartyMembers;
  partyDisplayName: string;
  partyId: PartyId;
  persistenceMode: PersistenceMode;
  syncError?: string;
  syncStatus: SyncStatus;
  updateCurrentUserProfile: (input: UserProfileInput) => void;
  renameParty: (displayName: string) => void;
  setCurrentParty: (partyId: PartyId) => void;
  userProfiles: UserProfile[];
  createEntity: (input: CreateEntityStoreInput) => EntityId | undefined;
  updateEntity: (entityId: EntityId, input: UpdateEntityInput) => void;
  updateCharacterData: (
    entityId: EntityId,
    characterData: CharacterData,
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
  swapInventoryRecords: (
    recordIdA: InventoryRecordId,
    recordIdB: InventoryRecordId,
  ) => InventoryMutationResult;
  reorderEntity: (entityId: EntityId, targetIndex: number) => void;
  identifyInventoryRecord: (
    recordId: InventoryRecordId,
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
const initialPartyStateRaw = readLocalPartyState(initialPartyId);
const initialPartyState = migratePartyMembership(initialPartyStateRaw, initialCurrentUserId);

writeLocalPartyState(initialPartyState);

export const useAppStore = create<AppStore>((set) => ({
  appState: initialPartyState.appState,
  currentUserId: initialCurrentUserId,
  gmUid: initialPartyState.party.gmUid,
  members: initialPartyState.party.members,
  partyDisplayName: initialPartyState.party.displayName,
  partyId: initialPartyState.party.id,
  persistenceMode,
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
        assertPartyAction(role ?? "player", "editPartySettings");
      } catch {
        return state;
      }
      return { partyDisplayName: normalizePartyDisplayName(displayName) };
    });
  },
  setCurrentParty: (partyId) => {
    writeLastPartyId(partyId);
    set((state) => {
      if (state.partyId === partyId) {
        return state;
      }

      const rawPartyState = readLocalPartyState(partyId);
      const partyState = migratePartyMembership(rawPartyState, state.currentUserId);

      stopConfiguredFirebaseSync();
      resetFirebaseWriteQueue();

      return {
        appState: partyState.appState,
        gmUid: partyState.party.gmUid,
        members: partyState.party.members,
        userProfiles: partyState.userProfiles,
        partyDisplayName: partyState.party.displayName,
        partyId: partyState.party.id,
        syncError: undefined,
        syncStatus: persistenceMode === "firebase" ? "connecting" : "local",
      };
    });

    if (firebaseConfig && canStartFirebaseSync()) {
      void startConfiguredFirebaseSync();
    }
  },
  createEntity: (input) => {
    const name = input.name.trim();

    if (name.length === 0) {
      return undefined;
    }

    const role = getStateUserRole(useAppStore.getState());
    try {
      assertEntityAction(role ?? "player", "createEntity");
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
    set((state) => {
      const role = getStateUserRole(state);
      try {
        assertEntityAction(role ?? "player", "editEntity");
      } catch {
        return state;
      }

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

      return {
        appState: appendAuditLogEntries(
          nextAppState,
          createEntityActiveAuditEntries(existingEntity, nextEntity),
        ),
      };
    });
  },
  updateCharacterData: (entityId, characterData) => {
    let result: EntityMutationResult = {
      ok: false,
      message: "Entity was not found.",
    };

    const role = getStateUserRole(useAppStore.getState());
    try {
      assertEntityAction(role ?? "player", "editEntity");
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
  setEntityActive: (entityId, active) => {
    set((state) => {
      const role = getStateUserRole(state);
      try {
        assertEntityAction(role ?? "player", "editEntity");
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
        assertEntityAction(role ?? "player", "deleteEntity");
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
      assertInventoryAction(role ?? "player", "addItem");
    } catch (e) {
      return { ok: false, message: e instanceof PermissionError ? e.message : "Permission denied." };
    }

    // Players cannot set GM-only identification fields
    if (role !== "gm") {
      const violations = getProtectedFormInputViolations(input);
      if (violations.length > 0) {
        return { ok: false, message: "Players cannot edit hidden unidentified-item fields." };
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

      const existingCharacterCoinRecord =
        input.recordType === "coins"
          ? getCharacterCoinRecord(entity.id, state.appState.inventoryRecords)
          : undefined;

      if (
        input.recordType === "coins" &&
        existingCharacterCoinRecord?.recordType === "coins"
      ) {
        const previousCoins = existingCharacterCoinRecord.coins;
        const nextCoins = mergeCoinData(previousCoins, input.coins);
        const nextInventoryRecords = state.appState.inventoryRecords.map(
          (record) => {
            if (
              record.id !== existingCharacterCoinRecord.id ||
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

        result = { ok: true, recordId: existingCharacterCoinRecord.id };
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
                    recordId: existingCharacterCoinRecord.id,
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
      assertInventoryAction(role ?? "player", "editItem");
    } catch (e) {
      return { ok: false, message: e instanceof PermissionError ? e.message : "Permission denied." };
    }

    if (role !== "gm") {
      const violations = getProtectedFormInputViolations(input);
      if (violations.length > 0) {
        return { ok: false, message: "Players cannot edit hidden unidentified-item fields." };
      }
    }

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
          ...input,
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
      assertInventoryAction(role ?? "player", "moveItem");
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
      assertInventoryAction(role ?? "player", "moveItem");
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
      assertInventoryAction(role ?? "player", "identifyItem");
    } catch (e) {
      return { ok: false, message: e instanceof PermissionError ? e.message : "Permission denied." };
    }

    set((state) => {
      const record = state.appState.inventoryRecords.find(
        (candidateRecord) => candidateRecord.id === recordId,
      );

      if (
        !record ||
        record.recordType === "coins" ||
        record.recordType === "treasure"
      ) {
        return state;
      }

      if (!hasSecretIdentificationFields(record)) {
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
  spendCoins: (recordId, input) => {
    let result: InventoryMutationResult = {
      ok: false,
      message: "Coin record was not found.",
    };

    const role = getStateUserRole(useAppStore.getState());
    try {
      assertInventoryAction(role ?? "player", "editCoins");
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
      const nextInventoryRecords = state.appState.inventoryRecords.map(
        (candidateRecord) =>
          candidateRecord.id === record.id && candidateRecord.recordType === "coins"
            ? { ...candidateRecord, coins: nextCoins }
            : candidateRecord,
      );
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
      assertInventoryAction(role ?? "player", "editCoins");
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

      const sourceRecord = getDefaultCoinRecordForEntity(
        sourceEntity.id,
        state.appState.inventoryRecords,
      );

      if (!sourceRecord || sourceRecord.recordType !== "coins") {
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

      const destinationRecord = getDefaultCoinRecordForEntity(
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
      assertInventoryAction(role ?? "player", "deleteItem");
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
      assertPartyAction(role ?? "player", "importParty");
    } catch {
      return;
    }
    set({ appState });
  },
  resetLocalState: () => {
    const role = getStateUserRole(useAppStore.getState());
    try {
      assertPartyAction(role ?? "player", "editPartySettings");
    } catch {
      return;
    }
    set({ appState: createEmptyAppState() });
  },
}));

let applyingRemotePartyState = false;
let firebaseUnsubscribe: (() => void) | undefined;
let firebaseWritePartyState: FirebaseWritePartyState | undefined;
let pendingFirebasePartyState: PartyState | undefined;
let writingFirebaseAppState = false;

useAppStore.subscribe((state, previousState) => {
  if (
    state.appState === previousState.appState &&
    state.gmUid === previousState.gmUid &&
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
    queueFirebasePartyStateWrite(partyState);
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
    auditLog: [
      ...appState.auditLog,
      ...entries.map((entry) =>
        createAuditLogEntry({
          ...getCurrentAuditActor(),
          ...entry,
          createdAt: new Date().toISOString(),
          id: createId("audit"),
        }),
      ),
    ],
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
    entries.push({
      entityId: input.nextRecord.entityId,
      eventType: "treasureValueChanged",
      recordId: input.nextRecord.id,
      summary: `Changed treasure value for ${getInventoryRecordAuditLabel(
        input.nextRecord,
      )} from ${input.previousRecord.treasure.gpValue} gp to ${
        input.nextRecord.treasure.gpValue
      } gp.`,
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
    input.previousRecord.recordType !== "treasure" &&
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

function hasSecretIdentificationFields(record: InventoryRecord): boolean {
  if (record.recordType === "coins" || record.recordType === "treasure") {
    return false;
  }

  return (
    record.identification?.identified === false &&
    (Boolean(record.identification.secretName?.trim()) ||
      Boolean(record.identification.secretDescription?.trim()))
  );
}

function revealInventoryRecord(record: InventoryRecord): InventoryRecord {
  if (record.recordType === "coins" || record.recordType === "treasure") {
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
    details.capacitySlots = record.container.capacitySlots;
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

  stopConfiguredFirebaseSync();

  const activePartyId = useAppStore.getState().partyId;
  const unsubscribe = await startFirebaseAppStateSync({
    config: firebaseConfig,
    getCurrentPartyState: () =>
      getPartyStateFromStoreState(useAppStore.getState()),
    onError: (message) => {
      setSyncMetadata("error", message);
    },
    onAuthUserId: (userId) => {
      const state = useAppStore.getState();
      const currentPartyState = getPartyStateFromStoreState(state);
      const migratedPartyState = migratePartyMembership(currentPartyState, userId);
      useAppStore.setState({
        currentUserId: userId,
        gmUid: migratedPartyState.party.gmUid,
        members: migratedPartyState.party.members,
      });
    },
    onReadyToWrite: (writePartyState) => {
      if (useAppStore.getState().partyId !== activePartyId) {
        return;
      }

      firebaseWritePartyState = writePartyState;
      void flushFirebasePartyStateWrite();
    },
    onRemotePartyState: (partyState) => {
      if (useAppStore.getState().partyId !== partyState.party.id) {
        return;
      }

      applyRemotePartyState(partyState);
    },
    onStatusChange: (syncStatus) => {
      if (useAppStore.getState().partyId === activePartyId) {
        setSyncMetadata(syncStatus);
      }
    },
    partyId: activePartyId,
  });

  if (useAppStore.getState().partyId === activePartyId) {
    firebaseUnsubscribe = unsubscribe;
  } else {
    unsubscribe();
  }
}

function stopConfiguredFirebaseSync(): void {
  firebaseUnsubscribe?.();
  firebaseUnsubscribe = undefined;
}

function resetFirebaseWriteQueue(): void {
  firebaseWritePartyState = undefined;
  pendingFirebasePartyState = undefined;
  writingFirebaseAppState = false;
}

function queueFirebasePartyStateWrite(partyState: PartyState): void {
  pendingFirebasePartyState = partyState;

  if (!firebaseWritePartyState) {
    return;
  }

  void flushFirebasePartyStateWrite();
}

async function flushFirebasePartyStateWrite(): Promise<void> {
  if (
    !firebaseWritePartyState ||
    !pendingFirebasePartyState ||
    writingFirebaseAppState
  ) {
    return;
  }

  const partyState = pendingFirebasePartyState;
  pendingFirebasePartyState = undefined;
  writingFirebaseAppState = true;
  setSyncMetadata("saving");

  try {
    await firebaseWritePartyState(partyState);
    writingFirebaseAppState = false;

    if (pendingFirebasePartyState) {
      void flushFirebasePartyStateWrite();
      return;
    }

    setSyncMetadata("synced");
  } catch (error) {
    writingFirebaseAppState = false;

    if (!pendingFirebasePartyState) {
      pendingFirebasePartyState = partyState;
    }

    setSyncMetadata("error", formatSyncError(error));
  }
}

function applyRemotePartyState(partyState: PartyState): void {
  setSyncMetadata("synced");

  const currentState = useAppStore.getState();
  const migratedPartyState = migratePartyMembership(partyState, currentState.currentUserId);
  const currentPartyState = getPartyStateFromStoreState(currentState);

  if (arePartyStatesEqual(currentPartyState, migratedPartyState)) {
    return;
  }

  applyingRemotePartyState = true;
  useAppStore.setState({
    appState: migratedPartyState.appState,
    gmUid: migratedPartyState.party.gmUid,
    members: migratedPartyState.party.members,
    partyDisplayName: migratedPartyState.party.displayName,
    userProfiles: migratedPartyState.userProfiles,
  });
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
  return JSON.stringify(leftPartyState) === JSON.stringify(rightPartyState);
}

function getPartyStateFromStoreState(
  state: Pick<
    AppStore,
    "appState" | "gmUid" | "members" | "partyDisplayName" | "partyId" | "userProfiles"
  >,
): PartyState {
  return createPartyState({
    appState: state.appState,
    displayName: state.partyDisplayName,
    gmUid: state.gmUid,
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

function getProtectedFormInputViolations(input: {
  identification?: { secretName?: unknown; secretDescription?: unknown } | null;
}): string[] {
  const violations: string[] = [];
  if (input.identification !== null && typeof input.identification === "object") {
    const id = input.identification as Record<string, unknown>;
    if ("secretName" in id) violations.push("identification.secretName");
    if ("secretDescription" in id) violations.push("identification.secretDescription");
  }
  return violations;
}

function getInitialPartyId(): PartyId {
  if (typeof window === "undefined") {
    return createPartyId();
  }

  return getPartyIdFromPathname(window.location.pathname) ?? readLastPartyId() ?? createPartyId();
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
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Firebase sync failed.";
}

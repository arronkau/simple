import { create } from "zustand";
import {
  createEntity,
  getNextEntitySortOrder,
  isCharacterLikeEntityType,
  type UpdateEntityInput,
} from "../model/entities";
import {
  normalizeCharacterData,
  validateCharacterData,
} from "../model/characters";
import {
  createEmptyAppState,
  readLocalAppState,
  writeLocalAppState,
  type AppState,
} from "../model/appState";
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
} from "../model/types";
import {
  createInitialInventoryRecordsForEntity,
  validateInventoryState,
} from "../model/validation";
import { getRuntimeFirebaseConfig } from "../persistence/firebaseConfig";
import {
  startFirebaseAppStateSync,
  type FirebaseWriteAppState,
} from "../persistence/firebaseSync";
import type { PersistenceMode, SyncStatus } from "../persistence/types";

type AppStore = {
  appState: AppState;
  persistenceMode: PersistenceMode;
  syncError?: string;
  syncStatus: SyncStatus;
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
  deleteInventoryRecord: (
    recordId: InventoryRecordId,
  ) => InventoryMutationResult;
  resetLocalState: () => void;
};

type CreateEntityStoreInput = {
  name: string;
  entityType: EntityType;
};

export type InventoryMutationResult =
  | { ok: true; recordId?: InventoryRecordId }
  | { ok: false; message: string };

export type EntityMutationResult =
  | { ok: true }
  | { ok: false; message: string };

type AuditLogEntryInput = Omit<CreateAuditLogEntryInput, "createdAt" | "id">;

const initialAppState = readLocalAppState();
const firebaseConfig = getRuntimeFirebaseConfig();
const persistenceMode: PersistenceMode = firebaseConfig ? "firebase" : "local";

writeLocalAppState(initialAppState);

export const useAppStore = create<AppStore>((set) => ({
  appState: initialAppState,
  persistenceMode,
  syncError: undefined,
  syncStatus: persistenceMode === "firebase" ? "connecting" : "local",
  createEntity: (input) => {
    const name = input.name.trim();

    if (name.length === 0) {
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
      const existingEntity = state.appState.entities.find(
        (entity) => entity.id === entityId,
      );

      if (!existingEntity) {
        return state;
      }

      const nextName =
        input.name !== undefined ? input.name.trim() : existingEntity.name;
      const nextEntity: Entity = {
        ...existingEntity,
        ...(nextName.length > 0 ? { name: nextName } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.notes !== undefined
          ? { notes: input.notes.trim() || undefined }
          : {}),
      };
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
      const entity = state.appState.entities.find(
        (candidateEntity) => candidateEntity.id === entityId,
      );

      if (!entity) {
        return state;
      }

      const deletedRecordCount = state.appState.inventoryRecords.filter(
        (record) => record.location.entityId === entityId,
      ).length;
      const nextAppState = {
        ...state.appState,
        entities: state.appState.entities.filter(
          (candidateEntity) => candidateEntity.id !== entityId,
        ),
        inventoryRecords: state.appState.inventoryRecords.filter(
          (record) => record.location.entityId !== entityId,
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
              entityId: buildResult.record.location.entityId,
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

    set((state) => {
      const record = state.appState.inventoryRecords.find(
        (candidateRecord) => candidateRecord.id === recordId,
      );
      const targetEntityId = input.location?.entityId ?? record?.location.entityId;
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
      const nextInventoryRecords = areInventoryLocationsEqual(
        record.location,
        buildResult.record.location,
      )
        ? replacedInventoryRecords
        : moveInventoryRecord({
            recordId,
            records: replacedInventoryRecords,
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
        editingRecordId: recordId,
      });

      if (!locationResult.ok) {
        result = locationResult;
        return state;
      }

      const nextInventoryRecords = moveInventoryRecord({
        recordId,
        records: state.appState.inventoryRecords,
        location: locationResult.location,
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
          areInventoryLocationsEqual(record.location, nextRecord.location)
            ? []
            : [
                createInventoryMoveAuditEntryInput({
                  record: nextRecord,
                  entities: state.appState.entities,
                  previousLocation: record.location,
                  nextLocation: nextRecord.location,
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
        (candidateEntity) => candidateEntity.id === record.location.entityId,
      );

      return {
        appState: appendAuditLogEntries(
          {
            ...state.appState,
            inventoryRecords: nextInventoryRecords,
          },
          [
            {
              entityId: record.location.entityId,
              eventType: "inventoryRecordDeleted",
              recordId,
              summary: `Deleted ${getInventoryRecordAuditLabel(record)} from ${
                entity ? formatEntityName(entity) : record.location.entityId
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
  resetLocalState: () => {
    set({ appState: createEmptyAppState() });
  },
}));

let applyingRemoteAppState = false;
let firebaseWriteAppState: FirebaseWriteAppState | undefined;
let pendingFirebaseAppState: AppState | undefined;
let writingFirebaseAppState = false;

useAppStore.subscribe((state, previousState) => {
  if (state.appState === previousState.appState) {
    return;
  }

  writeLocalAppState(state.appState);

  if (applyingRemoteAppState) {
    applyingRemoteAppState = false;
    return;
  }

  if (state.persistenceMode === "firebase") {
    queueFirebaseAppStateWrite(state.appState);
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
    !areInventoryLocationsEqual(
      input.previousRecord.location,
      input.nextRecord.location,
    )
  ) {
    entries.push(
      createInventoryMoveAuditEntryInput({
        entities: input.entities,
        nextLocation: input.nextRecord.location,
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
      entityId: input.nextRecord.location.entityId,
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

function createInventoryMoveAuditEntryInput(input: {
  entities: Entity[];
  nextLocation: InventoryLocation;
  previousLocation: InventoryLocation;
  record: InventoryRecord;
}): AuditLogEntryInput {
  return {
    entityId: input.nextLocation.entityId,
    eventType: "inventoryRecordMoved",
    recordId: input.record.id,
    summary: `Moved ${getInventoryRecordAuditLabel(
      input.record,
    )} from ${formatInventoryLocation(
      input.previousLocation,
      input.entities,
    )} to ${formatInventoryLocation(input.nextLocation, input.entities)}.`,
    details: {
      fromEntityId: input.previousLocation.entityId,
      toEntityId: input.nextLocation.entityId,
      fromLocation: formatInventoryLocation(input.previousLocation, input.entities),
      toLocation: formatInventoryLocation(input.nextLocation, input.entities),
    },
  };
}

function createInventoryRecordDetails(
  record: InventoryRecord,
  entities: Entity[],
): Record<string, string | number | boolean | null> {
  const details: Record<string, string | number | boolean | null> = {
    location: formatInventoryLocation(record.location, entities),
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

function formatInventoryLocation(
  location: InventoryLocation,
  entities: Entity[],
): string {
  const entity = entities.find(
    (candidateEntity) => candidateEntity.id === location.entityId,
  );
  const entityLabel = entity ? entity.name : location.entityId;
  const containerLabel =
    "containerId" in location ? ` in ${location.containerId}` : "";

  return `${entityLabel} ${location.placement}${containerLabel}`;
}

function hasCoinDelta(delta: CoinData): boolean {
  return delta.pp !== 0 || delta.gp !== 0 || delta.sp !== 0 || delta.cp !== 0;
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
    leftLocation.entityId === rightLocation.entityId &&
    leftLocation.locationType === rightLocation.locationType &&
    leftLocation.placement === rightLocation.placement &&
    leftContainerId === rightContainerId
  );
}

function canStartFirebaseSync(): boolean {
  return typeof window !== "undefined";
}

async function startConfiguredFirebaseSync(): Promise<void> {
  if (!firebaseConfig) {
    return;
  }

  await startFirebaseAppStateSync({
    config: firebaseConfig,
    getCurrentAppState: () => useAppStore.getState().appState,
    onError: (message) => {
      setSyncMetadata("error", message);
    },
    onReadyToWrite: (writeAppState) => {
      firebaseWriteAppState = writeAppState;
      void flushFirebaseAppStateWrite();
    },
    onRemoteAppState: (appState) => {
      applyRemoteAppState(appState);
    },
    onStatusChange: (syncStatus) => {
      setSyncMetadata(syncStatus);
    },
  });
}

function queueFirebaseAppStateWrite(appState: AppState): void {
  pendingFirebaseAppState = appState;

  if (!firebaseWriteAppState) {
    return;
  }

  void flushFirebaseAppStateWrite();
}

async function flushFirebaseAppStateWrite(): Promise<void> {
  if (
    !firebaseWriteAppState ||
    !pendingFirebaseAppState ||
    writingFirebaseAppState
  ) {
    return;
  }

  const appState = pendingFirebaseAppState;
  pendingFirebaseAppState = undefined;
  writingFirebaseAppState = true;
  setSyncMetadata("saving");

  try {
    await firebaseWriteAppState(appState);
    writingFirebaseAppState = false;

    if (pendingFirebaseAppState) {
      void flushFirebaseAppStateWrite();
      return;
    }

    setSyncMetadata("synced");
  } catch (error) {
    writingFirebaseAppState = false;

    if (!pendingFirebaseAppState) {
      pendingFirebaseAppState = appState;
    }

    setSyncMetadata("error", formatSyncError(error));
  }
}

function applyRemoteAppState(appState: AppState): void {
  setSyncMetadata("synced");

  if (areAppStatesEqual(useAppStore.getState().appState, appState)) {
    return;
  }

  applyingRemoteAppState = true;
  useAppStore.setState({ appState });
}

function setSyncMetadata(syncStatus: SyncStatus, syncError?: string): void {
  useAppStore.setState({
    syncError: syncStatus === "error" ? syncError : undefined,
    syncStatus,
  });
}

function areAppStatesEqual(
  leftAppState: AppState,
  rightAppState: AppState,
): boolean {
  return JSON.stringify(leftAppState) === JSON.stringify(rightAppState);
}

function formatSyncError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Firebase sync failed.";
}

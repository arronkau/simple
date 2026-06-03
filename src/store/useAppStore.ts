import { create } from "zustand";
import {
  createEntity,
  getNextEntitySortOrder,
  type UpdateEntityInput,
} from "../model/entities";
import {
  createEmptyAppState,
  readLocalAppState,
  writeLocalAppState,
  type AppState,
} from "../model/appState";
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
  EntityId,
  EntityType,
  InventoryLocation,
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

      return {
        appState: {
          ...state.appState,
          entities: [...state.appState.entities, entity],
          inventoryRecords: [
            ...state.appState.inventoryRecords,
            ...inventoryRecords,
          ],
        },
      };
    });

    return entityId;
  },
  updateEntity: (entityId, input) => {
    set((state) => ({
      appState: {
        ...state.appState,
        entities: state.appState.entities.map((entity) => {
          if (entity.id !== entityId) {
            return entity;
          }

          const nextName =
            input.name !== undefined ? input.name.trim() : entity.name;

          return {
            ...entity,
            ...(nextName.length > 0 ? { name: nextName } : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
            ...(input.notes !== undefined
              ? { notes: input.notes.trim() || undefined }
              : {}),
          };
        }),
      },
    }));
  },
  setEntityActive: (entityId, active) => {
    set((state) => ({
      appState: {
        ...state.appState,
        entities: state.appState.entities.map((entity) =>
          entity.id === entityId ? { ...entity, active } : entity,
        ),
      },
    }));
  },
  deleteEntity: (entityId) => {
    set((state) => ({
      appState: {
        ...state.appState,
        entities: state.appState.entities.filter(
          (entity) => entity.id !== entityId,
        ),
        inventoryRecords: state.appState.inventoryRecords.filter(
          (record) => record.location.entityId !== entityId,
        ),
      },
    }));
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
              coins: mergeCoinData(record.coins, input.coins),
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

        return {
          appState: {
            ...state.appState,
            inventoryRecords: nextInventoryRecords,
          },
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
        appState: {
          ...state.appState,
          inventoryRecords: nextInventoryRecords,
        },
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

      return {
        appState: {
          ...state.appState,
          inventoryRecords: nextInventoryRecords,
        },
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

      return {
        appState: {
          ...state.appState,
          inventoryRecords: nextInventoryRecords,
        },
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

      return {
        appState: {
          ...state.appState,
          inventoryRecords: nextInventoryRecords,
        },
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

function createId(prefix: "entity" | "record"): EntityId & InventoryRecordId {
  const randomId =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  return `${prefix}-${randomId}`;
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

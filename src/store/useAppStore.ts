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
import type { EntityId, EntityType, InventoryRecordId } from "../model/types";
import { createInitialInventoryRecordsForEntity } from "../model/validation";

type AppStore = {
  appState: AppState;
  createEntity: (input: CreateEntityStoreInput) => EntityId | undefined;
  updateEntity: (entityId: EntityId, input: UpdateEntityInput) => void;
  setEntityActive: (entityId: EntityId, active: boolean) => void;
  deleteEntity: (entityId: EntityId) => void;
  resetLocalState: () => void;
};

type CreateEntityStoreInput = {
  name: string;
  entityType: EntityType;
};

const initialAppState = readLocalAppState();

writeLocalAppState(initialAppState);

export const useAppStore = create<AppStore>((set) => ({
  appState: initialAppState,
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
  resetLocalState: () => {
    set({ appState: createEmptyAppState() });
  },
}));

useAppStore.subscribe((state) => {
  writeLocalAppState(state.appState);
});

function createId(prefix: "entity" | "record"): EntityId & InventoryRecordId {
  const randomId =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  return `${prefix}-${randomId}`;
}

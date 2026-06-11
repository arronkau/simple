import { create } from "zustand";
import type { Entity, EntityId } from "../model/types";

/**
 * UI-only record of which `storage` entity is acting as "the Floor", keyed by
 * party id and persisted to localStorage. This is deliberately NOT part of the
 * domain AppState/Entity — the Floor is an ordinary storage entity; only the
 * "which one is the Floor" choice lives here.
 */

const STORAGE_KEY = "simple.gear.floorByParty.v1";

type FloorByParty = Record<string, EntityId>;

function readFloorByParty(): FloorByParty {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);

    return parsed && typeof parsed === "object" ? (parsed as FloorByParty) : {};
  } catch {
    return {};
  }
}

function writeFloorByParty(floorByParty: FloorByParty): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(floorByParty));
  } catch {
    // Ignore storage failures (private mode, quota); the Floor still works for
    // this session, it just will not be remembered across reloads.
  }
}

type FloorUiStore = {
  floorByParty: FloorByParty;
  setFloorEntityId: (partyId: string, entityId: EntityId) => void;
};

export const useFloorUiStore = create<FloorUiStore>((set) => ({
  floorByParty: readFloorByParty(),
  setFloorEntityId: (partyId, entityId) =>
    set((state) => {
      const floorByParty = { ...state.floorByParty, [partyId]: entityId };

      writeFloorByParty(floorByParty);

      return { floorByParty };
    }),
}));

/**
 * Resolve the recorded Floor entity for a party. Returns undefined when no
 * Floor is set or the recorded id no longer points to a storage entity.
 */
export function resolveFloorEntity(
  partyId: string,
  floorByParty: FloorByParty,
  entities: Entity[],
): Entity | undefined {
  const floorEntityId = floorByParty[partyId];

  if (!floorEntityId) {
    return undefined;
  }

  return entities.find(
    (entity) => entity.id === floorEntityId && entity.entityType === "storage",
  );
}

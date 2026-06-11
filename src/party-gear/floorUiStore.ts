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

const DEFAULT_FLOOR_NAME = "Floor";

/**
 * Resolve the Floor entity for a party.
 *
 * The Floor designation lives in per-device localStorage, but the Floor entity
 * is shared party data. So a client without a local mapping (e.g. a second
 * player on a Firebase party) deterministically falls back to a `storage`
 * entity literally named "Floor". This keeps the Floor recoverable across
 * clients and prevents a second client from creating a duplicate.
 */
export function resolveFloorEntity(
  partyId: string,
  floorByParty: FloorByParty,
  entities: Entity[],
): Entity | undefined {
  const floorEntityId = floorByParty[partyId];
  const recorded = floorEntityId
    ? entities.find(
        (entity) =>
          entity.id === floorEntityId && entity.entityType === "storage",
      )
    : undefined;

  if (recorded) {
    return recorded;
  }

  return findDefaultFloorEntity(entities);
}

/** The first `storage` entity named "Floor", used as the cross-client fallback. */
export function findDefaultFloorEntity(entities: Entity[]): Entity | undefined {
  return entities
    .filter(
      (entity) =>
        entity.entityType === "storage" &&
        entity.name.trim().toLowerCase() === DEFAULT_FLOOR_NAME.toLowerCase(),
    )
    .sort((left, right) => left.sortOrder - right.sortOrder)[0];
}

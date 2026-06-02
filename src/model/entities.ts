import type { Entity, EntityId, EntityType } from "./types";

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  character: "Character",
  retainer: "Retainer",
  mount: "Mount",
  vehicle: "Vehicle",
  storage: "Storage",
};

export const ENTITY_TYPES: EntityType[] = [
  "character",
  "retainer",
  "mount",
  "vehicle",
  "storage",
];

export type CreateEntityInput = {
  id: EntityId;
  name: string;
  entityType: EntityType;
  sortOrder: number;
};

export type UpdateEntityInput = {
  name?: string;
  active?: boolean;
  notes?: string;
};

export function createEntity({
  id,
  name,
  entityType,
  sortOrder,
}: CreateEntityInput): Entity {
  return {
    id,
    name: name.trim(),
    entityType,
    active: true,
    sortOrder,
  };
}

export function getNextEntitySortOrder(entities: Entity[]): number {
  if (entities.length === 0) {
    return 0;
  }

  return Math.max(...entities.map((entity) => entity.sortOrder)) + 1000;
}

export function getSortedEntities(entities: Entity[]): Entity[] {
  return [...entities].sort((leftEntity, rightEntity) => {
    if (leftEntity.active !== rightEntity.active) {
      return leftEntity.active ? -1 : 1;
    }

    if (leftEntity.sortOrder !== rightEntity.sortOrder) {
      return leftEntity.sortOrder - rightEntity.sortOrder;
    }

    return leftEntity.name.localeCompare(rightEntity.name);
  });
}

export function isCharacterLikeEntityType(entityType: EntityType): boolean {
  return entityType === "character" || entityType === "retainer";
}

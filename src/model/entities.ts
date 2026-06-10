import type { Entity, EntityId, EntityType } from "./types";
import {
  createEmptyCharacterData,
  isCharacterLikeEntityType,
} from "./characters";

export { isCharacterLikeEntityType } from "./characters";

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
  entityType?: EntityType;
  active?: boolean;
  notes?: string;
};

export function applyEntityUpdate(
  existingEntity: Entity,
  input: UpdateEntityInput,
): Entity {
  const nextName =
    input.name !== undefined ? input.name.trim() : existingEntity.name;
  const nextEntityType = input.entityType ?? existingEntity.entityType;
  const nextEntity: Entity = {
    ...existingEntity,
    ...(nextName.length > 0 ? { name: nextName } : {}),
    entityType: nextEntityType,
    ...(input.active !== undefined ? { active: input.active } : {}),
    ...(input.notes !== undefined
      ? { notes: input.notes.trim() || undefined }
      : {}),
  };

  if (isCharacterLikeEntityType(nextEntityType)) {
    return {
      ...nextEntity,
      character: nextEntity.character ?? createEmptyCharacterData(),
    };
  }

  const { character: _character, ...nonCharacterEntity } = nextEntity;
  return nonCharacterEntity;
}

export function getEditableEntityTypes(entity: Entity): EntityType[] {
  if (isCharacterLikeEntityType(entity.entityType)) {
    return ["character", "retainer"];
  }

  return [entity.entityType];
}

export function createEntity({
  id,
  name,
  entityType,
  sortOrder,
}: CreateEntityInput): Entity {
  const entity: Entity = {
    id,
    name: name.trim(),
    entityType,
    active: true,
    sortOrder,
  };

  return isCharacterLikeEntityType(entityType)
    ? { ...entity, character: createEmptyCharacterData() }
    : entity;
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

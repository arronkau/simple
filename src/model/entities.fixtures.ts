import { createEmptyCharacterData } from "./characters";
import { applyEntityUpdate, getEditableEntityTypes } from "./entities";
import type { CharacterData, Entity } from "./types";

function makeCharacterData(
  overrides: Partial<CharacterData> = {},
): CharacterData {
  return {
    ...createEmptyCharacterData(),
    ...overrides,
  };
}

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: "entity-1",
    name: "Entity",
    entityType: "character",
    active: true,
    sortOrder: 0,
    character: makeCharacterData(),
    ...overrides,
  };
}

const characterToRetainer = applyEntityUpdate(
  makeEntity({
    entityType: "character",
    character: makeCharacterData({ className: "Fighter", level: 3 }),
  }),
  { entityType: "retainer" },
);

const retainerToCharacter = applyEntityUpdate(
  makeEntity({
    entityType: "retainer",
    character: makeCharacterData({ className: "Cleric", level: 2 }),
  }),
  { entityType: "character" },
);

const characterToStorage = applyEntityUpdate(
  makeEntity({
    entityType: "character",
    character: makeCharacterData({ className: "Magic-User", level: 4 }),
  }),
  { entityType: "storage" },
);

const storageToCharacter = applyEntityUpdate(
  makeEntity({
    id: "storage-1",
    name: "Storage",
    entityType: "storage",
    character: undefined,
  }),
  { entityType: "character" },
);

const mountToRetainer = applyEntityUpdate(
  makeEntity({
    id: "mount-1",
    name: "Mule",
    entityType: "mount",
    character: undefined,
  }),
  { entityType: "retainer" },
);

export const ENTITY_MODEL_MANUAL_FIXTURES = [
  {
    name: "applyEntityUpdate preserves character data when changing a character to a retainer",
    actual: {
      entityType: characterToRetainer.entityType,
      className: characterToRetainer.character?.className,
      level: characterToRetainer.character?.level,
    },
    expected: {
      entityType: "retainer",
      className: "Fighter",
      level: 3,
    },
  },
  {
    name: "applyEntityUpdate preserves character data when changing a retainer to a character",
    actual: {
      entityType: retainerToCharacter.entityType,
      className: retainerToCharacter.character?.className,
      level: retainerToCharacter.character?.level,
    },
    expected: {
      entityType: "character",
      className: "Cleric",
      level: 2,
    },
  },
  {
    name: "applyEntityUpdate ignores character-like to non-character type updates and preserves character data",
    actual: {
      entityType: characterToStorage.entityType,
      className: characterToStorage.character?.className,
      level: characterToStorage.character?.level,
    },
    expected: {
      entityType: "character",
      className: "Magic-User",
      level: 4,
    },
  },
  {
    name: "applyEntityUpdate does not allow storage to become character",
    actual: {
      entityType: storageToCharacter.entityType,
      hasCharacterSheet: storageToCharacter.character !== undefined,
    },
    expected: {
      entityType: "storage",
      hasCharacterSheet: false,
    },
  },
  {
    name: "applyEntityUpdate does not allow mount to become retainer",
    actual: {
      entityType: mountToRetainer.entityType,
      hasCharacterSheet: mountToRetainer.character !== undefined,
    },
    expected: {
      entityType: "mount",
      hasCharacterSheet: false,
    },
  },
  {
    name: "getEditableEntityTypes returns character and retainer for character-like entities",
    actual: {
      character: getEditableEntityTypes(makeEntity({ entityType: "character" })),
      retainer: getEditableEntityTypes(makeEntity({ entityType: "retainer" })),
    },
    expected: {
      character: ["character", "retainer"],
      retainer: ["character", "retainer"],
    },
  },
  {
    name: "getEditableEntityTypes returns only current type for non-character-like entities",
    actual: getEditableEntityTypes(
      makeEntity({
        id: "storage-1",
        name: "Storage",
        entityType: "storage",
        character: undefined,
      }),
    ),
    expected: ["storage"],
  },
];

import { createEntity } from "./entities";
import { parseAppState } from "./appState";
import {
  createEmptyCharacterData,
  normalizeCharacterData,
  validateCharacterData,
} from "./characters";
import { getCharacterSaveLookup } from "./saveTables";
import type { CharacterData, Entity } from "./types";

const emptyCharacterData = createEmptyCharacterData();

const createdCharacter = createEntity({
  id: "character-1",
  name: " Morgan ",
  entityType: "character",
  sortOrder: 0,
});

const createdRetainer = createEntity({
  id: "retainer-1",
  name: "Hireling",
  entityType: "retainer",
  sortOrder: 1000,
});

const createdMount = createEntity({
  id: "mount-1",
  name: "Mule",
  entityType: "mount",
  sortOrder: 2000,
});

const legacyCharacter: Entity = {
  id: "legacy-character-1",
  name: "Old Hero",
  entityType: "character",
  active: true,
  sortOrder: 0,
};

const storageWithCharacterData: Entity = {
  id: "storage-1",
  name: "Vault",
  entityType: "storage",
  active: true,
  sortOrder: 1000,
  character: {
    ...emptyCharacterData,
    className: "Should be removed",
  },
};

const parsedLegacyAppState = parseAppState({
  schemaVersion: 1,
  entities: [legacyCharacter, storageWithCharacterData],
  inventoryRecords: [],
});

const legacyPartialCharacterData = normalizeCharacterData({
  className: "Fighter",
  level: 2,
  hpCurrent: 3,
  hpMax: 6,
  xp: 1200,
  alignment: "Law",
  languages: ["Common", "Lawful"],
});

const invalidSkillCharacterData: CharacterData = {
  ...emptyCharacterData,
  skills: [
    {
      id: "skill-1",
      name: "Open Doors",
      chanceInSix: 7,
    },
  ],
};

export const CHARACTER_MANUAL_FIXTURES = [
  {
    name: "character-like entity creation initializes empty character sheets",
    actual: {
      character: createdCharacter.character,
      retainer: createdRetainer.character,
      mountHasCharacterData: createdMount.character !== undefined,
    },
    expected: {
      character: emptyCharacterData,
      retainer: emptyCharacterData,
      mountHasCharacterData: false,
    },
  },
  {
    name: "app state parsing initializes old character entities and strips non-character sheet data",
    actual: {
      legacyCharacterData: parsedLegacyAppState?.entities[0]?.character,
      storageHasCharacterData:
        parsedLegacyAppState?.entities[1]?.character !== undefined,
    },
    expected: {
      legacyCharacterData: emptyCharacterData,
      storageHasCharacterData: false,
    },
  },
  {
    name: "legacy partial character facts normalize to the full sheet shape",
    actual: {
      className: legacyPartialCharacterData.className,
      level: legacyPartialCharacterData.level,
      alignment: legacyPartialCharacterData.alignment,
      xp: legacyPartialCharacterData.xp,
      hp: legacyPartialCharacterData.hp,
      languages: legacyPartialCharacterData.languages,
    },
    expected: {
      className: "Fighter",
      level: 2,
      alignment: "Law",
      xp: 1200,
      hp: {
        current: 3,
        max: 6,
      },
      languages: ["Common", "Lawful"],
    },
  },
  {
    name: "character sheet validation rejects skill chances outside one through six",
    actual: validateCharacterData(invalidSkillCharacterData),
    expected: {
      valid: false,
      errors: ["Open Doors chance must be an integer from 1 through 6."],
    },
  },
  {
    name: "save lookup calculates supported class saves by exact class and level",
    actual: getCharacterSaveLookup("Fighter", 1),
    expected: {
      ok: true,
      attackBonus: 0,
      classId: "fighter",
      className: "Fighter",
      level: 1,
      saves: [
        { key: "doom", label: "Doom", value: 12 },
        { key: "ray", label: "Ray", value: 13 },
        { key: "hold", label: "Hold", value: 14 },
        { key: "blast", label: "Blast", value: 15 },
        { key: "spell", label: "Spell", value: 16 },
      ],
    },
  },
  {
    name: "save lookup safely reports unknown class",
    actual: getCharacterSaveLookup("Custom Adventurer", 1),
    expected: {
      ok: false,
      message: "Saves unavailable for this class.",
      saves: [
        { key: "doom", label: "Doom", value: Number.NaN },
        { key: "ray", label: "Ray", value: Number.NaN },
        { key: "hold", label: "Hold", value: Number.NaN },
        { key: "blast", label: "Blast", value: Number.NaN },
        { key: "spell", label: "Spell", value: Number.NaN },
      ],
    },
  },
  {
    name: "save lookup safely reports missing level",
    actual: getCharacterSaveLookup("Fighter", null),
    expected: {
      ok: false,
      message: "Enter level 1 or higher to calculate saves.",
      saves: [
        { key: "doom", label: "Doom", value: Number.NaN },
        { key: "ray", label: "Ray", value: Number.NaN },
        { key: "hold", label: "Hold", value: Number.NaN },
        { key: "blast", label: "Blast", value: Number.NaN },
        { key: "spell", label: "Spell", value: Number.NaN },
      ],
    },
  },
];

import { createEntity } from "./entities";
import { parseAppState } from "./appState";
import {
  adjustCharacterHp,
  adjustCharacterSpellMemorized,
  adjustCharacterXp,
  createEmptyCharacterData,
  getSpellMemorizationWarnings,
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

const legacyShortKeyCharacterData = normalizeCharacterData({
  className: "Thief",
  abilityScores: {
    str: 9,
    int: 10,
    wis: 8,
    dex: 14,
    con: 11,
    cha: 12,
  },
});

const legacyTitleFeatureCharacterData = normalizeCharacterData({
  className: "Cleric",
  features: [
    { id: "f-1", title: "Turn Undead", description: "Controls undead." },
    { id: "f-2", title: "Holy Symbol", description: "" },
  ],
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

const legacySpellsCharacterData = normalizeCharacterData({
  className: "Magic-User",
  spells: [
    { name: "Sleep", level: 1, memorized: 1, notes: "memorized at dawn" },
    { id: "spell-keep", name: "Charm Person", level: 1, memorized: 0 },
    { name: "", level: 2, memorized: 1 },
    { name: "Web", level: "two", memorized: -3 },
    "not a spell",
  ],
});

const invalidSpellCharacterData: CharacterData = {
  ...emptyCharacterData,
  spells: [
    {
      id: "spell-1",
      name: "Sleep",
      level: 0,
      memorized: 1.5,
    },
  ],
};

const overMemorizedCharacterData: CharacterData = {
  ...emptyCharacterData,
  className: "Magic-User",
  level: 3,
  spells: [
    { id: "spell-1", name: "Sleep", level: 1, memorized: 2 },
    { id: "spell-2", name: "Magic Missile", level: 1, memorized: 1 },
    { id: "spell-3", name: "Fireball", level: 3, memorized: 1 },
  ],
};

const withinSlotsCharacterData: CharacterData = {
  ...emptyCharacterData,
  className: "Magic-User",
  level: 3,
  spells: [
    { id: "spell-1", name: "Sleep", level: 1, memorized: 1 },
    { id: "spell-2", name: "Charm Person", level: 1, memorized: 0 },
    { id: "spell-3", name: "Web", level: 2, memorized: 1 },
  ],
};

const nonCasterSpellCharacterData: CharacterData = {
  ...emptyCharacterData,
  className: "Fighter",
  level: 3,
  spells: [{ id: "spell-1", name: "Sleep", level: 1, memorized: 1 }],
};

// Rich sheet used to prove quick adjustments rewrite only their own field.
const richCharacterData: CharacterData = {
  className: "Magic-User",
  level: 3,
  alignment: "Law",
  xp: 2500,
  hp: { current: 4, max: 6 },
  armorClass: { modifier: 1, override: null },
  abilityScores: {
    strength: 9,
    intelligence: 16,
    wisdom: 11,
    dexterity: 13,
    constitution: 10,
    charisma: 8,
  },
  skills: [{ id: "skill-1", name: "Lore", chanceInSix: 2, description: "Old tales" }],
  spells: [
    { id: "spell-sleep", name: "Sleep", level: 1, memorized: 1, notes: "at dawn" },
    { id: "spell-web", name: "Web", level: 2, memorized: 1 },
  ],
  languages: ["Common", "Elvish"],
  description: "Apprentice of the Grey Tower.",
  features: [{ id: "feature-1", name: "Read Magic", description: "At will." }],
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
    name: "legacy short ability score keys are mapped to full keys on normalize",
    actual: legacyShortKeyCharacterData.abilityScores,
    expected: {
      strength: 9,
      intelligence: 10,
      wisdom: 8,
      dexterity: 14,
      constitution: 11,
      charisma: 12,
    },
  },
  {
    name: "normalized ability scores contain only full keys",
    actual: Object.keys(legacyShortKeyCharacterData.abilityScores).sort(),
    expected: ["charisma", "constitution", "dexterity", "intelligence", "strength", "wisdom"],
  },
  {
    name: "legacy feature title field is normalized to name",
    actual: legacyTitleFeatureCharacterData.features.map((f) => f.name),
    expected: ["Turn Undead", "Holy Symbol"],
  },
  {
    name: "normalized features contain name not title",
    actual: legacyTitleFeatureCharacterData.features.every(
      (f) => "name" in f && !("title" in f),
    ),
    expected: true,
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
    name: "missing spells field normalizes to an empty array",
    actual: normalizeCharacterData({ className: "Fighter" }).spells,
    expected: [],
  },
  {
    name: "legacy spell rows normalize ids, levels, counts, and drop unnamed rows",
    actual: legacySpellsCharacterData.spells,
    expected: [
      {
        id: "spell-1",
        name: "Sleep",
        level: 1,
        memorized: 1,
        notes: "memorized at dawn",
      },
      {
        id: "spell-keep",
        name: "Charm Person",
        level: 1,
        memorized: 0,
      },
      {
        id: "spell-4",
        name: "Web",
        level: 1,
        memorized: 0,
      },
    ],
  },
  {
    name: "character sheet validation rejects structurally impossible spell rows",
    actual: validateCharacterData(invalidSpellCharacterData),
    expected: {
      valid: false,
      errors: [
        "Sleep level must be an integer of at least 1.",
        "Sleep memorized count must be a non-negative integer.",
      ],
    },
  },
  {
    name: "memorization warnings flag over-slot levels and over-max spells",
    actual: getSpellMemorizationWarnings(overMemorizedCharacterData),
    expected: [
      "Fireball is level 3, above the Magic-User maximum of 2.",
      "Level 1 spells memorized (3) exceed the available slots (2).",
      "Level 3 spells memorized (1) exceed the available slots (0).",
    ],
  },
  {
    name: "memorization within derived slots produces no warnings",
    actual: getSpellMemorizationWarnings(withinSlotsCharacterData),
    expected: [],
  },
  {
    name: "memorized spells on a non-caster class warn",
    actual: getSpellMemorizationWarnings(nonCasterSpellCharacterData),
    expected: ["Sleep is memorized but Fighter has no spell slots."],
  },
  {
    name: "memorization warnings stay silent for unknown classes",
    actual: getSpellMemorizationWarnings({
      ...emptyCharacterData,
      className: "Custom Adventurer",
      level: 1,
      spells: [{ id: "spell-1", name: "Sleep", level: 1, memorized: 9 }],
    }),
    expected: [],
  },
  {
    name: "hp adjustment rewrites only current hp and preserves the rest of the sheet",
    actual: adjustCharacterHp(richCharacterData, -1),
    expected: {
      ...richCharacterData,
      hp: { current: 3, max: 6 },
    },
  },
  {
    name: "hp adjustment clamps at zero and treats missing hp as zero",
    actual: {
      clamped: adjustCharacterHp(richCharacterData, -99).hp,
      fromNull: adjustCharacterHp(emptyCharacterData, 2).hp,
    },
    expected: {
      clamped: { current: 0, max: 6 },
      fromNull: { current: 2, max: null },
    },
  },
  {
    name: "xp adjustment rewrites only xp and preserves the rest of the sheet",
    actual: adjustCharacterXp(richCharacterData, 350),
    expected: {
      ...richCharacterData,
      xp: 2850,
    },
  },
  {
    name: "xp adjustment clamps at zero and treats missing xp as zero",
    actual: {
      clamped: adjustCharacterXp(richCharacterData, -99999).xp,
      fromNull: adjustCharacterXp(emptyCharacterData, 100).xp,
    },
    expected: {
      clamped: 0,
      fromNull: 100,
    },
  },
  {
    name: "memorized adjustment rewrites only the matching spell row",
    actual: adjustCharacterSpellMemorized(richCharacterData, "spell-sleep", 1),
    expected: {
      ...richCharacterData,
      spells: [
        { id: "spell-sleep", name: "Sleep", level: 1, memorized: 2, notes: "at dawn" },
        { id: "spell-web", name: "Web", level: 2, memorized: 1 },
      ],
    },
  },
  {
    name: "memorized adjustment clamps at zero and ignores unknown spell ids",
    actual: {
      clamped: adjustCharacterSpellMemorized(richCharacterData, "spell-sleep", -99)
        .spells[0]?.memorized,
      unknownId: adjustCharacterSpellMemorized(richCharacterData, "spell-missing", 1),
    },
    expected: {
      clamped: 0,
      unknownId: richCharacterData,
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

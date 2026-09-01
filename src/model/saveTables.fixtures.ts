import {
  getCharacterSaveLookup,
  getClassMetadata,
  getClassSpellSlots,
  getThac0,
  getXpProgress,
} from "./saveTables";

const ALL_CLASS_IDS = [
  "acrobat",
  "assassin",
  "barbarian",
  "bard",
  "cleric",
  "drow",
  "druid",
  "duergar",
  "dwarf",
  "elf",
  "fighter",
  "gnome",
  "goblin",
  "halfElf",
  "halfOrc",
  "halfling",
  "illusionist",
  "knight",
  "magicUser",
  "paladin",
  "ranger",
  "svirfneblin",
  "thief",
];

const EMPTY_SAVES = [
  { key: "doom", label: "Death", value: Number.NaN },
  { key: "ray", label: "Wands", value: Number.NaN },
  { key: "hold", label: "Paralysis", value: Number.NaN },
  { key: "blast", label: "Breath", value: Number.NaN },
  { key: "spell", label: "Spells", value: Number.NaN },
];

function getResolvedClassId(className: string): string | undefined {
  const lookup = getCharacterSaveLookup(className, 1);
  return lookup.ok ? lookup.classId : undefined;
}

export const SAVE_TABLES_MANUAL_FIXTURES = [
  {
    name: "save lookup resolves class and level",
    actual: getCharacterSaveLookup("Fighter", 4),
    expected: {
      ok: true,
      attackBonus: 2,
      classId: "fighter",
      className: "Fighter",
      level: 4,
      saves: [
        { key: "doom", label: "Death", value: 10 },
        { key: "ray", label: "Wands", value: 11 },
        { key: "hold", label: "Paralysis", value: 12 },
        { key: "blast", label: "Breath", value: 13 },
        { key: "spell", label: "Spells", value: 14 },
      ],
    },
  },
  {
    name: "save lookup normalizes class name punctuation and case",
    actual: getCharacterSaveLookup("magic user", 1).ok,
    expected: true,
  },
  {
    name: "save lookup resolves Imperial Goblin display name and goblin id",
    actual: {
      imperialGoblin: getResolvedClassId("Imperial Goblin"),
      goblin: getResolvedClassId("goblin"),
    },
    expected: {
      imperialGoblin: "goblin",
      goblin: "goblin",
    },
  },
  {
    name: "save lookup rejects empty class name",
    actual: getCharacterSaveLookup("", 1),
    expected: {
      ok: false,
      message: "Enter a supported class to calculate saves.",
      saves: EMPTY_SAVES,
    },
  },
  {
    name: "save lookup rejects unknown class",
    actual: getCharacterSaveLookup("Warlock", 1),
    expected: {
      ok: false,
      message: "Saves unavailable for this class.",
      saves: EMPTY_SAVES,
    },
  },
  {
    name: "save lookup rejects missing level",
    actual: getCharacterSaveLookup("Fighter", null),
    expected: {
      ok: false,
      message: "Enter level 1 or higher to calculate saves.",
      saves: EMPTY_SAVES,
    },
  },
  {
    name: "save lookup rejects level beyond class table",
    actual: getCharacterSaveLookup("Fighter", 15),
    expected: {
      ok: false,
      message: "Saves unavailable for Fighter level 15.",
      saves: EMPTY_SAVES,
    },
  },
  {
    name: "thac0 derives from attack bonus zero",
    actual: getThac0(0),
    expected: 19,
  },
  {
    name: "thac0 derives from positive attack bonus",
    actual: getThac0(2),
    expected: 17,
  },
  {
    name: "xp progress reports current and next thresholds",
    actual: getXpProgress("Magic-User", 2, 3000),
    expected: {
      ok: true,
      classId: "magicUser",
      className: "Magic-User",
      level: 2,
      currentLevelXp: 2500,
      nextLevelXp: 5000,
      xpToNext: 2000,
    },
  },
  {
    name: "xp progress clamps xp past next threshold to zero remaining",
    actual: getXpProgress("Fighter", 3, 9500),
    expected: {
      ok: true,
      classId: "fighter",
      className: "Fighter",
      level: 3,
      currentLevelXp: 4000,
      nextLevelXp: 8000,
      xpToNext: 0,
    },
  },
  {
    name: "xp progress at max level has no next threshold",
    actual: getXpProgress("Fighter", 14, 900000),
    expected: {
      ok: true,
      classId: "fighter",
      className: "Fighter",
      level: 14,
      currentLevelXp: 840000,
      nextLevelXp: null,
      xpToNext: null,
    },
  },
  {
    name: "xp progress with null xp keeps thresholds but no remaining",
    actual: getXpProgress("Fighter", 3, null),
    expected: {
      ok: true,
      classId: "fighter",
      className: "Fighter",
      level: 3,
      currentLevelXp: 4000,
      nextLevelXp: 8000,
      xpToNext: null,
    },
  },
  {
    name: "xp progress fails for unknown class",
    actual: getXpProgress("Warlock", 1, 0),
    expected: {
      ok: false,
      message: "Saves unavailable for this class.",
    },
  },
  {
    name: "spell slots for magic-user level 3",
    actual: getClassSpellSlots("Magic-User", 3),
    expected: {
      ok: true,
      classId: "magicUser",
      className: "Magic-User",
      level: 3,
      slots: [
        { spellLevel: 1, count: 2 },
        { spellLevel: 2, count: 1 },
      ],
      maxSpellLevel: 2,
    },
  },
  {
    name: "spell slots for magic-user level 14",
    actual: getClassSpellSlots("Magic-User", 14),
    expected: {
      ok: true,
      classId: "magicUser",
      className: "Magic-User",
      level: 14,
      slots: [
        { spellLevel: 1, count: 4 },
        { spellLevel: 2, count: 4 },
        { spellLevel: 3, count: 4 },
        { spellLevel: 4, count: 4 },
        { spellLevel: 5, count: 3 },
        { spellLevel: 6, count: 3 },
      ],
      maxSpellLevel: 6,
    },
  },
  {
    name: "spell slots empty for non-caster",
    actual: getClassSpellSlots("Acrobat", 1),
    expected: {
      ok: true,
      classId: "acrobat",
      className: "Acrobat",
      level: 1,
      slots: [],
      maxSpellLevel: null,
    },
  },
  {
    name: "spell slots fail for missing level",
    actual: getClassSpellSlots("Cleric", null),
    expected: {
      ok: false,
      message: "Enter level 1 or higher to calculate saves.",
    },
  },
  {
    name: "every class resolves spell slots and xp progress at level 1",
    actual: ALL_CLASS_IDS.every(
      (classId) =>
        getClassSpellSlots(classId, 1).ok && getXpProgress(classId, 1, 0).ok,
    ),
    expected: true,
  },
  {
    name: "campaign class metadata includes handout Hit Dice",
    actual: [
      "acrobat",
      "barbarian",
      "cleric",
      "druid",
      "dwarf",
      "elf",
      "fighter",
      "goblin",
      "halfElf",
      "halfling",
      "illusionist",
      "magicUser",
      "paladin",
      "thief",
    ].map((classId) => getClassMetadata(classId)),
    expected: [
      { ok: true, classId: "acrobat", className: "Acrobat", hitDie: "d4", expertise: { starting: 4, perLevel: 1 } },
      { ok: true, classId: "barbarian", className: "Barbarian", hitDie: "d8" },
      { ok: true, classId: "cleric", className: "Cleric", hitDie: "d6" },
      { ok: true, classId: "druid", className: "Druid", hitDie: "d6" },
      { ok: true, classId: "dwarf", className: "Dwarf", hitDie: "d8" },
      { ok: true, classId: "elf", className: "Elf", hitDie: "d6" },
      { ok: true, classId: "fighter", className: "Fighter", hitDie: "d8" },
      { ok: true, classId: "goblin", className: "Imperial Goblin", hitDie: "d6" },
      { ok: true, classId: "halfElf", className: "Half-Elf", hitDie: "d6" },
      { ok: true, classId: "halfling", className: "Halfling", hitDie: "d6" },
      { ok: true, classId: "illusionist", className: "Illusionist", hitDie: "d4" },
      { ok: true, classId: "magicUser", className: "Magic-User", hitDie: "d4" },
      { ok: true, classId: "paladin", className: "Paladin", hitDie: "d8" },
      { ok: true, classId: "thief", className: "Thief", hitDie: "d4", expertise: { starting: 6, perLevel: 2 } },
    ],
  },
  {
    name: "unknown class has no class metadata",
    actual: getClassMetadata("Warlock"),
    expected: {
      ok: false,
      message: "Class metadata unavailable for this class.",
    },
  },
];

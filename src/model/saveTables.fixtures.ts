import {
  getCharacterSaveLookup,
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
  { key: "doom", label: "Doom", value: Number.NaN },
  { key: "ray", label: "Ray", value: Number.NaN },
  { key: "hold", label: "Hold", value: Number.NaN },
  { key: "blast", label: "Blast", value: Number.NaN },
  { key: "spell", label: "Spell", value: Number.NaN },
];

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
        { key: "doom", label: "Doom", value: 10 },
        { key: "ray", label: "Ray", value: 11 },
        { key: "hold", label: "Hold", value: 12 },
        { key: "blast", label: "Blast", value: 13 },
        { key: "spell", label: "Spell", value: 14 },
      ],
    },
  },
  {
    name: "save lookup normalizes class name punctuation and case",
    actual: getCharacterSaveLookup("magic user", 1).ok,
    expected: true,
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
];

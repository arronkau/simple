import {
  getClassWeaponDamage,
  getExpertiseSummary,
  getSkillCapWarnings,
  getStartingHpWarning,
} from "./classDerivations";
import { createEmptyCharacterData } from "./characters";
import type { CharacterData, CharacterSkill } from "./types";

function makeCharacter({
  className,
  level,
  skills = [],
  strength = null,
  maxHp = null,
}: {
  className: string;
  level: number | null;
  skills?: CharacterSkill[];
  strength?: number | null;
  maxHp?: number | null;
}): CharacterData {
  const character = createEmptyCharacterData();

  return {
    ...character,
    className,
    level,
    hp: { current: maxHp, max: maxHp },
    abilityScores: { ...character.abilityScores, strength },
    skills,
  };
}

function getDamageLabel(className: string, level: number): string {
  const result = getClassWeaponDamage(className, level);

  return result.ok ? result.label : result.message;
}

const sixExpertiseSkills: CharacterSkill[] = [
  { id: "skill-1", name: "Climb", chanceInSix: 4 },
  { id: "skill-2", name: "Hear Noise", chanceInSix: 4 },
];

export const CLASS_DERIVATIONS_MANUAL_FIXTURES = [
  {
    name: "weapon damage returns the complete mastery result",
    actual: getClassWeaponDamage("Fighter", 4),
    expected: {
      ok: true,
      classId: "fighter",
      className: "Fighter",
      level: 4,
      step: 2,
      dice: 1,
      die: "d10",
      label: "1d10",
    },
  },
  {
    name: "fighter weapon damage follows every authored mastery bracket",
    actual: [1, 3, 4, 7, 10, 13, 14].map((level) =>
      getDamageLabel("Fighter", level),
    ),
    expected: ["1d8", "1d8", "1d10", "2d8", "3d8", "4d8", "4d8"],
  },
  {
    name: "thief weapon damage follows authored mastery brackets",
    actual: [1, 5, 9, 13].map((level) => getDamageLabel("Thief", level)),
    expected: ["1d4", "1d6", "2d4", "3d4"],
  },
  {
    name: "magic-user weapon damage follows authored mastery brackets",
    actual: [1, 6, 11].map((level) =>
      getDamageLabel("Magic-User", level),
    ),
    expected: ["1d4", "1d6", "2d4"],
  },
  {
    name: "cleric weapon damage follows authored mastery brackets",
    actual: [1, 5, 9, 13].map((level) => getDamageLabel("Cleric", level)),
    expected: ["1d6", "1d8", "2d6", "3d6"],
  },
  {
    name: "other campaign classes derive damage from their JSON brackets",
    actual: [
      getDamageLabel("Elf", 4),
      getDamageLabel("Elf", 7),
      getDamageLabel("Elf", 10),
      getDamageLabel("Imperial Goblin", 7),
      getDamageLabel("Halfling", 8),
      getDamageLabel("Dwarf", 10),
      getDamageLabel("Paladin", 13),
    ],
    expected: ["1d8", "2d6", "3d6", "2d6", "2d6", "3d8", "4d8"],
  },
  {
    name: "every remaining campaign class matches each authored bracket boundary",
    actual: {
      acrobat: [1, 5, 9, 13].map((level) =>
        getDamageLabel("Acrobat", level),
      ),
      barbarian: [1, 4, 7, 10, 13].map((level) =>
        getDamageLabel("Barbarian", level),
      ),
      druid: [1, 5, 9, 13].map((level) =>
        getDamageLabel("Druid", level),
      ),
      dwarf: [1, 4, 7, 10].map((level) =>
        getDamageLabel("Dwarf", level),
      ),
      elf: [1, 4, 7, 10].map((level) => getDamageLabel("Elf", level)),
      halfElf: [1, 4, 7, 10].map((level) =>
        getDamageLabel("Half-Elf", level),
      ),
      imperialGoblin: [1, 4, 7].map((level) =>
        getDamageLabel("Imperial Goblin", level),
      ),
      halfling: [1, 4, 7].map((level) =>
        getDamageLabel("Halfling", level),
      ),
      illusionist: [1, 6, 11].map((level) =>
        getDamageLabel("Illusionist", level),
      ),
      paladin: [1, 4, 7, 10, 13].map((level) =>
        getDamageLabel("Paladin", level),
      ),
    },
    expected: {
      acrobat: ["1d4", "1d6", "2d4", "3d4"],
      barbarian: ["1d8", "1d10", "2d8", "3d8", "4d8"],
      druid: ["1d6", "1d8", "2d6", "3d6"],
      dwarf: ["1d8", "1d10", "2d8", "3d8"],
      elf: ["1d6", "1d8", "2d6", "3d6"],
      halfElf: ["1d6", "1d8", "2d6", "3d6"],
      imperialGoblin: ["1d6", "1d8", "2d6"],
      halfling: ["1d6", "1d8", "2d6"],
      illusionist: ["1d4", "1d6", "2d4"],
      paladin: ["1d8", "1d10", "2d8", "3d8", "4d8"],
    },
  },
  {
    name: "weapon damage rejects classes without hit die metadata",
    actual: getClassWeaponDamage("Assassin", 1),
    expected: {
      ok: false,
      message: "Weapon damage unavailable because Assassin has no Hit Die.",
    },
  },
  {
    name: "weapon damage rejects levels outside the class table",
    actual: getClassWeaponDamage("Fighter", 15),
    expected: {
      ok: false,
      message: "Weapon damage unavailable for Fighter level 15.",
    },
  },
  {
    name: "weapon damage rejects unknown classes and missing levels",
    actual: {
      unknownClass: getClassWeaponDamage("Warlock", 1),
      missingLevel: getClassWeaponDamage("Fighter", null),
    },
    expected: {
      unknownClass: {
        ok: false,
        message: "Weapon damage unavailable for this class.",
      },
      missingLevel: {
        ok: false,
        message: "Enter level 1 or higher to calculate weapon damage.",
      },
    },
  },
  {
    name: "thief level one expertise can be exactly allocated",
    actual: getExpertiseSummary(
      makeCharacter({
        className: "Thief",
        level: 1,
        skills: sixExpertiseSkills,
      }),
    ),
    expected: {
      ok: true,
      pool: 6,
      spent: 6,
      delta: 0,
      warnings: [],
    },
  },
  {
    name: "thief level two expertise warns when under-allocated",
    actual: getExpertiseSummary(
      makeCharacter({
        className: "Thief",
        level: 2,
        skills: sixExpertiseSkills,
      }),
    ),
    expected: {
      ok: true,
      pool: 8,
      spent: 6,
      delta: -2,
      warnings: ["Expertise under-allocated by 2"],
    },
  },
  {
    name: "acrobat level one expertise warns when over-allocated",
    actual: getExpertiseSummary(
      makeCharacter({
        className: "Acrobat",
        level: 1,
        skills: [{ id: "skill-1", name: "Tumble", chanceInSix: 6 }],
      }),
    ),
    expected: {
      ok: true,
      pool: 4,
      spent: 5,
      delta: 1,
      warnings: ["Expertise over-allocated by 1"],
    },
  },
  {
    name: "open doors expertise base uses a resolvable positive strength modifier",
    actual: {
      strength16: getExpertiseSummary(
        makeCharacter({
          className: "Thief",
          level: 1,
          strength: 16,
          skills: [{ id: "skill-1", name: "Open Doors", chanceInSix: 5 }],
        }),
      ),
      strength8: getExpertiseSummary(
        makeCharacter({
          className: "Thief",
          level: 1,
          strength: 8,
          skills: [{ id: "skill-1", name: "Open Doors", chanceInSix: 5 }],
        }),
      ),
      strengthNull: getExpertiseSummary(
        makeCharacter({
          className: "Thief",
          level: 1,
          strength: null,
          skills: [{ id: "skill-1", name: "Open Doors", chanceInSix: 5 }],
        }),
      ),
    },
    expected: {
      strength16: {
        ok: true,
        pool: 6,
        spent: 3,
        delta: -3,
        warnings: ["Expertise under-allocated by 3"],
      },
      strength8: {
        ok: true,
        pool: 6,
        spent: 4,
        delta: -2,
        warnings: ["Expertise under-allocated by 2"],
      },
      strengthNull: {
        ok: true,
        pool: 6,
        spent: 4,
        delta: -2,
        warnings: ["Expertise under-allocated by 2"],
      },
    },
  },
  {
    name: "expertise rejects classes without expertise metadata",
    actual: getExpertiseSummary(
      makeCharacter({ className: "Fighter", level: 1 }),
    ),
    expected: {
      ok: false,
      message: "Expertise unavailable for this class.",
    },
  },
  {
    name: "expertise rejects missing and zero levels",
    actual: {
      missing: getExpertiseSummary(
        makeCharacter({ className: "Thief", level: null }),
      ),
      zero: getExpertiseSummary(
        makeCharacter({ className: "Thief", level: 0 }),
      ),
    },
    expected: {
      missing: {
        ok: false,
        message: "Enter level 1 or higher to calculate expertise.",
      },
      zero: {
        ok: false,
        message: "Enter level 1 or higher to calculate expertise.",
      },
    },
  },
  {
    name: "skill cap warning leaves a stored six-in-six chance unchanged",
    actual: getSkillCapWarnings(
      makeCharacter({
        className: "Fighter",
        level: 1,
        skills: [{ id: "skill-1", name: "Search", chanceInSix: 6 }],
      }),
    ),
    expected: ["No d6 skill may exceed 5-in-6"],
  },
  {
    name: "minimum starting hp warns for each class hit die",
    actual: [
      getStartingHpWarning(
        makeCharacter({ className: "Thief", level: 1, maxHp: 2 }),
      ),
      getStartingHpWarning(
        makeCharacter({ className: "Cleric", level: 1, maxHp: 3 }),
      ),
      getStartingHpWarning(
        makeCharacter({ className: "Fighter", level: 1, maxHp: 4 }),
      ),
    ],
    expected: [
      "Starting HP is below the d4 class minimum of 3.",
      "Starting HP is below the d6 class minimum of 4.",
      "Starting HP is below the d8 class minimum of 5.",
    ],
  },
  {
    name: "minimum starting hp stays silent outside its warning conditions",
    actual: {
      atMinimum: getStartingHpWarning(
        makeCharacter({ className: "Fighter", level: 1, maxHp: 5 }),
      ),
      levelTwo: getStartingHpWarning(
        makeCharacter({ className: "Thief", level: 2, maxHp: 1 }),
      ),
      nullMax: getStartingHpWarning(
        makeCharacter({ className: "Cleric", level: 1, maxHp: null }),
      ),
      unknownClass: getStartingHpWarning(
        makeCharacter({ className: "Warlock", level: 1, maxHp: 1 }),
      ),
    },
    expected: {},
  },
];

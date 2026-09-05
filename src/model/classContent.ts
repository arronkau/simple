import bundledClassContent from "./ose_class_content.json";
import { normalizeContentName } from "./spellLibrary";
import { loadClassContentFiles, resolveContentLibrary } from "./systemContent";
import { getAbilityModifier } from "./abilityModifiers";
import type { AbilityScores, CharacterSkill } from "./types";

export type ClassAbility = {
  id: string;
  name: string;
  description: string;
};

/** One entry of a skill roster, seeded onto a sheet as a d6 skill. */
export type ClassSkill = {
  id: string;
  name: string;
  description?: string;
};

/** A roster entry with the base chance a class starts it at, when the class
 * says so; otherwise the generic base applies (see getRosterSkillBaseChance). */
export type RosterSkill = ClassSkill & {
  baseChanceInSix?: number;
};

export type ClassLevelTable = {
  id: string;
  name: string;
  columns: string[];
  rowsByLevel: Record<string, Array<string | number>>;
};

export type ClassContentLibrary = {
  /** d6 skills every character starts with, before any class roster. */
  commonSkills?: ClassSkill[];
  classes: Record<
    string,
    {
      id: string;
      displayName: string;
      primeRequisites: Array<keyof AbilityScores>;
      spellListId?: string;
      abilities: ClassAbility[];
      /** Class-only roster, appended after the common skills. */
      skills?: ClassSkill[];
      /** Base chance overrides for common skills, by common skill id. */
      skillBases?: Record<string, number>;
      levelTables: ClassLevelTable[];
    }
  >;
};

export type ClassContentLookupResult =
  | {
      ok: true;
      classId: string;
      className: string;
      primeRequisites: Array<keyof AbilityScores>;
      spellListId?: string;
      abilities: ClassAbility[];
      skills: ClassSkill[];
      levelTables: ClassLevelTable[];
    }
  | {
      ok: false;
      message: string;
    };

export type ResolvedLevelTable = {
  id: string;
  name: string;
  columns: string[];
  values: Array<string | number> | null;
};

const DEFAULT_LIBRARY = resolveContentLibrary(
  bundledClassContent as ClassContentLibrary,
  "classes",
  loadClassContentFiles(),
);

export function getClassContentLookup(
  className: string,
  library: ClassContentLibrary = DEFAULT_LIBRARY,
): ClassContentLookupResult {
  const normalizedClassName = normalizeContentName(className);

  if (!normalizedClassName) {
    return {
      ok: false,
      message: "Enter a class to look up class content.",
    };
  }

  const classEntry = Object.values(library.classes).find(
    (candidateClass) =>
      normalizeContentName(candidateClass.id) === normalizedClassName ||
      normalizeContentName(candidateClass.displayName) === normalizedClassName,
  );

  if (!classEntry) {
    return {
      ok: false,
      message: "No class content authored for this class.",
    };
  }

  return {
    ok: true,
    classId: classEntry.id,
    className: classEntry.displayName,
    primeRequisites: classEntry.primeRequisites,
    ...(classEntry.spellListId !== undefined
      ? { spellListId: classEntry.spellListId }
      : {}),
    abilities: classEntry.abilities,
    skills: classEntry.skills ?? [],
    levelTables: classEntry.levelTables,
  };
}

/**
 * The d6 skills a character of this class starts with: the library's common
 * skills (with the class's base overrides applied) followed by the class's
 * own roster. An unknown or empty class still gets the common skills.
 */
export function getSkillRoster(
  className: string,
  library: ClassContentLibrary = DEFAULT_LIBRARY,
): RosterSkill[] {
  const normalizedClassName = normalizeContentName(className);
  const classEntry = normalizedClassName
    ? Object.values(library.classes).find(
        (candidateClass) =>
          normalizeContentName(candidateClass.id) === normalizedClassName ||
          normalizeContentName(candidateClass.displayName) ===
            normalizedClassName,
      )
    : undefined;
  const bases = classEntry?.skillBases ?? {};

  return [
    ...(library.commonSkills ?? []).map((skill) => ({
      ...skill,
      ...(bases[skill.id] !== undefined
        ? { baseChanceInSix: bases[skill.id] }
        : {}),
    })),
    ...(classEntry?.skills ?? []),
  ];
}

/**
 * Where a roster skill starts: the class's stated base, else 1-in-6, except
 * Open Doors, which starts at the STR modifier (at least 1). The expertise
 * derivation uses the same Open Doors rule.
 */
export function getRosterSkillBaseChance(
  skill: RosterSkill,
  strengthScore: number | null,
): number {
  if (skill.baseChanceInSix !== undefined) {
    return skill.baseChanceInSix;
  }

  if (normalizeContentName(skill.name) === "opendoors") {
    const modifier = getAbilityModifier(strengthScore);

    return modifier.ok ? Math.max(1, modifier.modifier) : 1;
  }

  return 1;
}

/**
 * Roster skills the sheet lacks, matched by fuzzy name against id or name,
 * as new rows at their base chance. Never removes or rewrites existing rows.
 */
export function createMissingRosterSkills(
  className: string,
  existingSkills: CharacterSkill[],
  strengthScore: number | null,
  createSkillId: () => string,
  library: ClassContentLibrary = DEFAULT_LIBRARY,
): CharacterSkill[] {
  const existing = new Set(
    existingSkills.map((skill) => normalizeContentName(skill.name)),
  );

  return getSkillRoster(className, library)
    .filter(
      (skill) =>
        !existing.has(normalizeContentName(skill.name)) &&
        !existing.has(normalizeContentName(skill.id)),
    )
    .map((skill) => ({
      id: createSkillId(),
      name: skill.name,
      chanceInSix: getRosterSkillBaseChance(skill, strengthScore),
      ...(skill.description ? { description: skill.description } : {}),
    }));
}

/**
 * When the class changes, a common skill still sitting at the generic base
 * (untouched since it was seeded) moves to the new class's base. A row the
 * player has adjusted is left alone.
 */
export function applyClassSkillBases(
  skills: CharacterSkill[],
  className: string,
  strengthScore: number | null,
  library: ClassContentLibrary = DEFAULT_LIBRARY,
): CharacterSkill[] {
  const roster = getSkillRoster(className, library);

  return skills.map((skill) => {
    const rosterSkill = roster.find(
      (candidate) =>
        candidate.baseChanceInSix !== undefined &&
        (normalizeContentName(candidate.name) === normalizeContentName(skill.name) ||
          normalizeContentName(candidate.id) === normalizeContentName(skill.name)),
    );

    if (!rosterSkill) {
      return skill;
    }

    const genericBase = getRosterSkillBaseChance(
      { ...rosterSkill, baseChanceInSix: undefined },
      strengthScore,
    );

    return skill.chanceInSix === genericBase
      ? { ...skill, chanceInSix: getRosterSkillBaseChance(rosterSkill, strengthScore) }
      : skill;
  });
}

/** The spell list a class casts from, or undefined for a non-caster or an unknown class. */
export function getClassSpellListId(
  className: string,
  library: ClassContentLibrary = DEFAULT_LIBRARY,
): string | undefined {
  const lookup = getClassContentLookup(className, library);

  return lookup.ok ? lookup.spellListId : undefined;
}

/**
 * Open Doors starts at the STR modifier, so a row still at the base for the
 * old STR score follows a STR change; a row the player has set stays put.
 */
export function applyStrengthToOpenDoors(
  skills: CharacterSkill[],
  previousStrength: number | null,
  nextStrength: number | null,
): CharacterSkill[] {
  const openDoors: RosterSkill = { id: "openDoors", name: "Open Doors" };
  const previousBase = getRosterSkillBaseChance(openDoors, previousStrength);
  const nextBase = getRosterSkillBaseChance(openDoors, nextStrength);

  if (previousBase === nextBase) {
    return skills;
  }

  return skills.map((skill) =>
    normalizeContentName(skill.name) === "opendoors" &&
    skill.chanceInSix === previousBase
      ? { ...skill, chanceInSix: nextBase }
      : skill,
  );
}

export function getClassLevelTables(
  className: string,
  level: number | null,
  library: ClassContentLibrary = DEFAULT_LIBRARY,
): ResolvedLevelTable[] {
  const contentLookup = getClassContentLookup(className, library);

  if (!contentLookup.ok) {
    return [];
  }

  return contentLookup.levelTables.map((table) => ({
    id: table.id,
    name: table.name,
    columns: table.columns,
    values:
      level === null ? null : (table.rowsByLevel[level.toString()] ?? null),
  }));
}

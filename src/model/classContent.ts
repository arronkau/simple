import bundledClassContent from "./ose_class_content.json";
import { normalizeContentName } from "./spellLibrary";
import { loadClassContentFiles, resolveContentLibrary } from "./systemContent";
import type { AbilityScores } from "./types";

export type ClassAbility = {
  id: string;
  name: string;
  description: string;
};

/** One entry of a class's skill roster, seeded onto a sheet as a d6 skill. */
export type ClassSkill = {
  id: string;
  name: string;
  description?: string;
};

export type ClassLevelTable = {
  id: string;
  name: string;
  columns: string[];
  rowsByLevel: Record<string, Array<string | number>>;
};

export type ClassContentLibrary = {
  classes: Record<
    string,
    {
      id: string;
      displayName: string;
      primeRequisites: Array<keyof AbilityScores>;
      spellListId?: string;
      abilities: ClassAbility[];
      skills?: ClassSkill[];
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
 * Roster skills the sheet does not have yet, matched by fuzzy name, for
 * seeding when a class is set. Never removes or rewrites existing rows.
 */
export function getMissingClassSkills(
  className: string,
  existingSkillNames: string[],
  library: ClassContentLibrary = DEFAULT_LIBRARY,
): ClassSkill[] {
  const lookup = getClassContentLookup(className, library);

  if (!lookup.ok) {
    return [];
  }

  const existing = new Set(existingSkillNames.map(normalizeContentName));

  return lookup.skills.filter(
    (skill) =>
      !existing.has(normalizeContentName(skill.name)) &&
      !existing.has(normalizeContentName(skill.id)),
  );
}

/** The spell list a class casts from, or undefined for a non-caster or an unknown class. */
export function getClassSpellListId(
  className: string,
  library: ClassContentLibrary = DEFAULT_LIBRARY,
): string | undefined {
  const lookup = getClassContentLookup(className, library);

  return lookup.ok ? lookup.spellListId : undefined;
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

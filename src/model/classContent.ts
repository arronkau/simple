import bundledClassContent from "./ose_class_content.json";
import { normalizeContentName } from "./spellLibrary";
import type { AbilityScores } from "./types";

export type ClassAbility = {
  id: string;
  name: string;
  description: string;
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

const DEFAULT_LIBRARY = bundledClassContent as ClassContentLibrary;

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
    levelTables: classEntry.levelTables,
  };
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

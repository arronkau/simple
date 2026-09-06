import { toAscendingArmorClassText } from "./armorClassNotation";
import bundledSpellLibrary from "./ose_spell_library.json";
import { loadSpellLibraryFiles, resolveContentLibrary } from "./systemContent";

export type SpellEntry = {
  id: string;
  displayName: string;
  reversible?: boolean;
  /** Name of the reversed form, when the list prints one. */
  reversedName?: string;
  duration?: string;
  range?: string;
  description: string;
};

/**
 * How casters of a list come by their spells: a prayed ("wholeList") list is
 * open at every castable level each day, a "spellbook" list must be learned
 * spell by spell. Absent means "spellbook".
 */
export type SpellListAccess = "wholeList" | "spellbook";

export type SpellLibrary = {
  spellLists: Record<
    string,
    {
      id: string;
      displayName: string;
      access?: SpellListAccess;
      levels: Record<string, SpellEntry[]>;
    }
  >;
};

export type SpellLookupResult =
  | {
      ok: true;
      spell: SpellEntry;
      listId: string;
      listName: string;
      spellLevel: number;
    }
  | {
      ok: false;
      message: string;
    };

export type SpellListLevel = {
  spellLevel: number;
  spells: SpellEntry[];
};

export type SpellListLookupResult =
  | {
      ok: true;
      listId: string;
      listName: string;
      access: SpellListAccess;
      levels: SpellListLevel[];
    }
  | {
      ok: false;
      message: string;
    };

export type SpellSuggestion = {
  spell: SpellEntry;
  spellLevel: number;
  listId: string;
};

const DEFAULT_LIBRARY = toAscendingArmorClassLibrary(
  resolveContentLibrary(
    bundledSpellLibrary as SpellLibrary,
    "spellLists",
    loadSpellLibraryFiles(),
  ),
);

/**
 * The transcribed library keeps the book's dual AC notation; the app shows
 * ascending AC only (see `armorClassNotation.ts`), so every description is
 * rewritten once here. The text a pick copies onto a sheet is the rewritten one.
 */
export function toAscendingArmorClassLibrary(library: SpellLibrary): SpellLibrary {
  return {
    ...library,
    spellLists: Object.fromEntries(
      Object.entries(library.spellLists).map(([listId, list]) => [
        listId,
        {
          ...list,
          levels: Object.fromEntries(
            Object.entries(list.levels).map(([levelKey, spells]) => [
              levelKey,
              spells.map((spell) => ({
                ...spell,
                description: toAscendingArmorClassText(spell.description),
              })),
            ]),
          ),
        },
      ]),
    ),
  };
}

export function getSpellLookup(
  spellName: string,
  preferredListId?: string,
  library: SpellLibrary = DEFAULT_LIBRARY,
): SpellLookupResult {
  const normalizedSpellName = normalizeContentName(spellName);

  if (!normalizedSpellName) {
    return {
      ok: false,
      message: "Enter a spell name to look up.",
    };
  }

  const lists = Object.values(library.spellLists);
  const orderedLists =
    preferredListId === undefined
      ? lists
      : [
          ...lists.filter((list) => list.id === preferredListId),
          ...lists.filter((list) => list.id !== preferredListId),
        ];

  for (const list of orderedLists) {
    for (const [levelKey, spells] of Object.entries(list.levels)) {
      const spell = spells.find(
        (candidateSpell) =>
          normalizeContentName(candidateSpell.id) === normalizedSpellName ||
          normalizeContentName(candidateSpell.displayName) ===
            normalizedSpellName,
      );

      if (spell) {
        return {
          ok: true,
          spell,
          listId: list.id,
          listName: list.displayName,
          spellLevel: Number(levelKey),
        };
      }
    }
  }

  return {
    ok: false,
    message: "Spell not found in the spell library.",
  };
}

export function getSpellListLookup(
  listId: string,
  library: SpellLibrary = DEFAULT_LIBRARY,
): SpellListLookupResult {
  const normalizedListId = normalizeContentName(listId);

  if (!normalizedListId) {
    return {
      ok: false,
      message: "Enter a spell list to look up.",
    };
  }

  const list = Object.values(library.spellLists).find(
    (candidateList) =>
      normalizeContentName(candidateList.id) === normalizedListId ||
      normalizeContentName(candidateList.displayName) === normalizedListId,
  );

  if (!list) {
    return {
      ok: false,
      message: "Spell list not found in the spell library.",
    };
  }

  return {
    ok: true,
    listId: list.id,
    listName: list.displayName,
    access: list.access ?? "spellbook",
    levels: Object.entries(list.levels)
      .map(([levelKey, spells]) => ({
        spellLevel: Number(levelKey),
        spells,
      }))
      .sort((left, right) => left.spellLevel - right.spellLevel),
  };
}

/**
 * Spells of one list that match a typed query, for the sheet's spell
 * autocomplete. Ordered by spell level, then name; an empty query returns the
 * whole list. No list (a non-caster or an unknown class) means no suggestions.
 */
export function filterSpellSuggestions(
  query: string,
  listId: string | undefined,
  library: SpellLibrary = DEFAULT_LIBRARY,
): SpellSuggestion[] {
  if (listId === undefined) {
    return [];
  }

  const listLookup = getSpellListLookup(listId, library);

  if (!listLookup.ok) {
    return [];
  }

  const normalizedQuery = normalizeContentName(query);

  return listLookup.levels.flatMap((level) =>
    [...level.spells]
      .sort((left, right) => left.displayName.localeCompare(right.displayName))
      .filter(
        (spell) =>
          !normalizedQuery ||
          normalizeContentName(spell.displayName).includes(normalizedQuery) ||
          normalizeContentName(spell.id).includes(normalizedQuery),
      )
      .map((spell) => ({
        spell,
        spellLevel: level.spellLevel,
        listId: listLookup.listId,
      })),
  );
}

export function getSpellListAccess(
  listId: string | undefined,
  library: SpellLibrary = DEFAULT_LIBRARY,
): SpellListAccess | undefined {
  if (listId === undefined) {
    return undefined;
  }

  const listLookup = getSpellListLookup(listId, library);

  return listLookup.ok ? listLookup.access : undefined;
}

/**
 * Every spell of one level in a list that the character does not already
 * have, matched by fuzzy name, for the editor's add-a-whole-level action.
 * Sorted by name like the suggestions.
 */
export function getSpellsMissingAtLevel(
  listId: string | undefined,
  spellLevel: number,
  existingSpellNames: string[],
  library: SpellLibrary = DEFAULT_LIBRARY,
): SpellSuggestion[] {
  const existing = new Set(existingSpellNames.map(normalizeContentName));

  return filterSpellSuggestions("", listId, library).filter(
    (suggestion) =>
      suggestion.spellLevel === spellLevel &&
      !existing.has(normalizeContentName(suggestion.spell.displayName)) &&
      !existing.has(normalizeContentName(suggestion.spell.id)),
  );
}

export function normalizeContentName(name: string): string {
  return name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "");
}

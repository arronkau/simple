import bundledSpellLibrary from "./ose_spell_library.json";

export type SpellEntry = {
  id: string;
  displayName: string;
  reversible?: boolean;
  duration?: string;
  range?: string;
  description: string;
};

export type SpellLibrary = {
  spellLists: Record<
    string,
    {
      id: string;
      displayName: string;
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
      levels: SpellListLevel[];
    }
  | {
      ok: false;
      message: string;
    };

const DEFAULT_LIBRARY = bundledSpellLibrary as SpellLibrary;

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
    levels: Object.entries(list.levels)
      .map(([levelKey, spells]) => ({
        spellLevel: Number(levelKey),
        spells,
      }))
      .sort((left, right) => left.spellLevel - right.spellLevel),
  };
}

export function normalizeContentName(name: string): string {
  return name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "");
}

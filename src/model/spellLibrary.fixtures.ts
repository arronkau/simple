import {
  getSpellLookup,
  getSpellListLookup,
  type SpellLibrary,
} from "./spellLibrary";

const testLibrary: SpellLibrary = {
  spellLists: {
    listA: {
      id: "listA",
      displayName: "List A",
      levels: {
        "1": [
          {
            id: "glow",
            displayName: "Glow",
            reversible: true,
            duration: "1 turn",
            range: "60'",
            description: "Test spell A1.",
          },
        ],
        "2": [
          {
            id: "shared",
            displayName: "Shared Spell",
            description: "Appears in both lists at different levels.",
          },
        ],
      },
    },
    listB: {
      id: "listB",
      displayName: "List B",
      levels: {
        "3": [
          {
            id: "shared",
            displayName: "Shared Spell",
            description: "Appears in both lists at different levels.",
          },
        ],
      },
    },
  },
};

export const SPELL_LIBRARY_MANUAL_FIXTURES = [
  {
    name: "spell lookup matches by display name with punctuation and case",
    actual: getSpellLookup("  GLOW! ", undefined, testLibrary),
    expected: {
      ok: true,
      spell: {
        id: "glow",
        displayName: "Glow",
        reversible: true,
        duration: "1 turn",
        range: "60'",
        description: "Test spell A1.",
      },
      listId: "listA",
      listName: "List A",
      spellLevel: 1,
    },
  },
  {
    name: "spell lookup prefers the requested list for shared names",
    actual: getSpellLookup("Shared Spell", "listB", testLibrary),
    expected: {
      ok: true,
      spell: {
        id: "shared",
        displayName: "Shared Spell",
        description: "Appears in both lists at different levels.",
      },
      listId: "listB",
      listName: "List B",
      spellLevel: 3,
    },
  },
  {
    name: "spell lookup falls back across lists for shared names",
    actual: getSpellLookup("Shared Spell", undefined, testLibrary),
    expected: {
      ok: true,
      spell: {
        id: "shared",
        displayName: "Shared Spell",
        description: "Appears in both lists at different levels.",
      },
      listId: "listA",
      listName: "List A",
      spellLevel: 2,
    },
  },
  {
    name: "spell lookup fails for empty name",
    actual: getSpellLookup("", undefined, testLibrary),
    expected: {
      ok: false,
      message: "Enter a spell name to look up.",
    },
  },
  {
    name: "spell lookup fails for unknown spell",
    actual: getSpellLookup("Unknown Spell", undefined, testLibrary),
    expected: {
      ok: false,
      message: "Spell not found in the spell library.",
    },
  },
  {
    name: "spell list lookup returns levels sorted ascending",
    actual: getSpellListLookup("listA", testLibrary),
    expected: {
      ok: true,
      listId: "listA",
      listName: "List A",
      levels: [
        {
          spellLevel: 1,
          spells: [
            {
              id: "glow",
              displayName: "Glow",
              reversible: true,
              duration: "1 turn",
              range: "60'",
              description: "Test spell A1.",
            },
          ],
        },
        {
          spellLevel: 2,
          spells: [
            {
              id: "shared",
              displayName: "Shared Spell",
              description: "Appears in both lists at different levels.",
            },
          ],
        },
      ],
    },
  },
  {
    name: "spell list lookup fails for unknown list",
    actual: getSpellListLookup("listC", testLibrary),
    expected: {
      ok: false,
      message: "Spell list not found in the spell library.",
    },
  },
  {
    name: "bundled spell library rejects unknown spell gracefully",
    actual: getSpellLookup("Definitely Not A Spell").ok,
    expected: false,
  },
];

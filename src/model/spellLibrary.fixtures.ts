import {
  filterSpellSuggestions,
  getSpellListAccess,
  getSpellLookup,
  getSpellListLookup,
  getSpellsMissingAtLevel,
  type SpellLibrary,
} from "./spellLibrary";

const testLibrary: SpellLibrary = {
  spellLists: {
    listA: {
      id: "listA",
      displayName: "List A",
      access: "wholeList",
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
      access: "wholeList",
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
  {
    name: "spell suggestions list a whole spell list by level then name for an empty query",
    actual: filterSpellSuggestions("", "listA", testLibrary),
    expected: [
      {
        spell: {
          id: "glow",
          displayName: "Glow",
          reversible: true,
          duration: "1 turn",
          range: "60'",
          description: "Test spell A1.",
        },
        spellLevel: 1,
        listId: "listA",
      },
      {
        spell: {
          id: "shared",
          displayName: "Shared Spell",
          description: "Appears in both lists at different levels.",
        },
        spellLevel: 2,
        listId: "listA",
      },
    ],
  },
  {
    name: "spell suggestions match a partial name ignoring case and punctuation",
    actual: filterSpellSuggestions(" SHA-red ", "List A", testLibrary).map(
      (suggestion) => `${suggestion.spell.id}@${suggestion.spellLevel}`,
    ),
    expected: ["shared@2"],
  },
  {
    name: "spell suggestions stay inside the requested list",
    actual: filterSpellSuggestions("glow", "listB", testLibrary),
    expected: [],
  },
  {
    name: "spell suggestions are empty without a list",
    actual: filterSpellSuggestions("glow", undefined, testLibrary),
    expected: [],
  },
  {
    name: "spell suggestions are empty for an unknown list",
    actual: filterSpellSuggestions("", "listC", testLibrary),
    expected: [],
  },
  {
    name: "spell list access reads the list flag and defaults to spellbook",
    actual: [
      getSpellListAccess("listA", testLibrary),
      getSpellListAccess("listB", testLibrary),
      getSpellListAccess("listC", testLibrary),
      getSpellListAccess(undefined, testLibrary),
    ],
    expected: ["wholeList", "spellbook", undefined, undefined],
  },
  {
    name: "spells missing at a level skip names already on the sheet, matched fuzzily",
    actual: getSpellsMissingAtLevel("listA", 1, ["  glow! "], testLibrary),
    expected: [],
  },
  {
    name: "spells missing at a level list the rest of that level only",
    actual: getSpellsMissingAtLevel("listA", 2, ["Glow"], testLibrary).map(
      (suggestion) => `${suggestion.spell.id}@${suggestion.spellLevel}`,
    ),
    expected: ["shared@2"],
  },
  {
    name: "spells missing at a level are empty without a list",
    actual: getSpellsMissingAtLevel(undefined, 1, [], testLibrary),
    expected: [],
  },
];

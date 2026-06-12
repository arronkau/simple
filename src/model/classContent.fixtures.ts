import {
  getClassContentLookup,
  getClassLevelTables,
  type ClassContentLibrary,
} from "./classContent";

const testLibrary: ClassContentLibrary = {
  classes: {
    testClass: {
      id: "testClass",
      displayName: "Test Class",
      primeRequisites: ["dexterity", "strength"],
      spellListId: "listA",
      abilities: [
        {
          id: "testAbility",
          name: "Test Ability",
          description: "A test ability.",
        },
      ],
      levelTables: [
        {
          id: "testSkills",
          name: "Test Skills",
          columns: ["Climb", "Sneak"],
          rowsByLevel: {
            "1": [87, "1-2"],
            "2": [88, "1-3"],
          },
        },
      ],
    },
    plainClass: {
      id: "plainClass",
      displayName: "Plain Class",
      primeRequisites: ["strength"],
      abilities: [],
      levelTables: [],
    },
  },
};

export const CLASS_CONTENT_MANUAL_FIXTURES = [
  {
    name: "class content lookup matches by display name",
    actual: getClassContentLookup("test class", testLibrary),
    expected: {
      ok: true,
      classId: "testClass",
      className: "Test Class",
      primeRequisites: ["dexterity", "strength"],
      spellListId: "listA",
      abilities: [
        {
          id: "testAbility",
          name: "Test Ability",
          description: "A test ability.",
        },
      ],
      levelTables: [
        {
          id: "testSkills",
          name: "Test Skills",
          columns: ["Climb", "Sneak"],
          rowsByLevel: {
            "1": [87, "1-2"],
            "2": [88, "1-3"],
          },
        },
      ],
    },
  },
  {
    name: "class content lookup omits spellListId when class has none",
    actual: getClassContentLookup("Plain Class", testLibrary),
    expected: {
      ok: true,
      classId: "plainClass",
      className: "Plain Class",
      primeRequisites: ["strength"],
      abilities: [],
      levelTables: [],
    },
  },
  {
    name: "class content lookup fails for empty class name",
    actual: getClassContentLookup("", testLibrary),
    expected: {
      ok: false,
      message: "Enter a class to look up class content.",
    },
  },
  {
    name: "class content lookup fails for unauthored class",
    actual: getClassContentLookup("Fighter", testLibrary),
    expected: {
      ok: false,
      message: "No class content authored for this class.",
    },
  },
  {
    name: "class level tables resolve the row for the given level",
    actual: getClassLevelTables("Test Class", 2, testLibrary),
    expected: [
      {
        id: "testSkills",
        name: "Test Skills",
        columns: ["Climb", "Sneak"],
        values: [88, "1-3"],
      },
    ],
  },
  {
    name: "class level tables return null values for unauthored level",
    actual: getClassLevelTables("Test Class", 5, testLibrary),
    expected: [
      {
        id: "testSkills",
        name: "Test Skills",
        columns: ["Climb", "Sneak"],
        values: null,
      },
    ],
  },
  {
    name: "class level tables return null values for missing level",
    actual: getClassLevelTables("Test Class", null, testLibrary),
    expected: [
      {
        id: "testSkills",
        name: "Test Skills",
        columns: ["Climb", "Sneak"],
        values: null,
      },
    ],
  },
  {
    name: "class level tables are empty for unauthored class",
    actual: getClassLevelTables("Fighter", 1, testLibrary),
    expected: [],
  },
];

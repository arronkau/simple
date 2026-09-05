import {
  getClassContentLookup,
  getClassLevelTables,
  applyClassSkillBases,
  applyStrengthToOpenDoors,
  createMissingRosterSkills,
  getClassSpellListId,
  getRosterSkillBaseChance,
  getSkillRoster,
  type ClassContentLibrary,
} from "./classContent";

const testLibrary: ClassContentLibrary = {
  commonSkills: [
    { id: "openDoors", name: "Open Doors" },
    { id: "listenAtDoors", name: "Listen at Doors" },
  ],
  classes: {
    testClass: {
      id: "testClass",
      displayName: "Test Class",
      primeRequisites: ["dexterity", "strength"],
      spellListId: "listA",
      skills: [
        { id: "climb", name: "Climb Sheer Surfaces" },
        { id: "sneak", name: "Move Silently", description: "Quietly." },
      ],
      skillBases: { listenAtDoors: 2 },
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
      skills: [
        { id: "climb", name: "Climb Sheer Surfaces" },
        { id: "sneak", name: "Move Silently", description: "Quietly." },
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
      skills: [],
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
  {
    name: "class spell list id resolves through a fuzzy class name",
    actual: getClassSpellListId("test class", testLibrary),
    expected: "listA",
  },
  {
    name: "class spell list id is undefined for a non-caster",
    actual: getClassSpellListId("Plain Class", testLibrary),
    expected: undefined,
  },
  {
    name: "class spell list id is undefined for an unknown class",
    actual: getClassSpellListId("Fighter", testLibrary),
    expected: undefined,
  },
  {
    name: "skill roster is common skills with class bases, then the class roster",
    actual: getSkillRoster("Test Class", testLibrary),
    expected: [
      { id: "openDoors", name: "Open Doors" },
      { id: "listenAtDoors", name: "Listen at Doors", baseChanceInSix: 2 },
      { id: "climb", name: "Climb Sheer Surfaces" },
      { id: "sneak", name: "Move Silently", description: "Quietly." },
    ],
  },
  {
    name: "skill roster for an unknown or empty class is the common skills alone",
    actual: [getSkillRoster("Fighter", testLibrary), getSkillRoster("", testLibrary)],
    expected: [
      [
        { id: "openDoors", name: "Open Doors" },
        { id: "listenAtDoors", name: "Listen at Doors" },
      ],
      [
        { id: "openDoors", name: "Open Doors" },
        { id: "listenAtDoors", name: "Listen at Doors" },
      ],
    ],
  },
  {
    name: "roster base chance is the class base, else 1, with Open Doors on STR",
    actual: [
      getRosterSkillBaseChance({ id: "x", name: "Hear Noise" }, 18),
      getRosterSkillBaseChance({ id: "x", name: "Hear Noise", baseChanceInSix: 2 }, 18),
      getRosterSkillBaseChance({ id: "openDoors", name: "Open Doors" }, 17),
      getRosterSkillBaseChance({ id: "openDoors", name: "Open Doors" }, 5),
      getRosterSkillBaseChance({ id: "openDoors", name: "Open Doors" }, null),
    ],
    expected: [1, 2, 2, 1, 1],
  },
  {
    name: "missing roster skills are seeded at base chance and skip rows present by fuzzy name",
    actual: (() => {
      let counter = 0;

      return createMissingRosterSkills(
        "Test Class",
        [{ id: "s0", name: "climb sheer surfaces!", chanceInSix: 3 }],
        16,
        () => `skill-${(counter += 1)}`,
        testLibrary,
      );
    })(),
    expected: [
      { id: "skill-1", name: "Open Doors", chanceInSix: 2 },
      { id: "skill-2", name: "Listen at Doors", chanceInSix: 2 },
      { id: "skill-3", name: "Move Silently", chanceInSix: 1, description: "Quietly." },
    ],
  },
  {
    name: "class skill bases move untouched common rows and leave adjusted rows alone",
    actual: applyClassSkillBases(
      [
        { id: "a", name: "Listen at Doors", chanceInSix: 1 },
        { id: "b", name: "Open Doors", chanceInSix: 1 },
        { id: "c", name: "Climb Sheer Surfaces", chanceInSix: 1 },
      ],
      "Test Class",
      null,
      testLibrary,
    ),
    expected: [
      { id: "a", name: "Listen at Doors", chanceInSix: 2 },
      { id: "b", name: "Open Doors", chanceInSix: 1 },
      { id: "c", name: "Climb Sheer Surfaces", chanceInSix: 1 },
    ],
  },
  {
    name: "class skill bases do not lower a common row the player raised",
    actual: applyClassSkillBases(
      [{ id: "a", name: "Listen at Doors", chanceInSix: 4 }],
      "Test Class",
      null,
      testLibrary,
    ),
    expected: [{ id: "a", name: "Listen at Doors", chanceInSix: 4 }],
  },
  {
    name: "open doors follows a STR change while still at the old base",
    actual: [
      applyStrengthToOpenDoors(
        [{ id: "a", name: "Open Doors", chanceInSix: 1 }],
        null,
        17,
      ),
      applyStrengthToOpenDoors(
        [{ id: "a", name: "Open Doors", chanceInSix: 3 }],
        null,
        17,
      ),
      applyStrengthToOpenDoors(
        [{ id: "a", name: "Open Doors", chanceInSix: 2 }],
        16,
        9,
      ),
    ],
    expected: [
      [{ id: "a", name: "Open Doors", chanceInSix: 2 }],
      [{ id: "a", name: "Open Doors", chanceInSix: 3 }],
      [{ id: "a", name: "Open Doors", chanceInSix: 1 }],
    ],
  },
];

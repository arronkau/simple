import { normalizeCharacterData } from "../model/characters";
import type { CharacterData } from "../model/types";
import {
  createCharacterSheetFormState,
  createEmptySpellFormState,
  toCharacterDataFormInput,
} from "./characterSheetForm";
import {
  getSheetCommitSchedule,
  getSheetSaveStatus,
  isCharacterDataDirty,
  isEntityDraftDirty,
  shouldReseedSheetDraft,
} from "./characterSheetAutosave";

const storedCharacterData: CharacterData = normalizeCharacterData({
  className: "Fighter",
  level: 3,
  alignment: "Law",
  xp: 4200,
  hp: { current: 11, max: 18 },
  armorClass: { modifier: 1, override: null },
  abilityScores: {
    strength: 14,
    intelligence: 9,
    wisdom: 11,
    dexterity: 13,
    constitution: 15,
    charisma: 8,
  },
  skills: [
    { id: "skill-1", name: "Listen", chanceInSix: 2 },
    {
      id: "skill-2",
      name: "Forage",
      chanceInSix: 3,
      description: "Wilderness only",
    },
  ],
  spells: [
    { id: "spell-1", name: "Magic Missile", level: 1, memorized: 2 },
    {
      id: "spell-2",
      name: "Sleep",
      level: 1,
      memorized: 0,
      notes: "From scroll",
    },
  ],
  languages: ["Common", "Dwarvish"],
  description: "Scarred veteran.",
  features: [
    { id: "feature-1", name: "Cleave", description: "Extra swing on a kill." },
  ],
});

const seededFormState = createCharacterSheetFormState(storedCharacterData);
const roundTrippedCharacterData = toCharacterDataFormInput(seededFormState);
const editedLevelCharacterData = toCharacterDataFormInput({
  ...seededFormState,
  level: "4",
});
const emptySpellRowCharacterData = toCharacterDataFormInput({
  ...seededFormState,
  spells: [...seededFormState.spells, createEmptySpellFormState()],
});
const invalidLevelCharacterData = toCharacterDataFormInput({
  ...seededFormState,
  level: "1.5",
});

export const CHARACTER_SHEET_AUTOSAVE_MANUAL_FIXTURES = [
  {
    name: "autosave schedule: typed text waits for a pause",
    actual: getSheetCommitSchedule("text"),
    expected: { mode: "debounced", delayMs: 400 },
  },
  {
    name: "autosave schedule: typed numbers wait for a pause",
    actual: getSheetCommitSchedule("number"),
    expected: { mode: "debounced", delayMs: 400 },
  },
  {
    name: "autosave schedule: selects commit immediately",
    actual: getSheetCommitSchedule("choice"),
    expected: { mode: "immediate" },
  },
  {
    name: "autosave schedule: adding or removing a row commits immediately",
    actual: getSheetCommitSchedule("structure"),
    expected: { mode: "immediate" },
  },
  {
    name: "autosave status: idle shows nothing",
    actual: getSheetSaveStatus({ phase: "idle" }),
    expected: undefined,
  },
  {
    name: "autosave status: pending commit reads Saving",
    actual: getSheetSaveStatus({ phase: "saving" }),
    expected: { tone: "muted", text: "Saving…" },
  },
  {
    name: "autosave status: committed edit reads Saved",
    actual: getSheetSaveStatus({ phase: "saved" }),
    expected: { tone: "success", text: "Saved" },
  },
  {
    name: "autosave status: validation failure keeps the model message",
    actual: getSheetSaveStatus({
      phase: "error",
      message: "Level must be a non-negative integer.",
    }),
    expected: {
      tone: "error",
      text: "Couldn't save: Level must be a non-negative integer.",
    },
  },
  {
    name: "autosave dirty: seeding then committing an untouched sheet is not a change",
    actual: isCharacterDataDirty(roundTrippedCharacterData, storedCharacterData),
    expected: false,
  },
  {
    name: "autosave dirty: an edited level is a change",
    actual: isCharacterDataDirty(editedLevelCharacterData, storedCharacterData),
    expected: true,
  },
  {
    name: "autosave dirty: a still-empty spell row is not a change",
    actual: isCharacterDataDirty(
      emptySpellRowCharacterData,
      storedCharacterData,
    ),
    expected: false,
  },
  {
    name: "autosave dirty: an unparsable number still commits so the model can reject it",
    actual: isCharacterDataDirty(invalidLevelCharacterData, storedCharacterData),
    expected: true,
  },
  {
    name: "autosave dirty: entity name edit is a change",
    actual: isEntityDraftDirty(
      { name: "Morgan Iron", entityType: "character" },
      { name: "Morgan", entityType: "character" },
    ),
    expected: true,
  },
  {
    name: "autosave dirty: entity name whitespace is not a change",
    actual: isEntityDraftDirty(
      { name: "  Morgan  ", entityType: "character" },
      { name: "Morgan", entityType: "character" },
    ),
    expected: false,
  },
  {
    name: "autosave dirty: a blank entity name is never written",
    actual: isEntityDraftDirty(
      { name: "   ", entityType: "character" },
      { name: "Morgan", entityType: "character" },
    ),
    expected: false,
  },
  {
    name: "autosave dirty: entity type change is a change",
    actual: isEntityDraftDirty(
      { name: "Morgan", entityType: "retainer" },
      { name: "Morgan", entityType: "character" },
    ),
    expected: true,
  },
  {
    name: "autosave reseed: the open editor keeps its draft for the same entity",
    actual: shouldReseedSheetDraft("entity-1", "entity-1"),
    expected: false,
  },
  {
    name: "autosave reseed: a different entity reseeds the draft",
    actual: shouldReseedSheetDraft("entity-1", "entity-2"),
    expected: true,
  },
  {
    name: "autosave reseed: a freshly opened editor seeds the draft",
    actual: shouldReseedSheetDraft(undefined, "entity-1"),
    expected: true,
  },
];

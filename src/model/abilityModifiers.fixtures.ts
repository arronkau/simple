import {
  getAbilityModifier,
  type AbilityModifierTable,
} from "./abilityModifiers";

const testTable: AbilityModifierTable = {
  modifierBands: [
    { min: 3, max: 3, modifier: -3 },
    { min: 4, max: 5, modifier: -2 },
    { min: 9, max: 12, modifier: 0 },
    { min: 18, max: 18, modifier: 3 },
  ],
};

export const ABILITY_MODIFIERS_MANUAL_FIXTURES = [
  {
    name: "ability modifier resolves a single-score band",
    actual: getAbilityModifier(3, testTable),
    expected: { ok: true, modifier: -3 },
  },
  {
    name: "ability modifier resolves a range band",
    actual: getAbilityModifier(10, testTable),
    expected: { ok: true, modifier: 0 },
  },
  {
    name: "ability modifier fails for null score",
    actual: getAbilityModifier(null, testTable),
    expected: { ok: false },
  },
  {
    name: "ability modifier fails for score outside authored bands",
    actual: getAbilityModifier(7, testTable),
    expected: { ok: false },
  },
  {
    name: "bundled ability modifier table is unauthored and fails gracefully",
    actual: getAbilityModifier(10),
    expected: { ok: false },
  },
];

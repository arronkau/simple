import {
  getAbilityModifier,
  type AbilityModifierTable,
} from "./abilityModifiers";

const testTable: AbilityModifierTable = {
  modifierBands: [
    { minScore: 3, maxScore: 3, modifier: -3 },
    { minScore: 4, maxScore: 5, modifier: -2 },
    { minScore: 9, maxScore: 12, modifier: 0 },
    { minScore: 18, maxScore: 18, modifier: 3 },
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
    name: "bundled ability modifier table resolves an average score",
    actual: getAbilityModifier(10),
    expected: { ok: true, modifier: 0 },
  },
  {
    name: "bundled ability modifier table fails gracefully outside authored bands",
    actual: getAbilityModifier(19),
    expected: { ok: false },
  },
];

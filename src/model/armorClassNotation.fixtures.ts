import { toAscendingArmorClassText } from "./armorClassNotation";

export const ARMOR_CLASS_NOTATION_MANUAL_FIXTURES = [
  {
    name: "dual-notation stat block keeps only the ascending values",
    actual: toAscendingArmorClassText(
      "AC 6 [13], HD 1 (4hp), Att 1 × bite (1d4), THAC0 19 [0], MV 90’ (30’)",
    ),
    expected:
      "AC 13, HD 1 (4hp), Att 1 × bite (1d4), Attack bonus +0, MV 90’ (30’)",
  },
  {
    name: "negative descending AC and a positive attack bonus",
    actual: toAscendingArmorClassText(
      "AC –2 [21], HD 16* (72hp), THAC0 8 [+11], ML 10",
    ),
    expected: "AC 21, HD 16* (72hp), Attack bonus +11, ML 10",
  },
  {
    name: "prose forms of armour class read the bracketed value",
    actual: toAscendingArmorClassText(
      "The monster has an Armour Class of 7 [12]. Against missile attacks: The caster’s AC is 2 [17].",
    ),
    expected:
      "The monster has an Armour Class of 12. Against missile attacks: The caster’s AC is 17.",
  },
  {
    name: "a THAC0 of mid-sentence becomes an attack bonus with the article fixed",
    actual: toAscendingArmorClassText(
      "The monster attacks the subject once per round with a THAC0 of 16 [+3].",
    ),
    expected:
      "The monster attacks the subject once per round with an attack bonus of +3.",
  },
  {
    name: "text without dual notation is unchanged and the rewrite is idempotent",
    actual: [
      toAscendingArmorClassText("The subject gains a +4 bonus to AC and saving throws."),
      toAscendingArmorClassText(toAscendingArmorClassText("AC 9 [10], THAC0 10 [+9]")),
      toAscendingArmorClassText(""),
    ],
    expected: [
      "The subject gains a +4 bonus to AC and saving throws.",
      "AC 10, Attack bonus +9",
      "",
    ],
  },
];

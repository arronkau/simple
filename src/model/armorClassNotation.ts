/**
 * Rule text transcribed from OSE prints Armour Class and attack values in
 * both notations at once: descending first, ascending in square brackets
 * ("AC 6 [13]", "THAC0 19 [0]", "an Armour Class of 7 [12]"). This campaign
 * uses ascending AC only, so the app rewrites such text to the bracketed
 * value alone ("AC 13", "Attack bonus +0", "an Armour Class of 12") wherever
 * it shows rule text: library entries on load and stored spell descriptions
 * on normalization. Text without the dual notation passes through unchanged,
 * so the rewrite is idempotent.
 */

const DESCENDING_NUMBER = "[–−-]?\\d+";
const BRACKETED_NUMBER = "\\s*\\[\\s*([+–−-]?\\d+)\\s*\\]";

/** "AC 6 [13]", "AC is 2 [17]", "Armour Class of 7 [12]" → the bracketed AC. */
const ARMOR_CLASS_PATTERN = new RegExp(
  `\\b(AC(?: is)?|Armou?r Class(?: of| is)?)\\s+${DESCENDING_NUMBER}${BRACKETED_NUMBER}`,
  "g",
);

/** "with a THAC0 of 16 [+3]" mid-sentence → "with an attack bonus of +3". */
const THAC0_OF_PATTERN = new RegExp(
  `\\b([Aa]) THAC0 of \\d+${BRACKETED_NUMBER}`,
  "g",
);

/** Stat-block "THAC0 19 [0]" → "Attack bonus +0". */
const THAC0_PATTERN = new RegExp(`\\bTHAC0(?: of)? \\d+${BRACKETED_NUMBER}`, "g");

export function toAscendingArmorClassText(text: string): string {
  return text
    .replace(ARMOR_CLASS_PATTERN, (_match, label: string, ascending: string) =>
      `${label} ${ascending}`,
    )
    .replace(THAC0_OF_PATTERN, (_match, article: string, bonus: string) =>
      `${article}n attack bonus of ${formatAttackBonus(bonus)}`,
    )
    .replace(THAC0_PATTERN, (_match, bonus: string) =>
      `Attack bonus ${formatAttackBonus(bonus)}`,
    );
}

/** The bracketed attack value always shows its sign: "0" → "+0", "+9" stays. */
function formatAttackBonus(bonus: string): string {
  return /^[+–−-]/.test(bonus) ? bonus : `+${bonus}`;
}

import bundledAbilityModifiers from "./ose_ability_modifiers.json";

export type AbilityModifierBand = {
  min: number;
  max: number;
  modifier: number;
};

export type AbilityModifierTable = {
  modifierBands: AbilityModifierBand[];
};

export type AbilityModifierResult =
  | {
      ok: true;
      modifier: number;
    }
  | {
      ok: false;
    };

const DEFAULT_TABLE = bundledAbilityModifiers as AbilityModifierTable;

export function getAbilityModifier(
  score: number | null,
  table: AbilityModifierTable = DEFAULT_TABLE,
): AbilityModifierResult {
  if (score === null || !Number.isInteger(score)) {
    return { ok: false };
  }

  const band = table.modifierBands.find(
    (candidateBand) => score >= candidateBand.min && score <= candidateBand.max,
  );

  if (!band) {
    return { ok: false };
  }

  return { ok: true, modifier: band.modifier };
}

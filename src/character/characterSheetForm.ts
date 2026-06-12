import {
  ABILITY_SCORE_KEYS,
  normalizeCharacterData,
} from "../model/characters";
import type { CharacterData } from "../model/types";
import { formatNullableNumberInput } from "../formatters";
import {
  createFormRowId,
  type AbilityScoreKey,
  type CharacterFeatureFormState,
  type CharacterSheetFormState,
  type CharacterSkillFormState,
  type CharacterSpellFormState,
} from "../view-types";

export function createCharacterSheetFormState(
  characterData: CharacterData,
): CharacterSheetFormState {
  const normalizedCharacterData = normalizeCharacterData(characterData);

  return {
    className: normalizedCharacterData.className,
    level: formatNullableNumberInput(normalizedCharacterData.level),
    alignment: normalizedCharacterData.alignment,
    xp: formatNullableNumberInput(normalizedCharacterData.xp),
    hpCurrent: formatNullableNumberInput(normalizedCharacterData.hp.current),
    hpMax: formatNullableNumberInput(normalizedCharacterData.hp.max),
    armorClassModifier: normalizedCharacterData.armorClass.modifier.toString(),
    armorClassOverride: formatNullableNumberInput(
      normalizedCharacterData.armorClass.override,
    ),
    abilityScores: ABILITY_SCORE_KEYS.reduce<Record<AbilityScoreKey, string>>(
      (abilityScores, key) => ({
        ...abilityScores,
        [key]: formatNullableNumberInput(
          normalizedCharacterData.abilityScores[key],
        ),
      }),
      {
        strength: "",
        intelligence: "",
        wisdom: "",
        dexterity: "",
        constitution: "",
        charisma: "",
      },
    ),
    skills: normalizedCharacterData.skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      chanceInSix: skill.chanceInSix.toString(),
      description: skill.description ?? "",
    })),
    spells: normalizedCharacterData.spells.map((spell) => ({
      id: spell.id,
      name: spell.name,
      level: spell.level.toString(),
      memorized: spell.memorized.toString(),
      notes: spell.notes ?? "",
    })),
    languagesText: normalizedCharacterData.languages.join("\n"),
    description: normalizedCharacterData.description,
    features: normalizedCharacterData.features.map((feature) => ({
      id: feature.id,
      name: feature.name,
      description: feature.description,
    })),
  };
}

export function toCharacterDataFormInput(
  formState: CharacterSheetFormState,
): CharacterData {
  return {
    className: formState.className.trim(),
    level: parseNullableIntegerInput(formState.level),
    alignment: formState.alignment,
    xp: parseNullableIntegerInput(formState.xp),
    hp: {
      current: parseNullableIntegerInput(formState.hpCurrent),
      max: parseNullableIntegerInput(formState.hpMax),
    },
    armorClass: {
      modifier: formState.armorClassModifier.trim()
        ? parseIntegerInput(formState.armorClassModifier)
        : 0,
      override: parseNullableIntegerInput(formState.armorClassOverride),
    },
    abilityScores: ABILITY_SCORE_KEYS.reduce<CharacterData["abilityScores"]>(
      (abilityScores, key) => ({
        ...abilityScores,
        [key]: parseNullableIntegerInput(formState.abilityScores[key]),
      }),
      {
        strength: null,
        intelligence: null,
        wisdom: null,
        dexterity: null,
        constitution: null,
        charisma: null,
      },
    ),
    skills: formState.skills.map((skill) => ({
      id: skill.id,
      name: skill.name.trim(),
      chanceInSix: parseIntegerInput(skill.chanceInSix),
      ...(skill.description.trim()
        ? { description: skill.description.trim() }
        : {}),
    })),
    spells: formState.spells
      .filter((spell) => spell.name.trim())
      .map((spell) => ({
        id: spell.id,
        name: spell.name.trim(),
        level: parseIntegerInput(spell.level),
        memorized: spell.memorized.trim()
          ? parseIntegerInput(spell.memorized)
          : 0,
        ...(spell.notes.trim() ? { notes: spell.notes.trim() } : {}),
      })),
    languages: parseLanguagesInput(formState.languagesText),
    description: formState.description.trim(),
    features: formState.features
      .map((feature) => ({
        id: feature.id,
        name: feature.name.trim(),
        description: feature.description.trim(),
      }))
      .filter((feature) => feature.name || feature.description),
  };
}

export function createEmptySkillFormState(): CharacterSkillFormState {
  return {
    id: createFormRowId("skill"),
    name: "",
    chanceInSix: "1",
    description: "",
  };
}

export function createEmptyFeatureFormState(): CharacterFeatureFormState {
  return {
    id: createFormRowId("feature"),
    name: "",
    description: "",
  };
}

export function createEmptySpellFormState(): CharacterSpellFormState {
  return {
    id: createFormRowId("spell"),
    name: "",
    level: "1",
    memorized: "0",
    notes: "",
  };
}

export function parseNullableIntegerInput(value: string): number | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  return parseIntegerInput(trimmedValue);
}

export function parseIntegerInput(value: string): number {
  const parsedValue = Number(value);

  return Number.isInteger(parsedValue) ? parsedValue : Number.NaN;
}

function parseLanguagesInput(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((language) => language.trim())
    .filter((language) => language.length > 0);
}

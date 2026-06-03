import type {
  AbilityScores,
  CharacterAlignment,
  CharacterData,
  CharacterFeature,
  CharacterSkill,
  Entity,
  EntityType,
} from "./types";

export const ABILITY_SCORE_KEYS = [
  "str",
  "int",
  "wis",
  "dex",
  "con",
  "cha",
] as const;

type AbilityScoreKey = (typeof ABILITY_SCORE_KEYS)[number];

export type CharacterDataValidationResult =
  | { valid: true; errors: [] }
  | { valid: false; errors: string[] };

type LegacyCharacterData = Partial<CharacterData> & {
  hpCurrent?: unknown;
  hpMax?: unknown;
};

const ALIGNMENTS: CharacterAlignment[] = ["Law", "Neutrality", "Chaos", ""];

export function createEmptyCharacterData(): CharacterData {
  return {
    className: "",
    level: null,
    alignment: "",
    xp: null,
    hp: {
      current: null,
      max: null,
    },
    abilityScores: createEmptyAbilityScores(),
    skills: [],
    languages: [],
    description: "",
    features: [],
  };
}

export function normalizeEntityCharacterData(entity: Entity): Entity {
  if (isCharacterLikeEntityType(entity.entityType)) {
    return {
      ...entity,
      character: normalizeCharacterData(entity.character),
    };
  }

  const { character: _character, ...entityWithoutCharacter } = entity;

  return entityWithoutCharacter;
}

export function normalizeCharacterData(value: unknown): CharacterData {
  if (!isRecord(value)) {
    return createEmptyCharacterData();
  }

  const candidate = value as LegacyCharacterData;
  const hp = isRecord(candidate.hp) ? candidate.hp : undefined;

  return {
    className: getString(candidate.className),
    level: getNullableInteger(candidate.level, 0),
    alignment: getAlignment(candidate.alignment),
    xp: getNullableInteger(candidate.xp, 0),
    hp: {
      current: getNullableInteger(hp?.current ?? candidate.hpCurrent, 0),
      max: getNullableInteger(hp?.max ?? candidate.hpMax, 0),
    },
    abilityScores: normalizeAbilityScores(candidate.abilityScores),
    skills: normalizeSkills(candidate.skills),
    languages: normalizeLanguages(candidate.languages),
    description: getString(candidate.description),
    features: normalizeFeatures(candidate.features),
  };
}

export function validateCharacterData(
  characterData: CharacterData,
): CharacterDataValidationResult {
  const errors: string[] = [];

  ABILITY_SCORE_KEYS.forEach((key) => {
    const value = characterData.abilityScores[key];

    if (!isIntegerAtLeast(value, 1) && value !== null) {
      errors.push(`${formatAbilityScoreLabel(key)} must be a positive integer.`);
    }
  });

  if (!isIntegerAtLeast(characterData.level, 0) && characterData.level !== null) {
    errors.push("Level must be a non-negative integer.");
  }

  if (!isIntegerAtLeast(characterData.xp, 0) && characterData.xp !== null) {
    errors.push("XP must be a non-negative integer.");
  }

  if (
    !isIntegerAtLeast(characterData.hp.current, 0) &&
    characterData.hp.current !== null
  ) {
    errors.push("Current HP must be a non-negative integer.");
  }

  if (!isIntegerAtLeast(characterData.hp.max, 0) && characterData.hp.max !== null) {
    errors.push("Max HP must be a non-negative integer.");
  }

  characterData.skills.forEach((skill) => {
    if (!isIntegerAtLeast(skill.chanceInSix, 1) || skill.chanceInSix > 6) {
      errors.push(
        `${skill.name.trim() || "Skill"} chance must be an integer from 1 through 6.`,
      );
    }
  });

  return errors.length === 0
    ? { valid: true, errors: [] }
    : { valid: false, errors };
}

export function isCharacterLikeEntityType(entityType: EntityType): boolean {
  return entityType === "character" || entityType === "retainer";
}

function createEmptyAbilityScores(): AbilityScores {
  return {
    str: null,
    int: null,
    wis: null,
    dex: null,
    con: null,
    cha: null,
  };
}

function normalizeAbilityScores(value: unknown): AbilityScores {
  if (!isRecord(value)) {
    return createEmptyAbilityScores();
  }

  return ABILITY_SCORE_KEYS.reduce<AbilityScores>(
    (abilityScores, key) => ({
      ...abilityScores,
      [key]: getNullableInteger(value[key], 1),
    }),
    createEmptyAbilityScores(),
  );
}

function normalizeSkills(value: unknown): CharacterSkill[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((skill, index) => {
    if (!isRecord(skill)) {
      return [];
    }

    return [
      {
        id: getString(skill.id) || `skill-${index + 1}`,
        name: getString(skill.name),
        chanceInSix: getIntegerInRange(skill.chanceInSix, 1, 6, 1),
        ...(getString(skill.description)
          ? { description: getString(skill.description) }
          : {}),
      },
    ];
  });
}

function normalizeLanguages(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((language) => getString(language).trim())
    .filter((language) => language.length > 0);
}

function normalizeFeatures(value: unknown): CharacterFeature[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((feature, index) => {
    if (!isRecord(feature)) {
      return [];
    }

    const title = getString(feature.title);
    const description = getString(feature.description);

    if (!title.trim() && !description.trim()) {
      return [];
    }

    return [
      {
        id: getString(feature.id) || `feature-${index + 1}`,
        title,
        description,
      },
    ];
  });
}

function getAlignment(value: unknown): CharacterAlignment {
  return ALIGNMENTS.includes(value as CharacterAlignment)
    ? (value as CharacterAlignment)
    : "";
}

function getIntegerInRange(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
    ? value
    : fallback;
}

function getNullableInteger(value: unknown, min: number): number | null {
  return isIntegerAtLeast(value, min) ? value : null;
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isIntegerAtLeast(value: unknown, min: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatAbilityScoreLabel(key: AbilityScoreKey): string {
  return key.toUpperCase();
}

import { getClassSpellSlots } from "./saveTables";
import type {
  AbilityScores,
  CharacterAlignment,
  CharacterData,
  CharacterFeature,
  CharacterSkill,
  CharacterSpell,
  Entity,
  EntityType,
} from "./types";

export const ABILITY_SCORE_KEYS = [
  "strength",
  "intelligence",
  "wisdom",
  "dexterity",
  "constitution",
  "charisma",
] as const;

export const ABILITY_SCORE_LABELS: Record<AbilityScoreKey, string> = {
  strength: "STR",
  intelligence: "INT",
  wisdom: "WIS",
  dexterity: "DEX",
  constitution: "CON",
  charisma: "CHA",
};

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
    armorClass: {
      modifier: 0,
      override: null,
    },
    abilityScores: createEmptyAbilityScores(),
    skills: [],
    spells: [],
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
    armorClass: normalizeArmorClass(candidate.armorClass),
    abilityScores: normalizeAbilityScores(candidate.abilityScores),
    skills: normalizeSkills(candidate.skills),
    spells: normalizeSpells(candidate.spells),
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

  if (!Number.isInteger(characterData.armorClass.modifier)) {
    errors.push("AC modifier must be an integer.");
  }

  if (
    !isIntegerAtLeast(characterData.armorClass.override, 0) &&
    characterData.armorClass.override !== null
  ) {
    errors.push("Manual AC must be a non-negative integer.");
  }

  characterData.skills.forEach((skill) => {
    if (!isIntegerAtLeast(skill.chanceInSix, 1) || skill.chanceInSix > 6) {
      errors.push(
        `${skill.name.trim() || "Skill"} chance must be an integer from 1 through 6.`,
      );
    }
  });

  characterData.spells.forEach((spell) => {
    if (!isIntegerAtLeast(spell.level, 1)) {
      errors.push(
        `${spell.name.trim() || "Spell"} level must be an integer of at least 1.`,
      );
    }

    if (!isIntegerAtLeast(spell.memorized, 0)) {
      errors.push(
        `${spell.name.trim() || "Spell"} memorized count must be a non-negative integer.`,
      );
    }
  });

  return errors.length === 0
    ? { valid: true, errors: [] }
    : { valid: false, errors };
}

export function adjustCharacterHp(
  characterData: CharacterData,
  delta: number,
): CharacterData {
  return {
    ...characterData,
    hp: {
      current: Math.max(0, (characterData.hp.current ?? 0) + delta),
      max: characterData.hp.max,
    },
  };
}

export function adjustCharacterXp(
  characterData: CharacterData,
  delta: number,
): CharacterData {
  return {
    ...characterData,
    xp: Math.max(0, (characterData.xp ?? 0) + delta),
  };
}

export function adjustCharacterSpellMemorized(
  characterData: CharacterData,
  spellId: string,
  delta: number,
): CharacterData {
  return {
    ...characterData,
    spells: characterData.spells.map((spell) =>
      spell.id === spellId
        ? { ...spell, memorized: Math.max(0, spell.memorized + delta) }
        : spell,
    ),
  };
}

export function getSpellMemorizationWarnings(
  characterData: CharacterData,
): string[] {
  const slotsLookup = getClassSpellSlots(
    characterData.className,
    characterData.level,
  );

  if (!slotsLookup.ok) {
    return [];
  }

  const warnings: string[] = [];
  const memorizedByLevel = new Map<number, number>();

  characterData.spells.forEach((spell) => {
    memorizedByLevel.set(
      spell.level,
      (memorizedByLevel.get(spell.level) ?? 0) + spell.memorized,
    );

    if (
      slotsLookup.maxSpellLevel !== null &&
      spell.level > slotsLookup.maxSpellLevel
    ) {
      warnings.push(
        `${spell.name.trim() || "Spell"} is level ${spell.level}, above the ${slotsLookup.className} maximum of ${slotsLookup.maxSpellLevel}.`,
      );
    }

    if (slotsLookup.maxSpellLevel === null && spell.memorized > 0) {
      warnings.push(
        `${spell.name.trim() || "Spell"} is memorized but ${slotsLookup.className} has no spell slots.`,
      );
    }
  });

  [...memorizedByLevel.entries()]
    .sort(([leftLevel], [rightLevel]) => leftLevel - rightLevel)
    .forEach(([spellLevel, memorized]) => {
      const slot = slotsLookup.slots.find(
        (candidateSlot) => candidateSlot.spellLevel === spellLevel,
      );
      const available = slot?.count ?? 0;

      if (slotsLookup.maxSpellLevel !== null && memorized > available) {
        warnings.push(
          `Level ${spellLevel} spells memorized (${memorized}) exceed the available slots (${available}).`,
        );
      }
    });

  return warnings;
}

export function isCharacterLikeEntityType(entityType: EntityType): boolean {
  return entityType === "character" || entityType === "retainer";
}

function createEmptyAbilityScores(): AbilityScores {
  return {
    strength: null,
    intelligence: null,
    wisdom: null,
    dexterity: null,
    constitution: null,
    charisma: null,
  };
}

const LEGACY_ABILITY_SCORE_KEY: Record<AbilityScoreKey, string> = {
  strength: "str",
  intelligence: "int",
  wisdom: "wis",
  dexterity: "dex",
  constitution: "con",
  charisma: "cha",
};

function normalizeAbilityScores(value: unknown): AbilityScores {
  if (!isRecord(value)) {
    return createEmptyAbilityScores();
  }

  return ABILITY_SCORE_KEYS.reduce<AbilityScores>(
    (abilityScores, key) => ({
      ...abilityScores,
      [key]: getNullableInteger(value[key] ?? value[LEGACY_ABILITY_SCORE_KEY[key]], 1),
    }),
    createEmptyAbilityScores(),
  );
}

function normalizeArmorClass(value: unknown): CharacterData["armorClass"] {
  if (!isRecord(value)) {
    return {
      modifier: 0,
      override: null,
    };
  }

  return {
    modifier: getInteger(value.modifier, 0),
    override: getNullableInteger(value.override, 0),
  };
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

function normalizeSpells(value: unknown): CharacterSpell[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((spell, index) => {
    if (!isRecord(spell)) {
      return [];
    }

    const name = getString(spell.name);

    if (!name.trim()) {
      return [];
    }

    return [
      {
        id: getString(spell.id) || `spell-${index + 1}`,
        name,
        level: getNullableInteger(spell.level, 1) ?? 1,
        memorized: getNullableInteger(spell.memorized, 0) ?? 0,
        ...(getString(spell.notes) ? { notes: getString(spell.notes) } : {}),
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

    const name = getString(feature.name) || getString(feature.title);
    const description = getString(feature.description);

    if (!name.trim() && !description.trim()) {
      return [];
    }

    return [
      {
        id: getString(feature.id) || `feature-${index + 1}`,
        name,
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

function getInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) ? value : fallback;
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
  return ABILITY_SCORE_LABELS[key];
}

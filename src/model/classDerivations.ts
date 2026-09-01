import bundledClassReference from "./ose_class_reference.json";
import { getAbilityModifier } from "./abilityModifiers";
import {
  getClassMetadata,
  type ClassReference,
  type HitDie,
} from "./saveTables";
import type { CharacterData } from "./types";

export type WeaponDamageDie = HitDie | "d10";

export type ClassWeaponDamageResult =
  | {
      ok: true;
      classId: string;
      className: string;
      level: number;
      step: number;
      dice: number;
      die: WeaponDamageDie;
      label: string;
    }
  | {
      ok: false;
      message: string;
    };

export type ExpertiseSummaryResult =
  | {
      ok: true;
      pool: number;
      spent: number;
      delta: number;
      warnings: string[];
    }
  | {
      ok: false;
      message: string;
    };

const DEFAULT_LIBRARY = bundledClassReference as ClassReference;
const NEXT_DAMAGE_DIE: Record<HitDie, WeaponDamageDie> = {
  d4: "d6",
  d6: "d8",
  d8: "d10",
};
const MINIMUM_STARTING_HP: Record<HitDie, number> = {
  d4: 3,
  d6: 4,
  d8: 5,
};

export function getClassWeaponDamage(
  className: string,
  level: number | null,
  library: ClassReference = DEFAULT_LIBRARY,
): ClassWeaponDamageResult {
  if (!normalizeName(className)) {
    return {
      ok: false,
      message: "Enter a supported class to calculate weapon damage.",
    };
  }

  const metadata = getClassMetadata(className, library);

  if (!metadata.ok) {
    return {
      ok: false,
      message: "Weapon damage unavailable for this class.",
    };
  }

  if (level === null || !Number.isInteger(level) || level < 1) {
    return {
      ok: false,
      message: "Enter level 1 or higher to calculate weapon damage.",
    };
  }

  const classEntry = Object.values(library.classes).find(
    (candidateClass) => candidateClass.id === metadata.classId,
  );
  const levelEntry = classEntry?.levels.find(
    (candidateLevel) => candidateLevel.level === level,
  );

  if (!classEntry || !levelEntry) {
    return {
      ok: false,
      message: `Weapon damage unavailable for ${metadata.className} level ${level}.`,
    };
  }

  if (!metadata.hitDie) {
    return {
      ok: false,
      message: `Weapon damage unavailable because ${metadata.className} has no Hit Die.`,
    };
  }

  const step = new Set(
    classEntry.levels
      .filter(
        (candidateLevel) =>
          candidateLevel.level >= 1 && candidateLevel.level <= level,
      )
      .map((candidateLevel) => candidateLevel.attackBonus),
  ).size;
  const dice = step <= 2 ? 1 : Math.min(step - 1, 4);
  const die = step === 2 ? NEXT_DAMAGE_DIE[metadata.hitDie] : metadata.hitDie;

  return {
    ok: true,
    classId: metadata.classId,
    className: metadata.className,
    level,
    step,
    dice,
    die,
    label: `${dice}${die}`,
  };
}

export function getExpertiseSummary(
  character: CharacterData,
  library: ClassReference = DEFAULT_LIBRARY,
): ExpertiseSummaryResult {
  const metadata = getClassMetadata(character.className, library);

  if (!metadata.ok || !metadata.expertise) {
    return {
      ok: false,
      message: "Expertise unavailable for this class.",
    };
  }

  if (
    character.level === null ||
    !Number.isInteger(character.level) ||
    character.level < 1
  ) {
    return {
      ok: false,
      message: "Enter level 1 or higher to calculate expertise.",
    };
  }

  const pool =
    metadata.expertise.starting +
    metadata.expertise.perLevel * (character.level - 1);
  const strengthModifier = getAbilityModifier(character.abilityScores.strength);
  const openDoorsBase = strengthModifier.ok
    ? Math.max(1, strengthModifier.modifier)
    : 1;
  const spent = character.skills.reduce((total, skill) => {
    const base = normalizeName(skill.name) === "opendoors" ? openDoorsBase : 1;

    return total + Math.max(0, skill.chanceInSix - base);
  }, 0);
  const delta = spent - pool;
  const warnings =
    delta > 0
      ? [`Expertise over-allocated by ${delta}`]
      : delta < 0
        ? [`Expertise under-allocated by ${Math.abs(delta)}`]
        : [];

  return {
    ok: true,
    pool,
    spent,
    delta,
    warnings,
  };
}

export function getSkillCapWarnings(character: CharacterData): string[] {
  return character.skills.flatMap((skill) =>
    skill.chanceInSix > 5 ? ["No d6 skill may exceed 5-in-6"] : [],
  );
}

export function getStartingHpWarning(
  character: CharacterData,
  library: ClassReference = DEFAULT_LIBRARY,
): string | undefined {
  if (character.level !== 1 || typeof character.hp.max !== "number") {
    return undefined;
  }

  const metadata = getClassMetadata(character.className, library);

  if (!metadata.ok || !metadata.hitDie) {
    return undefined;
  }

  const minimum = MINIMUM_STARTING_HP[metadata.hitDie];

  return character.hp.max < minimum
    ? `Starting HP is below the ${metadata.hitDie} class minimum of ${minimum}.`
    : undefined;
}

function normalizeName(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "");
}

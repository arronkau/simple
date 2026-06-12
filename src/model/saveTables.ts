import classReference from "./ose_class_reference.json";

export type SavingThrowKey = "doom" | "ray" | "hold" | "blast" | "spell";

export type SavingThrowDisplay = {
  key: SavingThrowKey;
  label: string;
  value: number;
};

export type CharacterSaveLookupResult =
  | {
      ok: true;
      attackBonus: number;
      classId: string;
      className: string;
      level: number;
      saves: SavingThrowDisplay[];
    }
  | {
      ok: false;
      message: string;
      saves: SavingThrowDisplay[];
    };

export type XpProgressResult =
  | {
      ok: true;
      classId: string;
      className: string;
      level: number;
      currentLevelXp: number;
      nextLevelXp: number | null;
      xpToNext: number | null;
    }
  | {
      ok: false;
      message: string;
    };

export type ClassSpellSlot = {
  spellLevel: number;
  count: number;
};

export type ClassSpellSlotsResult =
  | {
      ok: true;
      classId: string;
      className: string;
      level: number;
      slots: ClassSpellSlot[];
      maxSpellLevel: number | null;
    }
  | {
      ok: false;
      message: string;
    };

type ClassReference = {
  saveLabels: Record<
    SavingThrowKey,
    {
      label: string;
      oseKey: string;
      oseCategory: string;
    }
  >;
  classes: Record<
    string,
    {
      id: string;
      displayName: string;
      levels: Array<{
        level: number;
        xpThreshold: number;
        attackBonus: number;
        saves: Record<SavingThrowKey, number>;
        spellSlots: Record<string, number>;
        maxSpellLevel: number | null;
      }>;
    }
  >;
};

const reference = classReference as ClassReference;
const SAVE_KEYS: SavingThrowKey[] = ["doom", "ray", "hold", "blast", "spell"];
const EMPTY_SAVES = SAVE_KEYS.map((key) => ({
  key,
  label: reference.saveLabels[key].label,
  value: Number.NaN,
}));
const classAliases = new Map<string, string>(
  Object.values(reference.classes).flatMap((classEntry) => [
    [normalizeClassName(classEntry.id), classEntry.id],
    [normalizeClassName(classEntry.displayName), classEntry.id],
  ]),
);

export function getCharacterSaveLookup(
  className: string,
  level: number | null,
): CharacterSaveLookupResult {
  const lookup = findClassLevelEntry(className, level);

  if (!lookup.ok) {
    return {
      ok: false,
      message: lookup.message,
      saves: EMPTY_SAVES,
    };
  }

  return {
    ok: true,
    attackBonus: lookup.levelEntry.attackBonus,
    classId: lookup.classId,
    className: lookup.className,
    level: lookup.level,
    saves: SAVE_KEYS.map((key) => ({
      key,
      label: reference.saveLabels[key].label,
      value: lookup.levelEntry.saves[key],
    })),
  };
}

export function getThac0(attackBonus: number): number {
  return 19 - attackBonus;
}

export function getXpProgress(
  className: string,
  level: number | null,
  xp: number | null,
): XpProgressResult {
  const lookup = findClassLevelEntry(className, level);

  if (!lookup.ok) {
    return {
      ok: false,
      message: lookup.message,
    };
  }

  const nextLevelEntry = lookup.classEntry.levels.find(
    (candidateLevel) => candidateLevel.level === lookup.level + 1,
  );
  const nextLevelXp = nextLevelEntry ? nextLevelEntry.xpThreshold : null;

  return {
    ok: true,
    classId: lookup.classId,
    className: lookup.className,
    level: lookup.level,
    currentLevelXp: lookup.levelEntry.xpThreshold,
    nextLevelXp,
    xpToNext:
      nextLevelXp === null || xp === null
        ? null
        : Math.max(0, nextLevelXp - xp),
  };
}

export function getClassSpellSlots(
  className: string,
  level: number | null,
): ClassSpellSlotsResult {
  const lookup = findClassLevelEntry(className, level);

  if (!lookup.ok) {
    return {
      ok: false,
      message: lookup.message,
    };
  }

  return {
    ok: true,
    classId: lookup.classId,
    className: lookup.className,
    level: lookup.level,
    slots: Object.entries(lookup.levelEntry.spellSlots)
      .map(([spellLevel, count]) => ({
        spellLevel: Number(spellLevel),
        count,
      }))
      .sort((left, right) => left.spellLevel - right.spellLevel),
    maxSpellLevel: lookup.levelEntry.maxSpellLevel,
  };
}

type ClassLevelEntryLookup =
  | {
      ok: true;
      classId: string;
      className: string;
      level: number;
      classEntry: ClassReference["classes"][string];
      levelEntry: ClassReference["classes"][string]["levels"][number];
    }
  | {
      ok: false;
      message: string;
    };

function findClassLevelEntry(
  className: string,
  level: number | null,
): ClassLevelEntryLookup {
  const normalizedClassName = normalizeClassName(className);

  if (!normalizedClassName) {
    return {
      ok: false,
      message: "Enter a supported class to calculate saves.",
    };
  }

  const classId = classAliases.get(normalizedClassName);

  if (!classId) {
    return {
      ok: false,
      message: "Saves unavailable for this class.",
    };
  }

  if (level === null || !Number.isInteger(level) || level < 1) {
    return {
      ok: false,
      message: "Enter level 1 or higher to calculate saves.",
    };
  }

  const classEntry = reference.classes[classId];
  const levelEntry = classEntry.levels.find(
    (candidateLevel) => candidateLevel.level === level,
  );

  if (!levelEntry) {
    return {
      ok: false,
      message: `Saves unavailable for ${classEntry.displayName} level ${level}.`,
    };
  }

  return {
    ok: true,
    classId,
    className: classEntry.displayName,
    level,
    classEntry,
    levelEntry,
  };
}

function normalizeClassName(className: string): string {
  return className.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "");
}

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
        attackBonus: number;
        level: number;
        saves: Record<SavingThrowKey, number>;
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
  const normalizedClassName = normalizeClassName(className);

  if (!normalizedClassName) {
    return {
      ok: false,
      message: "Enter a supported class to calculate saves.",
      saves: EMPTY_SAVES,
    };
  }

  const classId = classAliases.get(normalizedClassName);

  if (!classId) {
    return {
      ok: false,
      message: "Saves unavailable for this class.",
      saves: EMPTY_SAVES,
    };
  }

  if (level === null || !Number.isInteger(level) || level < 1) {
    return {
      ok: false,
      message: "Enter level 1 or higher to calculate saves.",
      saves: EMPTY_SAVES,
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
      saves: EMPTY_SAVES,
    };
  }

  return {
    ok: true,
    attackBonus: levelEntry.attackBonus,
    classId,
    className: classEntry.displayName,
    level,
    saves: SAVE_KEYS.map((key) => ({
      key,
      label: reference.saveLabels[key].label,
      value: levelEntry.saves[key],
    })),
  };
}

function normalizeClassName(className: string): string {
  return className.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "");
}

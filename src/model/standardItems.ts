import catalogData from "./standardItemCatalog.json";
import type {
  ArmorData,
  ContainerData,
  HandsRequired,
  InventoryBurden,
  InventoryRecordType,
  LightData,
  UsesData,
  WeaponData,
} from "./types";
import type { InventoryRecordFormInput } from "./inventoryRecords";

export type StandardItemCatalogEntry = {
  slug: string;
  name: string;
  recordType: Exclude<InventoryRecordType, "coins" | "treasure">;
  quantity: number;
  burden: InventoryBurden;
  handsRequired: HandsRequired;
  description?: string;
  container?: Pick<ContainerData, "capacitySlots">;
  uses?: UsesData;
  light?: LightData;
  weapon?: Partial<WeaponData>;
  armor?: Partial<ArmorData>;
  source?: string;
  aliases?: string[];
  catalogNotes?: string;
  gpValue?: number;
};

type StandardItemCatalogData = {
  schema: "simple-standard-item-catalog-v1";
  items: StandardItemCatalogEntry[];
};

const catalog = catalogData as StandardItemCatalogData;

export const STANDARD_ITEM_CATALOG = [...catalog.items].sort((left, right) =>
  left.name.localeCompare(right.name),
);

export function getStandardItemBySlug(
  slug: string,
): StandardItemCatalogEntry | undefined {
  return STANDARD_ITEM_CATALOG.find((item) => item.slug === slug);
}

export function filterStandardItems(query: string): StandardItemCatalogEntry[] {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return STANDARD_ITEM_CATALOG;
  }

  return STANDARD_ITEM_CATALOG.filter((item) =>
    [
      item.name,
      item.slug,
      item.source,
      item.recordType,
      `${item.name} ${item.recordType}`,
      ...(item.aliases ?? []),
    ].some((value) => normalizeSearchText(value).includes(normalizedQuery)),
  );
}

export function createInventoryRecordInputFromStandardItem(
  slug: string,
): InventoryRecordFormInput | undefined {
  const item = getStandardItemBySlug(slug);

  if (!item) {
    return undefined;
  }

  const sharedInput = {
    recordType: item.recordType,
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    burden: item.burden,
    handsRequired: item.handsRequired,
    ...(item.container
      ? {
          container: {
            ...item.container,
            ...(item.slug === "backpack" ? { isBackpack: true } : {}),
          },
        }
      : {}),
    ...(item.light ? { light: item.light } : {}),
    ...(item.uses ? { uses: item.uses } : {}),
  };

  if (item.recordType === "weapon") {
    return {
      ...sharedInput,
      recordType: "weapon",
      weapon: item.weapon ?? {},
    };
  }

  if (item.recordType === "armor") {
    return {
      ...sharedInput,
      recordType: "armor",
      armor: item.armor ?? {},
    };
  }

  return {
    ...sharedInput,
    recordType: "equipment",
  };
}

function normalizeSearchText(value: string | undefined): string {
  return value?.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "") ?? "";
}

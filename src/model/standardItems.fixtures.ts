import {
  createInventoryRecordInputFromStandardItem,
  filterStandardItems,
  getStandardItemBySlug,
} from "./standardItems";

const requiredPhase7Slugs = [
  "torches-3",
  "lantern",
  "rations-standard",
  "rope-50",
  "backpack",
  "sack-small",
  "scroll-case",
  "sword",
  "dagger",
  "short-bow",
  "shield",
  "leather",
  "chainmail",
];

const backpackInput = createInventoryRecordInputFromStandardItem("backpack");
const torchInput = createInventoryRecordInputFromStandardItem("torches-3");
const swordInput = createInventoryRecordInputFromStandardItem("sword");
const chainmailInput = createInventoryRecordInputFromStandardItem("chainmail");

export const STANDARD_ITEMS_MANUAL_FIXTURES = [
  {
    name: "standard item catalog includes required phase 7 examples",
    actual: requiredPhase7Slugs.map((slug) => ({
      slug,
      name: getStandardItemBySlug(slug)?.name,
      recordType: getStandardItemBySlug(slug)?.recordType,
    })),
    expected: [
      { slug: "torches-3", name: "Torch", recordType: "equipment" },
      { slug: "lantern", name: "Lantern", recordType: "equipment" },
      {
        slug: "rations-standard",
        name: "Rations (standard)",
        recordType: "equipment",
      },
      { slug: "rope-50", name: "Rope (50’)", recordType: "equipment" },
      { slug: "backpack", name: "Backpack", recordType: "equipment" },
      { slug: "sack-small", name: "Sack (small)", recordType: "equipment" },
      { slug: "scroll-case", name: "Scroll case", recordType: "equipment" },
      { slug: "sword", name: "Sword", recordType: "weapon" },
      { slug: "dagger", name: "Dagger", recordType: "weapon" },
      { slug: "short-bow", name: "Short bow", recordType: "weapon" },
      { slug: "shield", name: "Shield", recordType: "armor" },
      { slug: "leather", name: "Leather", recordType: "armor" },
      { slug: "chainmail", name: "Chainmail", recordType: "armor" },
    ],
  },
  {
    name: "standard item search handles common spaced armor queries",
    actual: {
      leatherArmor: filterStandardItems("leather armor").map(
        (item) => item.slug,
      ),
      chainMail: filterStandardItems("chain mail").map((item) => item.slug),
    },
    expected: {
      leatherArmor: ["leather", "studded-leather"],
      chainMail: ["chainmail"],
    },
  },
  {
    name: "standard item conversion fills container light weapon and armor fields",
    actual: {
      backpack: {
        recordType: backpackInput?.recordType,
        name: backpackInput?.name,
        burden: backpackInput?.burden,
        handsRequired: backpackInput?.handsRequired,
        container: backpackInput?.container,
      },
      torch: {
        quantity: torchInput?.quantity,
        burden: torchInput?.burden,
        handsRequired: torchInput?.handsRequired,
        light: torchInput?.light,
        uses: torchInput?.uses,
      },
      sword: {
        recordType: swordInput?.recordType,
        handsRequired: swordInput?.handsRequired,
        weapon: swordInput?.weapon,
      },
      chainmail: {
        recordType: chainmailInput?.recordType,
        burden: chainmailInput?.burden,
        armor: chainmailInput?.armor,
      },
    },
    expected: {
      backpack: {
        recordType: "equipment",
        name: "Backpack",
        burden: { kind: "fixed", slotsPerItem: 1 },
        handsRequired: 2,
        container: { capacitySlots: 16, isBackpack: true },
      },
      torch: {
        quantity: 3,
        burden: { kind: "stacked", itemsPerSlot: 3 },
        handsRequired: 1,
        light: {
          isLit: false,
          lightDescription: "30' radius; one torch burns 1 hour / 6 turns.",
        },
        uses: { current: 6, max: 6 },
      },
      sword: {
        recordType: "weapon",
        handsRequired: 1,
        weapon: {
          qualities: ["Melee", "Quick draw", "Versatile"],
        },
      },
      chainmail: {
        recordType: "armor",
        burden: { kind: "fixed", slotsPerItem: 2 },
        armor: {
          baseArmorClass: 14,
        },
      },
    },
  },
  {
    name: "standard item conversion omits catalog-only price metadata",
    actual: "gpValue" in (swordInput ?? {}),
    expected: false,
  },
];

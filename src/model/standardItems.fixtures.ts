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
const sackInput = createInventoryRecordInputFromStandardItem("sack");

function getCatalogSummary(slug: string) {
  const item = getStandardItemBySlug(slug);

  return item
    ? {
        burden: item.burden,
        gpValue: item.gpValue,
        name: item.name,
        quantity: item.quantity,
      }
    : undefined;
}

const correctedCatalogExpectations = [
  { slug: "lorica-hamata", expected: { burden: { kind: "fixed", slotsPerItem: 1 }, gpValue: 100, name: "Lorica Hamata", quantity: 1 } },
  { slug: "lorica-segmentata", expected: { burden: { kind: "fixed", slotsPerItem: 2 }, gpValue: 400, name: "Lorica Segmentata", quantity: 1 } },
  { slug: "archontean-lamellar", expected: { burden: { kind: "fixed", slotsPerItem: 2 }, gpValue: 600, name: "Archontean Lamellar", quantity: 1 } },
  { slug: "helmet", expected: { burden: { kind: "none" }, gpValue: 5, name: "Helmet", quantity: 1 } },
  { slug: "crossbow", expected: { burden: { kind: "fixed", slotsPerItem: 2 }, gpValue: 30, name: "Crossbow", quantity: 1 } },
  { slug: "two-handed-sword", expected: { burden: { kind: "fixed", slotsPerItem: 2 }, gpValue: 15, name: "Two-handed sword", quantity: 1 } },
  { slug: "holy-water-vial", expected: { burden: { kind: "fixed", slotsPerItem: 1 }, gpValue: 25, name: "Holy water (vial)", quantity: 1 } },
  { slug: "oil-flask", expected: { burden: { kind: "fixed", slotsPerItem: 1 }, gpValue: 2, name: "Oil flask", quantity: 1 } },
  { slug: "chisel", expected: { burden: { kind: "fixed", slotsPerItem: 1 }, gpValue: 2, name: "Chisel", quantity: 1 } },
  { slug: "crowbar", expected: { burden: { kind: "fixed", slotsPerItem: 1 }, gpValue: 10, name: "Crowbar", quantity: 1 } },
  { slug: "holy-symbol", expected: { burden: { kind: "none" }, gpValue: 25, name: "Holy symbol", quantity: 1 } },
  { slug: "magnifying-glass", expected: { burden: { kind: "fixed", slotsPerItem: 1 }, gpValue: 3, name: "Magnifying glass", quantity: 1 } },
  { slug: "mirror-hand-sized-steel", expected: { burden: { kind: "fixed", slotsPerItem: 1 }, gpValue: 5, name: "Steel hand mirror", quantity: 1 } },
  { slug: "pole-10-long-wooden", expected: { burden: { kind: "fixed", slotsPerItem: 2 }, gpValue: 1, name: "Ten foot pole", quantity: 1 } },
  { slug: "sledgehammer", expected: { burden: { kind: "fixed", slotsPerItem: 2 }, gpValue: 5, name: "Sledgehammer", quantity: 1 } },
  { slug: "spade-or-shovel", expected: { burden: { kind: "fixed", slotsPerItem: 1 }, gpValue: 2, name: "Small shovel", quantity: 1 } },
  { slug: "stakes-and-mallet", expected: { burden: { kind: "fixed", slotsPerItem: 2 }, gpValue: 3, name: "Mallet and 3 Stakes", quantity: 1 } },
  { slug: "tinder-box-flint-steel", expected: { burden: { kind: "fixed", slotsPerItem: 1 }, gpValue: 3, name: "Tinder box", quantity: 1 } },
  { slug: "torches-3", expected: { burden: { kind: "stacked", itemsPerSlot: 3 }, gpValue: 0.5, name: "Torch", quantity: 3 } },
  { slug: "rations-iron", expected: { burden: { kind: "stacked", itemsPerSlot: 3 }, gpValue: 6, name: "Rations (iron)", quantity: 3 } },
  { slug: "rations-standard", expected: { burden: { kind: "stacked", itemsPerSlot: 3 }, gpValue: 2, name: "Rations (standard)", quantity: 3 } },
  { slug: "vial-glass", expected: { burden: { kind: "stacked", itemsPerSlot: 3 }, gpValue: 1, name: "Glass vials (3, bundle)", quantity: 3 } },
  { slug: "bell-miniature", expected: { burden: { kind: "none" }, gpValue: 1, name: "Bell (small)", quantity: 1 } },
];

const newCatalogExpectations = [
  { slug: "sack", expected: { burden: { kind: "none" }, gpValue: 1, name: "Sack", quantity: 1 } },
  { slug: "canvas-10x10", expected: { burden: { kind: "fixed", slotsPerItem: 2 }, gpValue: 2, name: "Canvas (10′ × 10′)", quantity: 1 } },
  { slug: "rope-ladder-25", expected: { burden: { kind: "fixed", slotsPerItem: 3 }, gpValue: 5, name: "Rope ladder (25′)", quantity: 1 } },
  { slug: "spell-book-blank", expected: { burden: { kind: "fixed", slotsPerItem: 1 }, gpValue: 100, name: "Spell book (blank)", quantity: 1 } },
  { slug: "arrows-quiver-20", expected: { burden: { kind: "stacked", itemsPerSlot: 20 }, gpValue: 5, name: "Arrows (quiver of 20)", quantity: 20 } },
  { slug: "bolts-case-30", expected: { burden: { kind: "stacked", itemsPerSlot: 30 }, gpValue: 10, name: "Bolts (case of 30)", quantity: 30 } },
  { slug: "blowgun-darts-pouch-5", expected: { burden: { kind: "stacked", itemsPerSlot: 5 }, gpValue: 1, name: "Blowgun darts (pouch of 5)", quantity: 5 } },
  { slug: "silver-tipped-arrow", expected: { burden: { kind: "stacked", itemsPerSlot: 20 }, gpValue: 5, name: "Silver-tipped arrow", quantity: 1 } },
  { slug: "sling-stones", expected: { burden: { kind: "none" }, gpValue: 0, name: "Sling stones", quantity: 1 } },
];

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
      sack: {
        burden: sackInput?.burden,
        handsRequired: sackInput?.handsRequired,
        container: sackInput?.container,
      },
    },
    expected: {
      backpack: {
        recordType: "equipment",
        name: "Backpack",
        burden: { kind: "fixed", slotsPerItem: 1 },
        handsRequired: 2,
        container: { capacitySlots: 16 },
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
      sack: {
        burden: { kind: "none" },
        handsRequired: 1,
        container: {
          capacityByHands: { oneHand: 6, twoHands: 12 },
        },
      },
    },
  },
  {
    name: "standard item conversion omits catalog-only price metadata",
    actual: "gpValue" in (swordInput ?? {}),
    expected: false,
  },
  ...correctedCatalogExpectations.map(({ slug, expected }) => ({
    name: `standard item catalog applies Arden Vul correction for ${slug}`,
    actual: getCatalogSummary(slug),
    expected,
  })),
  ...newCatalogExpectations.map(({ slug, expected }) => ({
    name: `standard item catalog includes Arden Vul entry ${slug}`,
    actual: getCatalogSummary(slug),
    expected,
  })),
  {
    name: "standard item catalog preserves handout prose and weapon traits",
    actual: {
      crossbow: getStandardItemBySlug("crossbow")?.weapon?.qualities,
      twoHandedSword: getStandardItemBySlug("two-handed-sword")?.weapon
        ?.qualities,
      holyWater: getStandardItemBySlug("holy-water-vial")?.description,
      oil: getStandardItemBySlug("oil-flask")?.description,
      loricaHamata: getStandardItemBySlug("lorica-hamata")?.description,
      loricaSegmentata: getStandardItemBySlug("lorica-segmentata")?.description,
    },
    expected: {
      crossbow: ["Deadly", "Reload"],
      twoHandedSword: ["Brutal", "Deadly", "Melee"],
      holyWater:
        "Blessed water kept in its special vial; used in religious rituals and against undead. Thrown: Missile 10/30/50, Splash — on a hit, the container smashes and douses the target; damage is dealt over two rounds.",
      oil:
        "Flask of oil. Fuels a lantern for 4 hours / 24 turns. Lit and thrown: Missile 10/30/50, Splash — on a hit, the container smashes and douses the target; damage is dealt over two rounds. Oil poured on the ground and lit covers a diameter of 3 feet and burns for 1 turn, inflicting damage on any character or monster moving through the pool.",
      loricaHamata:
        "Rarely sold; marks the wearer as an Archontean legionary. False claims to legionary status are generally resented.",
      loricaSegmentata:
        "Rarely sold; marks the wearer as an Archontean legionary. False claims to legionary status are generally resented.",
    },
  },
  {
    name: "all edited and added catalog entries cite the Arden Vul handout",
    actual: [...correctedCatalogExpectations, ...newCatalogExpectations].every(
      ({ slug }) =>
        getStandardItemBySlug(slug)?.source ===
        "Arden Vul Equipment handout (2026)",
    ),
    expected: true,
  },
  {
    name: "campaign sack catalog record carries hand-dependent capacity",
    actual: getStandardItemBySlug("sack")?.container,
    expected: {
      capacityByHands: { oneHand: 6, twoHands: 12 },
    },
  },
  {
    name: "standard item search returns only the campaign sack and hides barrel",
    actual: {
      sacks: filterStandardItems("sack").map((item) => item.slug),
      barrels: filterStandardItems("barrel").map((item) => item.slug),
      hiddenBarrelResolves: getStandardItemBySlug("barrel")?.slug,
    },
    expected: {
      sacks: ["sack"],
      barrels: [],
      hiddenBarrelResolves: "barrel",
    },
  },
];

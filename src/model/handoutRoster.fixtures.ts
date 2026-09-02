import { getStandardItemBySlug } from "./standardItems";

type HandoutSection = "armor" | "weapons" | "ammunition" | "gear";

type HandoutExpected = {
  gpValue: number;
  quantity: number;
  burden:
    | { kind: "none" }
    | { kind: "fixed"; slotsPerItem: number }
    | { kind: "stacked"; itemsPerSlot: number };
  armor?:
    | { baseArmorClass: number }
    | { armorBonus: number };
};

type HandoutRosterEntry = {
  section: HandoutSection;
  slug: string;
  expected: HandoutExpected;
};

const none = { kind: "none" } as const;
const fixed = (slotsPerItem: number) =>
  ({ kind: "fixed", slotsPerItem }) as const;
const stacked = (itemsPerSlot: number) =>
  ({ kind: "stacked", itemsPerSlot }) as const;

// Hand-transcribed from handouts/Equipment.html.
const HANDOUT_ROSTER: HandoutRosterEntry[] = [
  { section: "armor", slug: "padded", expected: { gpValue: 5, quantity: 1, burden: fixed(1), armor: { baseArmorClass: 11 } } },
  { section: "armor", slug: "furs", expected: { gpValue: 10, quantity: 1, burden: fixed(1), armor: { baseArmorClass: 12 } } },
  { section: "armor", slug: "leather", expected: { gpValue: 20, quantity: 1, burden: fixed(1), armor: { baseArmorClass: 12 } } },
  { section: "armor", slug: "studded-leather", expected: { gpValue: 25, quantity: 1, burden: fixed(1), armor: { baseArmorClass: 13 } } },
  { section: "armor", slug: "lorica-hamata", expected: { gpValue: 100, quantity: 1, burden: fixed(1), armor: { baseArmorClass: 14 } } },
  { section: "armor", slug: "chainmail", expected: { gpValue: 40, quantity: 1, burden: fixed(2), armor: { baseArmorClass: 14 } } },
  { section: "armor", slug: "lorica-segmentata", expected: { gpValue: 400, quantity: 1, burden: fixed(2), armor: { baseArmorClass: 15 } } },
  { section: "armor", slug: "archontean-lamellar", expected: { gpValue: 600, quantity: 1, burden: fixed(2), armor: { baseArmorClass: 16 } } },
  { section: "armor", slug: "shield", expected: { gpValue: 10, quantity: 1, burden: fixed(1), armor: { armorBonus: 1 } } },
  { section: "armor", slug: "helmet", expected: { gpValue: 5, quantity: 1, burden: none, armor: { armorBonus: 0 } } },

  { section: "weapons", slug: "battle-axe", expected: { gpValue: 7, quantity: 1, burden: fixed(2) } },
  { section: "weapons", slug: "blackjack", expected: { gpValue: 1, quantity: 1, burden: fixed(1) } },
  { section: "weapons", slug: "blowgun", expected: { gpValue: 3, quantity: 1, burden: fixed(1) } },
  { section: "weapons", slug: "bolas", expected: { gpValue: 5, quantity: 1, burden: fixed(1) } },
  { section: "weapons", slug: "club", expected: { gpValue: 3, quantity: 1, burden: fixed(1) } },
  { section: "weapons", slug: "crossbow", expected: { gpValue: 30, quantity: 1, burden: fixed(2) } },
  { section: "weapons", slug: "dagger", expected: { gpValue: 3, quantity: 1, burden: fixed(1) } },
  { section: "weapons", slug: "flail", expected: { gpValue: 10, quantity: 1, burden: fixed(2) } },
  { section: "weapons", slug: "garotte", expected: { gpValue: 1, quantity: 1, burden: fixed(1) } },
  { section: "weapons", slug: "hand-axe", expected: { gpValue: 4, quantity: 1, burden: fixed(1) } },
  { section: "weapons", slug: "javelin", expected: { gpValue: 1, quantity: 1, burden: fixed(1) } },
  { section: "weapons", slug: "lance", expected: { gpValue: 5, quantity: 1, burden: fixed(2) } },
  { section: "weapons", slug: "long-bow", expected: { gpValue: 40, quantity: 1, burden: fixed(2) } },
  { section: "weapons", slug: "mace", expected: { gpValue: 5, quantity: 1, burden: fixed(1) } },
  { section: "weapons", slug: "net", expected: { gpValue: 5, quantity: 1, burden: fixed(1) } },
  { section: "weapons", slug: "polearm", expected: { gpValue: 7, quantity: 1, burden: fixed(2) } },
  { section: "weapons", slug: "short-bow", expected: { gpValue: 25, quantity: 1, burden: fixed(2) } },
  { section: "weapons", slug: "short-sword", expected: { gpValue: 7, quantity: 1, burden: fixed(1) } },
  { section: "weapons", slug: "sling", expected: { gpValue: 2, quantity: 1, burden: fixed(1) } },
  { section: "weapons", slug: "spear", expected: { gpValue: 4, quantity: 1, burden: fixed(1) } },
  { section: "weapons", slug: "staff", expected: { gpValue: 2, quantity: 1, burden: fixed(2) } },
  { section: "weapons", slug: "sword", expected: { gpValue: 10, quantity: 1, burden: fixed(1) } },
  { section: "weapons", slug: "two-handed-sword", expected: { gpValue: 15, quantity: 1, burden: fixed(2) } },
  { section: "weapons", slug: "war-hammer", expected: { gpValue: 5, quantity: 1, burden: fixed(1) } },
  { section: "weapons", slug: "whip", expected: { gpValue: 10, quantity: 1, burden: fixed(1) } },

  { section: "ammunition", slug: "arrows-quiver-20", expected: { gpValue: 5, quantity: 20, burden: stacked(20) } },
  { section: "ammunition", slug: "blowgun-darts-pouch-5", expected: { gpValue: 1, quantity: 5, burden: stacked(5) } },
  { section: "ammunition", slug: "bolts-case-30", expected: { gpValue: 10, quantity: 30, burden: stacked(30) } },
  { section: "ammunition", slug: "silver-tipped-arrow", expected: { gpValue: 5, quantity: 1, burden: stacked(20) } },
  { section: "ammunition", slug: "sling-stones", expected: { gpValue: 0, quantity: 1, burden: none } },

  // Handout: Backpack "—" slots. By GM ruling (CAMPAIGN_RULES_AUDIT.md §2 #1)
  // the catalog keeps fixed 1 and the stowed-root movement rule (PR 2) makes a
  // worn backpack contribute 0; carried in hand it counts its slot.
  { section: "gear", slug: "backpack", expected: { gpValue: 5, quantity: 1, burden: fixed(1) } },
  { section: "gear", slug: "bell-miniature", expected: { gpValue: 1, quantity: 1, burden: none } },
  { section: "gear", slug: "block-and-tackle", expected: { gpValue: 5, quantity: 1, burden: fixed(1) } },
  { section: "gear", slug: "bucket", expected: { gpValue: 1, quantity: 1, burden: fixed(1) } },
  { section: "gear", slug: "caltrops-bag-of-20", expected: { gpValue: 1, quantity: 20, burden: stacked(20) } },
  { section: "gear", slug: "candles-10", expected: { gpValue: 1, quantity: 10, burden: stacked(10) } },
  { section: "gear", slug: "canvas-10x10", expected: { gpValue: 2, quantity: 1, burden: fixed(2) } },
  { section: "gear", slug: "chain-10", expected: { gpValue: 30, quantity: 1, burden: fixed(2) } },
  { section: "gear", slug: "chalk-10-sticks", expected: { gpValue: 1, quantity: 10, burden: stacked(10) } },
  { section: "gear", slug: "chisel", expected: { gpValue: 2, quantity: 1, burden: fixed(1) } },
  { section: "gear", slug: "crowbar", expected: { gpValue: 10, quantity: 1, burden: fixed(1) } },
  { section: "gear", slug: "garlic", expected: { gpValue: 5, quantity: 1, burden: none } },
  { section: "gear", slug: "vial-glass", expected: { gpValue: 1, quantity: 3, burden: stacked(3) } },
  { section: "gear", slug: "grappling-hook", expected: { gpValue: 25, quantity: 1, burden: fixed(1) } },
  { section: "gear", slug: "hammer-small", expected: { gpValue: 2, quantity: 1, burden: fixed(1) } },
  { section: "gear", slug: "holy-symbol", expected: { gpValue: 25, quantity: 1, burden: none } },
  { section: "gear", slug: "holy-water-vial", expected: { gpValue: 25, quantity: 1, burden: fixed(1) } },
  { section: "gear", slug: "iron-spikes-12", expected: { gpValue: 1, quantity: 12, burden: stacked(12) } },
  { section: "gear", slug: "lantern", expected: { gpValue: 10, quantity: 1, burden: fixed(1) } },
  { section: "gear", slug: "magnifying-glass", expected: { gpValue: 3, quantity: 1, burden: fixed(1) } },
  { section: "gear", slug: "manacles", expected: { gpValue: 15, quantity: 1, burden: fixed(1) } },
  { section: "gear", slug: "marbles-bag-of-20", expected: { gpValue: 1, quantity: 20, burden: stacked(20) } },
  { section: "gear", slug: "mining-pick", expected: { gpValue: 3, quantity: 1, burden: fixed(2) } },
  { section: "gear", slug: "mirror-hand-sized-steel", expected: { gpValue: 5, quantity: 1, burden: fixed(1) } },
  { section: "gear", slug: "oil-flask", expected: { gpValue: 2, quantity: 1, burden: fixed(1) } },
  { section: "gear", slug: "pole-10-long-wooden", expected: { gpValue: 1, quantity: 1, burden: fixed(2) } },
  { section: "gear", slug: "rations-iron", expected: { gpValue: 6, quantity: 3, burden: stacked(3) } },
  { section: "gear", slug: "rations-standard", expected: { gpValue: 2, quantity: 3, burden: stacked(3) } },
  { section: "gear", slug: "rope-50", expected: { gpValue: 1, quantity: 1, burden: fixed(1) } },
  { section: "gear", slug: "rope-ladder-25", expected: { gpValue: 5, quantity: 1, burden: fixed(3) } },
  { section: "gear", slug: "sack", expected: { gpValue: 1, quantity: 1, burden: none } },
  { section: "gear", slug: "saw", expected: { gpValue: 1, quantity: 1, burden: fixed(1) } },
  { section: "gear", slug: "scroll-case", expected: { gpValue: 1, quantity: 1, burden: fixed(1) } },
  { section: "gear", slug: "sledgehammer", expected: { gpValue: 5, quantity: 1, burden: fixed(2) } },
  { section: "gear", slug: "spade-or-shovel", expected: { gpValue: 2, quantity: 1, burden: fixed(1) } },
  { section: "gear", slug: "spell-book-blank", expected: { gpValue: 100, quantity: 1, burden: fixed(1) } },
  { section: "gear", slug: "stakes-and-mallet", expected: { gpValue: 3, quantity: 1, burden: fixed(2) } },
  { section: "gear", slug: "thieves-tools", expected: { gpValue: 25, quantity: 1, burden: fixed(1) } },
  { section: "gear", slug: "tinder-box-flint-steel", expected: { gpValue: 3, quantity: 1, burden: fixed(1) } },
  { section: "gear", slug: "torches-3", expected: { gpValue: 0.5, quantity: 3, burden: stacked(3) } },
  { section: "gear", slug: "twine-100-ball", expected: { gpValue: 1, quantity: 1, burden: fixed(1) } },
  { section: "gear", slug: "waterskin", expected: { gpValue: 1, quantity: 1, burden: fixed(1) } },
  { section: "gear", slug: "whistle", expected: { gpValue: 1, quantity: 1, burden: none } },
  { section: "gear", slug: "wine-2-pints", expected: { gpValue: 1, quantity: 1, burden: fixed(1) } },
];

export const HANDOUT_ROSTER_SLUGS = HANDOUT_ROSTER.map(({ slug }) => slug);

function projectCatalogEntry({
  slug,
  expected,
}: HandoutRosterEntry): unknown {
  const item = getStandardItemBySlug(slug);

  if (!item) {
    return undefined;
  }

  const projected = {
    gpValue: item.gpValue,
    quantity: item.quantity,
    burden: item.burden,
  };

  if (!expected.armor) {
    return projected;
  }

  return {
    ...projected,
    armor:
      "baseArmorClass" in expected.armor
        ? { baseArmorClass: item.armor?.baseArmorClass }
        : { armorBonus: item.armor?.armorBonus },
  } as HandoutExpected;
}

export const HANDOUT_ROSTER_MANUAL_FIXTURES = [
  ...HANDOUT_ROSTER.map((entry) => ({
    name: `handout ${entry.section} row matches catalog: ${entry.slug}`,
    actual: projectCatalogEntry(entry),
    expected: entry.expected,
  })),
  {
    name: "handout roster has 84 catalog rows",
    actual: HANDOUT_ROSTER.length,
    expected: 84,
  },
];

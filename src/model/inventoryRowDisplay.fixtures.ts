import { getInventoryRowDisplay } from "./inventoryRowDisplay";
import type { InventoryRecord } from "./types";

const entityId = "character-1";

const baseLocation = {
  kind: "contents",
} as const;

const ropeRecord: InventoryRecord = {
  id: "rope-1",
  entityId,
  recordType: "equipment",
  name: "Rope",
  location: baseLocation,
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
};

const rationsRecord: InventoryRecord = {
  id: "rations-1",
  entityId,
  recordType: "equipment",
  name: "Rations",
  location: baseLocation,
  sortOrder: 1000,
  quantity: 15,
  burden: { kind: "stacked", itemsPerSlot: 5 },
};

const litTorchRecord: InventoryRecord = {
  id: "torch-lit-1",
  entityId,
  recordType: "equipment",
  name: "Torch",
  location: baseLocation,
  sortOrder: 2000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  light: { isLit: true },
};

const unlitTorchStackRecord: InventoryRecord = {
  id: "torch-unlit-1",
  entityId,
  recordType: "equipment",
  name: "Torch",
  location: baseLocation,
  sortOrder: 3000,
  quantity: 2,
  burden: { kind: "stacked", itemsPerSlot: 2 },
  light: { isLit: false },
};

const longswordRecord: InventoryRecord = {
  id: "longsword-1",
  entityId,
  recordType: "weapon",
  name: "Longsword",
  location: baseLocation,
  sortOrder: 4000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  weapon: {
    damage: "1d8",
    range: "melee",
  },
};

const unidentifiedPotionRecord: InventoryRecord = {
  id: "potion-1",
  entityId,
  recordType: "equipment",
  name: "Potion",
  location: baseLocation,
  sortOrder: 5000,
  quantity: 1,
  burden: { kind: "none" },
  identification: {
    identified: false,
    secretName: "Cloudy vial",
  },
};

const chainmailRecord: InventoryRecord = {
  id: "chainmail-1",
  entityId,
  recordType: "armor",
  name: "Chainmail",
  location: baseLocation,
  sortOrder: 6000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 2 },
  armor: {
    baseArmorClass: 14,
    armorBonus: 4,
  },
};

const gemsRecord: InventoryRecord = {
  id: "gems-1",
  entityId,
  recordType: "treasure",
  name: "Gems",
  location: baseLocation,
  sortOrder: 7000,
  quantity: 10,
  burden: { kind: "none" },
  treasure: {
    gpValue: 500,
  },
};

const zeroValueTreasureRecord: InventoryRecord = {
  id: "treasure-0",
  entityId,
  recordType: "treasure",
  name: "Strange token",
  location: baseLocation,
  sortOrder: 8000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  treasure: {
    gpValue: 0,
  },
};

const coinsRecord: InventoryRecord = {
  id: "coins-1",
  entityId,
  recordType: "coins",
  name: "Coin stash",
  location: baseLocation,
  sortOrder: 9000,
  coins: {
    pp: 100,
    gp: 240,
    sp: 80,
    cp: 0,
  },
};

const backpackRecord: InventoryRecord = {
  id: "backpack-1",
  entityId,
  recordType: "equipment",
  name: "Backpack",
  location: baseLocation,
  sortOrder: 10000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  container: {
    capacitySlots: 8,
  },
};

const backpackContentsRecord: InventoryRecord = {
  id: "backpack-rope-1",
  entityId,
  recordType: "equipment",
  name: "Rope",
  location: {
    kind: "container",
    containerId: backpackRecord.id,
  },
  sortOrder: 0,
  quantity: 7,
  burden: { kind: "fixed", slotsPerItem: 1 },
};

const overloadedSackRecord: InventoryRecord = {
  id: "sack-1",
  entityId,
  recordType: "equipment",
  name: "Small sack",
  location: baseLocation,
  sortOrder: 11000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 1,
  container: {
    capacitySlots: 6,
  },
};

const overloadedSackContentsRecord: InventoryRecord = {
  id: "sack-rations-1",
  entityId,
  recordType: "equipment",
  name: "Rations",
  location: {
    kind: "container",
    containerId: overloadedSackRecord.id,
  },
  sortOrder: 0,
  quantity: 9,
  burden: { kind: "fixed", slotsPerItem: 1 },
};

const allRecords = [
  ropeRecord,
  rationsRecord,
  litTorchRecord,
  unlitTorchStackRecord,
  longswordRecord,
  unidentifiedPotionRecord,
  chainmailRecord,
  gemsRecord,
  zeroValueTreasureRecord,
  coinsRecord,
  backpackRecord,
  backpackContentsRecord,
  overloadedSackRecord,
  overloadedSackContentsRecord,
];

export const INVENTORY_ROW_DISPLAY_MANUAL_FIXTURES = [
  {
    name: "ordinary equipment row shows name and right slot burden",
    actual: getInventoryRowDisplay(ropeRecord, allRecords),
    expected: {
      primaryText: "Rope",
      statusIcons: [],
      rightText: "1 slot",
    },
  },
  {
    name: "stackable equipment row shows quantity and right slot burden",
    actual: getInventoryRowDisplay(rationsRecord, allRecords),
    expected: {
      primaryText: "Rations (15)",
      statusIcons: [],
      rightText: "3 slots",
    },
  },
  {
    name: "lit torch row shows status after primary text",
    actual: getInventoryRowDisplay(litTorchRecord, allRecords),
    expected: {
      primaryText: "Torch",
      statusIcons: ["lit"],
      rightText: "1 slot",
    },
  },
  {
    name: "unlit torch stack row shows quantity and unlit status",
    actual: getInventoryRowDisplay(unlitTorchStackRecord, allRecords),
    expected: {
      primaryText: "Torch (2)",
      statusIcons: ["unlit"],
      rightText: "1 slot",
    },
  },
  {
    name: "weapon row suppresses damage and range",
    actual: getInventoryRowDisplay(longswordRecord, allRecords),
    expected: {
      primaryText: "Longsword",
      statusIcons: [],
      rightText: "1 slot",
    },
  },
  {
    name: "unidentified non-treasure row shows unidentified status",
    actual: getInventoryRowDisplay(unidentifiedPotionRecord, allRecords),
    expected: {
      primaryText: "Potion",
      statusIcons: ["unidentified"],
      rightText: "0 slots",
    },
  },
  {
    name: "armor row suppresses AC and armor bonus",
    actual: getInventoryRowDisplay(chainmailRecord, allRecords),
    expected: {
      primaryText: "Chainmail",
      statusIcons: [],
      rightText: "2 slots",
    },
  },
  {
    name: "treasure row shows gp value before right slot burden and no status",
    actual: getInventoryRowDisplay(gemsRecord, allRecords),
    expected: {
      primaryText: "Gems (10)",
      statusIcons: [],
      secondaryText: "500 gp",
      rightText: "0 slots",
    },
  },
  {
    name: "zero-value treasure row omits gp value",
    actual: getInventoryRowDisplay(zeroValueTreasureRecord, allRecords),
    expected: {
      primaryText: "Strange token",
      statusIcons: [],
      rightText: "1 slot",
    },
  },
  {
    name: "coin row uses denominations as primary label and suppresses status",
    actual: getInventoryRowDisplay(coinsRecord, allRecords),
    expected: {
      primaryText: "100 pp, 240 gp, 80 sp",
      statusIcons: [],
      rightText: "5 slots",
    },
  },
  {
    name: "container row uses right used/capacity slots",
    actual: getInventoryRowDisplay(backpackRecord, allRecords),
    expected: {
      primaryText: "Backpack",
      statusIcons: [],
      rightText: "7/8 slots",
    },
  },
  {
    name: "over-capacity container row adds compact warning and no held status",
    actual: getInventoryRowDisplay(overloadedSackRecord, allRecords),
    expected: {
      primaryText: "Small sack",
      statusIcons: ["warning"],
      rightText: "9/6 slots",
    },
  },
];

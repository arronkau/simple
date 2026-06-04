import {
  getCoinCount,
  getContainerSlotUsage,
  getRecordSlotBurden,
} from "./calculations";
import type { CoinData, InventoryRecord } from "./types";

export type InventoryRowStatus = "lit" | "unlit" | "unidentified" | "warning";

export type InventoryRowDisplay = {
  primaryText: string;
  statusIcons: InventoryRowStatus[];
  secondaryText?: string;
  rightText: string;
};

export function getInventoryRowDisplay(
  record: InventoryRecord,
  allRecords: InventoryRecord[],
): InventoryRowDisplay {
  if (record.recordType === "coins") {
    return {
      primaryText: formatCoinDenominations(record.coins),
      statusIcons: [],
      rightText: formatSlots(getRecordSlotBurden(record)),
    };
  }

  const primaryText = formatItemQuantity(record.name, record.quantity);

  if (record.container) {
    const slotUsage = getContainerSlotUsage(record, allRecords);
    const isOverCapacity =
      slotUsage.capacitySlots !== undefined &&
      slotUsage.usedSlots > slotUsage.capacitySlots;

    return {
      primaryText,
      statusIcons: isOverCapacity ? ["warning"] : [],
      rightText: formatCapacity(slotUsage.usedSlots, slotUsage.capacitySlots),
    };
  }

  if (record.recordType === "treasure") {
    const gpValue =
      record.treasure.gpValue > 0
        ? `${formatNumber(record.treasure.gpValue)} gp`
        : undefined;

    return {
      primaryText,
      statusIcons: [],
      ...(gpValue ? { secondaryText: gpValue } : {}),
      rightText: formatSlots(getRecordSlotBurden(record)),
    };
  }

  return {
    primaryText,
    statusIcons: getInventoryRowStatusIcons(record),
    rightText: formatSlots(getRecordSlotBurden(record)),
  };
}

export function formatCoinDenominations(coins: CoinData): string {
  if (getCoinCount(coins) === 0) {
    return "Coins";
  }

  const allDenominations: Array<[string, number]> = [
    ["pp", coins.pp],
    ["gp", coins.gp],
    ["sp", coins.sp],
    ["cp", coins.cp],
  ];
  const denominations = allDenominations.filter(([, count]) => count > 0);

  return denominations
    .map(([label, count]) => `${formatNumber(count)} ${label}`)
    .join(", ");
}

export function formatSlots(slots: number): string {
  return slots === 1 ? "1 slot" : `${formatNumber(slots)} slots`;
}

export function formatCapacity(
  usedSlots: number,
  capacitySlots: number | undefined,
): string {
  if (capacitySlots === undefined) {
    return `${formatSlots(usedSlots)} used`;
  }

  return `${formatNumber(usedSlots)}/${formatNumber(capacitySlots)} slots`;
}

function formatItemQuantity(name: string, quantity: number): string {
  return quantity > 1 ? `${name} ×${formatNumber(quantity)}` : name;
}

function getInventoryRowStatusIcons(
  record: Exclude<InventoryRecord, { recordType: "coins" | "treasure" }>,
): InventoryRowStatus[] {
  const statuses: InventoryRowStatus[] = [];

  if (record.light) {
    statuses.push(record.light.isLit ? "lit" : "unlit");
  }

  if (record.identification?.identified === false) {
    statuses.push("unidentified");
  }

  return statuses;
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString("en-US")
    : Number(value.toFixed(2)).toLocaleString("en-US");
}

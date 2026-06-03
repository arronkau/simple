import { CALCULATION_MANUAL_FIXTURES } from "./model/calculations.fixtures";
import { ENCUMBRANCE_MANUAL_FIXTURES } from "./model/encumbrance.fixtures";
import { INVENTORY_DISPLAY_MANUAL_FIXTURES } from "./model/inventoryDisplay.fixtures";
import { VALIDATION_MANUAL_FIXTURES } from "./model/validation.fixtures";
import {
  PHASE_3_STORE_MANUAL_FIXTURES,
  PHASE_5_STORE_MANUAL_FIXTURES,
} from "./store/useAppStore.fixtures";
import {
  getDeleteConfirmationMessage,
  getRecordDisplayName,
} from "./App";
import type { InventoryRecord } from "./model/types";

type ManualFixture = {
  name: string;
  actual: unknown;
  expected: unknown;
};

const manualFixtures: ManualFixture[] = [
  ...CALCULATION_MANUAL_FIXTURES,
  ...ENCUMBRANCE_MANUAL_FIXTURES,
  ...INVENTORY_DISPLAY_MANUAL_FIXTURES,
  ...VALIDATION_MANUAL_FIXTURES,
  ...PHASE_3_STORE_MANUAL_FIXTURES,
  ...PHASE_5_STORE_MANUAL_FIXTURES,
];

for (const fixture of manualFixtures) {
  assertDeepEqual(fixture.actual, fixture.expected, fixture.name);
}

const coinRecord: InventoryRecord = {
  id: "coins-test",
  recordType: "coins",
  location: {
    entityId: "character-1",
    locationType: "stowed",
    placement: "coinPurse",
  },
  sortOrder: 0,
  slotProfile: { kind: "coins" },
  coins: {
    pp: 0,
    gp: 12,
    sp: 35,
    cp: 0,
  },
};

assertEqual(getRecordDisplayName(coinRecord), "Coins", "coin display name");
assertEqual(
  getDeleteConfirmationMessage(coinRecord),
  "Delete coin record containing 12 gp, 35 sp worth 15.5 gp?",
  "coin delete confirmation",
);

const treasureRecord: InventoryRecord = {
  id: "treasure-test",
  recordType: "treasure",
  name: "Silver plate",
  location: {
    entityId: "storage-1",
    locationType: "contents",
    placement: "contents",
  },
  sortOrder: 0,
  slotProfile: { kind: "fixed", slots: 1 },
  treasure: {
    gpValue: 50,
  },
};

assertEqual(
  getDeleteConfirmationMessage(treasureRecord),
  'Delete treasure "Silver plate" worth 50 gp?',
  "treasure delete confirmation",
);

function assertEqual(actual: unknown, expected: unknown, name: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(
      `${name}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(
        actual,
      )}`,
    );
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, name: string): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);

  if (actualJson !== expectedJson) {
    throw new Error(`${name}\nExpected: ${expectedJson}\nActual: ${actualJson}`);
  }
}

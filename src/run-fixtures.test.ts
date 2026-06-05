import { APP_MANUAL_FIXTURES } from "./App.fixtures";
import { AUDIT_LOG_MANUAL_FIXTURES } from "./model/auditLog.fixtures";
import { CALCULATION_MANUAL_FIXTURES } from "./model/calculations.fixtures";
import { CHARACTER_MANUAL_FIXTURES } from "./model/characters.fixtures";
import { ENCUMBRANCE_MANUAL_FIXTURES } from "./model/encumbrance.fixtures";
import { APP_STATE_MANUAL_FIXTURES } from "./model/appState.fixtures";
import { INVENTORY_DISPLAY_MANUAL_FIXTURES } from "./model/inventoryDisplay.fixtures";
import { INVENTORY_ROW_DISPLAY_MANUAL_FIXTURES } from "./model/inventoryRowDisplay.fixtures";
import { INVENTORY_RECORDS_MANUAL_FIXTURES } from "./model/inventoryRecords.fixtures";
import { STANDARD_ITEMS_MANUAL_FIXTURES } from "./model/standardItems.fixtures";
import { VALIDATION_MANUAL_FIXTURES } from "./model/validation.fixtures";
import { FIREBASE_CONFIG_MANUAL_FIXTURES } from "./persistence/firebaseConfig.fixtures";
import {
  PHASE_3_STORE_MANUAL_FIXTURES,
  PHASE_5_STORE_MANUAL_FIXTURES,
  PHASE_6_STORE_MANUAL_FIXTURES,
  PHASE_8B_STORE_MANUAL_FIXTURES,
  PHASE_8_STORE_MANUAL_FIXTURES,
} from "./store/useAppStore.fixtures";

type ManualFixture = {
  name: string;
  actual: unknown;
  expected: unknown;
};

const manualFixtures: ManualFixture[] = [
  ...APP_MANUAL_FIXTURES,
  ...APP_STATE_MANUAL_FIXTURES,
  ...AUDIT_LOG_MANUAL_FIXTURES,
  ...CALCULATION_MANUAL_FIXTURES,
  ...CHARACTER_MANUAL_FIXTURES,
  ...ENCUMBRANCE_MANUAL_FIXTURES,
  ...FIREBASE_CONFIG_MANUAL_FIXTURES,
  ...INVENTORY_DISPLAY_MANUAL_FIXTURES,
  ...INVENTORY_ROW_DISPLAY_MANUAL_FIXTURES,
  ...INVENTORY_RECORDS_MANUAL_FIXTURES,
  ...STANDARD_ITEMS_MANUAL_FIXTURES,
  ...VALIDATION_MANUAL_FIXTURES,
  ...PHASE_3_STORE_MANUAL_FIXTURES,
  ...PHASE_5_STORE_MANUAL_FIXTURES,
  ...PHASE_6_STORE_MANUAL_FIXTURES,
  ...PHASE_8_STORE_MANUAL_FIXTURES,
  ...PHASE_8B_STORE_MANUAL_FIXTURES,
];

for (const fixture of manualFixtures) {
  assertDeepEqual(fixture.actual, fixture.expected, fixture.name);
}

function assertDeepEqual(actual: unknown, expected: unknown, name: string): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);

  if (actualJson !== expectedJson) {
    throw new Error(`${name}\nExpected: ${expectedJson}\nActual: ${actualJson}`);
  }
}

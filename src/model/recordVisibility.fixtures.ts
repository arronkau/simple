import {
  getVisibleInventoryRecord,
  hasSecretIdentification,
  isUnidentifiedRecord,
} from "./recordVisibility";
import type { InventoryRecord } from "./types";

const entityId = "character-1";

const identifiedSwordRecord: InventoryRecord = {
  id: "sword-1",
  entityId,
  recordType: "weapon",
  name: "Longsword",
  description: "Plain steel.",
  location: { kind: "equipped", placement: "rightHand" },
  sortOrder: 1000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 1,
  isMagic: true,
  notes: "Taken from the reeve.",
  weapon: { damage: "1d8" },
};

const unidentifiedSwordRecord: InventoryRecord = {
  id: "sword-2",
  entityId,
  recordType: "weapon",
  name: "Notched blade",
  description: "Pitted and cold.",
  location: { kind: "equipped", placement: "rightHand" },
  sortOrder: 2000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 1,
  isMagic: true,
  uses: { current: 3, max: 5 },
  modifiers: [{ target: "attack", value: 1, label: "+1" }],
  notes: "Cursed: cannot be dropped.",
  identification: {
    identified: false,
    secretName: "Sword of Weeping",
    secretDescription: "It wants to be held.",
  },
  weapon: { damage: "1d8", qualities: ["silvered"] },
};

const unidentifiedTorchRecord: InventoryRecord = {
  id: "torch-1",
  entityId,
  recordType: "equipment",
  name: "Green candle",
  location: { kind: "equipped", placement: "leftHand" },
  sortOrder: 3000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 1,
  uses: { current: 6 },
  light: { isLit: true, lightDescription: "30' of sickly green light" },
  identification: { identified: false },
};

const unidentifiedTreasureRecord: InventoryRecord = {
  id: "treasure-1",
  entityId,
  recordType: "treasure",
  name: "Dull stones",
  location: { kind: "contents" },
  sortOrder: 4000,
  quantity: 3,
  burden: { kind: "none" },
  identification: { identified: false, secretName: "Star sapphires" },
  treasure: { gpValue: 1000 },
};

const coinsRecord: InventoryRecord = {
  id: "coins-1",
  entityId,
  recordType: "coins",
  location: { kind: "coinPurse" },
  sortOrder: 5000,
  notes: "Skimmed from the tithe.",
  coins: { pp: 0, gp: 20, sp: 0, cp: 0 },
};

export const RECORD_VISIBILITY_MANUAL_FIXTURES = [
  {
    name: "isUnidentifiedRecord is true for a non-coin record marked unidentified",
    actual: [
      isUnidentifiedRecord(unidentifiedSwordRecord),
      isUnidentifiedRecord(unidentifiedTreasureRecord),
      isUnidentifiedRecord(identifiedSwordRecord),
      isUnidentifiedRecord(coinsRecord),
    ],
    expected: [true, true, false, false],
  },
  {
    name: "hasSecretIdentification requires a secret name or description",
    actual: [
      hasSecretIdentification(unidentifiedSwordRecord),
      hasSecretIdentification(unidentifiedTreasureRecord),
      hasSecretIdentification(unidentifiedTorchRecord),
      hasSecretIdentification(identifiedSwordRecord),
    ],
    expected: [true, true, false, false],
  },
  {
    name: "gm sees an unidentified record unchanged",
    actual: getVisibleInventoryRecord(unidentifiedSwordRecord, "gm"),
    expected: unidentifiedSwordRecord,
  },
  {
    name: "player loses only notes on an identified record",
    actual: getVisibleInventoryRecord(identifiedSwordRecord, "player"),
    expected: {
      id: "sword-1",
      entityId,
      recordType: "weapon",
      name: "Longsword",
      description: "Plain steel.",
      location: { kind: "equipped", placement: "rightHand" },
      sortOrder: 1000,
      quantity: 1,
      burden: { kind: "fixed", slotsPerItem: 1 },
      handsRequired: 1,
      isMagic: true,
      weapon: { damage: "1d8" },
    },
  },
  {
    name: "player sees only the public shell of an unidentified weapon",
    actual: getVisibleInventoryRecord(unidentifiedSwordRecord, "player"),
    expected: {
      id: "sword-2",
      entityId,
      recordType: "weapon",
      name: "Notched blade",
      description: "Pitted and cold.",
      location: { kind: "equipped", placement: "rightHand" },
      sortOrder: 2000,
      quantity: 1,
      burden: { kind: "fixed", slotsPerItem: 1 },
      handsRequired: 1,
      identification: { identified: false },
      weapon: {},
    },
  },
  {
    name: "player sees an unidentified lit light source without description or uses",
    actual: getVisibleInventoryRecord(unidentifiedTorchRecord, "player"),
    expected: {
      id: "torch-1",
      entityId,
      recordType: "equipment",
      name: "Green candle",
      location: { kind: "equipped", placement: "leftHand" },
      sortOrder: 3000,
      quantity: 1,
      burden: { kind: "fixed", slotsPerItem: 1 },
      handsRequired: 1,
      identification: { identified: false },
      light: { isLit: true },
    },
  },
  {
    name: "player sees unidentified treasure with no gp value",
    actual: getVisibleInventoryRecord(unidentifiedTreasureRecord, "player"),
    expected: {
      id: "treasure-1",
      entityId,
      recordType: "treasure",
      name: "Dull stones",
      location: { kind: "contents" },
      sortOrder: 4000,
      quantity: 3,
      burden: { kind: "none" },
      identification: { identified: false },
      treasure: { gpValue: 0 },
    },
  },
  {
    name: "coins pass through for a player except for notes",
    actual: getVisibleInventoryRecord(coinsRecord, "player"),
    expected: {
      id: "coins-1",
      entityId,
      recordType: "coins",
      location: { kind: "coinPurse" },
      sortOrder: 5000,
      coins: { pp: 0, gp: 20, sp: 0, cp: 0 },
    },
  },
  {
    name: "null viewer role is redacted like a player",
    actual: getVisibleInventoryRecord(unidentifiedSwordRecord, null),
    expected: getVisibleInventoryRecord(unidentifiedSwordRecord, "player"),
  },
];

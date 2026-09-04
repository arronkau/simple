import type { InventoryRecord } from "../model/types";
import { buildHandDropSequence } from "./gearHands";

const entityId = "character-1";
const otherEntityId = "character-2";

const sword: InventoryRecord = {
  id: "sword-1",
  entityId,
  recordType: "weapon",
  name: "Sword",
  location: { kind: "equipped", placement: "loose" },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 1,
  weapon: { damage: "1d8" },
};

const torch: InventoryRecord = {
  id: "torch-1",
  entityId,
  recordType: "equipment",
  name: "Torch",
  location: { kind: "equipped", placement: "rightHand" },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 1,
};

const shield: InventoryRecord = {
  id: "shield-1",
  entityId,
  recordType: "armor",
  name: "Shield",
  location: { kind: "equipped", placement: "leftHand" },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 1,
  armor: { baseArmorClass: 13 },
};

const greatsword: InventoryRecord = {
  ...sword,
  id: "greatsword-1",
  name: "Greatsword",
  handsRequired: 2,
};

const heldGreatsword: InventoryRecord = {
  ...greatsword,
  location: { kind: "equipped", placement: "bothHands" },
};

const heldSack: InventoryRecord = {
  id: "sack-1",
  entityId,
  recordType: "equipment",
  name: "Sack",
  location: { kind: "equipped", placement: "bothHands" },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "none" },
  handsRequired: 1,
  container: { capacityByHands: { oneHand: 6, twoHands: 12 } },
};

// Same placement, different entity: it must never be treated as an occupant.
const otherCharacterTorch: InventoryRecord = {
  ...torch,
  id: "torch-2",
  entityId: otherEntityId,
};

export const GEAR_HANDS_MANUAL_FIXTURES = [
  {
    name: "one-handed record onto an empty hand is a single placement",
    actual: buildHandDropSequence(sword, "leftHand", entityId, [sword]),
    expected: [
      {
        recordId: "sword-1",
        location: { entityId: "character-1", placement: "leftHand" },
      },
    ],
  },
  {
    name: "one-handed record onto an occupied hand displaces that occupant to worn",
    actual: buildHandDropSequence(sword, "rightHand", entityId, [sword, torch]),
    expected: [
      {
        recordId: "torch-1",
        location: { entityId: "character-1", placement: "equippedLoose" },
      },
      {
        recordId: "sword-1",
        location: { entityId: "character-1", placement: "rightHand" },
      },
    ],
  },
  {
    name: "two-handed record dropped on one hand clears every hand and takes both",
    actual: buildHandDropSequence(greatsword, "leftHand", entityId, [
      greatsword,
      shield,
      torch,
    ]),
    expected: [
      {
        recordId: "shield-1",
        location: { entityId: "character-1", placement: "equippedLoose" },
      },
      {
        recordId: "torch-1",
        location: { entityId: "character-1", placement: "equippedLoose" },
      },
      {
        recordId: "greatsword-1",
        location: { entityId: "character-1", placement: "bothHands" },
      },
    ],
  },
  {
    name: "one-handed record onto a bothHands target displaces the two-hander spanning both",
    actual: buildHandDropSequence(sword, "bothHands", entityId, [
      sword,
      heldGreatsword,
    ]),
    expected: [
      {
        recordId: "greatsword-1",
        location: { entityId: "character-1", placement: "equippedLoose" },
      },
      {
        recordId: "sword-1",
        location: { entityId: "character-1", placement: "bothHands" },
      },
    ],
  },
  {
    name: "regripping a bothHands record into one hand does not displace itself",
    actual: buildHandDropSequence(heldSack, "rightHand", entityId, [heldSack]),
    expected: [
      {
        recordId: "sack-1",
        location: { entityId: "character-1", placement: "rightHand" },
      },
    ],
  },
  {
    name: "hand occupancy only counts records owned by the target entity",
    actual: buildHandDropSequence(sword, "rightHand", otherEntityId, [
      sword,
      torch,
      otherCharacterTorch,
    ]),
    expected: [
      {
        recordId: "torch-2",
        location: { entityId: "character-2", placement: "equippedLoose" },
      },
      {
        recordId: "sword-1",
        location: { entityId: "character-2", placement: "rightHand" },
      },
    ],
  },
];

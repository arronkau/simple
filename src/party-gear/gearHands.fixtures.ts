import type { InventoryRecord } from "../model/types";
import {
  benefitsFromBothHands,
  buildHandDropSequence,
  resolveHandTarget,
} from "./gearHands";

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

const dagger: InventoryRecord = {
  ...sword,
  id: "dagger-1",
  name: "Dagger",
  weapon: { damage: "1d4" },
};

const versatileSword: InventoryRecord = {
  ...sword,
  id: "versatile-sword-1",
  name: "Versatile sword",
  weapon: { damage: "1d8", qualities: ["Melee", "Quick draw", "Versatile"] },
};

// Qualities are free text authored in the catalog: match trimmed and folded.
const scruffyVersatileSword: InventoryRecord = {
  ...versatileSword,
  id: "versatile-sword-2",
  weapon: { damage: "1d8", qualities: [" versatile "] },
};

const looseSack: InventoryRecord = {
  id: "sack-2",
  entityId,
  recordType: "equipment",
  name: "Sack",
  location: { kind: "equipped", placement: "loose" },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "none" },
  handsRequired: 1,
  container: { capacityByHands: { oneHand: 6, twoHands: 12 } },
};

// Fixed capacity, not hand-dependent: a second hand buys nothing.
const backpack: InventoryRecord = {
  id: "backpack-1",
  entityId,
  recordType: "equipment",
  name: "Backpack",
  location: { kind: "stowedRoot" },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 1,
  container: { capacitySlots: 16 },
};

const coins: InventoryRecord = {
  id: "coins-1",
  entityId,
  recordType: "coins",
  location: { kind: "container", containerId: "backpack-1" },
  sortOrder: 0,
  coins: { pp: 0, gp: 10, sp: 0, cp: 0 },
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
    name: "record that gains nothing from a second hand lands in the right hand, displacing the two-hander spanning both",
    actual: buildHandDropSequence(dagger, "bothHands", entityId, [
      dagger,
      heldGreatsword,
    ]),
    expected: [
      {
        recordId: "greatsword-1",
        location: { entityId: "character-1", placement: "equippedLoose" },
      },
      {
        recordId: "dagger-1",
        location: { entityId: "character-1", placement: "rightHand" },
      },
    ],
  },
  {
    name: "container with hand-dependent capacity dropped on bothHands grips with both",
    actual: buildHandDropSequence(looseSack, "bothHands", entityId, [
      looseSack,
    ]),
    expected: [
      {
        recordId: "sack-2",
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
  {
    name: "container with hand-dependent capacity benefits from both hands",
    actual: benefitsFromBothHands(heldSack),
    expected: true,
  },
  {
    name: "weapon with a Versatile quality benefits from both hands",
    actual: benefitsFromBothHands(versatileSword),
    expected: true,
  },
  {
    name: "Versatile quality is matched trimmed and case-insensitively",
    actual: benefitsFromBothHands(scruffyVersatileSword),
    expected: true,
  },
  {
    name: "plain one-handed weapon does not benefit from both hands",
    actual: benefitsFromBothHands(dagger),
    expected: false,
  },
  {
    name: "two-handed weapon has no second hand to offer",
    actual: benefitsFromBothHands(greatsword),
    expected: false,
  },
  {
    name: "container with fixed capacity does not benefit from both hands",
    actual: benefitsFromBothHands(backpack),
    expected: false,
  },
  {
    name: "coins never benefit from both hands",
    actual: benefitsFromBothHands(coins),
    expected: false,
  },
  {
    name: "bothHands request on a plain one-handed record resolves to the right hand",
    actual: resolveHandTarget(dagger, "bothHands"),
    expected: "rightHand",
  },
  {
    name: "bothHands request on a versatile weapon resolves to both hands",
    actual: resolveHandTarget(versatileSword, "bothHands"),
    expected: "bothHands",
  },
  {
    name: "bothHands request on a hand-dependent container resolves to both hands",
    actual: resolveHandTarget(looseSack, "bothHands"),
    expected: "bothHands",
  },
  {
    name: "one-hand request on a two-handed record resolves to both hands",
    actual: resolveHandTarget(greatsword, "leftHand"),
    expected: "bothHands",
  },
  {
    name: "one-hand request on a one-handed record is taken as given",
    actual: resolveHandTarget(dagger, "leftHand"),
    expected: "leftHand",
  },
];

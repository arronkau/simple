import { lightRecord, snuffRecord } from "./lightSources";
import { createDefaultBackpack, type Entity, type InventoryRecord } from "./types";

const characterEntity: Entity = {
  id: "character-1",
  name: "Morgan",
  entityType: "character",
  active: true,
  sortOrder: 0,
};

const backpack = createDefaultBackpack({
  entityId: characterEntity.id,
  id: "backpack-1",
});

const torches: InventoryRecord = {
  id: "torches-1",
  recordType: "equipment",
  name: "Torch",
  entityId: characterEntity.id,
  location: { kind: "container", containerId: backpack.id },
  sortOrder: 0,
  quantity: 3,
  burden: { kind: "stacked", itemsPerSlot: 3 },
  handsRequired: 1,
  uses: { current: 6, max: 6 },
  light: { isLit: false, lightDescription: "30' radius" },
};

const lantern: InventoryRecord = {
  id: "lantern-1",
  recordType: "equipment",
  name: "Lantern",
  entityId: characterEntity.id,
  location: { kind: "container", containerId: backpack.id },
  sortOrder: 1000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 1,
  uses: { current: 24, max: 24 },
  light: { isLit: false, lightDescription: "30' radius" },
};

const glowStone: InventoryRecord = {
  id: "stone-1",
  recordType: "equipment",
  name: "Glowing stone",
  entityId: characterEntity.id,
  location: { kind: "container", containerId: backpack.id },
  sortOrder: 2000,
  quantity: 1,
  burden: { kind: "none" },
  handsRequired: 0,
  light: { isLit: false },
};

const sword: InventoryRecord = {
  id: "sword-1",
  recordType: "weapon",
  name: "Sword",
  entityId: characterEntity.id,
  location: { kind: "equipped", placement: "rightHand" },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 1,
  weapon: {},
};

const shield: InventoryRecord = {
  id: "shield-1",
  recordType: "armor",
  name: "Shield",
  entityId: characterEntity.id,
  location: { kind: "equipped", placement: "leftHand" },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 1,
  armor: { armorBonus: 1 },
};

const rope: InventoryRecord = {
  id: "rope-1",
  recordType: "equipment",
  name: "Rope",
  entityId: characterEntity.id,
  location: { kind: "container", containerId: backpack.id },
  sortOrder: 500,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
};

const litTorch: InventoryRecord = {
  ...torches,
  id: "torch-lit",
  quantity: 1,
  location: { kind: "equipped", placement: "leftHand" },
  uses: { current: 4, max: 6 },
  light: { isLit: true, lightDescription: "30' radius" },
};

const litLantern: InventoryRecord = {
  ...lantern,
  location: { kind: "equipped", placement: "leftHand" },
  light: { isLit: true, lightDescription: "30' radius" },
};

const heldTorchStack: InventoryRecord = {
  ...torches,
  location: { kind: "equipped", placement: "leftHand" },
};

type RecordSummary = {
  id: string;
  quantity: number;
  location: InventoryRecord["location"];
  isLit: boolean | undefined;
  uses: InventoryRecord["uses"];
};

function summarize(records: InventoryRecord[]): RecordSummary[] {
  return records
    .filter((record) => record.recordType !== "coins")
    .map((record) => ({
      id: record.id,
      quantity: record.quantity,
      location: record.location,
      isLit: record.light?.isLit,
      uses: record.uses,
    }));
}

function summarizeLight(result: ReturnType<typeof lightRecord>) {
  return result.ok
    ? {
        ok: true,
        litRecordId: result.litRecordId,
        split: result.split,
        handPlacement: result.handPlacement,
        records: summarize(result.records),
      }
    : result;
}

function lastLocation(result: ReturnType<typeof lightRecord>) {
  return result.ok ? result.records.at(-1)?.location : result;
}

function summarizeSnuff(result: ReturnType<typeof snuffRecord>) {
  return result.ok
    ? { ok: true, consumed: result.consumed, records: summarize(result.records) }
    : result;
}

export const LIGHT_SOURCES_MANUAL_FIXTURES = [
  {
    name: "lighting a torch stack splits one torch into the free left hand",
    actual: summarizeLight(
      lightRecord({
        entity: characterEntity,
        record: torches,
        records: [backpack, sword, torches],
        newRecordId: "torch-new",
      }),
    ),
    expected: {
      ok: true,
      litRecordId: "torch-new",
      split: true,
      handPlacement: "leftHand",
      records: [
        { id: backpack.id, quantity: 1, location: { kind: "stowedRoot" }, isLit: undefined, uses: undefined },
        { id: sword.id, quantity: 1, location: { kind: "equipped", placement: "rightHand" }, isLit: undefined, uses: undefined },
        { id: torches.id, quantity: 2, location: { kind: "container", containerId: backpack.id }, isLit: false, uses: { current: 6, max: 6 } },
        { id: "torch-new", quantity: 1, location: { kind: "equipped", placement: "leftHand" }, isLit: true, uses: { current: 6, max: 6 } },
      ],
    },
  },
  {
    name: "lighting prefers the left hand, then the right, then stays in place",
    actual: {
      rightFree: lastLocation(
        lightRecord({
          entity: characterEntity,
          record: torches,
          records: [backpack, shield, torches],
          newRecordId: "torch-new",
        }),
      ),
      noHandFree: summarizeLight(
        lightRecord({
          entity: characterEntity,
          record: torches,
          records: [backpack, sword, shield, torches],
          newRecordId: "torch-new",
        }),
      ),
    },
    expected: {
      rightFree: { kind: "equipped", placement: "rightHand" },
      noHandFree: {
        ok: true,
        litRecordId: "torch-new",
        split: true,
        records: [
          { id: backpack.id, quantity: 1, location: { kind: "stowedRoot" }, isLit: undefined, uses: undefined },
          { id: sword.id, quantity: 1, location: { kind: "equipped", placement: "rightHand" }, isLit: undefined, uses: undefined },
          { id: shield.id, quantity: 1, location: { kind: "equipped", placement: "leftHand" }, isLit: undefined, uses: undefined },
          { id: torches.id, quantity: 2, location: { kind: "container", containerId: backpack.id }, isLit: false, uses: { current: 6, max: 6 } },
          { id: "torch-new", quantity: 1, location: { kind: "container", containerId: backpack.id }, isLit: true, uses: { current: 6, max: 6 } },
        ],
      },
    },
  },
  {
    name: "lighting a single lantern lights the same record and moves it to a hand",
    actual: summarizeLight(
      lightRecord({
        entity: characterEntity,
        record: lantern,
        records: [backpack, lantern],
        newRecordId: "unused",
      }),
    ),
    expected: {
      ok: true,
      litRecordId: lantern.id,
      split: false,
      handPlacement: "leftHand",
      records: [
        { id: backpack.id, quantity: 1, location: { kind: "stowedRoot" }, isLit: undefined, uses: undefined },
        { id: lantern.id, quantity: 1, location: { kind: "equipped", placement: "leftHand" }, isLit: true, uses: { current: 24, max: 24 } },
      ],
    },
  },
  {
    name: "a light that needs no hands stays where it is",
    actual: summarizeLight(
      lightRecord({
        entity: characterEntity,
        record: glowStone,
        records: [backpack, glowStone],
        newRecordId: "unused",
      }),
    ),
    expected: {
      ok: true,
      litRecordId: glowStone.id,
      split: false,
      records: [
        { id: backpack.id, quantity: 1, location: { kind: "stowedRoot" }, isLit: undefined, uses: undefined },
        { id: glowStone.id, quantity: 1, location: { kind: "container", containerId: backpack.id }, isLit: true, uses: undefined },
      ],
    },
  },
  {
    name: "lighting a stack already held keeps the lit torch in hand and packs the rest",
    actual: summarizeLight(
      lightRecord({
        entity: characterEntity,
        record: heldTorchStack,
        records: [backpack, heldTorchStack],
        newRecordId: "torch-new",
      }),
    ),
    expected: {
      ok: true,
      litRecordId: "torch-new",
      split: true,
      records: [
        { id: backpack.id, quantity: 1, location: { kind: "stowedRoot" }, isLit: undefined, uses: undefined },
        { id: heldTorchStack.id, quantity: 2, location: { kind: "container", containerId: backpack.id }, isLit: false, uses: { current: 6, max: 6 } },
        { id: "torch-new", quantity: 1, location: { kind: "equipped", placement: "leftHand" }, isLit: true, uses: { current: 6, max: 6 } },
      ],
    },
  },
  {
    name: "lighting rejects non-lights and already-lit records",
    actual: {
      rope: lightRecord({
        entity: characterEntity,
        record: rope,
        records: [backpack, rope],
        newRecordId: "unused",
      }),
      lit: lightRecord({
        entity: characterEntity,
        record: litTorch,
        records: [backpack, litTorch],
        newRecordId: "unused",
      }),
    },
    expected: {
      rope: { ok: false, message: "Only light sources can be lit." },
      lit: { ok: false, message: "Torch is already lit." },
    },
  },
  {
    name: "a burned-out torch is removed; a burned-out lantern stays with zero uses",
    actual: {
      torch: summarizeSnuff(
        snuffRecord({
          record: litTorch,
          records: [backpack, litTorch, rope],
          outcome: { kind: "burnedOut" },
        }),
      ),
      lantern: summarizeSnuff(
        snuffRecord({
          record: litLantern,
          records: [backpack, litLantern],
          outcome: { kind: "burnedOut" },
        }),
      ),
    },
    expected: {
      torch: {
        ok: true,
        consumed: true,
        records: [
          { id: backpack.id, quantity: 1, location: { kind: "stowedRoot" }, isLit: undefined, uses: undefined },
          { id: rope.id, quantity: 1, location: { kind: "container", containerId: backpack.id }, isLit: undefined, uses: undefined },
        ],
      },
      lantern: {
        ok: true,
        consumed: false,
        records: [
          { id: backpack.id, quantity: 1, location: { kind: "stowedRoot" }, isLit: undefined, uses: undefined },
          { id: lantern.id, quantity: 1, location: { kind: "equipped", placement: "leftHand" }, isLit: false, uses: { current: 0, max: 24 } },
        ],
      },
    },
  },
  {
    name: "a burned-out torch inside a lit stack reduces the stack instead of deleting it",
    actual: summarizeSnuff(
      snuffRecord({
        record: { ...heldTorchStack, light: { isLit: true } },
        records: [backpack, { ...heldTorchStack, light: { isLit: true } }],
        outcome: { kind: "burnedOut" },
      }),
    ),
    expected: {
      ok: true,
      consumed: true,
      records: [
        { id: backpack.id, quantity: 1, location: { kind: "stowedRoot" }, isLit: undefined, uses: undefined },
        { id: heldTorchStack.id, quantity: 2, location: { kind: "equipped", placement: "leftHand" }, isLit: false, uses: { current: 6, max: 6 } },
      ],
    },
  },
  {
    name: "turns remaining records the burn left and puts the light out",
    actual: summarizeSnuff(
      snuffRecord({
        record: litTorch,
        records: [backpack, litTorch],
        outcome: { kind: "turnsRemaining", turns: 2 },
      }),
    ),
    expected: {
      ok: true,
      consumed: false,
      records: [
        { id: backpack.id, quantity: 1, location: { kind: "stowedRoot" }, isLit: undefined, uses: undefined },
        { id: litTorch.id, quantity: 1, location: { kind: "equipped", placement: "leftHand" }, isLit: false, uses: { current: 2, max: 6 } },
      ],
    },
  },
  {
    name: "turns remaining rejects negatives, fractions, values above max, and unlit records",
    actual: {
      negative: snuffRecord({ record: litTorch, records: [litTorch], outcome: { kind: "turnsRemaining", turns: -1 } }),
      fraction: snuffRecord({ record: litTorch, records: [litTorch], outcome: { kind: "turnsRemaining", turns: 1.5 } }),
      aboveMax: snuffRecord({ record: litTorch, records: [litTorch], outcome: { kind: "turnsRemaining", turns: 7 } }),
      unlit: snuffRecord({ record: torches, records: [torches], outcome: { kind: "burnedOut" } }),
    },
    expected: {
      negative: { ok: false, message: "Turns remaining must be a whole number of 0 or more." },
      fraction: { ok: false, message: "Turns remaining must be a whole number of 0 or more." },
      aboveMax: { ok: false, message: "Turns remaining cannot exceed 6." },
      unlit: { ok: false, message: "Only a lit light source can be put out." },
    },
  },
];

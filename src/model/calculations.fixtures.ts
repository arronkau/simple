import {
  MOVEMENT_SLOT_BURDEN_OPTIONS,
  getCoinCount,
  getCoinGpValue,
  getCoinSlotBurden,
  getContainerSlotUsage,
  getContentsSlots,
  getEffectiveRecordAndContentsSlotBurden,
  getEffectiveRecordSlotBurden,
  getCharacterArmorClass,
  getRecordSlotBurden,
  getTotalEntitySlots,
} from "./calculations";
import type { Entity, InventoryRecord } from "./types";

const storageEntity: Entity = {
  id: "storage-1",
  name: "Storage",
  entityType: "storage",
  active: true,
  sortOrder: 0,
  capacitySlots: 20,
};

const characterEntity: Entity = {
  id: "character-1",
  name: "Morgan",
  entityType: "character",
  active: true,
  sortOrder: 0,
};

const coinsRecord: InventoryRecord = {
  id: "coins-1",
  recordType: "coins",
  entityId: "character-1",
  location: {
    kind: "coinPurse",
  },
  sortOrder: 0,
  coins: {
    pp: 0,
    gp: 12,
    sp: 35,
    cp: 80,
  },
};

const crateRecord: InventoryRecord = {
  id: "crate-1",
  recordType: "equipment",
  name: "Crate",
  entityId: "storage-1",
  location: {
    kind: "contents",
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 2 },
  container: {
    capacitySlots: 8,
  },
};

const ropeRecord: InventoryRecord = {
  id: "rope-1",
  recordType: "equipment",
  name: "Rope",
  entityId: "storage-1",
  location: {
    kind: "container",
    containerId: "crate-1",
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
};

const torchRecord: InventoryRecord = {
  id: "torches-1",
  recordType: "equipment",
  name: "Torches",
  entityId: "storage-1",
  location: {
    kind: "container",
    containerId: "crate-1",
  },
  sortOrder: 1000,
  quantity: 6,
  burden: { kind: "stacked", itemsPerSlot: 3 },
};

const exactCapacityCrateRecord: InventoryRecord = {
  ...crateRecord,
  id: "exact-capacity-crate-1",
  container: {
    capacitySlots: 3,
  },
};

const overCapacityCrateRecord: InventoryRecord = {
  ...crateRecord,
  id: "over-capacity-crate-1",
  container: {
    capacitySlots: 2,
  },
};

const contentsOnlyBoxRecord: InventoryRecord = {
  id: "contents-only-box-1",
  recordType: "equipment",
  name: "Contents Only Box",
  entityId: "storage-1",
  location: {
    kind: "contents",
  },
  sortOrder: 2000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  container: {
    capacitySlots: 4,
  },
};

const contentsOnlyBoxChildRecord: InventoryRecord = {
  id: "contents-only-box-child-1",
  recordType: "equipment",
  name: "Packed Item",
  entityId: "storage-1",
  location: {
    kind: "container",
    containerId: contentsOnlyBoxRecord.id,
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
};

const sackRecord: InventoryRecord = {
  id: "sack-1",
  recordType: "equipment",
  name: "Sack",
  entityId: "character-1",
  location: {
    kind: "equipped",
    placement: "rightHand",
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 1,
  container: {
    capacitySlots: 6,
  },
};

const rationsRecord: InventoryRecord = {
  id: "rations-1",
  recordType: "equipment",
  name: "Rations",
  entityId: "character-1",
  location: {
    kind: "container",
    containerId: "sack-1",
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 3 },
};

const capacityRecords = [crateRecord, ropeRecord, torchRecord];
const exactCapacityRecords = [
  exactCapacityCrateRecord,
  {
    ...ropeRecord,
    location: {
      kind: "container" as const,
      containerId: exactCapacityCrateRecord.id,
    },
  },
  {
    ...torchRecord,
    location: {
      kind: "container" as const,
      containerId: exactCapacityCrateRecord.id,
    },
  },
];
const overCapacityRecords = [
  overCapacityCrateRecord,
  {
    ...ropeRecord,
    location: {
      kind: "container" as const,
      containerId: overCapacityCrateRecord.id,
    },
  },
  {
    ...torchRecord,
    location: {
      kind: "container" as const,
      containerId: overCapacityCrateRecord.id,
    },
  },
];
const emptyContentsOnlyRecords = [contentsOnlyBoxRecord];
const loadedContentsOnlyRecords = [
  contentsOnlyBoxRecord,
  contentsOnlyBoxChildRecord,
];
const heldContainerRecords = [sackRecord, rationsRecord];

const leatherArmorRecord: InventoryRecord = {
  id: "leather-armor-1",
  recordType: "armor",
  name: "Leather armor",
  entityId: "character-1",
  location: {
    kind: "equipped",
    placement: "loose",
  },
  sortOrder: 3000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  armor: {
    baseArmorClass: 12,
  },
};
const chainmailRecord: InventoryRecord = {
  ...leatherArmorRecord,
  id: "chainmail-1",
  name: "Chainmail",
  sortOrder: 4000,
  armor: {
    baseArmorClass: 14,
  },
};
const stowedPlateRecord: InventoryRecord = {
  ...leatherArmorRecord,
  id: "plate-1",
  name: "Plate",
  location: {
    kind: "stowedRoot",
  },
  sortOrder: 5000,
  armor: {
    baseArmorClass: 16,
  },
};
const heldShieldRecord: InventoryRecord = {
  id: "shield-1",
  recordType: "armor",
  name: "Shield",
  entityId: "character-1",
  location: {
    kind: "equipped",
    placement: "leftHand",
  },
  sortOrder: 6000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 1,
  armor: {
    armorBonus: 1,
  },
};
const stowedShieldRecord: InventoryRecord = {
  ...heldShieldRecord,
  id: "stowed-shield-1",
  location: {
    kind: "stowedRoot",
  },
};
const ringRecord: InventoryRecord = {
  id: "ring-1",
  recordType: "equipment",
  name: "Ring of protection",
  entityId: "character-1",
  location: {
    kind: "equipped",
    placement: "loose",
  },
  sortOrder: 7000,
  quantity: 1,
  burden: { kind: "none" },
  modifiers: [{ target: "armorClass", value: 1 }],
};

export const CALCULATION_MANUAL_FIXTURES = [
  {
    name: "coins count, value, and slots",
    actual: {
      coinCount: getCoinCount(coinsRecord.coins),
      coinGpValue: getCoinGpValue(coinsRecord.coins),
      coinSlots: getCoinSlotBurden(coinsRecord.coins),
      ninetyNineCoinSlots: getCoinSlotBurden({
        pp: 0,
        gp: 99,
        sp: 0,
        cp: 0,
      }),
      oneHundredCoinSlots: getCoinSlotBurden({
        pp: 0,
        gp: 100,
        sp: 0,
        cp: 0,
      }),
      oneHundredOneCoinSlots: getCoinSlotBurden({
        pp: 0,
        gp: 101,
        sp: 0,
        cp: 0,
      }),
      mixedCoinSlots: getCoinSlotBurden({
        pp: 2,
        gp: 40,
        sp: 50,
        cp: 9,
      }),
      mixedCoinGpValue: getCoinGpValue({
        pp: 2,
        gp: 40,
        sp: 50,
        cp: 9,
      }),
    },
    expected: {
      coinCount: 127,
      coinGpValue: 16.3,
      coinSlots: 2,
      ninetyNineCoinSlots: 1,
      oneHundredCoinSlots: 1,
      oneHundredOneCoinSlots: 2,
      mixedCoinSlots: 2,
      mixedCoinGpValue: 55.09,
    },
  },
  {
    name: "character AC uses equipped armor held shield item modifier and manual modifier",
    actual: getCharacterArmorClass(characterEntity, [
      leatherArmorRecord,
      heldShieldRecord,
      ringRecord,
      stowedPlateRecord,
      stowedShieldRecord,
    ], {
      className: "",
      level: null,
      alignment: "",
      xp: null,
      hp: { current: null, max: null },
      armorClass: { modifier: 1, override: null },
      abilityScores: {
        str: null,
        int: null,
        wis: null,
        dex: null,
        con: null,
        cha: null,
      },
      skills: [],
      languages: [],
      description: "",
      features: [],
    }),
    expected: {
      armorClass: 15,
      baseArmorClass: 12,
      equippedArmorRecordIds: ["leather-armor-1"],
      itemModifier: 1,
      manualModifier: 1,
      shieldRecordIds: ["shield-1"],
      warnings: [],
    },
  },
  {
    name: "character AC manual override replaces calculated value",
    actual: getCharacterArmorClass(characterEntity, [
      leatherArmorRecord,
      heldShieldRecord,
    ], {
      className: "",
      level: null,
      alignment: "",
      xp: null,
      hp: { current: null, max: null },
      armorClass: { modifier: 0, override: 17 },
      abilityScores: {
        str: null,
        int: null,
        wis: null,
        dex: null,
        con: null,
        cha: null,
      },
      skills: [],
      languages: [],
      description: "",
      features: [],
    }),
    expected: {
      armorClass: 17,
      baseArmorClass: 12,
      equippedArmorRecordIds: ["leather-armor-1"],
      itemModifier: 0,
      manualModifier: 0,
      manualOverride: 17,
      shieldRecordIds: ["shield-1"],
      warnings: [],
    },
  },
  {
    name: "character AC warns on multiple equipped armors and uses best armor",
    actual: getCharacterArmorClass(characterEntity, [
      leatherArmorRecord,
      chainmailRecord,
      heldShieldRecord,
    ]),
    expected: {
      armorClass: 15,
      baseArmorClass: 14,
      equippedArmorRecordIds: ["leather-armor-1", "chainmail-1"],
      itemModifier: 0,
      manualModifier: 0,
      shieldRecordIds: ["shield-1"],
      warnings: [
        {
          code: "multipleArmorsEquipped",
          entityId: "character-1",
          message: "Multiple armors equipped.",
          recordIds: ["leather-armor-1", "chainmail-1"],
        },
      ],
    },
  },
  {
    name: "container includes own slots and descendants",
    actual: {
      crateBaseSlots: getRecordSlotBurden(crateRecord),
      crateUsedSlots: getContainerSlotUsage(crateRecord, capacityRecords),
      crateTotalSlots: getEffectiveRecordAndContentsSlotBurden(
        crateRecord,
        capacityRecords,
      ),
      contentsSlots: getContentsSlots(storageEntity, capacityRecords),
      totalEntitySlots: getTotalEntitySlots(storageEntity, capacityRecords),
    },
    expected: {
      crateBaseSlots: 2,
      crateUsedSlots: {
        usedSlots: 3,
        capacitySlots: 8,
      },
      crateTotalSlots: 5,
      contentsSlots: 5,
      totalEntitySlots: 5,
    },
  },
  {
    name: "stackable equipment and capacity boundaries are exact",
    actual: {
      torchBurden: getRecordSlotBurden(torchRecord),
      exactCapacityUsage: getContainerSlotUsage(
        exactCapacityCrateRecord,
        exactCapacityRecords,
      ),
      overCapacityUsage: getContainerSlotUsage(
        overCapacityCrateRecord,
        overCapacityRecords,
      ),
    },
    expected: {
      torchBurden: 2,
      exactCapacityUsage: {
        usedSlots: 3,
        capacitySlots: 3,
      },
      overCapacityUsage: {
        usedSlots: 3,
        capacitySlots: 2,
      },
    },
  },
  {
    name: "containers always count own slots plus contents",
    actual: {
      emptyOwnSlots: getEffectiveRecordSlotBurden(
        contentsOnlyBoxRecord,
        emptyContentsOnlyRecords,
      ),
      loadedOwnSlots: getEffectiveRecordSlotBurden(
        contentsOnlyBoxRecord,
        loadedContentsOnlyRecords,
      ),
      loadedContainerUsage: getContainerSlotUsage(
        contentsOnlyBoxRecord,
        loadedContentsOnlyRecords,
      ),
      loadedTotalSlots: getEffectiveRecordAndContentsSlotBurden(
        contentsOnlyBoxRecord,
        loadedContentsOnlyRecords,
      ),
      loadedEntitySlots: getTotalEntitySlots(
        storageEntity,
        loadedContentsOnlyRecords,
      ),
    },
    expected: {
      emptyOwnSlots: 1,
      loadedOwnSlots: 1,
      loadedContainerUsage: {
        usedSlots: 1,
        capacitySlots: 4,
      },
      loadedTotalSlots: 2,
      loadedEntitySlots: 2,
    },
  },
  {
    name: "held container counts own slots but excludes contents from movement burden",
    actual: {
      visibleContainerUsage: getContainerSlotUsage(
        sackRecord,
        heldContainerRecords,
      ),
      normalTotalEntitySlots: getTotalEntitySlots(
        characterEntity,
        heldContainerRecords,
      ),
      movementTotalEntitySlots: getTotalEntitySlots(
        characterEntity,
        heldContainerRecords,
        MOVEMENT_SLOT_BURDEN_OPTIONS,
      ),
    },
    expected: {
      visibleContainerUsage: {
        usedSlots: 3,
        capacitySlots: 6,
      },
      normalTotalEntitySlots: 4,
      movementTotalEntitySlots: 1,
    },
  },
];

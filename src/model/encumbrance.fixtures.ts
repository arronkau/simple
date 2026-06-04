import { getContainerSlotUsage } from "./calculations";
import {
  getCharacterEncumbrance,
  getContentsCapacity,
  getEffectiveCarryState,
  getEncumbranceWarnings,
  getMovementRateForEquippedItems,
  getMovementRateForStowedItems,
  type EncumbranceWarning,
} from "./encumbrance";
import { createDefaultBackpack, type Entity, type InventoryRecord } from "./types";

type WarningSummary = Record<string, number>;

const characterEntity: Entity = {
  id: "character-1",
  name: "Morgan",
  entityType: "character",
  active: true,
  sortOrder: 0,
};

const cappedStorageEntity: Entity = {
  id: "storage-1",
  name: "Storage",
  entityType: "storage",
  active: true,
  sortOrder: 0,
  capacitySlots: 4,
};

const backpackRecord = createDefaultBackpack({
  entityId: characterEntity.id,
  id: "backpack-1",
});

const ropeRecord: InventoryRecord = {
  id: "rope-1",
  recordType: "equipment",
  name: "Rope",
  entityId: characterEntity.id,
  location: {
    kind: "container",
    containerId: backpackRecord.id,
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
};

const torchesRecord: InventoryRecord = {
  id: "torches-1",
  recordType: "equipment",
  name: "Torches",
  entityId: characterEntity.id,
  location: {
    kind: "container",
    containerId: backpackRecord.id,
  },
  sortOrder: 1000,
  quantity: 6,
  burden: { kind: "stacked", itemsPerSlot: 3 },
};

const yostBackpackRecord = createDefaultBackpack({
  entityId: characterEntity.id,
  id: "yost-backpack-1",
});

const yostBackpackTreasureRecord: InventoryRecord = {
  id: "yost-backpack-treasure-1",
  recordType: "treasure",
  name: "Treasure",
  entityId: characterEntity.id,
  location: {
    kind: "container",
    containerId: yostBackpackRecord.id,
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  treasure: {
    gpValue: 10,
  },
};

const yostBackpackSmallSackRecord: InventoryRecord = {
  id: "yost-backpack-sack-1",
  recordType: "equipment",
  name: "Small Sack",
  entityId: characterEntity.id,
  location: {
    kind: "container",
    containerId: yostBackpackRecord.id,
  },
  sortOrder: 1000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 1,
  container: {
    capacitySlots: 4,
  },
};

const yostHeldEmptySmallSackRecord: InventoryRecord = {
  ...yostBackpackSmallSackRecord,
  id: "yost-held-empty-sack-1",
  entityId: characterEntity.id,
  location: {
    kind: "equipped",
    placement: "rightHand",
  },
};

const yostHeldLoadedSmallSackRecord: InventoryRecord = {
  ...yostHeldEmptySmallSackRecord,
  id: "yost-held-loaded-sack-1",
};

const yostHeldSackTreasureRecord: InventoryRecord = {
  id: "yost-held-sack-treasure-1",
  recordType: "treasure",
  name: "Sack Treasure",
  entityId: characterEntity.id,
  location: {
    kind: "container",
    containerId: yostHeldLoadedSmallSackRecord.id,
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  treasure: {
    gpValue: 10,
  },
};

const secondYostHeldSackTreasureRecord: InventoryRecord = {
  ...yostHeldSackTreasureRecord,
  id: "yost-held-sack-treasure-2",
  sortOrder: 1000,
};

const equippedSixSlotsRecord: InventoryRecord = {
  id: "equipped-six-1",
  recordType: "equipment",
  name: "Equipped Bundle",
  entityId: characterEntity.id,
  location: {
    kind: "equipped",
    placement: "loose",
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 6 },
};

const equippedEightSlotsRecord: InventoryRecord = {
  ...equippedSixSlotsRecord,
  id: "equipped-eight-1",
  burden: { kind: "fixed", slotsPerItem: 8 },
};

const equippedTenSlotsRecord: InventoryRecord = {
  ...equippedSixSlotsRecord,
  id: "equipped-ten-1",
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 10 },
};

const fourSlotCoinsRecord: InventoryRecord = {
  id: "coins-400",
  recordType: "coins",
  entityId: characterEntity.id,
  location: {
    kind: "coinPurse",
  },
  sortOrder: 1000,
  coins: {
    pp: 0,
    gp: 400,
    sp: 0,
    cp: 0,
  },
};

const fiveSlotCoinsRecord: InventoryRecord = {
  ...fourSlotCoinsRecord,
  id: "coins-500",
  coins: {
    pp: 0,
    gp: 500,
    sp: 0,
    cp: 0,
  },
};

const seventeenSlotCoinsRecord: InventoryRecord = {
  ...fourSlotCoinsRecord,
  id: "coins-1700",
  coins: {
    pp: 0,
    gp: 1700,
    sp: 0,
    cp: 0,
  },
};

const heavyBackpackContentsRecord: InventoryRecord = {
  id: "heavy-backpack-load-1",
  recordType: "equipment",
  name: "Heavy backpack load",
  entityId: characterEntity.id,
  location: {
    kind: "container",
    containerId: backpackRecord.id,
  },
  sortOrder: 2000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 17 },
};

const heldSackRecord: InventoryRecord = {
  id: "sack-held-1",
  recordType: "equipment",
  name: "Sack",
  entityId: characterEntity.id,
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

const looseSackRecord: InventoryRecord = {
  ...heldSackRecord,
  id: "sack-loose-1",
  entityId: characterEntity.id,
  location: {
    kind: "equipped",
    placement: "loose",
  },
};

const heldSackRationsRecord: InventoryRecord = {
  id: "held-rations-1",
  recordType: "equipment",
  name: "Rations",
  entityId: characterEntity.id,
  location: {
    kind: "container",
    containerId: heldSackRecord.id,
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 3 },
};

const heldSackOverfilledRationsRecord: InventoryRecord = {
  ...heldSackRationsRecord,
  id: "held-overfilled-rations-1",
  burden: { kind: "fixed", slotsPerItem: 7 },
};

const looseSackRationsRecord: InventoryRecord = {
  ...heldSackRationsRecord,
  id: "loose-rations-1",
  entityId: characterEntity.id,
  location: {
    kind: "container",
    containerId: looseSackRecord.id,
  },
};

const storageLoadRecord: InventoryRecord = {
  id: "storage-load-1",
  recordType: "equipment",
  name: "Stored Load",
  entityId: cappedStorageEntity.id,
  location: {
    kind: "contents",
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 5 },
};

const smallBoxRecord: InventoryRecord = {
  id: "small-box-1",
  recordType: "equipment",
  name: "Small Box",
  entityId: cappedStorageEntity.id,
  location: {
    kind: "contents",
  },
  sortOrder: 1000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  container: {
    capacitySlots: 2,
  },
};

const overloadedBoxContentsRecord: InventoryRecord = {
  id: "box-contents-1",
  recordType: "equipment",
  name: "Box Contents",
  entityId: cappedStorageEntity.id,
  location: {
    kind: "container",
    containerId: smallBoxRecord.id,
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 3 },
};

const storageHandsRequiredSackRecord: InventoryRecord = {
  id: "storage-sack-1",
  recordType: "equipment",
  name: "Storage Sack",
  entityId: cappedStorageEntity.id,
  location: {
    kind: "contents",
  },
  sortOrder: 2000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 1,
  container: {
    capacitySlots: 6,
  },
};

const storageSackContentsRecord: InventoryRecord = {
  id: "storage-sack-contents-1",
  recordType: "equipment",
  name: "Stored Rations",
  entityId: cappedStorageEntity.id,
  location: {
    kind: "container",
    containerId: storageHandsRequiredSackRecord.id,
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
};

const nineSlotBackpackContentsRecord: InventoryRecord = {
  id: "nine-slot-backpack-load-1",
  recordType: "equipment",
  name: "Nine slot load",
  entityId: characterEntity.id,
  location: {
    kind: "container",
    containerId: backpackRecord.id,
  },
  sortOrder: 5000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 9 },
};

const fourteenSlotBackpackContentsRecord: InventoryRecord = {
  ...nineSlotBackpackContentsRecord,
  id: "fourteen-slot-backpack-load-1",
  name: "Fourteen slot load",
  burden: { kind: "fixed", slotsPerItem: 14 },
};

const litLanternRecord: InventoryRecord = {
  id: "lit-lantern-1",
  recordType: "equipment",
  name: "Lantern",
  entityId: characterEntity.id,
  location: {
    kind: "container",
    containerId: backpackRecord.id,
  },
  sortOrder: 3000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  light: {
    isLit: true,
    lightDescription: "Bright light.",
  },
};

const unidentifiedWandRecord: InventoryRecord = {
  id: "unidentified-wand-1",
  recordType: "equipment",
  name: "Wand of Secrets",
  entityId: characterEntity.id,
  location: {
    kind: "container",
    containerId: backpackRecord.id,
  },
  sortOrder: 4000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  identification: {
    identified: false,
    unidentifiedName: "Carved wand",
    unidentifiedDescription: "A polished wand with faint markings.",
  },
};

const emptyBackpackRecords = [backpackRecord];
const literalBackpackRecords = [backpackRecord, ropeRecord, torchesRecord];
const yostLoadedBackpackRecords = [
  yostBackpackRecord,
  yostBackpackTreasureRecord,
];
const yostLoadedBackpackWithEmptySackRecords = [
  ...yostLoadedBackpackRecords,
  yostBackpackSmallSackRecord,
];
const yostLoadedBackpackWithHeldEmptySackRecords = [
  ...yostLoadedBackpackRecords,
  yostHeldEmptySmallSackRecord,
];
const yostLoadedBackpackWithHeldLoadedSackRecords = [
  ...yostLoadedBackpackRecords,
  yostHeldLoadedSmallSackRecord,
  yostHeldSackTreasureRecord,
  secondYostHeldSackTreasureRecord,
];
const heldSackRecords = [heldSackRecord, heldSackRationsRecord];
const heldOverfilledSackWithBackpackRecords = [
  backpackRecord,
  heldSackRecord,
  heldSackOverfilledRationsRecord,
];
const looseSackRecords = [looseSackRecord, looseSackRationsRecord];
const cappedStorageRecords = [
  storageLoadRecord,
  smallBoxRecord,
  overloadedBoxContentsRecord,
];
const storageHandsRequiredSackRecords = [
  storageHandsRequiredSackRecord,
  storageSackContentsRecord,
];
const overfilledBackpackRecords = [backpackRecord, heavyBackpackContentsRecord];
const overloadedCharacterRecords = [backpackRecord, seventeenSlotCoinsRecord];
const globalOverloadRecords = [
  backpackRecord,
  equippedEightSlotsRecord,
  nineSlotBackpackContentsRecord,
];
const movementReducedRecords = [
  backpackRecord,
  equippedSixSlotsRecord,
  fourSlotCoinsRecord,
];
const stowedSlowerRecords = [
  backpackRecord,
  heldSackRecord,
  fourteenSlotBackpackContentsRecord,
];
const itemStatusRecords = [
  backpackRecord,
  litLanternRecord,
  unidentifiedWandRecord,
];

const emptyBackpackEncumbrance = getCharacterEncumbrance(
  characterEntity,
  emptyBackpackRecords,
);
const loadedLiteralBackpackEncumbrance = getCharacterEncumbrance(
  characterEntity,
  literalBackpackRecords,
);
const yostLoadedBackpackEncumbrance = getCharacterEncumbrance(
  characterEntity,
  yostLoadedBackpackRecords,
);
const yostLoadedBackpackWithEmptySackEncumbrance = getCharacterEncumbrance(
  characterEntity,
  yostLoadedBackpackWithEmptySackRecords,
);
const yostLoadedBackpackWithHeldEmptySackEncumbrance = getCharacterEncumbrance(
  characterEntity,
  yostLoadedBackpackWithHeldEmptySackRecords,
);
const yostLoadedBackpackWithHeldLoadedSackEncumbrance = getCharacterEncumbrance(
  characterEntity,
  yostLoadedBackpackWithHeldLoadedSackRecords,
);
const morganEncumbrance = getCharacterEncumbrance(characterEntity, [
  equippedSixSlotsRecord,
  fourSlotCoinsRecord,
]);
const stowedOverloadEncumbrance = getCharacterEncumbrance(characterEntity, [
  equippedSixSlotsRecord,
  seventeenSlotCoinsRecord,
]);
const equippedOverloadEncumbrance = getCharacterEncumbrance(characterEntity, [
  equippedTenSlotsRecord,
  fiveSlotCoinsRecord,
]);
const globalOverloadEncumbrance = getCharacterEncumbrance(
  characterEntity,
  globalOverloadRecords,
);
const stowedSlowerEncumbrance = getCharacterEncumbrance(
  characterEntity,
  stowedSlowerRecords,
);
const heldSackEncumbrance = getCharacterEncumbrance(
  characterEntity,
  heldSackRecords,
);
const storageCapacity = getContentsCapacity(
  cappedStorageEntity,
  cappedStorageRecords,
);

export const ENCUMBRANCE_MANUAL_FIXTURES = [
  {
    name: "movement lookups match configured bands",
    actual: {
      equippedThree: getMovementRateForEquippedItems(3),
      equippedFour: getMovementRateForEquippedItems(4),
      equippedSix: getMovementRateForEquippedItems(6),
      equippedEight: getMovementRateForEquippedItems(8),
      equippedTen: getMovementRateForEquippedItems(10),
      stowedTen: getMovementRateForStowedItems(10),
      stowedEleven: getMovementRateForStowedItems(11),
      stowedThirteen: getMovementRateForStowedItems(13),
      stowedFifteen: getMovementRateForStowedItems(15),
      stowedSeventeen: getMovementRateForStowedItems(17),
    },
    expected: {
      equippedThree: { explorationFeet: 120, encounterFeet: 40 },
      equippedFour: { explorationFeet: 90, encounterFeet: 30 },
      equippedSix: { explorationFeet: 60, encounterFeet: 20 },
      equippedEight: { explorationFeet: 30, encounterFeet: 10 },
      equippedTen: "overloaded",
      stowedTen: { explorationFeet: 120, encounterFeet: 40 },
      stowedEleven: { explorationFeet: 90, encounterFeet: 30 },
      stowedThirteen: { explorationFeet: 60, encounterFeet: 20 },
      stowedFifteen: { explorationFeet: 30, encounterFeet: 10 },
      stowedSeventeen: "overloaded",
    },
  },
  {
    name: "empty stowed-root backpack counts own slots as stowed",
    actual: {
      equippedItems: emptyBackpackEncumbrance.equippedItems,
      stowedItems: emptyBackpackEncumbrance.stowedItems,
      movement: emptyBackpackEncumbrance.movement,
      band: emptyBackpackEncumbrance.band,
    },
    expected: {
      equippedItems: 0,
      stowedItems: 1,
      movement: { explorationFeet: 120, encounterFeet: 40 },
      band: "normal",
    },
  },
  {
    name: "loaded backpack counts own slots plus contents",
    actual: {
      equippedItems: loadedLiteralBackpackEncumbrance.equippedItems,
      stowedItems: loadedLiteralBackpackEncumbrance.stowedItems,
      movement: loadedLiteralBackpackEncumbrance.movement,
      band: loadedLiteralBackpackEncumbrance.band,
    },
    expected: {
      equippedItems: 0,
      stowedItems: 4,
      movement: { explorationFeet: 120, encounterFeet: 40 },
      band: "normal",
    },
  },
  {
    name: "Yost container examples match equipped and stowed totals",
    actual: {
      loadedBackpack: summarizeEncumbrance(yostLoadedBackpackEncumbrance),
      loadedBackpackUsage: getContainerSlotUsage(
        yostBackpackRecord,
        yostLoadedBackpackRecords,
      ),
      loadedBackpackWithEmptySack: summarizeEncumbrance(
        yostLoadedBackpackWithEmptySackEncumbrance,
      ),
      loadedBackpackWithHeldEmptySack: summarizeEncumbrance(
        yostLoadedBackpackWithHeldEmptySackEncumbrance,
      ),
      loadedBackpackWithHeldLoadedSack: summarizeEncumbrance(
        yostLoadedBackpackWithHeldLoadedSackEncumbrance,
      ),
    },
    expected: {
      loadedBackpack: { equippedItems: 0, stowedItems: 2, totalItems: 2 },
      loadedBackpackUsage: { usedSlots: 1, capacitySlots: 16 },
      loadedBackpackWithEmptySack: {
        equippedItems: 0,
        stowedItems: 3,
        totalItems: 3,
      },
      loadedBackpackWithHeldEmptySack: {
        equippedItems: 1,
        stowedItems: 2,
        totalItems: 3,
      },
      loadedBackpackWithHeldLoadedSack: {
        equippedItems: 1,
        stowedItems: 2,
        totalItems: 3,
      },
    },
  },
  {
    name: "slower equipped movement wins over stowed movement",
    actual: {
      equippedItems: morganEncumbrance.equippedItems,
      stowedItems: morganEncumbrance.stowedItems,
      movement: morganEncumbrance.movement,
      band: morganEncumbrance.band,
    },
    expected: {
      equippedItems: 6,
      stowedItems: 4,
      movement: { explorationFeet: 60, encounterFeet: 20 },
      band: "encumbered",
    },
  },
  {
    name: "slower stowed movement wins over equipped movement",
    actual: {
      equippedItems: stowedSlowerEncumbrance.equippedItems,
      stowedItems: stowedSlowerEncumbrance.stowedItems,
      movement: stowedSlowerEncumbrance.movement,
      band: stowedSlowerEncumbrance.band,
    },
    expected: {
      equippedItems: 1,
      stowedItems: 15,
      movement: { explorationFeet: 30, encounterFeet: 10 },
      band: "heavilyEncumbered",
    },
  },
  {
    name: "stowed overload produces zero movement",
    actual: {
      overloaded: stowedOverloadEncumbrance.overloaded,
      overloadedReason: stowedOverloadEncumbrance.overloadedReason,
      movement: stowedOverloadEncumbrance.movement,
      band: stowedOverloadEncumbrance.band,
    },
    expected: {
      overloaded: true,
      overloadedReason: "stowed",
      movement: { explorationFeet: 0, encounterFeet: 0 },
      band: "overloaded",
    },
  },
  {
    name: "equipped overload produces zero movement",
    actual: {
      overloaded: equippedOverloadEncumbrance.overloaded,
      overloadedReason: equippedOverloadEncumbrance.overloadedReason,
      movement: equippedOverloadEncumbrance.movement,
      band: equippedOverloadEncumbrance.band,
    },
    expected: {
      overloaded: true,
      overloadedReason: "equipped",
      movement: { explorationFeet: 0, encounterFeet: 0 },
      band: "overloaded",
    },
  },
  {
    name: "global equipped plus stowed overload produces zero movement",
    actual: {
      equippedItems: globalOverloadEncumbrance.equippedItems,
      stowedItems: globalOverloadEncumbrance.stowedItems,
      overloaded: globalOverloadEncumbrance.overloaded,
      overloadedReason: globalOverloadEncumbrance.overloadedReason,
      movement: globalOverloadEncumbrance.movement,
      band: globalOverloadEncumbrance.band,
    },
    expected: {
      equippedItems: 8,
      stowedItems: 10,
      overloaded: true,
      overloadedReason: "both",
      movement: { explorationFeet: 0, encounterFeet: 0 },
      band: "overloaded",
    },
  },
  {
    name: "held containers count own slots and exclude contents from movement burden",
    actual: {
      containerState: getEffectiveCarryState(heldSackRecord, heldSackRecords),
      contentsState: getEffectiveCarryState(
        heldSackRationsRecord,
        heldSackRecords,
      ),
      equippedItems: heldSackEncumbrance.equippedItems,
      stowedItems: heldSackEncumbrance.stowedItems,
      visibleContainerUsage: getContainerSlotUsage(
        heldSackRecord,
        heldSackRecords,
      ),
      warnings: summarizeWarnings(
        getEncumbranceWarnings(characterEntity, heldSackRecords),
      ),
    },
    expected: {
      containerState: "equipped",
      contentsState: "excluded",
      equippedItems: 1,
      stowedItems: 0,
      visibleContainerUsage: { usedSlots: 3, capacitySlots: 6 },
      warnings: { missingBackpack: 1 },
    },
  },
  {
    name: "held overfilled container with backpack warns only for container capacity",
    actual: {
      encumbrance: summarizeEncumbrance(
        getCharacterEncumbrance(
          characterEntity,
          heldOverfilledSackWithBackpackRecords,
        ),
      ),
      visibleContainerUsage: getContainerSlotUsage(
        heldSackRecord,
        heldOverfilledSackWithBackpackRecords,
      ),
      warnings: summarizeWarnings(
        getEncumbranceWarnings(
          characterEntity,
          heldOverfilledSackWithBackpackRecords,
        ),
      ),
    },
    expected: {
      encumbrance: { equippedItems: 1, stowedItems: 1, totalItems: 2 },
      visibleContainerUsage: { usedSlots: 7, capacitySlots: 6 },
      warnings: { containerOverCapacity: 1 },
    },
  },
  {
    name: "non-held hands-required containers with contents warn",
    actual: {
      warnings: summarizeWarnings(
        getEncumbranceWarnings(characterEntity, looseSackRecords),
      ),
    },
    expected: {
      warnings: {
        handsRequiredContainerNotHeld: 1,
        missingBackpack: 1,
      },
    },
  },
  {
    name: "overfilled backpack creates a container warning",
    actual: {
      warnings: summarizeWarnings(
        getEncumbranceWarnings(characterEntity, overfilledBackpackRecords),
      ),
    },
    expected: {
      warnings: {
        containerOverCapacity: 1,
        entityOverloaded: 1,
      },
    },
  },
  {
    name: "overloaded character creates a movement warning",
    actual: {
      warnings: summarizeWarnings(
        getEncumbranceWarnings(characterEntity, overloadedCharacterRecords),
      ),
    },
    expected: {
      warnings: {
        entityOverloaded: 1,
      },
    },
  },
  {
    name: "standard movement reduction does not create a warning",
    actual: {
      warnings: summarizeWarnings(
        getEncumbranceWarnings(characterEntity, movementReducedRecords),
      ),
    },
    expected: {
      warnings: {},
    },
  },
  {
    name: "lit and unidentified item statuses do not create warnings",
    actual: {
      warnings: summarizeWarnings(
        getEncumbranceWarnings(characterEntity, itemStatusRecords),
      ),
    },
    expected: {
      warnings: {},
    },
  },
  {
    name: "non-character loaded hands-required containers do not require held warnings",
    actual: {
      warnings: summarizeWarnings(
        getEncumbranceWarnings(cappedStorageEntity, storageHandsRequiredSackRecords),
      ),
    },
    expected: {
      warnings: {},
    },
  },
  {
    name: "non-character contents capacity and capacity warnings are derived",
    actual: {
      capacity: storageCapacity,
      warnings: summarizeWarnings(
        getEncumbranceWarnings(cappedStorageEntity, cappedStorageRecords),
      ),
    },
    expected: {
      capacity: {
        usedSlots: 9,
        capacitySlots: 4,
        overloaded: true,
      },
      warnings: {
        containerOverCapacity: 1,
        entityOverCapacity: 1,
      },
    },
  },
];

function summarizeWarnings(warnings: EncumbranceWarning[]): WarningSummary {
  const summary = warnings.reduce<WarningSummary>((warningSummary, warning) => {
    warningSummary[warning.code] = (warningSummary[warning.code] ?? 0) + 1;
    return warningSummary;
  }, {});

  return Object.fromEntries(
    Object.entries(summary).sort(([leftCode], [rightCode]) =>
      leftCode.localeCompare(rightCode),
    ),
  );
}

function summarizeEncumbrance(encumbrance: {
  equippedItems: number;
  stowedItems: number;
}): { equippedItems: number; stowedItems: number; totalItems: number } {
  return {
    equippedItems: encumbrance.equippedItems,
    stowedItems: encumbrance.stowedItems,
    totalItems: encumbrance.equippedItems + encumbrance.stowedItems,
  };
}

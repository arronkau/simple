import {
  createDefaultBackpack,
  getRecordHandsRequired,
  isRecordHandsRequirementSatisfied,
  type Entity,
  type InventoryRecord,
} from "./types";
import {
  createInitialInventoryRecordsForEntity,
  getHandOccupancy,
  validateInventoryState,
  type ValidationIssue,
} from "./validation";

type IssueSummary = Record<string, number>;

const characterEntity: Entity = {
  id: "character-1",
  name: "Morgan",
  entityType: "character",
  active: true,
  sortOrder: 0,
};

const storageEntity: Entity = {
  id: "storage-1",
  name: "Storage",
  entityType: "storage",
  active: true,
  sortOrder: 1000,
};

const mountEntity: Entity = {
  id: "mount-1",
  name: "Mule",
  entityType: "mount",
  active: true,
  sortOrder: 2000,
};

const backpackRecord = createDefaultBackpack({
  entityId: characterEntity.id,
  id: "backpack-1",
});

const duplicateBackpackRecord = createDefaultBackpack({
  entityId: characterEntity.id,
  id: "backpack-2",
  sortOrder: 1000,
});

const stowedRootChestRecord: InventoryRecord = {
  id: "stowed-root-chest-1",
  recordType: "equipment",
  name: "Stowed Root Chest",
  location: {
    entityId: characterEntity.id,
    locationType: "equipped",
    placement: "loose",
  },
  sortOrder: 1000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 2 },
  container: {
    capacitySlots: 8,
  },
};

const stowedRootChestContentsRecord: InventoryRecord = {
  id: "stowed-root-chest-contents-1",
  recordType: "equipment",
  name: "Chest gear",
  location: {
    entityId: characterEntity.id,
    locationType: "stowed",
    placement: "backpack",
    containerId: stowedRootChestRecord.id,
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
};

const carriedBackpackRecord: InventoryRecord = {
  id: "carried-backpack-1",
  recordType: "equipment",
  name: "Carried Backpack",
  location: {
    entityId: characterEntity.id,
    locationType: "equipped",
    placement: "bothHands",
  },
  sortOrder: 1000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 2,
  container: {
    capacitySlots: 16,
    isBackpack: true,
  },
};

const carriedBackpackContentsRecord: InventoryRecord = {
  id: "carried-backpack-contents-1",
  recordType: "equipment",
  name: "Packed gear",
  location: {
    entityId: characterEntity.id,
    locationType: "stowed",
    placement: "container",
    containerId: carriedBackpackRecord.id,
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 2 },
};

const ropeRecord: InventoryRecord = {
  id: "rope-1",
  recordType: "equipment",
  name: "Rope",
  location: {
    entityId: characterEntity.id,
    locationType: "stowed",
    placement: "backpack",
    containerId: backpackRecord.id,
  },
  sortOrder: 2000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
};

const characterCoinsRecord: InventoryRecord = {
  id: "coins-1",
  recordType: "coins",
  location: {
    entityId: characterEntity.id,
    locationType: "stowed",
    placement: "coinPurse",
  },
  sortOrder: 3000,
  coins: { pp: 0, gp: 1, sp: 0, cp: 0 },
};

const secondCharacterCoinsRecord: InventoryRecord = {
  ...characterCoinsRecord,
  id: "coins-2",
  sortOrder: 4000,
};

const nonCharacterCoinsRecord: InventoryRecord = {
  id: "mount-coins-1",
  recordType: "coins",
  location: {
    entityId: mountEntity.id,
    locationType: "contents",
    placement: "contents",
  },
  sortOrder: 0,
  coins: { pp: 0, gp: 2, sp: 0, cp: 0 },
};

const secondNonCharacterCoinsRecord: InventoryRecord = {
  ...nonCharacterCoinsRecord,
  id: "mount-coins-2",
  sortOrder: 1000,
  coins: { pp: 0, gp: 3, sp: 0, cp: 0 },
};

const leftHandSword: InventoryRecord = {
  id: "sword-1",
  recordType: "weapon",
  name: "Sword",
  location: {
    entityId: characterEntity.id,
    locationType: "equipped",
    placement: "leftHand",
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 1,
  weapon: {},
};

const leftHandShield: InventoryRecord = {
  id: "shield-1",
  recordType: "armor",
  name: "Shield",
  location: {
    entityId: characterEntity.id,
    locationType: "equipped",
    placement: "leftHand",
  },
  sortOrder: 1000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 1,
  armor: {},
};

const bothHandsBow: InventoryRecord = {
  id: "bow-1",
  recordType: "weapon",
  name: "Bow",
  location: {
    entityId: characterEntity.id,
    locationType: "equipped",
    placement: "bothHands",
  },
  sortOrder: 2000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 2,
  weapon: {},
};

const invalidOneHandedBothHands: InventoryRecord = {
  ...leftHandSword,
  id: "dagger-1",
  name: "Dagger",
  location: {
    entityId: characterEntity.id,
    locationType: "equipped",
    placement: "bothHands",
  },
};

const ringInHandRecord: InventoryRecord = {
  id: "ring-1",
  recordType: "equipment",
  name: "Ring",
  location: {
    entityId: characterEntity.id,
    locationType: "equipped",
    placement: "rightHand",
  },
  sortOrder: 5000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 0 },
  handsRequired: 0,
};

const looseTorchRecord: InventoryRecord = {
  id: "torch-loose-1",
  recordType: "equipment",
  name: "Torch",
  location: {
    entityId: characterEntity.id,
    locationType: "equipped",
    placement: "loose",
  },
  sortOrder: 6000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 1,
};

const heldTorchRecord: InventoryRecord = {
  ...looseTorchRecord,
  id: "torch-held-1",
  location: {
    entityId: characterEntity.id,
    locationType: "equipped",
    placement: "leftHand",
  },
};

const leftHandPoleRecord: InventoryRecord = {
  id: "pole-left-1",
  recordType: "equipment",
  name: "10 foot pole",
  location: {
    entityId: characterEntity.id,
    locationType: "equipped",
    placement: "leftHand",
  },
  sortOrder: 7000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 2,
};

const bothHandsPoleRecord: InventoryRecord = {
  ...leftHandPoleRecord,
  id: "pole-both-1",
  location: {
    entityId: characterEntity.id,
    locationType: "equipped",
    placement: "bothHands",
  },
};

const legacyWeaponRecord: InventoryRecord = {
  id: "legacy-bow-1",
  recordType: "weapon",
  name: "Legacy Bow",
  location: {
    entityId: characterEntity.id,
    locationType: "equipped",
    placement: "bothHands",
  },
  sortOrder: 8000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  weapon: {
    hands: "twoHands",
  },
};

const legacyContainerRecord: InventoryRecord = {
  id: "legacy-sack-1",
  recordType: "equipment",
  name: "Legacy Sack",
  location: {
    entityId: characterEntity.id,
    locationType: "equipped",
    placement: "rightHand",
  },
  sortOrder: 9000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  container: {
    capacitySlots: 6,
    handsRequired: 1,
  },
};

const emptyNameRecord: InventoryRecord = {
  ...ropeRecord,
  id: "empty-name-1",
  name: " ",
};

const nonCharacterEquippedRecord: InventoryRecord = {
  id: "mount-saddle-1",
  recordType: "equipment",
  name: "Saddle",
  location: {
    entityId: mountEntity.id,
    locationType: "equipped",
    placement: "loose",
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
};

const storageCrateRecord: InventoryRecord = {
  id: "crate-1",
  recordType: "equipment",
  name: "Crate",
  location: {
    entityId: storageEntity.id,
    locationType: "contents",
    placement: "contents",
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 2 },
  container: {
    capacitySlots: 8,
  },
};

const nonContainerRecord: InventoryRecord = {
  id: "stone-1",
  recordType: "equipment",
  name: "Stone",
  location: {
    entityId: storageEntity.id,
    locationType: "contents",
    placement: "contents",
  },
  sortOrder: 1000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
};

const insideNonContainerRecord: InventoryRecord = {
  ...ropeRecord,
  id: "inside-stone-1",
  location: {
    entityId: storageEntity.id,
    locationType: "contents",
    placement: "container",
    containerId: nonContainerRecord.id,
  },
};

const nestedContainerRecord: InventoryRecord = {
  id: "nested-bag-1",
  recordType: "equipment",
  name: "Nested Bag",
  location: {
    entityId: storageEntity.id,
    locationType: "contents",
    placement: "container",
    containerId: storageCrateRecord.id,
  },
  sortOrder: 2000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  container: {
    capacitySlots: 4,
  },
};

const insideNestedContainerRecord: InventoryRecord = {
  ...ropeRecord,
  id: "inside-nested-bag-1",
  location: {
    entityId: storageEntity.id,
    locationType: "contents",
    placement: "container",
    containerId: nestedContainerRecord.id,
  },
};

const crossEntityContainedRecord: InventoryRecord = {
  ...ropeRecord,
  id: "cross-entity-1",
  location: {
    entityId: characterEntity.id,
    locationType: "stowed",
    placement: "container",
    containerId: storageCrateRecord.id,
  },
};

const cycleARecord: InventoryRecord = {
  ...nestedContainerRecord,
  id: "cycle-a",
  location: {
    entityId: storageEntity.id,
    locationType: "contents",
    placement: "container",
    containerId: "cycle-b",
  },
};

const cycleBRecord: InventoryRecord = {
  ...nestedContainerRecord,
  id: "cycle-b",
  location: {
    entityId: storageEntity.id,
    locationType: "contents",
    placement: "container",
    containerId: "cycle-a",
  },
};

const treasureContainerRecord = {
  id: "treasure-container-1",
  recordType: "treasure",
  name: "Gem Box",
  location: {
    entityId: storageEntity.id,
    locationType: "contents",
    placement: "contents",
  },
  sortOrder: 3000,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  treasure: {
    gpValue: 100,
  },
  container: {
    capacitySlots: 4,
  },
} as unknown as InventoryRecord;

const validCharacterResult = validateInventoryState(
  [characterEntity],
  [backpackRecord, ropeRecord, characterCoinsRecord],
);

const missingBackpackResult = validateInventoryState(
  [characterEntity],
  [characterCoinsRecord],
);

const duplicateBackpackResult = validateInventoryState(
  [characterEntity],
  [backpackRecord, duplicateBackpackRecord],
);

const duplicateStowedRootResult = validateInventoryState(
  [characterEntity],
  [backpackRecord, stowedRootChestRecord, stowedRootChestContentsRecord],
);

const carriedBackpackResult = validateInventoryState(
  [characterEntity],
  [
    backpackRecord,
    ropeRecord,
    carriedBackpackRecord,
    carriedBackpackContentsRecord,
  ],
);

const nonCharacterCoinsResult = validateInventoryState(
  [mountEntity],
  [nonCharacterCoinsRecord, secondNonCharacterCoinsRecord],
);

const invalidLocationAndHandsResult = validateInventoryState(
  [characterEntity, mountEntity],
  [
    backpackRecord,
    leftHandSword,
    leftHandShield,
    bothHandsBow,
    invalidOneHandedBothHands,
    emptyNameRecord,
    nonCharacterEquippedRecord,
    characterCoinsRecord,
    secondCharacterCoinsRecord,
  ],
);

const generalHandRequirementResult = validateInventoryState(
  [characterEntity],
  [backpackRecord, ringInHandRecord, leftHandPoleRecord],
);

const invalidContainmentResult = validateInventoryState(
  [characterEntity, storageEntity],
  [
    backpackRecord,
    storageCrateRecord,
    nonContainerRecord,
    insideNonContainerRecord,
    nestedContainerRecord,
    insideNestedContainerRecord,
    crossEntityContainedRecord,
    cycleARecord,
    cycleBRecord,
    treasureContainerRecord,
  ],
);

const createdCharacterInventory = createInitialInventoryRecordsForEntity({
  entity: characterEntity,
  backpackId: "new-backpack-1",
});

const createdStorageInventory = createInitialInventoryRecordsForEntity({
  entity: storageEntity,
  backpackId: "unused-backpack-1",
});

export const VALIDATION_MANUAL_FIXTURES = [
  {
    name: "valid character inventory has no issues",
    actual: {
      valid: validCharacterResult.valid,
      errors: summarizeIssues(validCharacterResult.errors),
      warnings: summarizeIssues(validCharacterResult.warnings),
    },
    expected: {
      valid: true,
      errors: {},
      warnings: {},
    },
  },
  {
    name: "missing backpack is a warning",
    actual: {
      valid: missingBackpackResult.valid,
      errors: summarizeIssues(missingBackpackResult.errors),
      warnings: summarizeIssues(missingBackpackResult.warnings),
    },
    expected: {
      valid: true,
      errors: {},
      warnings: {
        missingBackpack: 1,
      },
    },
  },
  {
    name: "two top-level stowed containers are a hard error",
    actual: {
      duplicateBackpacks: {
        valid: duplicateBackpackResult.valid,
        errors: summarizeIssues(duplicateBackpackResult.errors),
        warnings: summarizeIssues(duplicateBackpackResult.warnings),
      },
      duplicateStowedRoots: {
        valid: duplicateStowedRootResult.valid,
        errors: summarizeIssues(duplicateStowedRootResult.errors),
        warnings: summarizeIssues(duplicateStowedRootResult.warnings),
      },
    },
    expected: {
      duplicateBackpacks: {
        valid: false,
        errors: {
          duplicateTopLevelStowedContainer: 1,
        },
        warnings: {},
      },
      duplicateStowedRoots: {
        valid: false,
        errors: {
          duplicateTopLevelStowedContainer: 1,
        },
        warnings: {},
      },
    },
  },
  {
    name: "second backpack is valid when carried in both hands",
    actual: {
      valid: carriedBackpackResult.valid,
      errors: summarizeIssues(carriedBackpackResult.errors),
      warnings: summarizeIssues(carriedBackpackResult.warnings),
    },
    expected: {
      valid: true,
      errors: {},
      warnings: {},
    },
  },
  {
    name: "non-character entities may have multiple valid coin records",
    actual: {
      valid: nonCharacterCoinsResult.valid,
      errors: summarizeIssues(nonCharacterCoinsResult.errors),
      warnings: summarizeIssues(nonCharacterCoinsResult.warnings),
    },
    expected: {
      valid: true,
      errors: {},
      warnings: {},
    },
  },
  {
    name: "location, coin, name, and hand invariants are enforced",
    actual: {
      valid: invalidLocationAndHandsResult.valid,
      errors: summarizeIssues(invalidLocationAndHandsResult.errors),
      handErrors: getHandOccupancy(characterEntity.id, [
        leftHandSword,
        leftHandShield,
        bothHandsBow,
        invalidOneHandedBothHands,
      ]).errors.length,
      warnings: summarizeIssues(invalidLocationAndHandsResult.warnings),
    },
    expected: {
      valid: false,
      errors: {
        emptyInventoryRecordName: 1,
        handCollision: 3,
        invalidCoinCount: 1,
        invalidEntityLocationType: 1,
      },
      handErrors: 3,
      warnings: {},
    },
  },
  {
    name: "general hand requirements support minimum active semantics",
    actual: {
      valid: generalHandRequirementResult.valid,
      errors: summarizeIssues(generalHandRequirementResult.errors),
      ringInHand: isRecordHandsRequirementSatisfied(ringInHandRecord),
      looseTorch: isRecordHandsRequirementSatisfied(looseTorchRecord),
      heldTorch: isRecordHandsRequirementSatisfied(heldTorchRecord),
      leftHandPole: isRecordHandsRequirementSatisfied(leftHandPoleRecord),
      bothHandsPole: isRecordHandsRequirementSatisfied(bothHandsPoleRecord),
      shieldHandsRequired: getRecordHandsRequired(leftHandShield),
      legacyWeaponHandsRequired: getRecordHandsRequired(legacyWeaponRecord),
      legacyContainerHandsRequired: getRecordHandsRequired(legacyContainerRecord),
    },
    expected: {
      valid: true,
      errors: {},
      ringInHand: true,
      looseTorch: false,
      heldTorch: true,
      leftHandPole: false,
      bothHandsPole: true,
      shieldHandsRequired: 1,
      legacyWeaponHandsRequired: 2,
      legacyContainerHandsRequired: 1,
    },
  },
  {
    name: "containment invariants are enforced",
    actual: {
      valid: invalidContainmentResult.valid,
      errors: summarizeIssues(invalidContainmentResult.errors),
      warnings: summarizeIssues(invalidContainmentResult.warnings),
    },
    expected: {
      valid: false,
      errors: {
        containerCycle: 2,
        crossEntityContainment: 1,
        invalidContainerReference: 1,
        invalidTreasureContainer: 1,
        nestedContainerReceivingContents: 3,
        nestedNonEmptyContainer: 3,
      },
      warnings: {},
    },
  },
  {
    name: "initial entity inventory creates backpacks only for character-like entities",
    actual: {
      characterRecords: createdCharacterInventory.length,
      characterBackpackName: createdCharacterInventory[0]?.name,
      storageRecords: createdStorageInventory.length,
    },
    expected: {
      characterRecords: 1,
      characterBackpackName: "Backpack",
      storageRecords: 0,
    },
  },
];

function summarizeIssues(issues: ValidationIssue[]): IssueSummary {
  const summary = issues.reduce<IssueSummary>((issueSummary, issue) => {
    issueSummary[issue.code] = (issueSummary[issue.code] ?? 0) + 1;
    return issueSummary;
  }, {});

  return Object.fromEntries(
    Object.entries(summary).sort(([leftCode], [rightCode]) =>
      leftCode.localeCompare(rightCode),
    ),
  );
}

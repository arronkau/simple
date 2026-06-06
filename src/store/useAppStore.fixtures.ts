import { createEmptyCharacterData } from "../model/characters";
import { getSortedEntities } from "../model/entities";
import { getUsableContainerRecords } from "../model/inventoryRecords";
import { findBackpackRecords } from "../model/validation";
import { useAppStore } from "./useAppStore";

useAppStore.getState().resetLocalState();

const characterId = useAppStore.getState().createEntity({
  name: "Morgan",
  entityType: "character",
});
const mountId = useAppStore.getState().createEntity({
  name: "Mule",
  entityType: "mount",
});
const storageId = useAppStore.getState().createEntity({
  name: "Vault",
  entityType: "storage",
});
const blankEntityId = useAppStore.getState().createEntity({
  name: "   ",
  entityType: "retainer",
});

if (characterId) {
  useAppStore.getState().updateEntity(characterId, { name: "Morgan Iron" });
}

if (mountId) {
  useAppStore.getState().setEntityActive(mountId, false);
}

if (storageId) {
  useAppStore.getState().deleteEntity(storageId);
}

const phase3State = useAppStore.getState().appState;
const characterEntity = phase3State.entities.find(
  (entity) => entity.id === characterId,
);
const mountEntity = phase3State.entities.find((entity) => entity.id === mountId);

export const PHASE_3_STORE_MANUAL_FIXTURES = [
  {
    name: "store uses local persistence when Firebase config is missing",
    actual: {
      persistenceMode: useAppStore.getState().persistenceMode,
      syncError: useAppStore.getState().syncError,
      syncStatus: useAppStore.getState().syncStatus,
    },
    expected: {
      persistenceMode: "local",
      syncError: undefined,
      syncStatus: "local",
    },
  },
  {
    name: "character-like entity creation creates one backpack",
    actual: {
      entityCount: phase3State.entities.length,
      characterName: characterEntity?.name,
      characterBackpacks: characterId
        ? findBackpackRecords(characterId, phase3State.inventoryRecords).length
        : 0,
      blankEntityCreated: blankEntityId !== undefined,
    },
    expected: {
      entityCount: 2,
      characterName: "Morgan Iron",
      characterBackpacks: 1,
      blankEntityCreated: false,
    },
  },
  {
    name: "non-character entity creation does not create backpacks",
    actual: {
      mountBackpacks: mountId
        ? findBackpackRecords(mountId, phase3State.inventoryRecords).length
        : 0,
      mountActive: mountEntity?.active,
    },
    expected: {
      mountBackpacks: 0,
      mountActive: false,
    },
  },
  {
    name: "delete entity removes owned inventory records",
    actual: {
      storageExists: phase3State.entities.some((entity) => entity.id === storageId),
      storageRecordsExist: phase3State.inventoryRecords.some(
        (record) => record.entityId === storageId,
      ),
    },
    expected: {
      storageExists: false,
      storageRecordsExist: false,
    },
  },
  {
    name: "sorted entities list active entities before inactive entities",
    actual: getSortedEntities(phase3State.entities).map((entity) => ({
      name: entity.name,
      active: entity.active,
    })),
    expected: [
      {
        name: "Morgan Iron",
        active: true,
      },
      {
        name: "Mule",
        active: false,
      },
    ],
  },
];

useAppStore.getState().resetLocalState();

const phase5CharacterId = useAppStore.getState().createEntity({
  name: "Aria",
  entityType: "character",
});
const phase5NoBackpackCharacterId = useAppStore.getState().createEntity({
  name: "Nix",
  entityType: "character",
});
const phase5MountId = useAppStore.getState().createEntity({
  name: "Pack Mule",
  entityType: "mount",
});
const phase5StorageAId = useAppStore.getState().createEntity({
  name: "North Vault",
  entityType: "storage",
});
const phase5StorageBId = useAppStore.getState().createEntity({
  name: "South Vault",
  entityType: "storage",
});

if (phase5CharacterId) {
  useAppStore.getState().createInventoryRecord(phase5CharacterId, {
    recordType: "coins",
    coins: { gp: 12 },
  });
  useAppStore.getState().createInventoryRecord(phase5CharacterId, {
    recordType: "coins",
    coins: { sp: 8 },
  });
  useAppStore.getState().createInventoryRecord(phase5CharacterId, {
    recordType: "equipment",
    name: "Rope",
    quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  });
}

if (phase5MountId) {
  useAppStore.getState().createInventoryRecord(phase5MountId, {
    recordType: "treasure",
    name: "Trade goods",
    gpValue: 45,
    quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 2 },
  });
}

const phase5StateAfterDefaults = useAppStore.getState().appState;
const phase5CoinRecords = phase5StateAfterDefaults.inventoryRecords.filter(
  (record) =>
    record.recordType === "coins" &&
    record.entityId === phase5CharacterId,
);
const phase5RopeRecord = phase5StateAfterDefaults.inventoryRecords.find(
  (record) => record.recordType === "equipment" && record.name === "Rope",
);
const phase5TradeGoodsRecord =
  phase5StateAfterDefaults.inventoryRecords.find(
    (record) =>
      record.recordType === "treasure" && record.name === "Trade goods",
  );

let phase5BackpackMoveOk = false;
let phase5MissingContainerMoveOk = true;
let phase5MissingBackpackMoveOk = true;
let phase5InvalidHandOk = true;
let phase5NestedContainerMoveOk = true;
let phase5DeepContainerMoveOk = true;
let phase5DeleteNonEmptyContainerOk = true;
let phase5CrossEntityDescendantEntityId: string | undefined;
let phase5NestedContainerId: string | undefined;
let phase5SpareBagId: string | undefined;

if (phase5CharacterId) {
  const phase5BackpackRecord = findBackpackRecords(
    phase5CharacterId,
    useAppStore.getState().appState.inventoryRecords,
  )[0];

  const swordResult = useAppStore.getState().createInventoryRecord(
    phase5CharacterId,
    {
      recordType: "weapon",
      name: "Sword",
      quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
    },
  );

  if (swordResult.ok && swordResult.recordId) {
    phase5BackpackMoveOk = useAppStore
      .getState()
      .moveInventoryRecord(swordResult.recordId, {
        entityId: phase5CharacterId,
        placement: "container",
        containerId: phase5BackpackRecord?.id,
      }).ok;
    phase5MissingContainerMoveOk = useAppStore
      .getState()
      .moveInventoryRecord(swordResult.recordId, {
        entityId: phase5CharacterId,
        placement: "container",
        containerId: "missing-container",
      }).ok;
  }

  const noBackpackRecord =
    phase5NoBackpackCharacterId !== undefined
      ? findBackpackRecords(
          phase5NoBackpackCharacterId,
          useAppStore.getState().appState.inventoryRecords,
        )[0]
      : undefined;

  if (noBackpackRecord) {
    useAppStore.getState().deleteInventoryRecord(noBackpackRecord.id);
  }

  const hammerResult = phase5NoBackpackCharacterId
    ? useAppStore.getState().createInventoryRecord(
        phase5NoBackpackCharacterId,
        {
          recordType: "weapon",
          name: "Hammer",
          quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
        },
      )
    : undefined;

  if (hammerResult?.ok && hammerResult.recordId && phase5NoBackpackCharacterId) {
    phase5MissingBackpackMoveOk = useAppStore
      .getState()
      .moveInventoryRecord(hammerResult.recordId, {
        entityId: phase5NoBackpackCharacterId,
        placement: "container",
      }).ok;
  }

  const spareBagResult = useAppStore.getState().createInventoryRecord(
    phase5CharacterId,
    {
      recordType: "equipment",
      name: "Spare Bag",
      quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
      container: { capacitySlots: 4 },
    },
  );

  if (spareBagResult.ok && spareBagResult.recordId) {
    phase5SpareBagId = spareBagResult.recordId;

    const nestedPouchResult = useAppStore.getState().createInventoryRecord(
      phase5CharacterId,
      {
        recordType: "equipment",
        name: "Nested Pouch",
        quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
        container: { capacitySlots: 1 },
        location: {
          entityId: phase5CharacterId,
          placement: "container",
          containerId: spareBagResult.recordId,
        },
      },
    );

    if (nestedPouchResult.ok) {
      phase5NestedContainerId = nestedPouchResult.recordId;
    }
  }

  useAppStore.getState().createInventoryRecord(phase5CharacterId, {
    recordType: "weapon",
    name: "Dagger",
    quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
    location: { entityId: phase5CharacterId, placement: "leftHand" },
  });
  phase5InvalidHandOk = useAppStore
    .getState()
    .createInventoryRecord(phase5CharacterId, {
      recordType: "weapon",
      name: "Axe",
      quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
      location: { entityId: phase5CharacterId, placement: "leftHand" },
    }).ok;

  const sackResult = useAppStore.getState().createInventoryRecord(
    phase5CharacterId,
    {
      recordType: "equipment",
      name: "Sack",
      quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
      container: { capacitySlots: 6 },
    },
  );

  if (sackResult.ok && sackResult.recordId) {
    useAppStore.getState().createInventoryRecord(phase5CharacterId, {
      recordType: "equipment",
      name: "Torch",
      quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
      location: {
        entityId: phase5CharacterId,
        placement: "container",
        containerId: sackResult.recordId,
      },
    });
    phase5NestedContainerMoveOk = useAppStore
      .getState()
      .moveInventoryRecord(sackResult.recordId, {
        entityId: phase5CharacterId,
        placement: "container",
        containerId: spareBagResult.ok ? spareBagResult.recordId : undefined,
      }).ok;
    phase5DeleteNonEmptyContainerOk = useAppStore
      .getState()
      .deleteInventoryRecord(sackResult.recordId).ok;
  }

  if (phase5SpareBagId) {
    phase5DeepContainerMoveOk = useAppStore
      .getState()
      .moveInventoryRecord(phase5SpareBagId, {
        entityId: phase5CharacterId,
        placement: "container",
        containerId: phase5BackpackRecord?.id,
      }).ok;
  }
}

if (phase5StorageAId && phase5StorageBId) {
  const crateResult = useAppStore.getState().createInventoryRecord(
    phase5StorageAId,
    {
      recordType: "equipment",
      name: "Crate",
      quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 2 },
      container: { capacitySlots: 10 },
    },
  );

  if (crateResult.ok && crateResult.recordId) {
    const lanternResult = useAppStore.getState().createInventoryRecord(
      phase5StorageAId,
      {
        recordType: "equipment",
        name: "Lantern",
        quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
        location: {
          entityId: phase5StorageAId,
          placement: "container",
          containerId: crateResult.recordId,
        },
      },
    );

    useAppStore.getState().moveInventoryRecord(crateResult.recordId, {
      entityId: phase5StorageBId,
      placement: "contents",
    });

    if (lanternResult.ok && lanternResult.recordId) {
      phase5CrossEntityDescendantEntityId =
        useAppStore
          .getState()
          .appState.inventoryRecords.find(
            (record) => record.id === lanternResult.recordId,
          )?.entityId;
    }
  }
}

const phase5FinalState = useAppStore.getState().appState;
const phase5DaggerRecord = phase5FinalState.inventoryRecords.find(
  (record) => record.recordType === "weapon" && record.name === "Dagger",
);
const phase5SackRecord = phase5FinalState.inventoryRecords.find(
  (record) => record.recordType === "equipment" && record.name === "Sack",
);
const phase5CharacterEntity = phase5FinalState.entities.find(
  (entity) => entity.id === phase5CharacterId,
);
const phase5NewRecordContainerOptionIds = phase5CharacterEntity
  ? getUsableContainerRecords({
      entity: phase5CharacterEntity,
      isContainer: false,
      records: phase5FinalState.inventoryRecords,
    }).map((record) => record.id)
  : [];
const phase5SackMoveContainerOptionIds =
  phase5CharacterEntity && phase5SackRecord
    ? getUsableContainerRecords({
        entity: phase5CharacterEntity,
        isContainer: true,
        records: phase5FinalState.inventoryRecords,
        editingRecordId: phase5SackRecord.id,
      }).map((record) => record.id)
    : [];

useAppStore.getState().resetLocalState();

const phase5SpendCharacterId = useAppStore.getState().createEntity({
  name: "Yost",
  entityType: "character",
});

if (phase5SpendCharacterId) {
  useAppStore.getState().createInventoryRecord(phase5SpendCharacterId, {
    recordType: "coins",
    coins: { gp: 50, sp: 7 },
  });
}

const phase5SpendCoinRecord = useAppStore
  .getState()
  .appState.inventoryRecords.find(
    (record) =>
      record.recordType === "coins" &&
      record.entityId === phase5SpendCharacterId,
  );
const phase5SpendWithNoteResult = phase5SpendCoinRecord
  ? useAppStore.getState().spendCoins(phase5SpendCoinRecord.id, {
      amounts: {
        gp: 10,
        sp: 2,
      },
      note: "paid temple donation",
    })
  : { ok: false };
const phase5OverspendResult = phase5SpendCoinRecord
  ? useAppStore.getState().spendCoins(phase5SpendCoinRecord.id, {
      denomination: "sp",
      amount: 20,
    })
  : { ok: false };
const phase5SpendWithoutNoteResult = phase5SpendCoinRecord
  ? useAppStore.getState().spendCoins(phase5SpendCoinRecord.id, {
      denomination: "sp",
      amount: 2,
    })
  : { ok: false };
const phase5SpendState = useAppStore.getState().appState;
const phase5SpendFinalCoinRecord = phase5SpendState.inventoryRecords.find(
  (record) => record.id === phase5SpendCoinRecord?.id,
);
const phase5SpendAuditEntries = phase5SpendState.auditLog.filter(
  (entry) =>
    entry.eventType === "coinsChanged" &&
    entry.recordId === phase5SpendCoinRecord?.id,
);

export const PHASE_5_STORE_MANUAL_FIXTURES = [
  {
    name: "character coin creation merges into a single coin-purse record",
    actual: {
      coinRecords: phase5CoinRecords.length,
      coins:
        phase5CoinRecords[0]?.recordType === "coins"
          ? phase5CoinRecords[0].coins
          : undefined,
    },
    expected: {
      coinRecords: 1,
      coins: { pp: 0, gp: 12, sp: 8, cp: 0 },
    },
  },
  {
    name: "default create locations follow entity kind",
    actual: {
      characterEquipmentLocation: phase5RopeRecord?.location,
      nonCharacterTreasureLocation: phase5TradeGoodsRecord?.location,
    },
    expected: {
      characterEquipmentLocation: {
        kind: "equipped",
        placement: "loose",
      },
      nonCharacterTreasureLocation: {
        kind: "contents",
      },
    },
  },
  {
    name: "move validation blocks invalid backpack and hand states",
    actual: {
      backpackMoveOk: phase5BackpackMoveOk,
      missingContainerMoveOk: phase5MissingContainerMoveOk,
      missingBackpackMoveOk: phase5MissingBackpackMoveOk,
      invalidHandOk: phase5InvalidHandOk,
    },
    expected: {
      backpackMoveOk: true,
      missingContainerMoveOk: false,
      missingBackpackMoveOk: false,
      invalidHandOk: false,
    },
  },
  {
    name: "new records use sibling sort order for their target location",
    actual: {
      daggerSortOrder: phase5DaggerRecord?.sortOrder,
    },
    expected: {
      daggerSortOrder: 0,
    },
  },
  {
    name: "one-level non-empty containers can nest but deeper container nesting is blocked",
    actual: {
      nestedContainerMoveOk: phase5NestedContainerMoveOk,
      deepContainerMoveOk: phase5DeepContainerMoveOk,
      deleteNonEmptyContainerOk: phase5DeleteNonEmptyContainerOk,
    },
    expected: {
      nestedContainerMoveOk: true,
      deepContainerMoveOk: false,
      deleteNonEmptyContainerOk: false,
    },
  },
  {
    name: "usable container options exclude invalid destinations before submit",
    actual: {
      nestedContainerOffered:
        phase5NestedContainerId !== undefined &&
        phase5NewRecordContainerOptionIds.includes(phase5NestedContainerId),
      nestedContainerOfferedForContainerMove:
        phase5NestedContainerId !== undefined &&
        phase5SackMoveContainerOptionIds.includes(phase5NestedContainerId),
      containerMoveOptions: phase5SackMoveContainerOptionIds.length,
    },
    expected: {
      nestedContainerOffered: true,
      nestedContainerOfferedForContainerMove: false,
      containerMoveOptions: 2,
    },
  },
  {
    name: "container cross-entity moves update descendant entity ids",
    actual: {
      descendantEntityId: phase5CrossEntityDescendantEntityId,
    },
    expected: {
      descendantEntityId: phase5StorageBId,
    },
  },
  {
    name: "coin spend reduces selected denomination and blocks overdrafts",
    actual: {
      spendWithNoteOk: phase5SpendWithNoteResult.ok,
      overspendOk: phase5OverspendResult.ok,
      spendWithoutNoteOk: phase5SpendWithoutNoteResult.ok,
      finalCoins:
        phase5SpendFinalCoinRecord?.recordType === "coins"
          ? phase5SpendFinalCoinRecord.coins
          : undefined,
    },
    expected: {
      spendWithNoteOk: true,
      overspendOk: false,
      spendWithoutNoteOk: true,
      finalCoins: {
        pp: 0,
        gp: 40,
        sp: 3,
        cp: 0,
      },
    },
  },
  {
    name: "coin spend audit records amount denomination and optional note",
    actual: phase5SpendAuditEntries.map((entry) => ({
      summary: entry.summary,
      spendGp: entry.details?.spendGp,
      spendSp: entry.details?.spendSp,
      spendNote: entry.details?.spendNote,
    })),
    expected: [
      {
        summary: "Yost spent 10 gp, 2 sp — paid temple donation.",
        spendGp: 10,
        spendSp: 2,
        spendNote: "paid temple donation",
      },
      {
        summary: "Yost spent 2 sp.",
        spendGp: 0,
        spendSp: 2,
        spendNote: undefined,
      },
    ],
  },
];

useAppStore.getState().resetLocalState();

const phase6CharacterId = useAppStore.getState().createEntity({
  name: "Yost",
  entityType: "character",
});
let phase6NamedItemId: string | undefined;
let phase6DescriptionOnlyItemId: string | undefined;
let phase6NoSecretItemId: string | undefined;

if (phase6CharacterId) {
  const namedItemResult = useAppStore.getState().createInventoryRecord(
    phase6CharacterId,
    {
      recordType: "weapon",
      name: "rusty sword",
      description: "A corroded blade.",
      quantity: 1,
      burden: { kind: "fixed", slotsPerItem: 1 },
      handsRequired: 1,
      identification: {
        identified: false,
        secretName: "Sword of Sundering +2",
        secretDescription: "A keen magic sword etched with storm runes.",
      },
      weapon: {},
    },
  );
  const descriptionOnlyResult = useAppStore.getState().createInventoryRecord(
    phase6CharacterId,
    {
      recordType: "equipment",
      name: "sealed scroll",
      description: "A wax-sealed scroll.",
      quantity: 1,
      burden: { kind: "fixed", slotsPerItem: 1 },
      identification: {
        identified: false,
        secretDescription: "A scroll of warding against undead.",
      },
    },
  );
  const noSecretResult = useAppStore.getState().createInventoryRecord(
    phase6CharacterId,
    {
      recordType: "equipment",
      name: "plain charm",
      quantity: 1,
      burden: { kind: "fixed", slotsPerItem: 1 },
      identification: {
        identified: false,
      },
    },
  );

  phase6NamedItemId = namedItemResult.ok ? namedItemResult.recordId : undefined;
  phase6DescriptionOnlyItemId = descriptionOnlyResult.ok
    ? descriptionOnlyResult.recordId
    : undefined;
  phase6NoSecretItemId = noSecretResult.ok ? noSecretResult.recordId : undefined;
}

const phase6IdentifyNamedResult = phase6NamedItemId
  ? useAppStore.getState().identifyInventoryRecord(phase6NamedItemId)
  : { ok: false };
const phase6IdentifyDescriptionOnlyResult = phase6DescriptionOnlyItemId
  ? useAppStore
      .getState()
      .identifyInventoryRecord(phase6DescriptionOnlyItemId)
  : { ok: false };
const phase6IdentifyNoSecretResult = phase6NoSecretItemId
  ? useAppStore.getState().identifyInventoryRecord(phase6NoSecretItemId)
  : { ok: false };
const phase6State = useAppStore.getState().appState;
const phase6NamedItem = phase6State.inventoryRecords.find(
  (record) => record.id === phase6NamedItemId,
);
const phase6DescriptionOnlyItem = phase6State.inventoryRecords.find(
  (record) => record.id === phase6DescriptionOnlyItemId,
);
const phase6IdentifyAuditEntries = phase6State.auditLog.filter(
  (entry) => entry.eventType === "inventoryRecordIdentified",
);

export const PHASE_6_STORE_MANUAL_FIXTURES = [
  {
    name: "identify action copies secret fields into public fields",
    actual: {
      identifyNamedOk: phase6IdentifyNamedResult.ok,
      identifyDescriptionOnlyOk: phase6IdentifyDescriptionOnlyResult.ok,
      identifyNoSecretOk: phase6IdentifyNoSecretResult.ok,
      namedItem:
        phase6NamedItem && phase6NamedItem.recordType !== "coins"
          ? {
              name: phase6NamedItem.name,
              description: phase6NamedItem.description,
              identification: phase6NamedItem.identification,
            }
          : undefined,
      descriptionOnlyItem:
        phase6DescriptionOnlyItem &&
        phase6DescriptionOnlyItem.recordType !== "coins"
          ? {
              name: phase6DescriptionOnlyItem.name,
              description: phase6DescriptionOnlyItem.description,
              identification: phase6DescriptionOnlyItem.identification,
            }
          : undefined,
    },
    expected: {
      identifyNamedOk: true,
      identifyDescriptionOnlyOk: true,
      identifyNoSecretOk: false,
      namedItem: {
        name: "Sword of Sundering +2",
        description: "A keen magic sword etched with storm runes.",
        identification: undefined,
      },
      descriptionOnlyItem: {
        name: "sealed scroll",
        description: "A scroll of warding against undead.",
        identification: undefined,
      },
    },
  },
  {
    name: "identify action writes one audit entry per identified item",
    actual: phase6IdentifyAuditEntries.map((entry) => ({
      eventType: entry.eventType,
      summary: entry.summary,
      previousName: entry.details?.previousName,
      nextName: entry.details?.nextName,
    })),
    expected: [
      {
        eventType: "inventoryRecordIdentified",
        summary: "Identified rusty sword as Sword of Sundering +2.",
        previousName: "rusty sword",
        nextName: "Sword of Sundering +2",
      },
      {
        eventType: "inventoryRecordIdentified",
        summary: "Identified sealed scroll.",
        previousName: "sealed scroll",
        nextName: "sealed scroll",
      },
    ],
  },
];

useAppStore.getState().resetLocalState();

const phase8CharacterId = useAppStore.getState().createEntity({
  name: "Ledger Hero",
  entityType: "character",
});
const phase8StorageId = useAppStore.getState().createEntity({
  name: "Ledger Vault",
  entityType: "storage",
});

if (phase8CharacterId) {
  useAppStore.getState().setEntityActive(phase8CharacterId, false);
  useAppStore.getState().setEntityActive(phase8CharacterId, true);

  useAppStore.getState().createInventoryRecord(phase8CharacterId, {
    recordType: "coins",
    coins: { gp: 10 },
  });
  useAppStore.getState().createInventoryRecord(phase8CharacterId, {
    recordType: "coins",
    coins: { sp: 5 },
  });

  const treasureResult = useAppStore.getState().createInventoryRecord(
    phase8CharacterId,
    {
      recordType: "treasure",
      name: "Ruby",
      gpValue: 10,
      quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
    },
  );

  if (treasureResult.ok && treasureResult.recordId) {
    useAppStore.getState().updateInventoryRecord(treasureResult.recordId, {
      recordType: "treasure",
      name: "Ruby",
      gpValue: 25,
      quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
    });
  }

  const ropeResult = useAppStore.getState().createInventoryRecord(
    phase8CharacterId,
    {
      recordType: "equipment",
      name: "Rope",
      quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
    },
  );

  if (ropeResult.ok && ropeResult.recordId && phase8StorageId) {
    useAppStore.getState().moveInventoryRecord(ropeResult.recordId, {
      entityId: phase8StorageId,
      placement: "contents",
    });
    useAppStore.getState().deleteInventoryRecord(ropeResult.recordId);
  }
}

if (phase8StorageId) {
  useAppStore.getState().deleteEntity(phase8StorageId);
}

if (phase8CharacterId) {
  useAppStore.getState().deleteEntity(phase8CharacterId);
}

const phase8AuditEntries = useAppStore.getState().appState.auditLog;
const phase8CoinChangeEntry = phase8AuditEntries.find(
  (entry) => entry.eventType === "coinsChanged",
);
const phase8TreasureValueEntry = phase8AuditEntries.find(
  (entry) => entry.eventType === "treasureValueChanged",
);
const phase8MoveEntry = phase8AuditEntries.find(
  (entry) => entry.eventType === "inventoryRecordMoved",
);
const phase8DeleteRecordEntry = phase8AuditEntries.find(
  (entry) => entry.eventType === "inventoryRecordDeleted",
);

useAppStore.getState().resetLocalState();

const phase8SameEntityCharacterId = useAppStore.getState().createEntity({
  name: "Quiet Mover",
  entityType: "character",
});
const phase8SameEntityRecordResult = phase8SameEntityCharacterId
  ? useAppStore.getState().createInventoryRecord(phase8SameEntityCharacterId, {
      recordType: "equipment",
      name: "Crowbar",
      quantity: 1,
      burden: { kind: "fixed", slotsPerItem: 1 },
      handsRequired: 1,
    })
  : { ok: false };
const phase8SameEntityRecordId =
  phase8SameEntityRecordResult.ok && "recordId" in phase8SameEntityRecordResult
    ? phase8SameEntityRecordResult.recordId
    : undefined;
const phase8SameEntityMoveResult =
  phase8SameEntityCharacterId && phase8SameEntityRecordId
    ? useAppStore
        .getState()
        .moveInventoryRecord(phase8SameEntityRecordId, {
          entityId: phase8SameEntityCharacterId,
          placement: "leftHand",
        })
    : { ok: false };
const phase8SameEntityMoveAuditCount = useAppStore
  .getState()
  .appState.auditLog.filter(
    (entry) => entry.eventType === "inventoryRecordMoved",
  ).length;

export const PHASE_8_STORE_MANUAL_FIXTURES = [
  {
    name: "store audit log captures significant entity and inventory mutations",
    actual: phase8AuditEntries.map((entry) => entry.eventType),
    expected: [
      "entityCreated",
      "entityCreated",
      "entityDeactivated",
      "entityActivated",
      "inventoryRecordCreated",
      "coinsChanged",
      "inventoryRecordCreated",
      "treasureValueChanged",
      "inventoryRecordCreated",
      "inventoryRecordMoved",
      "inventoryRecordDeleted",
      "entityDeleted",
      "entityDeleted",
    ],
  },
  {
    name: "store audit log records coin denomination deltas",
    actual: {
      details: {
        deltaCp: phase8CoinChangeEntry?.details?.deltaCp,
        deltaGp: phase8CoinChangeEntry?.details?.deltaGp,
        deltaPp: phase8CoinChangeEntry?.details?.deltaPp,
        deltaSp: phase8CoinChangeEntry?.details?.deltaSp,
      },
      summary: phase8CoinChangeEntry?.summary,
    },
    expected: {
      details: {
        deltaCp: 0,
        deltaGp: 0,
        deltaPp: 0,
        deltaSp: 5,
      },
      summary: 'Changed coins for "Ledger Hero": +5 sp.',
    },
  },
  {
    name: "store audit log records treasure value edits",
    actual: {
      details: {
        nextGpValue: phase8TreasureValueEntry?.details?.nextGpValue,
        previousGpValue: phase8TreasureValueEntry?.details?.previousGpValue,
      },
      summary: phase8TreasureValueEntry?.summary,
    },
    expected: {
      details: {
        nextGpValue: 25,
        previousGpValue: 10,
      },
      summary: 'Changed treasure value for "Ruby" from 10 gp to 25 gp.',
    },
  },
  {
    name: "store audit log records move and delete targets",
    actual: {
      deletedRecordType: phase8DeleteRecordEntry?.details?.recordType,
      fromEntityId: phase8MoveEntry?.details?.fromEntityId,
      toEntityId: phase8MoveEntry?.details?.toEntityId,
    },
    expected: {
      deletedRecordType: "equipment",
      fromEntityId: phase8CharacterId,
      toEntityId: phase8StorageId,
    },
  },
  {
    name: "store audit log suppresses same-entity inventory movement",
    actual: {
      moveOk: phase8SameEntityMoveResult.ok,
      moveAuditCount: phase8SameEntityMoveAuditCount,
    },
    expected: {
      moveOk: true,
      moveAuditCount: 0,
    },
  },
];

useAppStore.getState().resetLocalState();

const phase8BCharacterId = useAppStore.getState().createEntity({
  name: "Sheet Hero",
  entityType: "character",
});
const phase8BMountId = useAppStore.getState().createEntity({
  name: "Sheet Mule",
  entityType: "mount",
});
const phase8BInventoryCountBeforeUpdate =
  useAppStore.getState().appState.inventoryRecords.length;
const phase8BCharacterData = {
  ...createEmptyCharacterData(),
  className: "Cleric",
  level: 1,
  alignment: "Law" as const,
  xp: 150,
  hp: {
    current: 4,
    max: 6,
  },
  abilityScores: {
    str: 9,
    int: 10,
    wis: 13,
    dex: 8,
    con: 11,
    cha: 12,
  },
  skills: [
    {
      id: "skill-open-doors",
      name: "Open Doors",
      chanceInSix: 2,
      description: "Stuck doors",
    },
  ],
  languages: ["Common", "Lawful"],
  description: "Keeps careful notes.",
  features: [
    {
      id: "feature-turn-undead",
      title: "Turn Undead",
      description: "Manual note only.",
    },
  ],
};

const phase8BCharacterUpdateResult = phase8BCharacterId
  ? useAppStore
      .getState()
      .updateCharacterData(phase8BCharacterId, phase8BCharacterData)
  : { ok: false };
const phase8BInvalidSkillResult = phase8BCharacterId
  ? useAppStore.getState().updateCharacterData(phase8BCharacterId, {
      ...phase8BCharacterData,
      skills: [
        {
          id: "skill-invalid",
          name: "Listen",
          chanceInSix: 0,
        },
      ],
    })
  : { ok: false };
const phase8BMountUpdateResult = phase8BMountId
  ? useAppStore
      .getState()
      .updateCharacterData(phase8BMountId, phase8BCharacterData)
  : { ok: false };
const phase8BState = useAppStore.getState().appState;
const phase8BCharacter = phase8BState.entities.find(
  (entity) => entity.id === phase8BCharacterId,
);
const phase8BMount = phase8BState.entities.find(
  (entity) => entity.id === phase8BMountId,
);

export const PHASE_8B_STORE_MANUAL_FIXTURES = [
  {
    name: "store edits and persists basic character sheet fields without changing inventory",
    actual: {
      updateOk: phase8BCharacterUpdateResult.ok,
      className: phase8BCharacter?.character?.className,
      level: phase8BCharacter?.character?.level,
      alignment: phase8BCharacter?.character?.alignment,
      xp: phase8BCharacter?.character?.xp,
      hp: phase8BCharacter?.character?.hp,
      wis: phase8BCharacter?.character?.abilityScores.wis,
      languages: phase8BCharacter?.character?.languages,
      featureTitle: phase8BCharacter?.character?.features[0]?.title,
      skillChance: phase8BCharacter?.character?.skills[0]?.chanceInSix,
      inventoryCountUnchanged:
        phase8BInventoryCountBeforeUpdate ===
        phase8BState.inventoryRecords.length,
    },
    expected: {
      updateOk: true,
      className: "Cleric",
      level: 1,
      alignment: "Law",
      xp: 150,
      hp: {
        current: 4,
        max: 6,
      },
      wis: 13,
      languages: ["Common", "Lawful"],
      featureTitle: "Turn Undead",
      skillChance: 2,
      inventoryCountUnchanged: true,
    },
  },
  {
    name: "store prevents character sheet data on non-character entities and invalid skill chances",
    actual: {
      invalidSkillOk: phase8BInvalidSkillResult.ok,
      mountUpdateOk: phase8BMountUpdateResult.ok,
      mountHasCharacterData: phase8BMount?.character !== undefined,
      characterSkillChance: phase8BCharacter?.character?.skills[0]?.chanceInSix,
    },
    expected: {
      invalidSkillOk: false,
      mountUpdateOk: false,
      mountHasCharacterData: false,
      characterSkillChance: 2,
    },
  },
];

useAppStore.getState().resetLocalState();

const dndFirstEntityId = useAppStore.getState().createEntity({
  name: "First",
  entityType: "storage",
});
const dndSecondEntityId = useAppStore.getState().createEntity({
  name: "Second",
  entityType: "storage",
});
const dndThirdEntityId = useAppStore.getState().createEntity({
  name: "Third",
  entityType: "storage",
});

if (dndFirstEntityId) {
  useAppStore.getState().reorderEntity(dndFirstEntityId, 2);
}

const dndReorderedEntityNames = getSortedEntities(
  useAppStore.getState().appState.entities,
).map((entity) => entity.name);

useAppStore.getState().resetLocalState();

const dndStorageId = useAppStore.getState().createEntity({
  name: "Dnd Vault",
  entityType: "storage",
});
const dndSwapRecordA = dndStorageId
  ? useAppStore.getState().createInventoryRecord(dndStorageId, {
      recordType: "equipment",
      name: "Alpha",
      quantity: 1,
      burden: { kind: "fixed", slotsPerItem: 1 },
    })
  : { ok: false };
const dndSwapRecordB = dndStorageId
  ? useAppStore.getState().createInventoryRecord(dndStorageId, {
      recordType: "equipment",
      name: "Beta",
      quantity: 1,
      burden: { kind: "fixed", slotsPerItem: 1 },
    })
  : { ok: false };
const dndSwapRecordAId =
  dndSwapRecordA.ok && "recordId" in dndSwapRecordA
    ? dndSwapRecordA.recordId
    : undefined;
const dndSwapRecordBId =
  dndSwapRecordB.ok && "recordId" in dndSwapRecordB
    ? dndSwapRecordB.recordId
    : undefined;
const dndSwapResult =
  dndSwapRecordAId && dndSwapRecordBId
    ? useAppStore
        .getState()
        .swapInventoryRecords(dndSwapRecordAId, dndSwapRecordBId)
    : { ok: false, message: "Swap records were not created." };
const dndSwapOrder = useAppStore
  .getState()
  .appState.inventoryRecords.filter(
    (record) =>
      record.entityId === dndStorageId && record.location.kind === "contents",
  )
  .sort((left, right) => left.sortOrder - right.sortOrder)
  .map((record) => record.name);

const dndContainerResult = dndStorageId
  ? useAppStore.getState().createInventoryRecord(dndStorageId, {
      recordType: "equipment",
      name: "Box",
      quantity: 1,
      burden: { kind: "fixed", slotsPerItem: 1 },
      container: { capacitySlots: 4 },
    })
  : { ok: false };
const dndContainerRecordId =
  dndContainerResult.ok && "recordId" in dndContainerResult
    ? dndContainerResult.recordId
    : undefined;
const dndChildResult =
  dndStorageId && dndContainerRecordId
    ? useAppStore.getState().createInventoryRecord(dndStorageId, {
        recordType: "equipment",
        name: "Inside Box",
        quantity: 1,
        burden: { kind: "fixed", slotsPerItem: 1 },
        location: {
          entityId: dndStorageId,
          placement: "container",
          containerId: dndContainerRecordId,
        },
      })
    : { ok: false };
const dndChildRecordId =
  dndChildResult.ok && "recordId" in dndChildResult
    ? dndChildResult.recordId
    : undefined;
const dndInvalidSwapResult =
  dndContainerRecordId && dndChildRecordId
    ? useAppStore
        .getState()
        .swapInventoryRecords(dndContainerRecordId, dndChildRecordId)
    : { ok: false, message: "Invalid swap records were not created." };

export const PHASE_DND_STORE_MANUAL_FIXTURES = [
  {
    name: "store hidden reorderEntity reassigns entity sort order",
    actual: dndReorderedEntityNames,
    expected: ["Second", "Third", "First"],
  },
  {
    name: "store swaps inventory records and rejects container-descendant swaps",
    actual: {
      swapOk: dndSwapResult.ok,
      swapOrder: dndSwapOrder,
      invalidSwapOk: dndInvalidSwapResult.ok,
      invalidSwapMessage: dndInvalidSwapResult.ok
        ? undefined
        : dndInvalidSwapResult.message,
    },
    expected: {
      swapOk: true,
      swapOrder: ["Beta", "Alpha"],
      invalidSwapOk: false,
      invalidSwapMessage: "Cannot swap a container with its own contents.",
    },
  },
];

useAppStore.getState().resetLocalState();
useAppStore.setState({
  currentUserId: "user-1",
  userProfiles: [],
});
useAppStore.getState().updateCurrentUserProfile({
  displayName: "Morgan",
  role: "GM",
});
useAppStore.getState().createEntity({
  name: "Attributed Character",
  entityType: "character",
});
const attributedAuditEntry = useAppStore.getState().appState.auditLog[0];
const currentUserProfile = useAppStore.getState().userProfiles[0];

export const PHASE_2_STORE_MANUAL_FIXTURES = [
  {
    name: "store profiles current user and attributes audit entries",
    actual: {
      profile: currentUserProfile
        ? {
            id: currentUserProfile.id,
            displayName: currentUserProfile.displayName,
            role: currentUserProfile.role,
          }
        : undefined,
      auditActorLabel: attributedAuditEntry?.actorLabel,
      auditActorRole: attributedAuditEntry?.actorRole,
      auditActorUserId: attributedAuditEntry?.actorUserId,
    },
    expected: {
      profile: {
        id: "user-1",
        displayName: "Morgan",
        role: "GM",
      },
      auditActorLabel: "Morgan (GM)",
      auditActorRole: "GM",
      auditActorUserId: "user-1",
    },
  },
];

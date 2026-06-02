import { getSortedEntities } from "../model/entities";
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
        (record) => record.location.entityId === storageId,
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
    slotProfile: { kind: "fixed", slots: 1 },
  });
}

if (phase5MountId) {
  useAppStore.getState().createInventoryRecord(phase5MountId, {
    recordType: "treasure",
    name: "Trade goods",
    gpValue: 45,
    slotProfile: { kind: "fixed", slots: 2 },
  });
}

const phase5StateAfterDefaults = useAppStore.getState().appState;
const phase5CoinRecords = phase5StateAfterDefaults.inventoryRecords.filter(
  (record) =>
    record.recordType === "coins" &&
    record.location.entityId === phase5CharacterId,
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
let phase5MissingBackpackMoveOk = true;
let phase5InvalidHandOk = true;
let phase5NestedContainerMoveOk = true;
let phase5DeleteNonEmptyContainerOk = true;
let phase5CrossEntityDescendantEntityId: string | undefined;

if (phase5CharacterId) {
  const swordResult = useAppStore.getState().createInventoryRecord(
    phase5CharacterId,
    {
      recordType: "weapon",
      name: "Sword",
      weapon: { hands: "oneHand" },
      slotProfile: { kind: "fixed", slots: 1 },
    },
  );

  if (swordResult.ok && swordResult.recordId) {
    phase5BackpackMoveOk = useAppStore
      .getState()
      .moveInventoryRecord(swordResult.recordId, {
        entityId: phase5CharacterId,
        placement: "backpack",
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
          weapon: { hands: "oneHand" },
          slotProfile: { kind: "fixed", slots: 1 },
        },
      )
    : undefined;

  if (hammerResult?.ok && hammerResult.recordId && phase5NoBackpackCharacterId) {
    phase5MissingBackpackMoveOk = useAppStore
      .getState()
      .moveInventoryRecord(hammerResult.recordId, {
        entityId: phase5NoBackpackCharacterId,
        placement: "backpack",
      }).ok;
  }

  const spareBagResult = useAppStore.getState().createInventoryRecord(
    phase5CharacterId,
    {
      recordType: "equipment",
      name: "Spare Bag",
      slotProfile: { kind: "fixed", slots: 1 },
      container: { capacitySlots: 4 },
    },
  );

  useAppStore.getState().createInventoryRecord(phase5CharacterId, {
    recordType: "weapon",
    name: "Dagger",
    weapon: { hands: "oneHand" },
    slotProfile: { kind: "fixed", slots: 1 },
    location: { entityId: phase5CharacterId, placement: "leftHand" },
  });
  phase5InvalidHandOk = useAppStore
    .getState()
    .createInventoryRecord(phase5CharacterId, {
      recordType: "weapon",
      name: "Axe",
      weapon: { hands: "oneHand" },
      slotProfile: { kind: "fixed", slots: 1 },
      location: { entityId: phase5CharacterId, placement: "leftHand" },
    }).ok;

  const sackResult = useAppStore.getState().createInventoryRecord(
    phase5CharacterId,
    {
      recordType: "equipment",
      name: "Sack",
      slotProfile: { kind: "fixed", slots: 1 },
      container: { capacitySlots: 6 },
    },
  );

  if (sackResult.ok && sackResult.recordId) {
    useAppStore.getState().createInventoryRecord(phase5CharacterId, {
      recordType: "equipment",
      name: "Torch",
      slotProfile: { kind: "fixed", slots: 1 },
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
}

if (phase5StorageAId && phase5StorageBId) {
  const crateResult = useAppStore.getState().createInventoryRecord(
    phase5StorageAId,
    {
      recordType: "equipment",
      name: "Crate",
      slotProfile: { kind: "fixed", slots: 2 },
      container: { capacitySlots: 10 },
    },
  );

  if (crateResult.ok && crateResult.recordId) {
    const lanternResult = useAppStore.getState().createInventoryRecord(
      phase5StorageAId,
      {
        recordType: "equipment",
        name: "Lantern",
        slotProfile: { kind: "fixed", slots: 1 },
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
          )?.location.entityId;
    }
  }
}

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
        entityId: phase5CharacterId,
        locationType: "equipped",
        placement: "loose",
      },
      nonCharacterTreasureLocation: {
        entityId: phase5MountId,
        locationType: "contents",
        placement: "contents",
      },
    },
  },
  {
    name: "move validation blocks invalid backpack and hand states",
    actual: {
      backpackMoveOk: phase5BackpackMoveOk,
      missingBackpackMoveOk: phase5MissingBackpackMoveOk,
      invalidHandOk: phase5InvalidHandOk,
    },
    expected: {
      backpackMoveOk: true,
      missingBackpackMoveOk: false,
      invalidHandOk: false,
    },
  },
  {
    name: "non-empty containers cannot nest or delete",
    actual: {
      nestedContainerMoveOk: phase5NestedContainerMoveOk,
      deleteNonEmptyContainerOk: phase5DeleteNonEmptyContainerOk,
    },
    expected: {
      nestedContainerMoveOk: false,
      deleteNonEmptyContainerOk: false,
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
];

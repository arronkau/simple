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

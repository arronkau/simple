import { getDirectChildRecords } from "./calculations";
import { sortInventoryRecordsBySortOrder } from "./inventoryRecords";
import type { Entity, EntityId, InventoryRecord } from "./types";
import {
  findBackpackRecords,
  findTopLevelStowedContainerRecords,
  getHandOccupancy,
  isCharacterLikeEntity,
} from "./validation";

export type CharacterInventorySections = {
  mode: "characterLike";
  handRecordIds: {
    leftHand?: string;
    rightHand?: string;
    bothHands?: string;
  };
  otherEquipped: InventoryRecord[];
  coinRecord?: InventoryRecord;
  backpackRecord?: InventoryRecord;
  backpackRecords: InventoryRecord[];
  backpackContents: InventoryRecord[];
};

export type ContentsInventorySections = {
  mode: "contentsOnly";
  contents: InventoryRecord[];
};

export type InventorySections =
  | CharacterInventorySections
  | ContentsInventorySections;

export function getInventorySections(
  entity: Entity,
  records: InventoryRecord[],
): InventorySections {
  const ownedRecords = getOwnedRecords(entity.id, records);

  if (!isCharacterLikeEntity(entity)) {
    return {
      mode: "contentsOnly",
      contents: sortInventoryRecordsBySortOrder(
        ownedRecords.filter((record) => record.location.kind === "contents"),
      ),
    };
  }

  const backpackRecords = findBackpackRecords(entity.id, ownedRecords);
  const backpackRecord = findTopLevelStowedContainerRecords(
    entity.id,
    ownedRecords,
  )[0];
  const backpackRecordIds = new Set(
    backpackRecord ? [backpackRecord.id] : [],
  );

  return {
    mode: "characterLike",
    handRecordIds: getHandOccupancy(entity.id, ownedRecords),
    otherEquipped: sortInventoryRecordsBySortOrder(
      ownedRecords.filter(
        (record) =>
          record.location.kind === "equipped" &&
          record.location.placement === "loose" &&
          !backpackRecordIds.has(record.id),
      ),
    ),
    coinRecord: ownedRecords.find(
      (record) =>
        record.recordType === "coins" &&
        record.location.kind === "coinPurse",
    ),
    backpackRecord,
    backpackRecords,
    backpackContents: backpackRecord
      ? sortInventoryRecordsBySortOrder(
          getDirectChildRecords(backpackRecord.id, ownedRecords),
        )
      : [],
  };
}

export function getOwnedRecords(
  entityId: EntityId,
  records: InventoryRecord[],
): InventoryRecord[] {
  return records.filter((record) => record.entityId === entityId);
}

export function getRecordById(
  recordId: string | undefined,
  records: InventoryRecord[],
): InventoryRecord | undefined {
  if (!recordId) {
    return undefined;
  }

  return records.find((record) => record.id === recordId);
}

export function getContainerContents(
  containerRecord: InventoryRecord,
  records: InventoryRecord[],
): InventoryRecord[] {
  return sortInventoryRecordsBySortOrder(
    getDirectChildRecords(containerRecord.id, records),
  );
}

import { getDirectChildRecords } from "./calculations";
import {
  findBackpackRecords,
  isCharacterLikeEntity,
} from "./validation";
import type {
  ArmorData,
  CoinData,
  ContainerBurdenMode,
  ContainerData,
  Entity,
  EntityId,
  InventoryLocation,
  InventoryRecord,
  InventoryRecordId,
  InventoryRecordType,
  NonCoinSlotProfile,
  WeaponData,
} from "./types";

export type InventoryRecordPlacementKey =
  | "default"
  | "equippedLoose"
  | "leftHand"
  | "rightHand"
  | "bothHands"
  | "coinPurse"
  | "backpack"
  | "contents"
  | "container";

export type InventoryRecordLocationInput = {
  entityId: EntityId;
  placement: InventoryRecordPlacementKey;
  containerId?: InventoryRecordId;
};

export type InventoryRecordFormInput = {
  recordType: InventoryRecordType;
  name?: string;
  description?: string;
  coins?: Partial<CoinData>;
  gpValue?: number;
  weapon?: Partial<WeaponData>;
  armor?: Partial<ArmorData>;
  slotProfile?: NonCoinSlotProfile;
  container?: Partial<ContainerData>;
  location?: InventoryRecordLocationInput;
};

export type CreateInventoryRecordInput = {
  entity: Entity;
  id: InventoryRecordId;
  records: InventoryRecord[];
  input: InventoryRecordFormInput;
};

export type UpdateInventoryRecordInput = {
  record: InventoryRecord;
  records: InventoryRecord[];
  entity: Entity;
  input: InventoryRecordFormInput;
};

export type MoveInventoryRecordInput = {
  recordId: InventoryRecordId;
  records: InventoryRecord[];
  location: InventoryLocation;
};

export type InventoryRecordBuildResult =
  | { ok: true; record: InventoryRecord }
  | { ok: false; message: string };

export type InventoryLocationBuildResult =
  | { ok: true; location: InventoryLocation }
  | { ok: false; message: string };

const EMPTY_COINS: CoinData = {
  pp: 0,
  gp: 0,
  sp: 0,
  cp: 0,
};

export function createInventoryRecordFromInput({
  entity,
  id,
  records,
  input,
}: CreateInventoryRecordInput): InventoryRecordBuildResult {
  const locationResult = createInventoryLocation({
    entity,
    recordType: input.recordType,
    records,
    location: input.location,
  });

  if (!locationResult.ok) {
    return locationResult;
  }

  const sortOrder = getNextInventoryRecordSortOrder(
    records,
    locationResult.location.entityId,
  );

  return buildInventoryRecord({
    id,
    input,
    location: locationResult.location,
    sortOrder,
  });
}

export function updateInventoryRecordFromInput({
  record,
  records,
  entity,
  input,
}: UpdateInventoryRecordInput): InventoryRecordBuildResult {
  if (record.recordType !== input.recordType) {
    return {
      ok: false,
      message: "Inventory record type cannot be changed while editing.",
    };
  }

  const locationResult = createInventoryLocation({
    entity,
    recordType: input.recordType,
    records,
    location: input.location,
    editingRecordId: record.id,
  });

  if (!locationResult.ok) {
    return locationResult;
  }

  return buildInventoryRecord({
    id: record.id,
    input,
    location: locationResult.location,
    sortOrder: record.sortOrder,
  });
}

export function createInventoryLocation({
  entity,
  recordType,
  records,
  location,
  editingRecordId,
}: {
  entity: Entity;
  recordType: InventoryRecordType;
  records: InventoryRecord[];
  location?: InventoryRecordLocationInput;
  editingRecordId?: InventoryRecordId;
}): InventoryLocationBuildResult {
  const placement = location?.placement ?? "default";

  if (recordType === "coins") {
    if (isCharacterLikeEntity(entity)) {
      return {
        ok: true,
        location: {
          entityId: entity.id,
          locationType: "stowed",
          placement: "coinPurse",
        },
      };
    }

    if (placement === "container") {
      const containerIdResult = getUsableContainerId({
        entity,
        records,
        containerId: location?.containerId,
        editingRecordId,
      });

      if (!containerIdResult.ok) {
        return containerIdResult;
      }

      return {
        ok: true,
        location: {
          entityId: entity.id,
          locationType: "contents",
          placement: "container",
          containerId: containerIdResult.containerId,
        },
      };
    }

    return {
      ok: true,
      location: {
        entityId: entity.id,
        locationType: "contents",
        placement: "contents",
      },
    };
  }

  if (!isCharacterLikeEntity(entity)) {
    if (placement === "container") {
      const containerIdResult = getUsableContainerId({
        entity,
        records,
        containerId: location?.containerId,
        editingRecordId,
      });

      if (!containerIdResult.ok) {
        return containerIdResult;
      }

      return {
        ok: true,
        location: {
          entityId: entity.id,
          locationType: "contents",
          placement: "container",
          containerId: containerIdResult.containerId,
        },
      };
    }

    return {
      ok: true,
      location: {
        entityId: entity.id,
        locationType: "contents",
        placement: "contents",
      },
    };
  }

  switch (placement) {
    case "leftHand":
    case "rightHand":
    case "bothHands":
      return {
        ok: true,
        location: {
          entityId: entity.id,
          locationType: "equipped",
          placement,
        },
      };
    case "backpack": {
      const backpackRecord = findBackpackRecords(entity.id, records).find(
        (candidateRecord) => candidateRecord.id !== editingRecordId,
      );

      if (!backpackRecord) {
        return {
          ok: false,
          message: "This entity does not have a backpack.",
        };
      }

      return {
        ok: true,
        location: {
          entityId: entity.id,
          locationType: "stowed",
          placement: "backpack",
          containerId: backpackRecord.id,
        },
      };
    }
    case "container": {
      const containerIdResult = getUsableContainerId({
        entity,
        records,
        containerId: location?.containerId,
        editingRecordId,
      });

      if (!containerIdResult.ok) {
        return containerIdResult;
      }

      return {
        ok: true,
        location: {
          entityId: entity.id,
          locationType: "stowed",
          placement: "container",
          containerId: containerIdResult.containerId,
        },
      };
    }
    case "default":
    case "equippedLoose":
    case "coinPurse":
    case "contents":
      return {
        ok: true,
        location: {
          entityId: entity.id,
          locationType: "equipped",
          placement: "loose",
        },
      };
  }
}

export function moveInventoryRecord({
  recordId,
  records,
  location,
}: MoveInventoryRecordInput): InventoryRecord[] {
  const record = records.find(
    (candidateRecord) => candidateRecord.id === recordId,
  );

  if (!record) {
    return records;
  }

  const descendantRecordIds = getDescendantRecordIds(recordId, records);
  const targetEntityId = location.entityId;
  const sortOrder = getNextInventoryRecordSortOrder(records, targetEntityId);

  return records.map((candidateRecord) => {
    if (candidateRecord.id === recordId) {
      return {
        ...candidateRecord,
        location,
        sortOrder,
      };
    }

    if (descendantRecordIds.has(candidateRecord.id)) {
      return {
        ...candidateRecord,
        location: {
          ...candidateRecord.location,
          entityId: targetEntityId,
        } as InventoryLocation,
      };
    }

    return candidateRecord;
  });
}

export function mergeCoinData(
  currentCoins: CoinData,
  addedCoins: Partial<CoinData> | undefined,
): CoinData {
  const normalizedCoins = normalizeCoins(addedCoins);

  return {
    pp: currentCoins.pp + normalizedCoins.pp,
    gp: currentCoins.gp + normalizedCoins.gp,
    sp: currentCoins.sp + normalizedCoins.sp,
    cp: currentCoins.cp + normalizedCoins.cp,
  };
}

export function getCharacterCoinRecord(
  entityId: EntityId,
  records: InventoryRecord[],
): InventoryRecord | undefined {
  return records.find(
    (record) =>
      record.recordType === "coins" &&
      record.location.entityId === entityId &&
      record.location.locationType === "stowed" &&
      record.location.placement === "coinPurse",
  );
}

export function isContainerRecordEmpty(
  recordId: InventoryRecordId,
  records: InventoryRecord[],
): boolean {
  return getDirectChildRecords(recordId, records).length === 0;
}

export function getMoveDescendantRecordIds(
  recordId: InventoryRecordId,
  records: InventoryRecord[],
): Set<InventoryRecordId> {
  return getDescendantRecordIds(recordId, records);
}

export function getLocationPlacementKey(
  location: InventoryLocation,
): InventoryRecordPlacementKey {
  if (location.locationType === "equipped") {
    return location.placement === "loose" ? "equippedLoose" : location.placement;
  }

  if (location.locationType === "stowed") {
    return location.placement;
  }

  return location.placement;
}

function buildInventoryRecord({
  id,
  input,
  location,
  sortOrder,
}: {
  id: InventoryRecordId;
  input: InventoryRecordFormInput;
  location: InventoryLocation;
  sortOrder: number;
}): InventoryRecordBuildResult {
  const description = normalizeOptionalText(input.description);

  if (input.recordType === "coins") {
    return {
      ok: true,
      record: {
        id,
        recordType: "coins",
        location,
        sortOrder,
        slotProfile: { kind: "coins" },
        coins: normalizeCoins(input.coins),
        ...(description ? { description } : {}),
      },
    };
  }

  const name = input.name?.trim() ?? "";

  if (name.length === 0) {
    return {
      ok: false,
      message: "Name is required.",
    };
  }

  const slotProfile = normalizeSlotProfile(input.slotProfile);
  const container = normalizeContainer(input.container);
  const shared = {
    id,
    name,
    location,
    sortOrder,
    slotProfile,
    ...(description ? { description } : {}),
    ...(container ? { container } : {}),
  };

  switch (input.recordType) {
    case "treasure":
      return {
        ok: true,
        record: {
          ...shared,
          recordType: "treasure",
          treasure: {
            gpValue: normalizeNumber(input.gpValue, 0),
          },
        },
      };
    case "weapon":
      return {
        ok: true,
        record: {
          ...shared,
          recordType: "weapon",
          weapon: {
            hands: input.weapon?.hands ?? "oneHand",
            ...(normalizeOptionalText(input.weapon?.damage)
              ? { damage: normalizeOptionalText(input.weapon?.damage) }
              : {}),
            ...(normalizeOptionalText(input.weapon?.range)
              ? { range: normalizeOptionalText(input.weapon?.range) }
              : {}),
          },
        },
      };
    case "armor":
      return {
        ok: true,
        record: {
          ...shared,
          recordType: "armor",
          armor: {
            ...(input.armor?.baseArmorClass !== undefined
              ? { baseArmorClass: normalizeNumber(input.armor.baseArmorClass, 0) }
              : {}),
            ...(input.armor?.armorBonus !== undefined
              ? { armorBonus: normalizeNumber(input.armor.armorBonus, 0) }
              : {}),
          },
        },
      };
    case "equipment":
      return {
        ok: true,
        record: {
          ...shared,
          recordType: "equipment",
        },
      };
  }
}

function getUsableContainerId({
  entity,
  records,
  containerId,
  editingRecordId,
}: {
  entity: Entity;
  records: InventoryRecord[];
  containerId: InventoryRecordId | undefined;
  editingRecordId: InventoryRecordId | undefined;
}): { ok: true; containerId: InventoryRecordId } | { ok: false; message: string } {
  if (!containerId) {
    return {
      ok: false,
      message: "Container placement requires a container.",
    };
  }

  const containerRecord = records.find((record) => record.id === containerId);

  if (
    !containerRecord ||
    !containerRecord.container ||
    containerRecord.location.entityId !== entity.id ||
    containerRecord.id === editingRecordId
  ) {
    return {
      ok: false,
      message: "Selected container is not available.",
    };
  }

  return {
    ok: true,
    containerId: containerRecord.id,
  };
}

function getNextInventoryRecordSortOrder(
  records: InventoryRecord[],
  entityId: EntityId,
): number {
  const entityRecords = records.filter(
    (record) => record.location.entityId === entityId,
  );

  if (entityRecords.length === 0) {
    return 0;
  }

  return Math.max(...entityRecords.map((record) => record.sortOrder)) + 1000;
}

function getDescendantRecordIds(
  recordId: InventoryRecordId,
  records: InventoryRecord[],
): Set<InventoryRecordId> {
  const descendantRecordIds = new Set<InventoryRecordId>();
  const pendingRecordIds = [recordId];

  while (pendingRecordIds.length > 0) {
    const currentRecordId = pendingRecordIds.pop();

    if (!currentRecordId) {
      continue;
    }

    for (const childRecord of getDirectChildRecords(currentRecordId, records)) {
      if (!descendantRecordIds.has(childRecord.id)) {
        descendantRecordIds.add(childRecord.id);
        pendingRecordIds.push(childRecord.id);
      }
    }
  }

  return descendantRecordIds;
}

function normalizeCoins(coins: Partial<CoinData> | undefined): CoinData {
  return {
    pp: normalizeInteger(coins?.pp, EMPTY_COINS.pp),
    gp: normalizeInteger(coins?.gp, EMPTY_COINS.gp),
    sp: normalizeInteger(coins?.sp, EMPTY_COINS.sp),
    cp: normalizeInteger(coins?.cp, EMPTY_COINS.cp),
  };
}

function normalizeSlotProfile(
  slotProfile: NonCoinSlotProfile | undefined,
): NonCoinSlotProfile {
  if (slotProfile?.kind === "stackable") {
    return {
      kind: "stackable",
      quantity: Math.max(0, normalizeInteger(slotProfile.quantity, 1)),
      perSlot: Math.max(1, normalizeInteger(slotProfile.perSlot, 1)),
    };
  }

  return {
    kind: "fixed",
    slots: Math.max(0, normalizeNumber(slotProfile?.slots, 1)),
  };
}

function normalizeContainer(
  container: Partial<ContainerData> | undefined,
): ContainerData | undefined {
  if (!container) {
    return undefined;
  }

  return {
    capacitySlots: Math.max(0, normalizeNumber(container.capacitySlots, 0)),
    handsRequired: normalizeHandsRequired(container.handsRequired),
    ...(container.isBackpack ? { isBackpack: true } : {}),
    ...(container.burdenMode
      ? { burdenMode: container.burdenMode as ContainerBurdenMode }
      : {}),
  };
}

function normalizeHandsRequired(value: ContainerData["handsRequired"]): 0 | 1 | 2 {
  if (value === 1 || value === 2) {
    return value;
  }

  return 0;
}

function normalizeNumber(value: number | undefined, fallback: number): number {
  if (value === undefined || Number.isNaN(value)) {
    return fallback;
  }

  return value;
}

function normalizeInteger(value: number | undefined, fallback: number): number {
  return Math.max(0, Math.floor(normalizeNumber(value, fallback)));
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalizedValue = value?.trim();

  return normalizedValue && normalizedValue.length > 0
    ? normalizedValue
    : undefined;
}

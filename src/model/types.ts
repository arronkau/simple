export type EntityId = string;
export type InventoryRecordId = string;
export type ISODateTimeString = string;

export type EntityType =
  | "character"
  | "retainer"
  | "mount"
  | "vehicle"
  | "storage";

export type CharacterData = {
  className?: string;
  level?: number;
  hpCurrent?: number;
  hpMax?: number;
  armorClass?: number;
  xp?: number;
  alignment?: string;
  languages?: string[];
};

export type Entity = {
  id: EntityId;
  name: string;
  entityType: EntityType;
  active: boolean;
  sortOrder: number;

  capacitySlots?: number;
  baseMovementFeet?: number;

  character?: CharacterData;

  notes?: string;
  createdAt?: ISODateTimeString;
  updatedAt?: ISODateTimeString;
};

export type InventoryRecordType =
  | "coins"
  | "treasure"
  | "weapon"
  | "armor"
  | "equipment";

export type EquippedPlacement =
  | "leftHand"
  | "rightHand"
  | "bothHands"
  | "loose";

export type CharacterStowedPlacement =
  | "coinPurse"
  | "backpack"
  | "container";

export type ContentsPlacement = "contents" | "container";

export type InventoryLocation =
  | {
      entityId: EntityId;
      locationType: "equipped";
      placement: EquippedPlacement;
    }
  | {
      entityId: EntityId;
      locationType: "stowed";
      placement: "coinPurse";
    }
  | {
      entityId: EntityId;
      locationType: "stowed";
      placement: "backpack";
      containerId: InventoryRecordId;
    }
  | {
      entityId: EntityId;
      locationType: "stowed";
      placement: "container";
      containerId: InventoryRecordId;
    }
  | {
      entityId: EntityId;
      locationType: "contents";
      placement: "contents";
    }
  | {
      entityId: EntityId;
      locationType: "contents";
      placement: "container";
      containerId: InventoryRecordId;
    };

export type FixedSlotProfile = {
  kind: "fixed";
  slots: number;
};

export type StackableSlotProfile = {
  kind: "stackable";
  quantity: number;
  perSlot: number;
};

export type CoinSlotProfile = {
  kind: "coins";
};

export type SlotProfile =
  | FixedSlotProfile
  | StackableSlotProfile
  | CoinSlotProfile;

export type NonCoinSlotProfile = FixedSlotProfile | StackableSlotProfile;

export type CoinData = {
  pp: number;
  gp: number;
  sp: number;
  cp: number;
};

export type TreasureData = {
  gpValue: number;
};

export type WeaponHands = "oneHand" | "twoHands";

export type WeaponData = {
  damage?: string;
  hands: WeaponHands;
  range?: string;
  qualities?: string[];
};

export type ArmorData = {
  baseArmorClass?: number;
  armorBonus?: number;
};

export type ContainerBurdenMode =
  | "contentsOnlyWhenLoaded"
  | "containerPlusContents"
  | "fixedOnly";

export type ContainerData = {
  capacitySlots: number;
  handsRequired?: 0 | 1 | 2;
  isBackpack?: boolean;
  burdenMode?: ContainerBurdenMode;
};

export type IdentificationData = {
  identified: boolean;
  unidentifiedName?: string;
  unidentifiedDescription?: string;
};

export type UsesData = {
  current: number;
  max?: number;
};

export type LightData = {
  isLit: boolean;
  turnsRemaining?: number;
};

export type KnownModifierTarget =
  | "armorClass"
  | "attack"
  | "damage"
  | "savingThrow"
  | "ability"
  | "skill"
  | "movement";

export type Modifier = {
  target: KnownModifierTarget | (string & {});
  value: number;
  label?: string;
};

type InventoryRecordShared = {
  id: InventoryRecordId;
  description?: string;
  location: InventoryLocation;
  sortOrder: number;
  uses?: UsesData;
  light?: LightData;
  modifiers?: Modifier[];
  notes?: string;
  createdAt?: ISODateTimeString;
  updatedAt?: ISODateTimeString;
};

export type CoinsRecord = InventoryRecordShared & {
  recordType: "coins";
  name?: string;
  slotProfile: CoinSlotProfile;
  coins: CoinData;
  treasure?: never;
  weapon?: never;
  armor?: never;
  container?: never;
  identification?: never;
};

export type TreasureRecord = InventoryRecordShared & {
  recordType: "treasure";
  name: string;
  slotProfile: NonCoinSlotProfile;
  treasure: TreasureData;
  container?: ContainerData;
  coins?: never;
  weapon?: never;
  armor?: never;
  identification?: never;
};

export type WeaponRecord = InventoryRecordShared & {
  recordType: "weapon";
  name: string;
  slotProfile: NonCoinSlotProfile;
  weapon: WeaponData;
  container?: ContainerData;
  identification?: IdentificationData;
  coins?: never;
  treasure?: never;
  armor?: never;
};

export type ArmorRecord = InventoryRecordShared & {
  recordType: "armor";
  name: string;
  slotProfile: NonCoinSlotProfile;
  armor: ArmorData;
  container?: ContainerData;
  identification?: IdentificationData;
  coins?: never;
  treasure?: never;
  weapon?: never;
};

export type EquipmentRecord = InventoryRecordShared & {
  recordType: "equipment";
  name: string;
  slotProfile: NonCoinSlotProfile;
  container?: ContainerData;
  identification?: IdentificationData;
  coins?: never;
  treasure?: never;
  weapon?: never;
  armor?: never;
};

export type InventoryRecord =
  | CoinsRecord
  | TreasureRecord
  | WeaponRecord
  | ArmorRecord
  | EquipmentRecord;

export type CreateDefaultBackpackInput = {
  entityId: EntityId;
  id: InventoryRecordId;
  sortOrder?: number;
};

export function createDefaultBackpack({
  entityId,
  id,
  sortOrder = 0,
}: CreateDefaultBackpackInput): InventoryRecord {
  return {
    id,
    recordType: "equipment",
    name: "Backpack",
    location: {
      entityId,
      locationType: "equipped",
      placement: "loose",
    },
    sortOrder,
    slotProfile: { kind: "fixed", slots: 1 },
    container: {
      capacitySlots: 16,
      handsRequired: 0,
      isBackpack: true,
      burdenMode: "contentsOnlyWhenLoaded",
    },
  };
}

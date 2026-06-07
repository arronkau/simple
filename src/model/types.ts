export type EntityId = string;
export type InventoryRecordId = string;
export type ISODateTimeString = string;

export type AuditLogEntryId = string;
export type UserId = string;
export type UserRole = "GM" | "Player";

export type AuditEventType =
  | "entityCreated"
  | "entityDeleted"
  | "entityActivated"
  | "entityDeactivated"
  | "inventoryRecordCreated"
  | "inventoryRecordDeleted"
  | "inventoryRecordIdentified"
  | "inventoryRecordMoved"
  | "coinsChanged"
  | "treasureValueChanged";

export type AuditLogDetailValue = string | number | boolean | null;

export type AuditLogEntry = {
  id: AuditLogEntryId;
  createdAt: ISODateTimeString;
  actorLabel: string;
  actorRole?: UserRole;
  actorUserId?: UserId;
  eventType: AuditEventType;
  entityId?: EntityId;
  recordId?: InventoryRecordId;
  summary: string;
  details?: Record<string, AuditLogDetailValue>;
};

export type UserProfile = {
  id: UserId;
  displayName: string;
  role: UserRole;
  updatedAt?: ISODateTimeString;
};

export type EntityType =
  | "character"
  | "retainer"
  | "mount"
  | "vehicle"
  | "storage";

export type AbilityScores = {
  strength: number | null;
  intelligence: number | null;
  wisdom: number | null;
  dexterity: number | null;
  constitution: number | null;
  charisma: number | null;
};

export type CharacterAlignment = "Law" | "Neutrality" | "Chaos" | "";

export type CharacterSkill = {
  id: string;
  name: string;
  chanceInSix: number;
  description?: string;
};

export type CharacterFeature = {
  id: string;
  name: string;
  description: string;
};

export type CharacterData = {
  className: string;
  level: number | null;
  alignment: CharacterAlignment;
  xp: number | null;
  hp: {
    current: number | null;
    max: number | null;
  };
  armorClass: {
    modifier: number;
    override: number | null;
  };
  abilityScores: AbilityScores;
  skills: CharacterSkill[];
  languages: string[];
  description: string;
  features: CharacterFeature[];
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

export type InventoryLocation =
  | {
      kind: "equipped";
      placement: EquippedPlacement;
    }
  | {
      kind: "stowedRoot";
    }
  | {
      kind: "coinPurse";
    }
  | {
      kind: "contents";
    }
  | {
      kind: "container";
      containerId: InventoryRecordId;
    };

export type FixedInventoryBurden = {
  kind: "fixed";
  slotsPerItem: number;
};

export type StackedInventoryBurden = {
  kind: "stacked";
  itemsPerSlot: number;
};

export type NoInventoryBurden = {
  kind: "none";
};

export type InventoryBurden =
  | FixedInventoryBurden
  | StackedInventoryBurden
  | NoInventoryBurden;

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
export type HandsRequired = 0 | 1 | 2;

export type WeaponData = {
  damage?: string;
  /** @deprecated Use the record-level handsRequired field. */
  hands?: WeaponHands;
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
  /** @deprecated Use the record-level handsRequired field. */
  handsRequired?: 0 | 1 | 2;
  /** @deprecated Containers always count own slots plus contents. */
  burdenMode?: ContainerBurdenMode;
};

export type IdentificationData = {
  identified: boolean;
  secretName?: string;
  secretDescription?: string;
};

export type UsesData = {
  current: number;
  max?: number;
};

export type LightData = {
  isLit: boolean;
  lightDescription?: string;
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
  entityId: EntityId;
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

type NonCoinInventoryRecordShared = InventoryRecordShared & {
  quantity: number;
  burden: InventoryBurden;
  handsRequired?: HandsRequired;
};

export type CoinsRecord = InventoryRecordShared & {
  recordType: "coins";
  name?: string;
  coins: CoinData;
  treasure?: never;
  weapon?: never;
  armor?: never;
  container?: never;
  identification?: never;
};

export type TreasureRecord = NonCoinInventoryRecordShared & {
  recordType: "treasure";
  name: string;
  treasure: TreasureData;
  container?: never;
  coins?: never;
  weapon?: never;
  armor?: never;
  identification?: never;
};

export type WeaponRecord = NonCoinInventoryRecordShared & {
  recordType: "weapon";
  name: string;
  weapon: WeaponData;
  container?: ContainerData;
  identification?: IdentificationData;
  coins?: never;
  treasure?: never;
  armor?: never;
};

export type ArmorRecord = NonCoinInventoryRecordShared & {
  recordType: "armor";
  name: string;
  armor: ArmorData;
  container?: ContainerData;
  identification?: IdentificationData;
  coins?: never;
  treasure?: never;
  weapon?: never;
};

export type EquipmentRecord = NonCoinInventoryRecordShared & {
  recordType: "equipment";
  name: string;
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
    entityId,
    recordType: "equipment",
    name: "Backpack",
    location: {
      kind: "stowedRoot",
    },
    sortOrder,
    quantity: 1,
    burden: { kind: "fixed", slotsPerItem: 1 },
    handsRequired: 0,
    container: {
      capacitySlots: 16,
    },
  };
}

export function getRecordHandsRequired(record: InventoryRecord): HandsRequired {
  if (record.recordType === "coins") {
    return 0;
  }

  const recordHandsRequired = coerceHandsRequired(record.handsRequired);

  if (recordHandsRequired !== undefined) {
    return recordHandsRequired;
  }

  if (record.recordType === "weapon") {
    if (record.weapon.hands === "twoHands") {
      return 2;
    }

    if (record.weapon.hands === "oneHand") {
      return 1;
    }
  }

  return normalizeHandsRequired(record.container?.handsRequired);
}

export function getEquippedHandsUsed(
  location: InventoryLocation,
): HandsRequired | undefined {
  if (location.kind !== "equipped") {
    return undefined;
  }

  switch (location.placement) {
    case "bothHands":
      return 2;
    case "leftHand":
    case "rightHand":
      return 1;
    case "loose":
      return 0;
  }
}

export function isRecordHandsRequirementSatisfied(
  record: InventoryRecord,
): boolean {
  const equippedHandsUsed = getEquippedHandsUsed(record.location);

  return (
    equippedHandsUsed !== undefined &&
    equippedHandsUsed >= getRecordHandsRequired(record)
  );
}

export function normalizeHandsRequired(
  value: unknown,
  fallback: HandsRequired = 0,
): HandsRequired {
  return coerceHandsRequired(value) ?? fallback;
}

function coerceHandsRequired(value: unknown): HandsRequired | undefined {
  if (value === 0 || value === 1 || value === 2) {
    return value;
  }

  return undefined;
}

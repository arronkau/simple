import { ABILITY_SCORE_KEYS } from "./model/characters";
import type { AppState } from "./model/appState";
import type { EncumbranceWarning } from "./model/encumbrance";
import type {
  InventoryRecordPlacementKey,
} from "./model/inventoryRecords";
import type {
  CharacterAlignment,
  CoinData,
  Entity,
  EntityId,
  EntityType,
  InventoryRecord,
  InventoryRecordId,
  InventoryRecordType,
  KnownModifierTarget,
  UserRole,
} from "./model/types";
import type { ValidationIssue } from "./model/validation";
import type { CoinDenomination } from "./store/useAppStore";

export type EntityFormState = {
  name: string;
  entityType: EntityType;
};

export const EMPTY_ENTITY_FORM: EntityFormState = {
  name: "",
  entityType: "character",
};

export const RECORD_TYPE_LABELS: Record<InventoryRecordType, string> = {
  coins: "Coins",
  treasure: "Treasure",
  weapon: "Weapon",
  armor: "Armor",
  equipment: "Equipment",
};

export const RECORD_TYPES: InventoryRecordType[] = [
  "equipment",
  "coins",
  "treasure",
  "weapon",
  "armor",
];

export const COIN_DENOMINATIONS: CoinDenomination[] = ["pp", "gp", "sp", "cp"];

export const EMPTY_COINS: CoinData = {
  pp: 0,
  gp: 0,
  sp: 0,
  cp: 0,
};

export const MODIFIER_TARGET_OPTIONS: Array<{
  label: string;
  value:
    | KnownModifierTarget
    | "ability:str"
    | "ability:int"
    | "ability:wis"
    | "ability:dex"
    | "ability:con"
    | "ability:cha"
    | "other";
}> = [
  { label: "AC", value: "armorClass" },
  { label: "Attack", value: "attack" },
  { label: "Damage", value: "damage" },
  { label: "Saves", value: "savingThrow" },
  { label: "Strength", value: "ability:str" },
  { label: "Intelligence", value: "ability:int" },
  { label: "Wisdom", value: "ability:wis" },
  { label: "Dexterity", value: "ability:dex" },
  { label: "Constitution", value: "ability:con" },
  { label: "Charisma", value: "ability:cha" },
  { label: "Movement", value: "movement" },
  { label: "Other", value: "other" },
];

export type ModifierFormRow = {
  id: string;
  target: string;
  value: string;
  label: string;
};

export type RecordFormState = {
  mode: "create" | "edit";
  entityId: EntityId;
  recordId?: InventoryRecordId;
  recordType: InventoryRecordType;
  targetEntityId: EntityId;
  placement: InventoryRecordPlacementKey;
  containerId: InventoryRecordId | "";
  name: string;
  description: string;
  pp: string;
  gp: string;
  sp: string;
  cp: string;
  gpValue: string;
  damage: string;
  range: string;
  baseArmorClass: string;
  armorBonus: string;
  stackable: boolean;
  quantity: string;
  slotsPerItem: string;
  itemsPerSlot: string;
  showMovement: boolean;
  isContainer: boolean;
  capacitySlots: string;
  handsRequired: "0" | "1" | "2";
  isMagic: boolean;
  isUnidentified: boolean;
  secretName: string;
  secretDescription: string;
  isLight: boolean;
  lightDescription: string;
  isLit: boolean;
  trackUses: boolean;
  usesCurrent: string;
  usesMax: string;
  addModifiers: boolean;
  modifiers: ModifierFormRow[];
  notesEnabled: boolean;
  notes: string;
  addWeaponQualities: boolean;
  qualities: string;
};

export type AbilityScoreKey = (typeof ABILITY_SCORE_KEYS)[number];

export type CharacterSkillFormState = {
  id: string;
  name: string;
  chanceInSix: string;
  description: string;
};

export type CharacterFeatureFormState = {
  id: string;
  name: string;
  description: string;
};

export type CharacterSheetFormState = {
  className: string;
  level: string;
  alignment: CharacterAlignment;
  xp: string;
  hpCurrent: string;
  hpMax: string;
  armorClassModifier: string;
  armorClassOverride: string;
  abilityScores: Record<AbilityScoreKey, string>;
  skills: CharacterSkillFormState[];
  languagesText: string;
  description: string;
  features: CharacterFeatureFormState[];
};

export type CoinSpendFormState = {
  recordId: InventoryRecordId;
  amounts: Record<CoinDenomination, string>;
  note: string;
};

export type CoinTransferFormState = {
  sourceEntityId: EntityId;
  destinationEntityId: EntityId;
  amounts: Record<CoinDenomination, string>;
  note: string;
};

export type ManageMessage = {
  tone: "error" | "success";
  text: string;
};

export type UserProfileFormState = {
  displayName: string;
  role: UserRole;
};

export type DeleteConfirmationState =
  | {
      kind: "entity";
      entity: Entity;
    }
  | {
      kind: "record";
      record: InventoryRecord;
    };

export type AppStateExport = {
  version: 1;
  exportedAt: string;
  data: AppState;
};

export type PartyAbilityScoreDisplay = {
  label: string;
  value: string;
};

export type PartyOverviewCard = {
  abilityScores: PartyAbilityScoreDisplay[];
  ac: string;
  id: EntityId;
  name: string;
  entityType: EntityType;
  classLevel: string;
  hp: string;
  hurt: boolean;
  movement: string;
  movementFeet: number;
  languages: string;
  hands: string[];
  validationIssues: ValidationIssue[];
  warningCount: number;
  warningSummary: string;
  warnings: EncumbranceWarning[];
};

export function createFormRowId(
  prefix: "feature" | "modifier" | "skill",
): string {
  const randomId =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  return `${prefix}-${randomId}`;
}

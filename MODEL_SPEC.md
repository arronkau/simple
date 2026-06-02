# Model Spec

## Goal

Define a simple model for a table-usable TTRPG character and inventory tracker.

The model uses two primary concepts:

1. **Entity** — a character, retainer, mount, vehicle, or storage location that can own or carry inventory.
2. **InventoryRecord** — a concrete inventory instance, stack, coin pile, treasure object, weapon, armor, equipment item, or container.

---

# Entity Model

## Entity Type

```ts
type EntityType =
  | "character"
  | "retainer"
  | "mount"
  | "vehicle"
  | "storage";
```

## Entity

```ts
type Entity = {
  id: string;
  type: EntityType;
  name: string;

  active: boolean;

  capacitySlots?: number;

  character?: CharacterData;
  movement?: MovementData;

  notes?: string;
  sortOrder?: number;
};
```

## `id`

Unique identifier for the entity.

Used by `InventoryLocation.entityId`.

## `type`

The kind of entity.

Allowed values:

```ts
"character" | "retainer" | "mount" | "vehicle" | "storage"
```

## `name`

Display name for the entity.

Examples:

```ts
"Yost"
"Mal"
"Mule"
"Wagon"
"Townhouse Storage"
```

## `active`

Whether this entity is currently active in the party view.

Inactive entities remain stored but may be hidden or collapsed by default.

## `capacitySlots`

Optional total inventory capacity for the entity.

Typical use:

- Mounts
- Vehicles
- Storage locations
- Special retainers or constrained carriers

Characters and retainers may derive capacity from rules instead of storing it directly.

## `character`

Optional character data.

Used by character-like entities only:

- `character`
- `retainer`

Mounts, vehicles, and storage usually omit this.

## `movement`

Optional movement data.

Used when an entity has movement that should be displayed or modified by encumbrance. Characters and retainers may derive movement from rules instead of storing it directly.

## `notes`

Freeform notes for the entity.

## `sortOrder`

Stable display order among entities.

---

# Character Data

The exact character sheet model can be expanded later. Keep this minimal for inventory work.

```ts
type CharacterData = {
  className?: string;
  level?: number;
  alignment?: string;

  hpCurrent?: number;
  hpMax?: number;
  armorClass?: number;

  abilities?: Partial<Record<AbilityKey, number>>;
  saves?: Partial<Record<SaveKey, number>>;
  skills?: Partial<Record<SkillKey, number>>;

  languages?: string[];
  xp?: number;
};
```

This model is intentionally incomplete. Do not block inventory implementation on a full character-sheet schema.

---

# Movement Data

```ts
type MovementData = {
  baseExplorationSpeed?: number;
  currentExplorationSpeed?: number;
  encumbranceState?: "normal" | "slowed" | "overloaded";
  notes?: string;
};
```

Movement should usually be derived from inventory burden and rules data, not manually edited in most workflows.

---

# Inventory Model

## Inventory Record Type

```ts
type InventoryRecordType =
  | "coins"
  | "treasure"
  | "weapon"
  | "armor"
  | "equipment";
```

## Inventory Record

```ts
type InventoryRecord = {
  id: string;

  recordType: InventoryRecordType;

  name?: string;
  description?: string;

  quantity?: number;

  slotProfile?: SlotProfile;

  gpValue?: number;

  coins?: CoinDenominations;

  handsRequired?: 0 | 1 | 2;

  identified?: boolean;
  unidentifiedName?: string;
  unidentifiedDescription?: string;

  isLit?: boolean;
  emitsLightRadius?: number;

  usesRemaining?: number;
  usesMax?: number;
  consumedOnFinalUse?: boolean;

  modifiers?: ItemModifiers;

  weapon?: WeaponData;
  armor?: ArmorData;
  container?: ContainerData;

  location: InventoryLocation;

  sortOrder?: number;
};
```

## `id`

Unique identifier for this inventory record.

Used for editing, deleting, sorting, drag-and-drop, and container references.

## `recordType`

The broad kind of inventory record.

```ts
"coins" | "treasure" | "weapon" | "armor" | "equipment"
```

## `name`

The normal identified display name.

Examples:

```ts
"Longsword"
"Leather Armor"
"Backpack"
"Silver Chalice"
```

Coins omit this.

## `description`

The normal identified description.

Used for item notes, treasure descriptions, magic item descriptions, or equipment details.

Coins omit this.

## `quantity`

Number of items represented by this record.

Defaults to `1` when omitted.

Used for stackable equipment, ammunition, torches, rations, treasure multiples, etc.

Coins do not use `quantity`; they use `coins`.

---

# Slot Fields

## Slot Profile

```ts
type SlotProfile =
  | { slotsTaken: number; stackSize?: never }
  | { stackSize: number; slotsTaken?: never };
```

Use `slotsTaken` for individually slotted items.

```ts
slotProfile: { slotsTaken: 1 }
```

Use `stackSize` for stackable items.

```ts
slotProfile: { stackSize: 3 }
```

Slot calculation:

```ts
if slotsTaken exists:
  slots = quantity * slotsTaken

if stackSize exists:
  slots = Math.ceil(quantity / stackSize)
```

Rules:

- `slotsTaken: 0` is allowed for negligible items.
- A record must not define both `slotsTaken` and `stackSize`.
- Coins do not use `slotProfile`; coin slots are derived from denomination counts.

---

# Value Fields

## `gpValue`

Gold-piece value of this record.

For treasure, this is required.

For weapons, armor, and equipment, this is optional.

For coins, this is derived from denomination counts and should not be stored.

## `coins`

Used only when `recordType === "coins"`.

```ts
type CoinDenominations = {
  pp: number;
  gp: number;
  sp: number;
  cp: number;
};
```

Coin records store denomination counts only.

Coin GP value is derived:

```ts
pp * 10 + gp + sp / 10 + cp / 100
```

Coin slots are derived:

```ts
const totalCoins = pp + gp + sp + cp;

slots = totalCoins === 0
  ? 0
  : Math.ceil(totalCoins / 100);
```

Coins should not use:

```ts
name
```

```ts
description
```

```ts
slotProfile
```

```ts
handsRequired
```

```ts
gpValue
```

or other non-coin fields except where the UI needs a harmless display label.

---

# Hands and Equipment Fields

## `handsRequired`

How many hands the record requires when held.

```ts
0 | 1 | 2
```

Typical meanings:

- `0`: worn item, armor, ring, cloak, negligible item.
- `1`: one-handed weapon, shield, torch.
- `2`: two-handed weapon or bulky held object.

Hand placement is controlled by `location.area`.

Two-handed held items should use:

```ts
location.area: "bothHands"
```

---

# Identification Fields

## `identified`

Whether this specific record is identified.

If omitted, treat as identified.

If explicitly `false`, use unidentified display fields.

## `unidentifiedName`

Displayed name when `identified === false`.

Example:

```ts
"Strange Black Blade"
```

## `unidentifiedDescription`

Displayed description when `identified === false`.

---

# Light and Use Fields

## `emitsLightRadius`

Light radius emitted by the item when lit.

Presence of this field means the item can be lit.

## `isLit`

Whether this record is currently lit.

Only relevant when `emitsLightRadius` exists.

## `usesMax`

Maximum number of uses this record can have.

Examples:

- Wand charges
- Oil flask uses
- Special consumable uses

## `usesRemaining`

Current number of uses remaining.

## `consumedOnFinalUse`

Whether the record should be removed or marked consumed when `usesRemaining` reaches `0`.

This field describes behavior only. It does not require automatic consumption unless the UI already supports that.

---

# Modifiers

## `modifiers`

Simple mechanical bonuses or notes.

```ts
type ItemModifiers = {
  acBonus?: number;
  toHitBonus?: number;
  damageBonus?: number;
  saveBonus?: number;

  abilityBonuses?: Partial<Record<AbilityKey, number>>;
  skillBonuses?: Partial<Record<SkillKey, number>>;

  movementBonus?: number;

  notes?: string;
};
```

Used for weapons, armor, shields, rings, cloaks, treasure, or any other item that grants a simple modifier.

Ambiguous effects should go in `notes`.

This is not a generic rules engine.

---

# Weapon Data

## `weapon`

Used only when `recordType === "weapon"`.

```ts
type WeaponData = {
  damage: string;

  qualities?: string[];

  range?: {
    short?: number;
    medium?: number;
    long?: number;
  };
};
```

## `weapon.damage`

Damage expression.

Example:

```ts
"1d8"
```

## `weapon.qualities`

Optional weapon qualities.

Example:

```ts
["slow", "two-handed"]
```

## `weapon.range`

Optional missile/thrown weapon range data.

---

# Armor Data

## `armor`

Used only when `recordType === "armor"`.

```ts
type ArmorData = {
  baseAc: number;
};
```

## `armor.baseAc`

Base armor class provided by this armor.

Armor is active when:

```ts
recordType === "armor" && location.area === "equipped"
```

There is no separate armor location.

---

# Container Data

## `container`

Used for records that can contain other records.

Usually used when `recordType === "equipment"`.

```ts
type ContainerData = {
  capacitySlots: number;
  countsAsSlotsWhenEmpty?: number;
  canContainNonEmptyContainers?: boolean;
};
```

## `container.capacitySlots`

Maximum number of slots this container can hold.

## `container.countsAsSlotsWhenEmpty`

How many slots the container itself takes when empty.

## `container.canContainNonEmptyContainers`

Whether this container may hold other containers that already contain items.

Default should be false unless explicitly set.

---

# Location

## Inventory Location

```ts
type InventoryLocation = {
  entityId: string;
  entityType: EntityType;

  area:
    | "equipped"
    | "stowed"
    | "container"
    | "leftHand"
    | "rightHand"
    | "bothHands";

  containerId?: string;
};
```

## `location.entityId`

ID of the character, retainer, mount, vehicle, or storage entity that ultimately owns or carries this record.

## `location.entityType`

The kind of entity.

Allowed values:

```ts
"character" | "retainer" | "mount" | "vehicle" | "storage"
```

## `location.area`

Where the record is placed.

Allowed values:

```ts
"equipped" | "stowed" | "container" | "leftHand" | "rightHand" | "bothHands"
```

Meanings:

- `equipped`: worn or active equipment.
- `stowed`: loose carried inventory.
- `container`: inside another inventory record.
- `leftHand`: held in left hand.
- `rightHand`: held in right hand.
- `bothHands`: held using both hands.

Armor uses `equipped`.

There is no `armor` location.

## `location.containerId`

The `id` of the containing inventory record.

Required when:

```ts
location.area === "container"
```

Omitted otherwise.

---

# Sorting

## `sortOrder`

Optional display order within the current location or container.

Used for stable inventory ordering.

---

# Display Logic

## Display Name

```ts
if record.identified === false:
  record.unidentifiedName ?? "Unidentified Item"
else:
  record.name
```

## Display Description

```ts
if record.identified === false:
  record.unidentifiedDescription
else:
  record.description
```

---

# Slot Calculation

## Coins

```ts
const totalCoins =
  record.coins.pp +
  record.coins.gp +
  record.coins.sp +
  record.coins.cp;

const slots =
  totalCoins === 0
    ? 0
    : Math.ceil(totalCoins / 100);
```

## Non-Coins

```ts
const quantity = record.quantity ?? 1;

if record.slotProfile.slotsTaken exists:
  slots = quantity * record.slotProfile.slotsTaken;

if record.slotProfile.stackSize exists:
  slots = Math.ceil(quantity / record.slotProfile.stackSize);
```

---

# Placement Rules

## Armor

Armor is active when:

```ts
record.recordType === "armor" &&
record.location.area === "equipped"
```

Stowed armor, contained armor, or armor carried in hand does not provide base AC.

## Containers

A container is any inventory record with `container` data.

Items inside it use:

```ts
location.area: "container"
location.containerId: "<container record id>"
```

Container load is calculated from the slot burden of records whose `location.containerId` points to that container.

## Hands

Hand-held records use one of:

```ts
location.area: "leftHand"
location.area: "rightHand"
location.area: "bothHands"
```

Validation should prevent:

- More than one item in `leftHand`.
- More than one item in `rightHand`.
- More than one item in `bothHands`.
- A `bothHands` item plus any `leftHand` or `rightHand` item on the same entity.
- A two-handed item being placed in `leftHand` or `rightHand`.
- A one-handed item being placed in `bothHands` unless explicitly allowed by future UI behavior.

A two-handed item is represented by:

```ts
handsRequired: 2
```

and should normally be placed with:

```ts
location.area: "bothHands"
```

---

# Validation Rules

## Hard Validation

Hard validation should prevent corrupt or nonsensical state:

- Inventory records must have a valid `id`.
- Inventory records must have a valid `recordType`.
- Inventory records must have a valid `location.entityId`.
- `location.entityId` must point to an existing entity.
- `location.entityType` must match the entity's `type`.
- `location.containerId` is required when `location.area === "container"`.
- `location.containerId` must point to an existing inventory record with `container` data.
- A record must not define both `slotProfile.slotsTaken` and `slotProfile.stackSize`.
- Coin records must use `coins` and should not require `slotProfile`, `quantity`, or `gpValue`.
- Hand locations must not violate hand-capacity rules.

## Soft Warnings

Soft warnings may be shown without blocking play:

- Entity is overloaded.
- Container is over capacity, if temporary overfilling is allowed.
- Unidentified item has no unidentified display name.
- Item has uses below zero or above max due to manual editing.

---

# Complete Type Summary

```ts
type EntityType =
  | "character"
  | "retainer"
  | "mount"
  | "vehicle"
  | "storage";

type Entity = {
  id: string;
  type: EntityType;
  name: string;
  active: boolean;
  capacitySlots?: number;
  character?: CharacterData;
  movement?: MovementData;
  notes?: string;
  sortOrder?: number;
};

type CharacterData = {
  className?: string;
  level?: number;
  alignment?: string;
  hpCurrent?: number;
  hpMax?: number;
  armorClass?: number;
  abilities?: Partial<Record<AbilityKey, number>>;
  saves?: Partial<Record<SaveKey, number>>;
  skills?: Partial<Record<SkillKey, number>>;
  languages?: string[];
  xp?: number;
};

type MovementData = {
  baseExplorationSpeed?: number;
  currentExplorationSpeed?: number;
  encumbranceState?: "normal" | "slowed" | "overloaded";
  notes?: string;
};

type InventoryRecordType =
  | "coins"
  | "treasure"
  | "weapon"
  | "armor"
  | "equipment";

type SlotProfile =
  | { slotsTaken: number; stackSize?: never }
  | { stackSize: number; slotsTaken?: never };

type CoinDenominations = {
  pp: number;
  gp: number;
  sp: number;
  cp: number;
};

type ItemModifiers = {
  acBonus?: number;
  toHitBonus?: number;
  damageBonus?: number;
  saveBonus?: number;
  abilityBonuses?: Partial<Record<AbilityKey, number>>;
  skillBonuses?: Partial<Record<SkillKey, number>>;
  movementBonus?: number;
  notes?: string;
};

type WeaponData = {
  damage: string;
  qualities?: string[];
  range?: {
    short?: number;
    medium?: number;
    long?: number;
  };
};

type ArmorData = {
  baseAc: number;
};

type ContainerData = {
  capacitySlots: number;
  countsAsSlotsWhenEmpty?: number;
  canContainNonEmptyContainers?: boolean;
};

type InventoryLocation = {
  entityId: string;
  entityType: EntityType;
  area: "equipped" | "stowed" | "container" | "leftHand" | "rightHand" | "bothHands";
  containerId?: string;
};

type InventoryRecord = {
  id: string;
  recordType: InventoryRecordType;
  name?: string;
  description?: string;
  quantity?: number;
  slotProfile?: SlotProfile;
  gpValue?: number;
  coins?: CoinDenominations;
  handsRequired?: 0 | 1 | 2;
  identified?: boolean;
  unidentifiedName?: string;
  unidentifiedDescription?: string;
  isLit?: boolean;
  emitsLightRadius?: number;
  usesRemaining?: number;
  usesMax?: number;
  consumedOnFinalUse?: boolean;
  modifiers?: ItemModifiers;
  weapon?: WeaponData;
  armor?: ArmorData;
  container?: ContainerData;
  location: InventoryLocation;
  sortOrder?: number;
};
```

---

# Field Use by Record Type

## Coins

Use:

```ts
id
recordType: "coins"
coins
location
sortOrder
```

Do not require:

```ts
name
description
quantity
slotProfile
gpValue
handsRequired
```

## Treasure

Use:

```ts
id
recordType: "treasure"
name
description
quantity
slotProfile
gpValue
identified
unidentifiedName
unidentifiedDescription
location
sortOrder
```

Optional:

```ts
modifiers
container
```

## Weapon

Use:

```ts
id
recordType: "weapon"
name
description
quantity
slotProfile
gpValue
handsRequired
weapon
modifiers
identified
unidentifiedName
unidentifiedDescription
location
sortOrder
```

## Armor

Use:

```ts
id
recordType: "armor"
name
description
quantity
slotProfile
gpValue
handsRequired
armor
modifiers
identified
unidentifiedName
unidentifiedDescription
location
sortOrder
```

## Equipment

Use:

```ts
id
recordType: "equipment"
name
description
quantity
slotProfile
gpValue
handsRequired
container
modifiers
identified
unidentifiedName
unidentifiedDescription
isLit
emitsLightRadius
usesRemaining
usesMax
consumedOnFinalUse
location
sortOrder
```

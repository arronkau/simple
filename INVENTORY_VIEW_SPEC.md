# Inventory View Spec

## Goal

Provide a table-usable inventory screen for managing equipped, stowed, and non-character contents records across party entities. The view should prioritize fast play, clear state, and simple interactions over exhaustive rule automation.

`MODEL_SPEC.md` is the source of truth for data interfaces, invariants, and derived calculations. `ENCUMBRANCE_SPEC.md` is the source of truth for movement and encumbrance calculations. This file is the source of truth for inventory UI structure and interaction behavior.

## Rules Basis

The inventory view must reflect the carried-item distinction for character-like entities:

- **Equipped items** are held, actively used, worn, sheathed, or ready to use at short notice.
- **Stowed items** are packed away in a backpack, coin purse, sack, chest, or similar storage. In combat, retrieving a packed/stowed item may take one round by table ruling.

For character-like entities, the inventory view has only two primary inventory categories:

1. Equipped
2. Stowed

Hands, loose equipped items, backpack, coin purse, and containers are subdivisions of those two categories. They are not separate primary inventory categories.

For non-character entities, use the explicit Contents layout.

## Primary Objects Used by the View

- `Entity`
- `InventoryRecord`
- `InventoryLocation`
- `ContainerData`
- `SlotProfile`

Entity and holder are the same concept. Use entity terminology everywhere.

## Entity List

The inventory view displays inventory grouped by entity.

Entity types:

```ts
"character" | "retainer" | "mount" | "vehicle" | "storage"
```

Display active entities before inactive entities. Within each active/inactive group, use `sortOrder` where available.

## Entity Header

Each entity section should show:

- Name
- Entity type
- Active/inactive state
- Equipped items/slots, if character-like
- Stowed items/slots, if character-like
- Contents items/slots, if non-character
- Total used slots
- Capacity slots, if applicable
- Encumbrance or movement state, if applicable
- Warning state if overloaded or invalid

For character-like entities, the header may also show compact summary data when available:

- Class / level
- HP current / max
- AC
- Exploration movement

Keep the header compact. The inventory screen should not become a full character sheet.

## Character and Retainer Inventory Layout

Characters and retainers use the full inventory layout.

Use this section order:

1. Entity header
2. Equipped
   - Hands
   - Other equipped
3. Stowed
   - Coin purse
   - Backpack
   - Containers inline

Do not add a separate top-level containers section.

## Required Character Containers

Character-like entities should have literal container records for:

1. Backpack
2. Coin purse

These are real inventory records, not virtual UI sections. They can be stolen, lost, destroyed, moved, or overfilled.

### Backpack Requirement

A character-like entity cannot stow non-coin items unless it has a literal backpack container.

- The backpack record is normally shown as equipped/worn loose gear.
- Non-coin stowed records are normally placed inside the backpack container or inside containers within the backpack.
- If the backpack is missing, show a warning and disable/avoid moves that would stow non-coin items.

### Coin Purse Requirement

Coins must be inside a literal coin-purse container.

- The coin purse record is normally shown as equipped/worn loose gear.
- The coin record should be displayed through the Coin Purse subsection.
- If the coin purse is missing, show a warning and disable/avoid adding coins until one is created.

## Equipped Section

The equipped section contains records that are held, worn, actively used, sheathed, or otherwise ready at short notice.

Relevant location state:

```ts
location.carryState === "equipped"
```

The equipped section has two subsections:

1. Hands
2. Other equipped

### Hands

Relevant equipped placements:

```ts
location.carryState === "equipped"
location.placement === "leftHand"
location.placement === "rightHand"
location.placement === "bothHands"
```

Hand display is exclusive:

- Show `leftHand` and `rightHand` by default.
- Show `bothHands` instead when a two-handed item occupies both hands.
- Do not show `leftHand`, `rightHand`, and `bothHands` as three simultaneous slots.

Behavior:

- A `handsRequired: 1` item may occupy `leftHand` or `rightHand`.
- A `handsRequired: 2` item occupies `bothHands`.
- A `handsRequired: 0` item should not occupy a hand.
- Moving a `handsRequired: 2` item to either empty hand should claim both hands and switch the display to `bothHands`.
- Moving a `handsRequired: 2` item into hands should be blocked if either hand is already occupied.
- Moving a `handsRequired: 1` item into hands should be blocked when `bothHands` is occupied.

Validation should prevent:

- More than one item in the same hand.
- A two-handed item plus another hand-held item.
- A two-handed item represented as only one occupied hand.
- A one-handed item represented in `bothHands`.
- A zero-handed item represented in any hand.

Empty hand states should display `Empty hand`.

### Other Equipped

Relevant equipped placement:

```ts
location.carryState === "equipped"
location.placement === "loose"
```

Use this section for equipped items that are not currently occupying hands.

Examples:

- Armor worn
- Backpack worn
- Coin purse worn
- Sheathed weapon ready at short notice
- Worn cloak
- Ring
- Amulet
- Other active or ready gear

Body armor is active when:

```ts
record.recordType === "armor" &&
record.armor?.armorKind !== "shield" &&
record.location.carryState === "equipped" &&
record.location.placement === "loose"
```

A shield is active only when held in a valid hand placement.

More generally, items with `handsRequired > 0` should have their active effects applied only while they are in a valid hand placement.

There is no separate armor location.

## Stowed Section

The stowed section contains carried inventory that is packed away and not immediately ready.

Relevant location state:

```ts
location.carryState === "stowed"
```

The stowed section has two subsections:

1. Coin purse
2. Backpack

### Coin Purse

The coin purse is a literal container record with `container.containerRole === "coinPurse"`.

Relevant coin record state:

```ts
record.recordType === "coins"
record.location.carryState === "stowed"
record.location.placement === "container"
record.location.containerId === coinPurse.id
```

For v1:

- Each entity should have at most one coin record.
- The view presents that record as the contents of the entity's coin purse.
- Coin records should not appear as generic backpack items.
- Coin records should not require a user-entered name.
- Coin records are always stowed, not equipped.

Display coin records with:

- Denomination counts
- Derived GP value
- Derived slot burden
- Edit/add action

Example:

```md
Coin Purse — 12 gp, 35 sp, 80 cp — 2 slots — 16.3 gp value
```

If the entity has a coin purse but no coin record, show `No coins` and an add/edit action.

If the entity has no coin purse, show `Missing coin purse` and an action to create one.

### Backpack

The backpack is a literal container record with `container.containerRole === "backpack"`.

Relevant stowed records:

```ts
location.carryState === "stowed"
location.placement === "container"
location.containerId === backpack.id
```

The backpack section contains non-coin stowed records, including:

- Loose equipment packed away
- Loose treasure packed away
- Stowed weapons
- Stowed armor
- Ordinary containers
- Records inside ordinary containers

If the entity has no backpack, show `Missing backpack` and an action to create one.

If the backpack is empty, show `Empty` and an add/move action.

Do not treat `Backpack` as a virtual default area. It must be represented by an actual container record.

## Containers Inline

A container is any non-coin `InventoryRecord` with `container` data.

In the character/retainer inventory view, ordinary containers with contents are normally shown inside the stowed Backpack section.

Exception:

- A container with `handsRequired > 0` may be equipped in hands while it has contents.
- When this happens, the container should appear in the equipped Hands area, and its contents should be visually nested under it.
- The app should warn when a `handsRequired > 0` container has contents but is not held in a valid hand placement.

Container contents are records with:

```ts
location.placement === "container"
location.containerId === container.id
```

Each displayed container should show compactly:

- Container name
- Used slots / capacity slots
- Over-capacity warning if applicable
- Contained records
- Held/stowed warning if applicable

Example:

```md
Right hand: Sack — 4/6 slots
  - Rations (3)
  - Iron spikes
```

Container load is calculated from the slot burden of records whose `location.containerId` points to that container.

Container contents should be visually nested under the container. Avoid moving containers to a separate global section.

If a container is empty, show `Empty` and an add/move action.

## Mount, Vehicle, and Storage Inventory Layout

Mounts, vehicles, and storage use a simpler layout.

Use this section order:

1. Entity header
2. Contents
   - Containers inline

These entities do not need:

- Hands
- Equipped section
- Stowed section distinction in the UI
- Coin purse/backpack labels unless useful later

For the underlying model, their direct inventory should use:

```ts
location.carryState === "contents"
location.placement === "contents"
```

Records inside containers owned by these entities should use:

```ts
location.carryState === "contents"
location.placement === "container"
location.containerId === container.id
```

Containers appear inline inside the contents list rather than as a separate top-level layout section.

## Inventory Record Display

### Row/Card Content

Each inventory record should show compact summary information as applicable:

- Display name
- Quantity, if greater than 1
- Slot burden, if greater than 1 or needed for warnings
- Coin value or treasure value where useful
- Equipped/stowed/contents status if context is unclear
- Specific placement if context is unclear
- Hands required, if greater than 0
- Uses remaining, if applicable
- Lit state, if applicable
- Warning state

Keep rows compact. The inventory screen should not become a full rules reference page.

### Display Name

Use this display rule:

```ts
if record.identification?.identified === false:
  record.identification.unidentifiedName ?? "Unidentified Item"
else:
  record.name?.trim() || "Unnamed Item"
```

Coin records may display as `Coins` even when `name` is absent.

### Display Description

Use this display rule:

```ts
if record.identification?.identified === false:
  record.identification.unidentifiedDescription
else:
  record.description
```

Descriptions should be hidden, collapsed, or shown in edit/detail views by default.

### Slot Display

Show calculated slot burden, not raw slot fields.

Omit slot display for records that use 0 or 1 slot unless warning context requires it.

Examples:

- Omit for `0 slots`
- Omit for `1 slot`
- `2 slots`
- `3/6 slots` for a container

### Coins Display

Coin records should display:

- PP / GP / SP / CP counts, omitting zero denominations if desired
- Derived GP value
- Derived slot burden

Coin records should not require a user-entered name.

### Treasure Display

Treasure records should show:

- Name
- Slot burden, if greater than 1
- GP value in detail/edit views when useful

Treasure is always identified. Do not expose identification fields for treasure records.

### Weapons Display

Weapon records may show compact metadata where useful:

- Damage
- Hands required
- Range, if present
- Qualities, if present
- Slot burden, if greater than 1
- Warning state

Do not turn the inventory row into a full weapon reference entry.

### Armor Display

Armor records may show compact metadata where useful:

- Base AC or armor bonus
- Armor kind, especially shield
- Hands required, if greater than 0
- Slot burden, if greater than 1
- Whether active based on current location
- Warning state

Shield rows should make clear whether the AC bonus is currently active. A shield grants AC only when held in hand.

### Equipment Display

Equipment records may show compact metadata where useful:

- Quantity if greater than 1
- Slot burden, if greater than 1
- Hands required, if greater than 0
- Container status if applicable
- Uses/light state if applicable
- Warning state

## Add and Edit Workflows

### Add Record

The add-record flow should allow the user to choose:

- Record type
- Entity
- Location appropriate to entity type
- Container, if placing inside a container

For character-like entities, location choices should map to:

- Equipped loose
- Left hand
- Right hand
- Both hands, as the result for `handsRequired: 2`
- Inside backpack
- Inside coin purse, coins only
- Inside another valid container

For non-character entities, location choices should map to:

- Contents
- Inside another valid container

The form should expose only fields relevant to the selected record type.

Treasure creation should not expose identification fields.

Coin creation should update the entity's existing coin record if one already exists.

### Edit Record

Editing a record should allow changes to relevant fields only.

Potential fields:

- Name and description
- Quantity or slot profile
- GP value
- Coin denominations
- Hands required
- Carry state and placement
- Container data
- Identification data for weapons, armor, and equipment only
- Light/use data
- Weapon/armor data where applicable

Avoid showing every possible field at once. Use type-specific sections.

### Move Record

Moving a record should update only `location` and `sortOrder` unless the user also edits the record.

Common character-like moves:

- Backpack container to equipped loose
- Equipped loose to backpack container
- Backpack container to left hand
- Backpack container to right hand
- Backpack container to hands, with `handsRequired: 2` records claiming `bothHands`
- Into valid container
- Out of container to backpack
- To another entity

Common non-character moves:

- Contents to container
- Container to contents
- To another entity

When moving a container to another entity, contained records should move with it according to the model invariant.

### Delete Record

Deleting a record should require confirmation if:

- It is a container with contents.
- It is the literal backpack or coin purse.
- It has nonzero coin value.
- It has nonzero treasure value.

Default behavior for non-empty containers:

- Prevent deletion until contents are moved.
- Do not implement delete-with-contents unless a later task explicitly adds it.

## Movement Interaction

The initial implementation should not assume drag-and-drop.

Use explicit controls such as:

- Move button
- Context menu
- Placement select
- Send to backpack
- Hold in left hand
- Hold in right hand
- Move into container
- Move out of container
- Move to entity

The requirements are about valid resulting state, not the input method.

### Valid Move Targets

Valid move targets:

- Character backpack container
- Character coin-purse container, coins only
- Non-character contents area
- Other equipped area for character-like entities
- Left hand
- Right hand
- Valid container
- Another entity

`bothHands` is a resulting state, not a third simultaneous visible hand target in the default view. A `handsRequired: 2` item moved into either empty hand should claim `bothHands`.

### Move Validation

Moves should be blocked or warned when they would create invalid state.

Block:

- Moving into a non-container record.
- Moving into a missing container.
- Moving a `handsRequired: 2` item into hands when either hand is already occupied.
- Moving a `handsRequired: 1` item into hands while `bothHands` is occupied.
- Moving into an occupied hand.
- Moving a `handsRequired: 1` item into `bothHands`.
- Moving a `handsRequired: 0` item into a hand.
- Creating a container cycle.
- Moving a non-empty ordinary container into another ordinary container.
- Moving a non-coin record into the coin purse.
- Moving a coin record out of the coin purse except as part of moving the entire coin purse/container.
- Stowing non-coin character inventory when the character has no backpack container.

Warn, but do not necessarily block:

- Entity exceeds capacity.
- Container exceeds capacity, if temporary overfilling is allowed.
- Entity is overloaded.
- A hands-required container has contents but is not held in a valid hand placement.

### Sort Order

Within a placement or container, moved records should receive stable `sortOrder` values.

Do not refactor sorting globally unless needed.

## Derived Display Values

The inventory view should display these values by deriving them from model data:

- Slot burden per record
- Used slots per container
- Equipped slots per entity
- Stowed slots per entity
- Contents slots per non-character entity
- Total used slots per entity
- Coin value per coin record
- Treasure value per entity
- Hand occupancy
- Active modifier status
- Overloaded or over-capacity warnings

Do not store derived values in UI state unless there is a specific performance reason.

## Validation and Warnings

### Hard Blocks

The UI should prevent actions that create invalid state:

- More than one item in `leftHand`.
- More than one item in `rightHand`.
- More than one item represented in the active `bothHands` display.
- Any `leftHand` or `rightHand` item while `bothHands` is occupied.
- A `bothHands` item while `leftHand` or `rightHand` is occupied.
- A `handsRequired: 2` record failing to claim `bothHands` when held.
- A `handsRequired: 1` record being placed in `bothHands`.
- A `handsRequired: 0` record being placed in any hand.
- Placing a record inside a non-container.
- Creating a container cycle.
- Placing a record in a missing entity.
- Placing a record in a missing container.
- Creating a second coin record for the same entity.
- Placing a non-coin record in the coin purse.
- Moving a coin record out of the coin purse except as part of moving the whole coin purse/container.
- Placing a non-empty ordinary container inside another ordinary container.

### Warnings

The UI may warn without blocking:

- Entity exceeds capacity.
- Container exceeds capacity, if temporary overfilling is allowed.
- Entity is overloaded.
- Record has incomplete optional metadata.
- Unidentified weapon, armor, or equipment lacks an unidentified name.
- Character-like entity is missing a backpack.
- Character-like entity is missing a coin purse.
- A hands-required container has contents but is not held.

## Empty States

The inventory view should have useful empty states.

Examples:

- No entities yet: show an action to create an entity.
- Entity has no inventory: show an action to add a record.
- Missing backpack: show an action to create a backpack.
- Missing coin purse: show an action to create a coin purse.
- Coin purse is empty: show `No coins` and an add/edit action.
- Backpack is empty: show `Empty` and an add/move action.
- Container is empty: show `Empty` and an add/move action.
- Hand is empty: show `Empty hand`.

## Minimal Acceptance Criteria

A first complete implementation of this view should satisfy:

- Entities are displayed by active state and `sortOrder` where available.
- Character and retainer entities show entity header, equipped section, and stowed section.
- Equipped section contains hands and other equipped items.
- Hands display either `leftHand` and `rightHand` or `bothHands`, not all three simultaneously.
- `handsRequired: 2` records moved into either empty hand claim `bothHands` and switch the hands display to the `bothHands` view.
- Hand overload states are prevented.
- Stowed section contains coin purse and backpack.
- Coin purse and backpack are literal container records.
- Character-like entities cannot stow non-coin items without a backpack container.
- Coin records display denominations, derived GP value, and derived slots.
- Coin records are always stowed inside the coin-purse container.
- Backpack contains all non-coin stowed records not already visually nested under a valid ordinary container.
- Containers appear inline inside backpack/contents or nested under held containers rather than as a separate top-level layout section.
- A hands-required container can be held while containing items.
- A hands-required container with contents warns when not held.
- Treasure records are always identified.
- Container records display used slots and capacity.
- Mount, vehicle, and storage entities show a simpler contents layout using explicit contents location.
- Records can be moved between valid entity locations using explicit controls; drag-and-drop is not required.
- Records can be moved into and out of containers.
- The UI does not require Firebase to function in local mode.

## Non-Goals

- No full OSE rules automation.
- No separate item-definition model.
- No complex permission model in this inventory-view pass.
- No exhaustive magic-item automation.
- No separate armor location.
- No separate top-level containers section.
- No drag-and-drop requirement in the initial implementation pass.

# Inventory View Spec

## Goal

Provide a table-usable inventory screen for managing carried, equipped, stored, and container-held records across party entities.

The view should prioritize fast play, clear state, and simple interactions over exhaustive rule automation.

`MODEL_SPEC.md` is the source of truth for data interfaces, invariants, and derived calculations. This file is the source of truth for inventory UI structure and interaction behavior.

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
- Used slots
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

## Equipped Section

The equipped section contains records that are held, worn, or otherwise active.

It has two subsections:

1. Hands
2. Other equipped

### Hands

Relevant location values:

```ts
location.area: "leftHand"
location.area: "rightHand"
location.area: "bothHands"
```

Hand display is exclusive:

- Show `leftHand` and `rightHand` by default.
- Show `bothHands` instead when a two-handed item occupies both hands.
- Do not show `leftHand`, `rightHand`, and `bothHands` as three simultaneous slots.

Behavior:

- A one-handed item may occupy `leftHand` or `rightHand`.
- A two-handed item occupies `bothHands`.
- Dropping a two-handed item into either empty hand should claim both hands and switch the display to `bothHands`.
- Dropping a two-handed item into either hand should be blocked if either hand is already occupied.
- Dropping a one-handed item should be blocked when `bothHands` is occupied.

Validation should prevent:

- More than one item in the same hand.
- A two-handed item plus another hand-held item.
- A two-handed item represented as only one occupied hand.
- A one-handed item represented in `bothHands`.

Empty hand states should display `Empty hand`.

### Other Equipped

Relevant location value:

```ts
location.area: "equipped"
```

Use this section for worn or active gear that is not hand-held.

Examples:

- Armor
- Worn cloak
- Ring
- Amulet
- Other active gear

Armor is active when:

```ts
record.recordType === "armor" && record.location.area === "equipped"
```

There is no separate armor location.

## Stowed Section

The stowed section contains carried inventory that is not equipped or held.

It has two subsections:

1. Coin purse
2. Backpack

### Coin Purse

Relevant record type:

```ts
record.recordType === "coins"
```

The coin purse is a display section for the entity's coin record.

For v1:

- Each entity should have at most one coin record.
- The view presents that record as the entity's coin purse.
- Coin records should not appear as generic loose items in the backpack.
- Coin records should not require a user-entered name.

Display coin records with:

- Denomination counts
- Derived GP value
- Derived slot burden
- Edit/add action

Example:

```md
Coins — 12 gp, 35 sp, 80 cp — 2 slots — 16.3 gp value
```

If the entity has no coin record or all denominations are zero, show `No coins` and an add/edit action.

### Backpack

Relevant location value:

```ts
location.area: "stowed"
```

The backpack section contains all non-coin stowed records, including:

- Loose equipment
- Loose treasure
- Stowed weapons
- Stowed armor
- Containers

`Backpack` is a view section for non-coin stowed inventory. It does not require a literal Backpack inventory record unless the user creates one.

Containers are displayed inline in this section rather than in a separate top-level containers section.

If the backpack is empty, show `Empty` and an add/move action.

## Containers Inline

A container is any non-coin `InventoryRecord` with `container` data.

Containers may appear in stowed, equipped, held, or contained locations. In the default character/retainer layout, most containers will appear inside the backpack section.

Container contents are records with:

```ts
location.area: "container"
location.containerId: container.id
```

Each displayed container should show compactly:

- Container name
- Used slots / capacity slots
- Over-capacity warning if applicable
- Contained records

Example:

```md
Sack — 4/6 slots
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
- Stowed section distinction
- Coin purse/backpack labels unless useful later

Unless a future rule requires otherwise, their inventory can use `stowed` as the default location area.

Relevant location value:

```ts
location.area: "stowed"
```

Containers appear inline inside the contents list rather than as a separate top-level layout section.

## Inventory Record Display

### Row/Card Content

Each inventory record should show compact summary information as applicable:

- Display name
- Quantity, if greater than 1
- Slot burden, if greater than 1 or needed for warnings
- Coin value or treasure value where useful
- Equipped/held/container location if context is unclear
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
  record.name
```

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
- Slot burden, if greater than 1
- Whether active based on `location.area === "equipped"`
- Warning state

### Equipment Display

Equipment records may show compact metadata where useful:

- Quantity if greater than 1
- Slot burden, if greater than 1
- Container status if applicable
- Uses/light state if applicable
- Warning state

## Add and Edit Workflows

### Add Record

The add-record flow should allow the user to choose:

- Record type
- Entity
- Location area
- Container, if placing inside a container

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
- Location
- Container data
- Identification data for weapons, armor, and equipment only
- Light/use data
- Weapon/armor data where applicable

Avoid showing every possible field at once. Use type-specific sections.

### Move Record

Moving a record should update only `location` and `sortOrder` unless the user also edits the record.

Common moves:

- Stowed to equipped
- Equipped to stowed
- Stowed to left hand
- Stowed to right hand
- Stowed to either hand, with two-handed records claiming `bothHands`
- Into container
- Out of container
- To another entity

When moving a container to another entity, contained records should move with it according to the model invariant.

### Delete Record

Deleting a record should require confirmation if:

- It is a container with contents.
- It has nonzero coin value.
- It has nonzero treasure value.

Default behavior for non-empty containers:

- Prevent deletion until contents are moved.

Do not implement delete-with-contents unless a later task explicitly adds it.

## Drag-and-Drop Behavior

Drag-and-drop may be implemented where practical, but button/menu movement is acceptable as a fallback.

### Drop Targets

Valid drop targets:

- Entity backpack/stowed area
- Entity contents area for mount, vehicle, or storage
- Other equipped area for character-like entities
- Left hand
- Right hand
- Container
- Another entity

`bothHands` is a resulting state, not a third simultaneous visible hand target in the default view.

A two-handed item dropped into either empty hand should claim `bothHands`.

### Drop Validation

Drops should be blocked or warned when they would create invalid state.

Block:

- Dropping into a non-container record.
- Dropping into a missing container.
- Dropping a two-handed item into either hand when either hand is already occupied.
- Dropping a one-handed item while `bothHands` is occupied.
- Dropping into an occupied hand.
- Dropping a one-handed item into `bothHands`.
- Creating a container cycle.
- Dropping a non-empty container into another container.

Warn, but do not necessarily block:

- Entity exceeds capacity.
- Container exceeds capacity, if temporary overfilling is allowed.
- Entity is overloaded.

### Sort Order

Within a location or container, dropped records should receive stable `sortOrder` values.

Do not refactor sorting globally unless needed.

## Derived Display Values

The inventory view should display these values by deriving them from model data:

- Slot burden per record
- Used slots per container
- Used slots per entity
- Coin value per coin record
- Treasure value per entity
- Equipped/stowed burden where rules require it
- Hand occupancy
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
- A two-handed item failing to claim `bothHands`.
- A one-handed item being placed in `bothHands`.
- Placing a record inside a non-container.
- Creating a container cycle.
- Placing a record in a missing entity.
- Placing a record in a missing container.
- Creating a second coin record for the same entity.
- Placing a non-empty container inside another container.

### Warnings

The UI may warn without blocking:

- Entity exceeds capacity.
- Container exceeds capacity, if temporary overfilling is allowed.
- Entity is overloaded.
- Record has incomplete optional metadata.
- Unidentified weapon, armor, or equipment lacks an unidentified name.

## Empty States

The inventory view should have useful empty states.

Examples:

- No entities yet: show an action to create an entity.
- Entity has no inventory: show an action to add a record.
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
- Two-handed records dropped into either empty hand claim `bothHands` and switch the hands display to the `bothHands` view.
- Hand overload states are prevented.
- Stowed section contains coin purse and backpack.
- Coin records display denominations, derived GP value, and derived slots.
- Backpack contains all non-coin stowed records.
- Containers appear inline inside backpack/contents rather than as a separate top-level layout section.
- Treasure records are always identified.
- Container records display used slots and capacity.
- Mount, vehicle, and storage entities show a simpler contents layout.
- Records can be moved between entity locations.
- Records can be moved into and out of containers.
- The UI does not require Firebase to function in local mode.

## Non-Goals

- No full OSE rules automation.
- No separate item-definition model.
- No complex permission model in this inventory-view pass.
- No exhaustive magic-item automation.
- No required literal Backpack inventory record for the backpack view section.
- No separate top-level containers section.

# Inventory View Spec

## Goal

Provide a table-usable inventory screen for managing all carried, equipped, stored, and container-held records across party entities.

The view should prioritize fast play, clear state, and simple interactions over exhaustive rule automation.

## Primary Objects

- `Entity`
- `InventoryRecord`
- `InventoryLocation`
- `ContainerData`
- `SlotProfile`

Entity and holder are the same concept. Use entity terminology everywhere.

---

# View Structure

## Entity List

The inventory view should display inventory grouped by entity.

Entity types:

```ts
"character" | "retainer" | "mount" | "vehicle" | "storage"
```

Active entities should appear before inactive entities.

Within each active/inactive group, use `sortOrder` where available.

## Entity Header

Each entity section should show:

- Name
- Entity type
- Active/inactive state
- Used slots
- Capacity slots if applicable
- Encumbrance or movement state if applicable
- Warning state if overloaded or invalid

For character-like entities, also show useful summary data when available:

- Class / level
- HP current / max
- AC
- Exploration movement

---

# Character and Retainer Inventory Layout

Characters and retainers use the full inventory layout.

## Recommended Section Order

1. Entity header
2. Hands
3. Equipped
4. Stowed
5. Containers

## Hands Section

Hand display is exclusive: show either `leftHand` and `rightHand`, or show `bothHands`. The default display is `leftHand` and `rightHand`. Dropping a two-handed item into either empty hand claims `bothHands` and changes the display to the `bothHands` view. This action is blocked if either hand is already occupied.

Relevant location values:

```ts
location.area: "leftHand"
location.area: "rightHand"
location.area: "bothHands"
```

Validation should prevent:

- More than one item in the same hand.
- A two-handed item plus another hand-held item.
- A two-handed item being represented as only one occupied hand.

## Equipped Section

Use for worn or active gear that is not hand-held.

Relevant location value:

```ts
location.area: "equipped"
```

Examples:

- Armor
- Worn cloak
- Ring
- Amulet
- Active pack item if needed

Armor is active when:

```ts
record.recordType === "armor" && record.location.area === "equipped"
```

There is no separate armor location.

## Stowed Section

Use for carried inventory inside a container.

Relevant location value:

```ts
location.area: "stowed"
```

Examples:

- Loose equipment
- Loose treasure
- Coin records
- Containers carried by the entity

Containers should appear in stowed inventory unless equipped or held for a specific reason.

## Containers Section

A container is any `InventoryRecord` with `container` data.

Container records may appear in stowed, equipped, held, or contained locations. Their contents are records with:

```ts
location.area: "container"
location.containerId: "<container record id>"
```

Each displayed container should show:

- Container name
- Used slots
- Capacity slots
- Over-capacity warning if applicable
- Contained records

Container load is calculated from the slot burden of records whose `location.containerId` points to that container.

---

# Mount, Vehicle, and Storage Inventory Layout

Mounts, vehicles, and storage use a simpler layout.

## Recommended Section Order

1. Entity header
2. Contents
3. Containers, if any

## Contents Section

Use a flat inventory list for records owned by the entity.

These entities do not need:

- Hands
- Equipped section
- Stowed section distinction

Unless a future rule requires it, their inventory can use `stowed` as the default location area.

Relevant location value:

```ts
location.area: "stowed"
```

Containers work the same way as for characters and retainers.

---

# Inventory Record Display

## Row/Card Content

Each inventory record should show, as applicable:

- Display name
- Record type
- Quantity
- Slot burden
- Coin value or treasure value
- Equipped/held/container location
- Uses remaining
- Lit state
- Warning state

Keep rows compact. The inventory screen should not become a full rules reference page.

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

Descriptions should be hidden, collapsed, or shown in edit/detail views by default to keep the inventory compact.

## Slot Display

Show calculated slot burden, not raw slot fields.

Examples:

- `1 slot`
- `2 slots`
- `0 slots`
- `3/6 slots` for a container

## Coins Display

Coin records should display denomination counts and derived total value.

Example:

```md
Coins — 12 gp, 35 sp, 80 cp — 2 slots — 16.3 gp value
```

Coin records should not require a user-entered name.

## Treasure Display

Treasure records should show:

- Name
- Slot burden
- GP value
- Identification state if unidentified

## Weapons Display

Weapon records should show:

- Name
- Damage
- Hands required
- Range if present
- Relevant qualities
- Slot burden

## Armor Display

Armor records should show:

- Name
- Base AC
- Slot burden
- Whether active based on `location.area === "equipped"`

## Equipment Display

Equipment records should show:

- Name
- Quantity if greater than 1
- Slot burden
- Container status if applicable
- Uses/light state if applicable

---

# Add and Edit Workflows

## Add Record

The add-record flow should allow the user to choose:

- Record type
- Entity
- Location area
- Container, if placing inside a container

The form should expose only fields relevant to the selected record type.

## Edit Record

Editing a record should allow changes to:

- Name and description
- Quantity
- Slot profile
- GP value
- Coin denominations
- Hands required
- Location
- Container data
- Identification data
- Light/use data
- Weapon/armor data where applicable

Avoid showing every possible field at once. Use type-specific sections.

## Move Record

Moving a record should update only `location` and `sortOrder` unless the user also edits the record.

Common moves:

- Stowed to equipped
- Equipped to stowed
- Stowed to left hand
- Stowed to right hand
- Stowed to both hands
- Into container
- Out of container
- To another entity

## Delete Record

Deleting a record should require confirmation if:

- It is a container with contents.
- It has nonzero coin value.
- It has nonzero treasure value.

When deleting a container, the UI must either:

- Prevent deletion until contents are moved, or
- Ask whether to delete contents too.

Default recommendation: prevent deletion until contents are moved.

---

# Drag-and-Drop Behavior

Drag-and-drop may be implemented where practical, but button/menu movement is acceptable as a fallback.

## Drop Targets

Valid drop targets:

- Entity stowed area
- Equipped area for character-like entities
- Left hand
- Right hand
- Both hands
- Container
- Another entity

## Drop Validation

Drops should be blocked or warned when they would create invalid state:

- Dropping into a non-container record.
- Dropping into a missing container.
- Dropping a two-handed item into only one hand.
- Dropping a one-handed item into `bothHands`, unless explicitly allowed later.
- Dropping into an occupied hand.
- Dropping into either hand while `bothHands` is occupied.
- Dropping into `bothHands` while either hand is occupied.
- Dropping a non-empty container into another container unless allowed by container data.

## Sort Order

Within a location or container, dropped records should receive stable `sortOrder` values.

Do not refactor sorting globally unless needed.

---

# Derived Calculations

The inventory view should derive:

- Slot burden per record
- Used slots per container
- Used slots per entity
- Coin value per coin record
- Treasure value per entity
- Equipped/stowed burden where rules require it
- Hand occupancy
- Overloaded or over-capacity warnings

Do not store derived values unless there is a specific performance reason.

---

# Validation and Warnings

## Hard Blocks

The UI should prevent actions that create invalid state:

- More than one item in `leftHand`.
- More than one item in `rightHand`.
- More than one item in `bothHands`.
- Any `leftHand` or `rightHand` item while `bothHands` is occupied.
- A `bothHands` item while `leftHand` or `rightHand` is occupied.
- Placing a record inside a non-container.
- Creating a container cycle.
- Placing a record in a missing entity.
- Placing a record in a missing container.

## Warnings

The UI may warn without blocking:

- Entity exceeds capacity.
- Container exceeds capacity, if temporary overfilling is allowed.
- Entity is overloaded.
- Record has incomplete optional metadata.
- Unidentified item lacks an unidentified name.

---

# Empty States

The inventory view should have useful empty states.

Examples:

- No entities yet: show an action to create an entity.
- Entity has no inventory: show an action to add a record.
- Container is empty: show `Empty` and an add/move action.
- Hand is empty: show `Empty hand`.

---

# Minimal Acceptance Criteria

A first complete implementation of this view should satisfy:

- Entities are displayed by type and active state.
- Character and retainer entities show hands, equipped, stowed, and containers.
- Mount, vehicle, and storage entities show a simpler contents layout.
- Inventory records display compact summary information.
- Coin records display denominations, derived GP value, and derived slots.
- Container records display used slots and capacity.
- Two-handed records can use `bothHands`.
- Hand overload states are prevented.
- Records can be moved between entity locations.
- Records can be moved into and out of containers.
- The UI does not require Firebase to function in local mode.

---

# Non-Goals

- No full OSE rules automation.
- No separate item-definition model.
- No complex permission model in this inventory-view pass.
- No exhaustive magic-item automation.

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
- Movement state, TBD for now
- Warning state if overloaded or invalid

Keep the inventory header compact. Character-sheet data such as class, HP, AC, and XP belongs elsewhere unless a later layout pass explicitly adds it back.

---

# Character and Retainer Inventory Layout

Characters and retainers use the full inventory layout.

## Recommended Section Order

1. Entity header
2. Equipped
3. Stowed

---

# Equipped Section

Use for hand-held, worn, or active gear.

Relevant location values:

```ts
location.area: "leftHand"
location.area: "rightHand"
location.area: "bothHands"
location.area: "equipped"
```

The equipped section has two parts:

1. Hands
2. Other equipped items

## Hands Display

Hand display is exclusive:

- Show `leftHand` and `rightHand` by default.
- Show `bothHands` instead when a two-handed item occupies both hands.
- Do not show `leftHand`, `rightHand`, and `bothHands` as three simultaneous slots.

Behavior:

- A one-handed item may occupy `leftHand` or `rightHand`.
- A two-handed item occupies `bothHands`.
- Dropping a two-handed item into either empty hand should claim both hands and change the display to the `bothHands` view.
- Dropping a two-handed item into either hand should be blocked if either hand is already occupied.
- Dropping a one-handed item should be blocked when `bothHands` is occupied.

Validation should prevent:

- More than one item in the same hand.
- A two-handed item plus another hand-held item.
- A two-handed item being represented as only one occupied hand.
- A one-handed item being represented in `bothHands`.

## Other Equipped Items

Use `location.area: "equipped"` for worn or active gear that is not hand-held.

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

---

# Stowed Section

Use for carried inventory that is not equipped or held.

Relevant location value:

```ts
location.area: "stowed"
```

For simplicity, the stowed section has two parts:

1. Coin purse
2. Backpack

## Coin Purse

The coin purse is a simple display section for all coin records owned by the entity.

For v1, each entity should have at most one coin record. The inventory view displays this as the entity's coin purse.

Coins are still represented as `InventoryRecord` records with `recordType: "coins"`, but the view should present them as one practical coin purse rather than as generic loose items.

## Backpack

The backpack section contains all other stowed records, including:

- Loose equipment
- Loose treasure
- Stowed weapons or armor
- Containers

“Backpack” is a view section for non-coin stowed inventory. It does not require a literal Backpack inventory record unless the user creates one.

Containers are displayed inside the backpack section rather than as a separate top-level layout section.

---

# Containers

A container is any `InventoryRecord` with `container` data.

Container records may appear in stowed, equipped, held, or contained locations. In the default inventory layout, they appear inside the stowed backpack section unless the user has moved them elsewhere.

Container contents are records with:

```ts
location.area: "container"
location.containerId: "<container record id>"
```

Each displayed container should show compactly:

- Container name
- Used slots / capacity slots
- Over-capacity warning if applicable
- Contained records

Container load is calculated from the slot burden of records whose `location.containerId` points to that container.

---

# Mount, Vehicle, and Storage Inventory Layout

Mounts, vehicles, and storage use a simpler layout.

## Recommended Section Order

1. Entity header
2. Contents

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

Containers appear inside the contents list rather than as a separate top-level layout section.

---

# Inventory Record Display

## Row/Card Content

Each inventory record should show, as applicable:

- Display name
- Quantity, if greater than 1, next to the name; for example, `Torch (3)`
- Slot burden, if greater than 1
- Uses remaining, if applicable
- Lit state, if applicable
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

Omit slot display for records that use 0 or 1 slot unless warning context requires it.

Examples:

- omit for `0 slots`
- omit for `1 slot`
- `2 slots`
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
- Slot burden, if greater than 1
- GP value in detail/edit views when useful

Treasure is always identified. Do not expose identification fields for treasure records.

## Weapons Display

Weapon records may show compact metadata where useful:

- Damage
- Hands required
- Slot burden, if greater than 1
- Warning state

Do not turn the inventory row into a full weapon reference entry.

## Armor Display

Armor records may show compact metadata where useful:

- Base AC
- Slot burden, if greater than 1
- Whether active based on `location.area === "equipped"`
- Warning state

## Equipment Display

Equipment records may show compact metadata where useful:

- Quantity if greater than 1
- Slot burden, if greater than 1
- Container status if applicable
- Uses/light state if applicable
- Warning state

---

# Add and Edit Workflows

## Add Record

The add-record flow should allow the user to choose:

- Record type
- Entity
- Location area
- Container, if placing inside a container

The form should expose only fields relevant to the selected record type.

Treasure creation should not expose identification fields.

## Edit Record

Editing a record should allow changes to relevant fields only.

Potential fields:

- Name and description
- Quantity
- Slot profile
- GP value
- Coin denominations
- Hands required
- Location
- Container data
- Identification data for weapons, armor, and equipment only
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
- Stowed to either hand, with two-handed records claiming `bothHands`
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

- Entity stowed/backpack area
- Equipped area for character-like entities
- Left hand
- Right hand
- Container
- Another entity

`bothHands` is a resulting state, not a third simultaneous visible hand target in the default view. A two-handed item dropped into either empty hand should claim `bothHands`.

## Drop Validation

Drops should be blocked or warned when they would create invalid state:

- Dropping into a non-container record.
- Dropping into a missing container.
- Dropping a two-handed item into either hand when either hand is already occupied.
- Dropping a one-handed item while `bothHands` is occupied.
- Dropping into an occupied hand.
- Dropping a non-empty container into another container unless allowed by container data.
- Creating a container cycle.

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
- More than one item represented in the active `bothHands` display.
- Any `leftHand` or `rightHand` item while `bothHands` is occupied.
- A `bothHands` item while `leftHand` or `rightHand` is occupied.
- A two-handed item failing to claim `bothHands`.
- A one-handed item being placed in `bothHands`.
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

---

# Empty States

The inventory view should have useful empty states.

Examples:

- No entities yet: show an action to create an entity.
- Entity has no inventory: show an action to add a record.
- Coin purse is empty: show `No coins` and an add/edit action.
- Backpack is empty: show `Empty` and an add/move action.
- Container is empty: show `Empty` and an add/move action.
- Hand is empty: show `Empty hand`.

---

# Minimal Acceptance Criteria

A first complete implementation of this view should satisfy:

- Entities are displayed by active state and `sortOrder` where available.
- Character and retainer entities show an entity header, equipped section, and stowed section.
- Equipped section contains hands and other equipped items.
- Hands display either `leftHand` and `rightHand` or `bothHands`, not all three simultaneously.
- Two-handed records dropped into either empty hand claim `bothHands` and switch the hands display to the `bothHands` view.
- Hand overload states are prevented.
- Stowed section contains coin purse and backpack.
- Containers appear inside backpack/contents rather than as a separate top-level layout section.
- Mount, vehicle, and storage entities show a simpler contents layout.
- Inventory records display compact summary information.
- Coin records display denominations, derived GP value, and derived slots.
- Treasure records are always identified.
- Container records display used slots and capacity.
- Records can be moved between entity locations.
- Records can be moved into and out of containers.
- The UI does not require Firebase to function in local mode.

---

# Non-Goals

- No full OSE rules automation.
- No separate item-definition model.
- No complex permission model in this inventory-view pass.
- No exhaustive magic-item automation.
- No required literal Backpack inventory record for the backpack view section.

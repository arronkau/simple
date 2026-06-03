# Inventory View Spec

## Goal

Provide a table-usable inventory screen for managing records across party entities.

The view should prioritize fast play, clear state, and simple interactions over exhaustive rule automation.

`MODEL_SPEC.md` is the source of truth for data interfaces, invariants, and derived calculations.

This file is the source of truth for inventory UI structure and interaction behavior.

## Rules Basis

The inventory view must reflect two different entity inventory models.

### Character-Like Entities

Characters and retainers use:

1. Equipped
2. Stowed

Equipped records are held, actively used, worn, sheathed, or ready to use at short notice.

Stowed records are packed away in valid stowed storage.

For character-like entities:

- The default location for newly added non-coin records is equipped loose.
- Coin records are displayed in the coin purse.
- The coin purse is not a real container.
- Coin records count toward stowed slots.
- Non-coin stowed records must go into the character's literal backpack container or another valid container.
- On character or retainer creation, create exactly one default backpack record.
- A character-like entity may not have more than one backpack container.
- If no backpack exists, the view should warn and should not allow stowing non-coin records into backpack placement.

Hands, loose equipped items, coin purse, backpack, and containers are subdivisions of equipped/stowed. They are not separate primary inventory categories.

### Non-Character Entities

Mounts, vehicles, and storage use contents inventory.

They do not use:

- Equipped section
- Stowed section
- Hands
- Coin purse
- Backpack requirement

They display records in a contents list.

Coins may appear directly in contents or inside ordinary containers.

## Primary Objects Used by the View

- `Entity`
- `InventoryRecord`
- `InventoryLocation`
- `ContainerData`
- `SlotProfile`

Use entity terminology everywhere.

## Entity List

The inventory view displays inventory grouped by entity.

Entity types:

```ts
"character" | "retainer" | "mount" | "vehicle" | "storage"
```

Display active entities before inactive entities.

Within each active/inactive group, use `sortOrder` where available.

## Entity Header

Each entity section should show:

- Name
- Entity type
- Active/inactive state
- Equipped slots, for character-like entities
- Stowed slots, for character-like entities
- Contents slots, for non-character entities
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

## Equipped Section

The equipped section contains records that are held, worn, actively used, sheathed, or otherwise ready at short notice.

Relevant location state:

```ts
location.locationType === "equipped"
```

The equipped section has two subsections:

1. Hands
2. Other equipped

### Hands

Relevant equipped placements:

```ts
location.locationType === "equipped"
location.placement === "leftHand"
location.placement === "rightHand"
location.placement === "bothHands"
```

Hand display is exclusive:

- Show `leftHand` and `rightHand` by default.
- Show `bothHands` instead when a record occupies both hands.
- Do not show `leftHand`, `rightHand`, and `bothHands` as three simultaneous slots.

Behavior:

- Any non-coin equipped record may occupy `leftHand`, `rightHand`, or `bothHands`.
- `handsRequired` is the minimum hand count needed for active/use effects, not a placement prohibition.
- A `handsRequired: 0` record may still be placed in hand.
- A `handsRequired: 1` record is active-ready in `leftHand`, `rightHand`, or `bothHands`.
- A `handsRequired: 2` record is active-ready in `bothHands`.
- Moving a record into `bothHands` should be blocked if either hand is already occupied.
- Moving a record into `leftHand` or `rightHand` should be blocked when `bothHands` is occupied.

Validation should prevent:

- More than one item in the same hand.
- A `bothHands` item plus another hand-held item.

Empty hand states should display `Empty hand`.

### Other Equipped

Relevant equipped placement:

```ts
location.locationType === "equipped"
location.placement === "loose"
```

Use this section for equipped items that are not currently occupying hands.

Examples:

- Armor worn
- Shield slung but ready, if not occupying a hand by table ruling
- Sheathed weapon ready at short notice
- Worn cloak
- Ring
- Amulet
- Other active or ready gear
- Default placement for newly added non-coin records on character-like entities

Armor is active when:

```ts
record.recordType === "armor" &&
record.location.locationType === "equipped" &&
record.location.placement === "loose"
```

There is no separate armor location.

## Stowed Section

The stowed section contains character-like carried inventory that is packed away and not immediately ready.

Relevant location state:

```ts
location.locationType === "stowed"
```

The stowed section has two subsections:

1. Coin purse
2. Backpack

### Coin Purse

Relevant record and location:

```ts
record.recordType === "coins"
record.location.locationType === "stowed"
record.location.placement === "coinPurse"
```

The coin purse is the display section for the character-like entity's coin record.

The coin purse is not a real container.

For v1:

- Each entity should have at most one coin record.
- The view presents character-like coin records as the entity's coin purse.
- Coin records should not appear as generic loose items in the backpack.
- Coin records should not require a user-entered name.
- Coin records are always stowed for character-like entities.
- Character-like coin records count toward stowed slots.

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

Relevant stowed placements:

```ts
location.locationType === "stowed"
location.placement === "backpack"
location.containerId === backpackRecord.id
```

The backpack section represents a literal backpack container record.

Backpack requirements:

- On character or retainer creation, create exactly one default backpack record.
- The backpack is an `InventoryRecord` with `recordType: "equipment"` and `container.isBackpack === true`.
- A character-like entity may not have more than one backpack container.
- The backpack itself may be displayed as the section header rather than as a normal item row.
- Non-coin stowed records directly in the backpack must point to the backpack record ID.
- If no backpack exists, show a warning and an action to create one.
- If no backpack exists, do not allow non-coin records to be moved to backpack stowed placement.

The backpack section contains:

- Loose equipment packed in the backpack
- Loose treasure packed in the backpack
- Stowed weapons
- Stowed armor
- Containers
- Records inside containers

If the backpack is empty, show `Empty` and an add/move action.

## Containers Inline

A container is any non-coin `InventoryRecord` with `container` data.

In the character/retainer inventory view, containers are normally shown inside the Backpack section unless they are equipped in hand.

Container contents are records with:

```ts
location.placement === "container"
location.containerId === container.id
```

A container with contents held in hand, such as a sack, does not count toward encumbrance, and neither do items inside.

Each displayed container should show compactly:

- Container name
- Used slots / capacity slots
- Over-capacity warning if applicable
- Hands-required warning if applicable
- Contained records

Example:

```md
Sack — 4/6 slots — held in left hand
- Rations (3)
- Iron spikes
```

Container load is calculated from the slot burden of records whose `location.containerId` points to that container.

Container contents should be visually nested under the container.

Avoid moving containers to a separate global section.

If a container is empty, show `Empty` and an add/move action.

### Hands-Required Container Warnings

The view should warn when:

- A container has `handsRequired: 1` or `handsRequired: 2`.
- The container is non-empty.
- The container is not equipped in a hand placement.

The warning should not block play unless the resulting state violates a hard invariant.

## Mount, Vehicle, and Storage Inventory Layout

Mounts, vehicles, and storage use a simpler layout.

Use this section order:

1. Entity header
2. Contents
3. Containers inline

These entities do not use:

- Hands
- Equipped section
- Stowed section
- Coin purse
- Backpack

Relevant default location:

```ts
location.locationType === "contents"
location.placement === "contents"
```

Containers appear inline inside the contents list rather than as a separate top-level layout section.

Coins may appear directly in contents or inside ordinary containers.

## Inventory Record Display

### Row/Card Content

Each inventory record should show compact summary information as applicable:

- Display name
- Quantity, if greater than 1
- Slot burden, if greater than 1 or needed for warnings
- Coin value or treasure value where useful
- Equipped/stowed status if context is unclear
- Specific placement if context is unclear
- Uses remaining, if applicable
- Lit state, if applicable
- Warning state

Keep rows compact.

The inventory screen should not become a full rules reference page.

### Display Name

Use this display rule:

```ts
if record.identification?.identified === false:
  record.identification.unidentifiedName ?? "Unidentified Item"
else:
  record.name
```

All non-coin records must have a non-empty trimmed `name`.

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
- Whether active based on equipped loose placement
- Warning state

### Equipment Display

Equipment records may show compact metadata where useful:

- Quantity if greater than 1
- Slot burden, if greater than 1
- Container status if applicable
- Uses/light state if applicable
- Warning state

## Add and Edit Workflows

Avoid showing every possible field at once.

Use type-specific sections.

### Add Record Defaults

For character-like entities:

- Non-coin records default to equipped loose.
- Coin records default to coin purse.
- Stowed backpack placement is available only if the entity has a backpack.
- Stowed container placement is available only when a valid container exists.

For non-character entities:

- All records default to contents.
- Coin records may appear directly in contents.
- Container placement is available only when a valid container exists.

### Type-Specific Form Fields

| Record type | Required fields | Default location | Optional v1 fields | Hidden / not shown |
|---|---|---|---|---|
| `coins` on character-like entity | PP, GP, SP, CP | Coin purse | None | Name, description, identification, weapon, armor, treasure |
| `coins` on non-character entity | PP, GP, SP, CP | Contents | Container placement | Name, description, identification, weapon, armor, treasure |
| `treasure` | Name, GP value, slot profile | Character-like: equipped loose; non-character: contents | Description, placement, hands required | Identification, weapon, armor, coins |
| `weapon` | Name, slot profile | Character-like: equipped loose; non-character: contents | Description, damage, range, qualities, identification, placement, hands required, uses, modifiers | Coins, treasure, armor |
| `armor` | Name, slot profile | Character-like: equipped loose; non-character: contents | Description, base AC, armor bonus, identification, placement, hands required, uses, modifiers | Coins, treasure, weapon |
| `equipment` | Name, slot profile | Character-like: equipped loose; non-character: contents | Description, container data, uses, light, identification, placement, hands required, modifiers | Coins, treasure, weapon-only fields, armor-only fields |

### Hand Requirement Form Field

Show `handsRequired` for every non-coin record.

| Field | Required? | Default | Notes |
|---|---:|---|---|
| `handsRequired` | No | Weapons: `1`; other non-coins: `0` | Allowed values: `0`, `1`, `2`; describes minimum active/use hand count |

### Container Form Fields

Show container fields only when the user marks a non-coin record as a container.

| Field | Required? | Default | Notes |
|---|---:|---|---|
| `capacitySlots` | Yes | None | Must be `>= 0` |
| `isBackpack` | No | `false` | Only one backpack per character-like entity |
| `burdenMode` | No | `contentsOnlyWhenLoaded` | Advanced field; may be hidden behind details |

### Slot Profile Form Fields

| Slot kind | Fields shown | Notes |
|---|---|---|
| `fixed` | slots | Use for most records |
| `stackable` | quantity, perSlot | Use for torches, rations, ammunition, similar records |
| `coins` | PP, GP, SP, CP | Use only for `recordType: "coins"` |

### Location Form Fields

| Entity type | Record type | Allowed location controls |
|---|---|---|
| character/retainer | coins | Coin purse only |
| character/retainer | non-coin | Equipped loose, left hand, right hand, both hands, backpack if backpack exists, container if valid container exists |
| mount/vehicle/storage | any | Contents, container if valid container exists |

### Edit Record

Editing a record should allow changes to relevant fields only.

Potential fields:

- Name and description
- Quantity or slot profile
- GP value
- Coin denominations
- Hands required
- Location and placement
- Container data
- Identification data for weapons, armor, and equipment only
- Light/use data
- Weapon/armor data where applicable

Do not expose identification fields for coins or treasure.

Coin editing should update the entity's single coin record instead of creating duplicates.

## Move Record

Moving a record should update only `location` and `sortOrder` unless the user also edits the record.

Common character-like moves:

- Equipped loose to held hand
- Held hand to equipped loose
- Equipped loose to backpack, only if backpack exists
- Backpack to equipped loose
- Backpack to left hand
- Backpack to right hand
- Backpack to both hands
- Backpack into container
- Container to backpack
- To another entity

Common non-character moves:

- Contents to container
- Container to contents
- To another entity

When moving a container to another entity, contained records should move with it according to the model invariant.

## Drag and Drop

Do not implement drag-and-drop in the initial pass.

Use explicit buttons, menus, or move actions for v1.

Drag-and-drop may be considered later, but it is not part of v1 acceptance criteria.

## Minimal Acceptance Criteria

- Character-like entities show equipped and stowed sections.
- Character-like entities show hand occupancy correctly.
- Character-like entities show coin purse as display-only placement, not as a real container.
- Character-like entities receive exactly one default backpack record on creation.
- Character-like entities cannot stow non-coin records in backpack placement without a backpack container.
- Mounts, vehicles, and storage show contents only.
- Mounts, vehicles, and storage do not show hands, equipped, stowed, coin purse, or backpack sections.
- Non-character coin records can appear in contents.
- Containers render inline with nested contents.
- Hands-required containers warn when non-empty and not held.
- Held hands-required containers and contents are excluded from encumbrance.
- Empty ordinary containers contribute their own slot burden.
- Non-empty ordinary containers contribute contents burden only unless marked heavy.
- Movement uses the slower of equipped and stowed burden.
- Add/edit forms show only fields relevant to the selected record type.
- No drag-and-drop is required.

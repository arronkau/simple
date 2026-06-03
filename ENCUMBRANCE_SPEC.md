# Encumbrance Spec

## Goal

Define movement and encumbrance behavior for the inventory app.

This file is the source of truth for movement-rate calculations, encumbrance warnings, and the distinction between equipped and stowed carried items. Data model fields belong in `MODEL_SPEC.md`. UI layout belongs in `INVENTORY_VIEW_SPEC.md`.

## Terminology Mapping

The rules PDF uses **packed** items. This app uses **stowed** items.

Treat these as the same concept:

```text
packed == stowed
```

The app should display `stowed`, not `packed`.

## Rules Basis

For character-like entities, movement rate is determined by looking up both equipped items and packed/stowed items, then using the slower movement rate.

Rules table:

| Equipped items | Stowed items | Movement rate |
|---:|---:|---:|
| 0–3 | 0–10 | 120' (40') |
| 4–5 | 11–12 | 90' (30') |
| 6–7 | 13–14 | 60' (20') |
| 8–9 | 15–16 | 30' (10') |

Maximum load:

- More than 9 equipped items means the character cannot move.
- More than 16 stowed items means the character cannot move.

The slower of the equipped-rate lookup and stowed-rate lookup is the character's movement rate.

## Core Types

Suggested derived result type:

```ts
export type MovementRate = {
  explorationFeet: number;
  encounterFeet: number;
};

export type EncumbranceBand =
  | "normal"
  | "lightlyEncumbered"
  | "encumbered"
  | "heavilyEncumbered"
  | "overloaded";

export type CharacterEncumbranceResult = {
  equippedItems: number;
  stowedItems: number;
  equippedRate: MovementRate;
  stowedRate: MovementRate;
  movement: MovementRate;
  overloaded: boolean;
  overloadedReason?: "equipped" | "stowed" | "both";
  band: EncumbranceBand;
};

export type ContentsCapacityResult = {
  usedSlots: number;
  capacitySlots?: number;
  overloaded: boolean;
};
```

## Counting Item Burden

The app uses the slot burden calculated from `SlotProfile` as item count for this encumbrance system.

```ts
itemCount = recordSlots(record)
```

Examples:

- fixed 1 slot item = 1 item
- fixed 2 slot item = 2 items
- stackable 6 torches at 3 per slot = 2 items
- 100 coins = 1 item
- 101 coins = 2 items
- tiny / 0-slot item = 0 items

Do not separately implement OSE coin-weight encumbrance for this ruleset.

## Character-Like Equipped Count

For characters and retainers, equipped item count includes records whose own location is `equipped`, except records excluded by the held hands-required container rule.

Records inside a held hands-required container are modeled normally as container contents, but they are excluded from movement-restricting encumbrance. They should not be counted as equipped or stowed burden.

Suggested helper:

```ts
getEffectiveCarryState(record, allRecords): "equipped" | "stowed" | "contents" | "excluded"
```

A contained record is excluded when its nearest containing ancestor is a container record with record-level `handsRequired > 0` and is equipped in a hand placement.

## Character-Like Stowed Count

For characters and retainers, stowed item count includes:

- records inside the literal backpack container;
- records inside ordinary containers that are themselves stowed in the backpack;
- the character-like entity's coin record in coin-purse placement;
- other records that are effectively stowed by helper logic.

A record inside a held hands-required container should not be counted as stowed for movement if the helper classifies it as excluded.

## Backpack and Coin Purse Treatment

The backpack is a literal container.

The coin purse is not a real container. It is a character-like coin placement/display concept.

For encumbrance:

- Container burden follows the container's `burdenMode`.
- Empty `contentsOnlyWhenLoaded` containers count their own slot burden in their current carry bucket.
- Non-empty `contentsOnlyWhenLoaded` containers do not count their own slot burden; their contents count normally unless another rule excludes them.
- `containerPlusContents` containers count both their own slot burden and their contents.
- `fixedOnly` containers count only their own slot burden; descendants do not contribute to encumbrance.
- The character-like coin record in coin-purse placement counts toward stowed slots according to coin burden.
- There is no coin-purse inventory record, container ID, capacity, or separate slot burden.
- Contents count according to their own slot burden unless excluded by an explicit container rule.
- Container used capacity excludes the container's own burden.
- Held hands-required containers and their contents are excluded from equipped and stowed movement burden.

## Held Hands-Required Containers

Some container records require hands via record-level `handsRequired`:

- small sack: likely `handsRequired: 1`
- large sack: likely `handsRequired: 2`
- chest: likely `handsRequired: 2`

Rules:

- A container record with `handsRequired > 0` may contain items while held.
- If it contains items and is not held, warn.
- If held, the container occupies the appropriate hand placement.
- Its contents remain modeled as container contents.
- Held hands-required containers and their contents are excluded from movement-restricting encumbrance.
- The app should still show the held container's contained slot total for visibility.
- A non-empty hands-required container that is not held should warn.

## Movement Lookup

Suggested helper:

```ts
function getMovementRateForEquippedItems(equippedItems: number): MovementRate | "overloaded";
```

Rules:

```text
0–3 -> 120 / 40
4–5 -> 90 / 30
6–7 -> 60 / 20
8–9 -> 30 / 10
10+ -> overloaded
```

Suggested helper:

```ts
function getMovementRateForStowedItems(stowedItems: number): MovementRate | "overloaded";
```

Rules:

```text
0–10 -> 120 / 40
11–12 -> 90 / 30
13–14 -> 60 / 20
15–16 -> 30 / 10
17+ -> overloaded
```

Suggested helper:

```ts
function getSlowerMovementRate(a: MovementRate, b: MovementRate): MovementRate;
```

Compare by `explorationFeet`. The encounter value should match the same row.

## Character Encumbrance Calculation

Suggested helper:

```ts
function getCharacterEncumbrance(entity, records): CharacterEncumbranceResult;
```

Steps:

1. Confirm entity is `character` or `retainer`.
2. Derive effective carry state for each owned record.
3. Exclude held hands-required containers and descendants from movement burden.
4. Sum effective slot burden for records contributing to equipped burden.
5. Sum effective slot burden for records contributing to stowed burden.
6. Look up equipped movement rate.
7. Look up stowed movement rate.
8. If either side is overloaded, return movement `0 / 0`.
9. Otherwise return the slower movement rate.

## Non-Character Capacity

Mounts, vehicles, and storage do not use equipped/stowed movement bands.

They use contents capacity only.

Suggested helper:

```ts
function getContentsCapacity(entity, records): ContentsCapacityResult;
```

Rules:

- Sum all owned records using contents location, including records inside containers.
- If `entity.capacitySlots` exists, warn when used slots exceed capacity.
- Do not calculate equipped/stowed movement for mounts, vehicles, or storage.

Mounts and vehicles may derive their capacity from coin capacity divided by 100 when importing OSE-style mount/vehicle data.

```ts
capacitySlots = Math.floor(coinCapacity / 100)
```

## Strength Modifier Rule

The STR modifier adjusts stowed item thresholds.

If later implemented:

- apply the character's melee STR modifier to stowed thresholds only;
- do not apply it to equipped thresholds;
- keep it behind an explicit setting.

## Examples

### Example 1 — Morgan

Morgan carries:

- 6 equipped items
- 4 stowed items

Equipped lookup:

```text
6 equipped -> 60' / 20'
```

Stowed lookup:

```text
4 stowed -> 120' / 40'
```

Final movement:

```text
60' / 20'
```

The slower rate wins.

### Example 2 — Stowed Overload

A character has:

- 2 equipped items
- 17 stowed items

Result:

```text
overloaded, 0' / 0'
```

Reason: more than 16 stowed items.

### Example 3 — Equipped Overload

A character has:

- 10 equipped items
- 5 stowed items

Result:

```text
overloaded, 0' / 0'
```

Reason: more than 9 equipped items.

### Example 4 — Held Sack With Contents

A character has:

- Sack, `handsRequired: 1`, equipped in right hand, fixed 1 slot
- Rations inside sack, fixed 3 slots

Effective classification:

```text
Sack -> excluded from movement burden while held
Rations -> excluded from movement burden by held-container ancestry
```

Equipped count contribution:

```text
0
```

Stowed count contribution:

```text
0
```

Visible contained slot total:

```text
3
```

No warning is shown because the non-empty hands-required container is held.

### Example 5 — Literal Backpack

A character has:

- Backpack, equipped loose, fixed 1 slot
- Rope inside backpack, fixed 1 slot
- Torches inside backpack, stackable 6 at 3 per slot = 2 slots

Effective classification:

```text
Backpack -> equipped, 0 slots because it is a loaded contents-only container
Rope -> stowed
Torches -> stowed
```

Equipped count contribution:

```text
0
```

Stowed count contribution:

```text
3
```

Visible backpack capacity:

```text
3 / 16
```

### Example 6 — Yost Contents-Only Containers

Assume a backpack and a small sack are both `contentsOnlyWhenLoaded` containers with fixed 1 slot. Assume every other item is a simple fixed 1 slot item.

Empty backpack:

```text
Yost (equipped 1 / stowed 0 / total 1)
- hands: empty
- backpack: empty
```

Loaded backpack:

```text
Yost (equipped 0 / stowed 1 / total 1)
- hands: empty
- backpack:
  - treasure item
```

The backpack capacity display is `1 / 16`, but the backpack's own fixed slot does not count while loaded.

Loaded backpack with empty sack:

```text
Yost (equipped 0 / stowed 2 / total 2)
- hands: empty
- backpack:
  - treasure item
  - small sack: empty
```

The empty sack counts as 1 stowed slot. The loaded backpack does not count its own slot.

Loaded backpack with empty held sack:

```text
Yost (equipped 1 / stowed 1 / total 2)
- hands:
  - small sack: empty
- backpack:
  - treasure item
```

Loaded backpack with loaded held sack:

```text
Yost (equipped 0 / stowed 1 / total 1)
- hands:
  - small sack:
    - treasure item
    - treasure item
- backpack:
  - treasure item
```

The loaded held sack and its contents do not count toward movement encumbrance. The loaded backpack's contents still count as stowed.

## Acceptance Criteria

- Equipped and stowed counts are derived from inventory records, not stored manually.
- The app uses `stowed` internally/display-wise for the PDF's `packed` category.
- Character/retainer movement uses the slower of equipped and stowed movement lookups.
- 10+ equipped items causes overloaded movement `0 / 0`.
- 17+ stowed items causes overloaded movement `0 / 0`.
- Mounts, vehicles, and storage use contents capacity, not equipped/stowed bands.
- Backpack is a literal inventory record and follows the same container burden modes as other containers.
- Empty contents-only containers count their own slot burden; loaded contents-only containers count contents only.
- Coin purse is not a literal inventory record; character-like coin records in coin-purse placement count toward stowed burden.
- Coin burden is `ceil(totalCoins / 100)`.
- Held hands-required containers and their contents are excluded from equipped and stowed movement burden.
- The app still shows held hands-required container contained slot totals for visibility.
- A hands-required container with contents warns when not held.

## Non-Goals

- No OSE coin-weight encumbrance for this campaign ruleset.
- No automatic combat action or retrieval timing for carried sacks/containers.
- No drag-and-drop dependency.
- No combat action automation.
- No full vehicle movement rules.

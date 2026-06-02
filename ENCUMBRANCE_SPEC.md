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

The app should display `stowed`, not `packed`, unless quoting rules text.

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
  usedItems: number;
  capacityItems?: number;
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

For characters and retainers, equipped item count includes:

- records whose own location is `equipped`;
- records inside a held container that has `handsRequired > 0` and is equipped in a valid hand placement.

This second rule is intentional. A sack with contents may be held in hand, and the model must be able to treat the sack and its contents as equipped for later special-rule handling.

For now, implement only the classification/counting hook. Do not implement special movement exemptions for held sacks yet.

Suggested helper:

```ts
getEffectiveCarryState(record, allRecords): "equipped" | "stowed" | "contents"
```

A contained record is effectively equipped when its nearest containing ancestor with `handsRequired > 0` is equipped in a valid hand placement.

## Character-Like Stowed Count

For characters and retainers, stowed item count includes:

- records inside the literal backpack container;
- records inside ordinary containers that are themselves stowed in the backpack;
- the coin record inside the literal coin purse;
- other records that are effectively stowed by helper logic.

A record inside a held hands-required container should not be counted as stowed for movement if the helper classifies it as effectively equipped.

## Backpack and Coin Purse Treatment

Backpack and coin purse are literal containers.

For encumbrance:

- Backpack's own slot burden counts according to its `slotProfile` when equipped/worn.
- Coin purse's own slot burden counts according to its `slotProfile` when equipped/worn.
- Contents count according to their own slot burden.
- Container used capacity excludes the container's own burden.
- Entity movement burden includes both the container's own burden and its contents, unless a later explicit rule changes this.

## Held Hands-Required Containers

Some containers require hands:

- small sack: likely `handsRequired: 1`
- large sack: likely `handsRequired: 1` or `2`, depending on campaign data
- chest: likely `handsRequired: 2`

Rules:

- A container with `handsRequired > 0` may contain items while held.
- If it contains items and is not held, warn.
- If held, the container occupies the appropriate hand placement.
- Its contents remain modeled as container contents but may be treated as effectively equipped by encumbrance helpers.
- Future special rules may exempt or alter how a held container and its contents affect movement. Do not hard-code that exemption until a later task explicitly requests it.

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
3. Sum record slot burden for effectively equipped records.
4. Sum record slot burden for effectively stowed records.
5. Look up equipped movement rate.
6. Look up stowed movement rate.
7. If either side is overloaded, return movement `0 / 0`.
8. Otherwise return the slower movement rate.

## Non-Character Capacity

Mounts, vehicles, and storage do not use equipped/stowed movement bands.

They use contents capacity only.

Suggested helper:

```ts
function getContentsCapacity(entity, records): ContentsCapacityResult;
```

Rules:

- Sum all owned records using contents location, including records inside containers.
- If `entity.capacitySlots` exists, warn when used items exceed capacity.
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
Sack -> equipped
Rations -> equipped by held-container ancestry
```

Equipped count contribution:

```text
1 + 3 = 4
```

Stowed count contribution:

```text
0
```

This prepares the data model for future special handling of carried containers. Do not implement a special exemption yet.

### Example 5 — Literal Backpack

A character has:

- Backpack, equipped loose, fixed 1 slot
- Rope inside backpack, fixed 1 slot
- Torches inside backpack, stackable 6 at 3 per slot = 2 slots

Effective classification:

```text
Backpack -> equipped
Rope -> stowed
Torches -> stowed
```

Equipped count contribution:

```text
1
```

Stowed count contribution:

```text
3
```

## Acceptance Criteria

- Equipped and stowed counts are derived from inventory records, not stored manually.
- The app uses `stowed` internally/display-wise for the PDF's `packed` category.
- Character/retainer movement uses the slower of equipped and stowed movement lookups.
- 10+ equipped items causes overloaded movement `0 / 0`.
- 17+ stowed items causes overloaded movement `0 / 0`.
- Mounts, vehicles, and storage use contents capacity, not equipped/stowed bands.
- Backpack and coin purse are counted as literal inventory records according to their slot profile.
- Coin burden is `ceil(totalCoins / 100)`.
- A held hands-required container can make its contents effectively equipped for counting.
- A hands-required container with contents warns when not held.

## Non-Goals

- No OSE coin-weight encumbrance for this campaign ruleset.
- No automatic special exemption for carried sacks/containers yet.
- No drag-and-drop dependency.
- No combat action automation.
- No full vehicle movement rules.

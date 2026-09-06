# Encumbrance Spec

## Goal

Define movement and encumbrance behavior for the inventory app.

This file is the source of truth for movement-rate calculations, encumbrance warnings, and the distinction between equipped and stowed carried items. Data model fields belong in `MODEL_SPEC.md`. UI layout belongs outside this file.

## Terminology Mapping

The rules PDF uses **packed** items. This app uses **stowed** items.

Treat these as the same concept:

```text
packed == stowed
```

The app should display `stowed`, not `packed`.

## Rules Basis

For character-like entities, movement rate is determined by looking up both equipped items and packed/stowed items, then using the slower movement rate.

Rules table (stowed thresholds are shown for STR modifier 0; see the Strength Modifier Rule):

| Equipped items | Stowed items | Movement rate |
|---:|---:|---:|
| 0–3 | 0–10 | 120' (40') |
| 4–5 | 11–12 | 90' (30') |
| 6–7 | 13–14 | 60' (20') |
| 8–9 | 15–16 | 30' (10') |

Maximum load:

- More than 9 equipped items means the character cannot move.
- More than 16 + STR modifier stowed items means the character cannot move.
- There is no combined equipped + stowed limit. The sheet has two independent lists; each is checked on its own.
- A container over capacity on a character-like entity is an overload condition and the character cannot move.
- A non-empty hands-required container left at equipped/loose (not held in a hand) is an overload condition and the character cannot move. Hands requirements are not enforced at `stowedRoot`, inside another container, or in non-character contents.

The slower of the equipped-rate lookup and stowed-rate lookup is the character's movement rate when no overload condition applies.

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
  overloadedReason?: "equipped" | "stowed" | "both" | "container" | "invalid";
  band: EncumbranceBand;
  strengthModifier: number;
  equippedCapacity: number; // 9
  stowedCapacity: number; // 16 + strengthModifier
};

export type ContentsCapacityResult = {
  usedSlots: number;
  capacitySlots?: number;
  overloaded: boolean;
};
```

## Counting Item Burden

The app uses the slot burden calculated from the record's `InventoryBurden` (`MODEL_SPEC.md`, Inventory Quantity And Burden) as item count for this encumbrance system. `slotProfile` is a retired field name that survives only as a legacy input to state parsing (`src/model/appState.ts`).

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

For characters and retainers, equipped item count includes records whose own location is `equipped`, except records excluded by the held-container contents rule.

Records inside any hand-held container are modeled normally as container contents, but they are excluded from movement-restricting encumbrance. They should not be counted as equipped or stowed burden. The held container itself still counts in its equipped hand placement.

Suggested helper:

```ts
getEffectiveCarryState(record, allRecords): "equipped" | "stowed" | "contents" | "excluded"
```

A contained record is excluded when any containing ancestor is a container record equipped in `leftHand`, `rightHand`, or `bothHands`. This is allowed even though the contained record itself has `location.kind === "container"`; effective movement status is derived from the ancestor chain.

## Character-Like Stowed Count

For characters and retainers, stowed item count includes:

- records inside the top-level stowed container, normally named Backpack;
- records inside ordinary containers that are themselves stowed in the top-level stowed container;
- coin records stowed like any other record (inside the top-level stowed container or a container within it);
- records inside any valid same-entity container whose ancestor chain makes them effectively stowed;
- other records that are effectively stowed by helper logic.

A record inside a hand-held container should not be counted as stowed for movement if the helper classifies it as excluded.

## Backpack and Coin Treatment

The top-level stowed container is a literal container, normally named Backpack. It is identified by `location.kind === "stowedRoot"`, not by special container metadata.

Coins are ordinary inventory records with no placement of their own. A coin record counts wherever it sits: stowed inside the top-level stowed container, equipped at `placement: "loose"`, or in a non-character entity's contents. Coins may not be placed in a hand.

For encumbrance:

- Containers count their own slot burden whether empty or full, except that a
  record whose own location is `stowedRoot` contributes 0 own movement burden.
- Contents inside containers also count toward movement encumbrance, except when the container is carried in hand.
- When a container is carried in hand, the container itself still counts but its contents are excluded from movement encumbrance.
- A coin record counts according to coin burden in whichever band its ancestor chain puts it (equipped or stowed).
- Contents count according to their own slot burden unless excluded by the held-container contents rule.
- Container used capacity excludes the container's own burden.
- Contents inside hand-held containers are excluded from equipped and stowed movement burden.

## Held Containers

Some container records require hands via record-level `handsRequired`:

- small sack: likely `handsRequired: 1`
- large sack: likely `handsRequired: 2`
- chest: likely `handsRequired: 2`

Rules:

- A container record with `handsRequired > 0` may contain items while held.
- If held, the container occupies the appropriate hand placement.
- Its contents remain modeled as container contents.
- The held container itself counts toward movement-restricting encumbrance.
- A container with `capacityByHands` resolves to its one-hand capacity in
  `leftHand` or `rightHand`, and its two-hand capacity in `bothHands`.
- Outside a hand placement, a container uses `capacitySlots` when one is
  defined and otherwise falls back to `capacityByHands.twoHands`: a container
  can never hold more than its two-handed maximum, wherever it sits, except at
  the stowed root, which has no capacity of its own. The resolved capacity can
  create a capacity warning and an overload like any other container capacity.
- Contents inside any hand-held container are excluded from movement-restricting encumbrance.
- The app should still show the held container's contained slot total for visibility.
- `handsRequired` describes carrying the container **in hand**. It is only enforceable when the container's own location is `equipped` with `placement: "loose"`: a non-empty hands-required container left at equipped/loose creates an overload condition — the character cannot move.
- All other placements never trigger the hands requirement: a `stowedRoot` container is worn on the back (a `handsRequired: 2` backpack is fine there), a container nested inside another container is packed cargo, non-character `contents` are carried by the mount/vehicle/storage entity, and hand placements satisfy the requirement.

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

### Movement tables and explanation (display helpers)

The sheet lets a player click a movement number to see what produced it. The
helpers behind those views derive from the same constants as the lookups above
and never store anything:

```ts
function getEquippedMovementBands(): MovementBand[];
function getStowedMovementBands(strengthModifier?: number): MovementBand[];
function getMovementExplanation(entity: Entity, records: InventoryRecord[]): MovementExplanation;
```

- A `MovementBand` is one row of a table: `band`, `minItems`, `maxItems`
  (`null` for the open-ended overloaded row), and `movement`. The stowed rows
  shift by the STR modifier exactly as `getMovementRateForStowedItems` does,
  so the displayed table and the lookup can never disagree (a fixture checks
  every row boundary for each modifier −3…+3).
- `MovementExplanation` carries both lookups (`equipped`, `stowed` with the
  STR modifier and each side's items/capacity), the two overload conditions
  (`containerOverCapacity`, `handsRequiredContainerNotHeld`), the final
  `movement`, and `limitedBy`: without an overload, the side(s) whose lookup
  equals the final rate (both when they tie); with one, every overload
  condition that applies.

## Character Encumbrance Calculation

Suggested helper:

```ts
function getCharacterEncumbrance(entity, records): CharacterEncumbranceResult;
```

Steps:

1. Confirm entity is `character` or `retainer`.
2. Derive effective carry state for each owned record.
3. Exclude descendants of hand-held containers from movement burden.
4. Sum effective slot burden for records contributing to equipped burden.
5. Sum effective slot burden for records contributing to stowed burden.
6. Look up equipped movement rate.
7. Look up stowed movement rate.
8. If either side is overloaded, a carried container is over capacity, or a non-empty hands-required container sits at equipped/loose, return movement `0 / 0`.
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

Aspirational, not implemented: mounts and vehicles may derive their capacity
from coin capacity divided by 100 when importing OSE-style mount/vehicle data.

```ts
capacitySlots = Math.floor(coinCapacity / 100)
```

No code path applies this rule today — there is no mount/vehicle import, and
`entity.capacitySlots` has no editor either, so the value can only arrive
through imported JSON. See `TASKS.md` (missing entity capacity/movement editor).

## Strength Modifier Rule

Source: the OSE Advanced Fantasy character sheet's Packed Items list. Its rows
have fixed movement-band boundaries, and the top rows are labelled STR 18+,
16+, 13+, 9+, 6+, 4+. A character keeps the rows at or below their STR label,
so the STR modifier (−3 to +3) removes or adds rows at the top of the list and
every packed threshold shifts by it. The app applies this rule always (this
campaign uses it); it is not a setting.

- `strengthModifier` = the character's ability-score modifier for STR; 0 when
  STR is blank or the entity has no character data. Retainers use the same rule.
- Stowed lookup uses `stowedItems − strengthModifier` against the table above.
- Stowed capacity = `16 + strengthModifier` (13 to 19).
- Equipped thresholds and the equipped limit of 9 never change.

Worked example, STR 18 (+3): 13 stowed → 120', 15 → 90', 17 → 60', 19 → 30',
20 → overloaded. STR 3 (−3): 7 stowed → 120', 13 → 30', 14 → overloaded.

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

Reason: more than 16 stowed items (STR modifier 0).

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

- Sack, `handsRequired: 1`, equipped in right hand, no own slot burden,
  `capacityByHands: { oneHand: 6, twoHands: 12 }`
- Rations inside sack, fixed 3 slots

Effective classification:

```text
Sack -> equipped, 0 slots
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

- Backpack, stowed root, fixed 1 slot
- Rope inside backpack, fixed 1 slot
- Torches inside backpack, stackable 6 at 3 per slot = 2 slots

Effective classification:

```text
Backpack -> stowed, 0 own movement slots (`stowedRoot` exception)
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

Visible backpack usage:

```text
3 / —
```

The top-level stowed container has no capacity of its own while it is the
stowed root: the stowed limit (16 + STR modifier) governs the packed list. Its
catalog `capacitySlots` applies again if it is carried in hand or packed
inside something else.

### Example 6 — Yost Containers

Assume a backpack and a small sack are containers with fixed 1 slot. Assume every other item is a simple fixed 1 slot item.

Empty backpack:

```text
Yost (equipped 0 / stowed 0 / total 0)
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

The backpack shows `1 / —` (no capacity of its own at the stowed root); the
backpack's own fixed slot does not count toward movement while it is the
stowed root.

Loaded backpack with empty sack:

```text
Yost (equipped 0 / stowed 2 / total 2)
- hands: empty
- backpack:
  - treasure item
  - small sack: empty
```

The empty sack counts as 1 stowed slot. The loaded backpack does not count its
own slot while it is the stowed root.

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
Yost (equipped 1 / stowed 1 / total 2)
- hands:
  - small sack:
    - treasure item
    - treasure item
- backpack:
  - treasure item
```

The loaded held sack counts its own slot, but its contents do not count toward
movement encumbrance. The loaded backpack's contents count; the stowed-root
backpack's own burden does not.

## Acceptance Criteria

- Equipped and stowed counts are derived from inventory records, not stored manually.
- The app uses `stowed` internally/display-wise for the PDF's `packed` category.
- Character/retainer movement uses the slower of equipped and stowed movement lookups.
- 10+ equipped items causes overloaded movement `0 / 0`.
- Stowed items above 16 + STR modifier cause overloaded movement `0 / 0`; the
  STR modifier shifts every stowed threshold and never touches equipped.
- Equipped + stowed above 16 is not, by itself, an overload.
- Container over its resolved capacity on a character-like entity causes
  overloaded movement `0 / 0`; undefined capacity is not an overload. A
  container at `stowedRoot` has undefined capacity (the stowed limit governs).
- A non-empty hands-required container at equipped/loose causes overloaded movement `0 / 0`. The same container at `stowedRoot` (worn), nested inside another container (packed cargo), in non-character contents, or in a hand does not.
- Mounts, vehicles, and storage use contents capacity, not equipped/stowed bands.
- Backpack is a literal inventory record; while its own location is
  `stowedRoot`, its own movement burden is 0.
- Containers count their own slot burden whether empty or full, except for the
  `stowedRoot` movement-burden exemption.
- Contents inside containers count unless excluded by the held-container contents rule.
- Coins are ordinary records: a coin record inside the top-level stowed container counts toward stowed burden, one at equipped/loose counts toward equipped burden.
- Coin burden is `ceil(totalCoins / 100)`.
- Contents inside hand-held containers are excluded from equipped and stowed movement burden.
- The held container itself still counts.
- Hand-dependent container capacity resolves from the container's current hand
  placement; everywhere else it falls back to `capacitySlots` when defined and
  otherwise to `capacityByHands.twoHands`.
- The app still shows held container contained slot totals for visibility.
- A hands-required container with contents overloads the character only when left at equipped/loose.

## Non-Goals

- No OSE coin-weight encumbrance for this campaign ruleset.
- No automatic combat action or retrieval timing for carried sacks/containers.
- Drag-and-drop must use the same validated move and encumbrance logic as non-drag workflows.
- No combat action automation.
- No full vehicle movement rules.

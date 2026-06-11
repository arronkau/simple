---
name: encumbrance-rules
description: Domain rules and test conventions for the `simple` TTRPG inventory app. Use whenever changing inventory, encumbrance, movement-rate, slot-burden, container, coin, or movement-warning logic, OR when adding/running tests. Covers the slot/movement rules from ENCUMBRANCE_SPEC.md and the project's fixture-based test harness.
---

# Encumbrance & Inventory Rules

This skill keeps changes to `simple`'s inventory engine consistent with its spec and test conventions.

## Source of truth

- **Rules:** [ENCUMBRANCE_SPEC.md](../../../ENCUMBRANCE_SPEC.md) is authoritative for movement/encumbrance. [MODEL_SPEC.md](../../../MODEL_SPEC.md) owns data-model fields. Never put UI layout in these specs.
- **Implementation:** [src/model/encumbrance.ts](../../../src/model/encumbrance.ts). Slot burden helpers live in [src/model/calculations.ts](../../../src/model/calculations.ts).
- If you change behavior, update the spec AND the fixtures in the same change. If code and spec disagree, stop and surface it — don't silently pick one.

## Core invariants (don't break these)

- **Counts are derived, never stored.** Equipped/stowed counts come from inventory records via `recordSlots`, not manual fields.
- **Item count = slot burden.** `itemCount = recordSlots(record)`. Coin burden is `ceil(totalCoins / 100)`. Tiny/0-slot items count 0.
- **Character/retainer movement = slower of equipped-lookup and stowed-lookup** (compare by `explorationFeet`; encounter value matches the same row).
- **Movement tables** (see spec for full table):
  - Equipped: `0–3→120/40`, `4–5→90/30`, `6–7→60/20`, `8–9→30/10`, `10+→overloaded`.
  - Stowed: `0–10→120/40`, `11–12→90/30`, `13–14→60/20`, `15–16→30/10`, `17+→overloaded`.
- **Overload → `0/0`** when: >9 equipped, >16 stowed, >16 total, a carried container over capacity, or a non-empty hands-required container that is NOT held/equipped.
- **Held-container rule:** contents inside any hand-held container are EXCLUDED from movement burden, but the container itself still counts in its equipped hand. Use `getEffectiveCarryState` / the ancestor chain — never infer from a record's own `location.kind` alone.
- **Containers always count their own slot burden** whether empty or full. Container used-capacity EXCLUDES the container's own burden.
- **Backpack is a literal record** (`location.kind === "stowedRoot"`). **Coin purse is NOT a record** — it's a coin placement; the coin record counts toward stowed slots.
- **Mounts/vehicles/storage** use `getContentsCapacity` only — never equipped/stowed bands. Imported OSE capacity = `floor(coinCapacity / 100)`.
- Terminology: the rules PDF says **packed**; this app uses **stowed** everywhere (internal + display).
- Drag-and-drop must reuse the same validated move + encumbrance logic as non-drag paths.

When in doubt, find the matching worked example in the spec (Morgan, held sack, Yost containers, etc.) and make the code reproduce it exactly.

## Test convention (this repo is non-standard)

There is no Jest/Vitest. Tests are **manual fixtures** compared by deep JSON equality.

- Each module `foo.ts` has a sibling `foo.fixtures.ts` exporting `const FOO_MANUAL_FIXTURES: { name, actual, expected }[]`.
- `actual` calls the real function; `expected` is the literal result. The runner asserts `JSON.stringify(actual) === JSON.stringify(expected)`.
- Register new fixture arrays in [src/run-fixtures.test.ts](../../../src/run-fixtures.test.ts) (import + spread into `manualFixtures`).
- **Run:** `npm test` (esbuild-bundles `run-fixtures.test.ts` then executes it). Also run `npm run typecheck` (`tsc --noEmit`).

### Adding a test
1. Open the relevant `*.fixtures.ts` (e.g. `src/model/encumbrance.fixtures.ts`).
2. Push a `{ name, actual: theFunction(input), expected: <literal> }` entry to its exported array.
3. If it's a brand-new fixtures file, add its import + spread to `src/run-fixtures.test.ts`.
4. `npm test && npm run typecheck`.

Because comparison is JSON string equality, key order and shape must match exactly — mirror the result type's field order.

## Workflow for an encumbrance change
1. Read the relevant spec section and the existing fixtures for the function.
2. Edit `encumbrance.ts` (or `calculations.ts`).
3. Add/adjust fixtures covering the changed branch, including an overload edge case.
4. `npm test && npm run typecheck`.
5. Update `ENCUMBRANCE_SPEC.md` if behavior changed.

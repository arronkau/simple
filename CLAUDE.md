# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`simple` is a small TTRPG (OSR/OSE) party, inventory, and character tracker for table use. It runs entirely client-side, with localStorage as the default persistence and optional Firebase (anonymous auth + Firestore) sync when env vars are present.

## Commands

```bash
npm run dev         # Vite dev server (prints local URL)
npm run typecheck   # tsc --noEmit
npm run test        # bundles + runs the fixture suite (see Testing below)
npm run build       # tsc --noEmit && vite build
```

There is no lint step. `npm run build` typechecks first, so build failures are often type errors.

## Testing

There is no test framework (no Jest/Vitest). Tests are **manual fixtures**: arrays of `{ name, actual, expected }` objects deep-equality–checked via `JSON.stringify`.

- Most modules `foo.ts` have a sibling `foo.fixtures.ts` exporting a `*_MANUAL_FIXTURES` array. `actual` calls the real function; `expected` is a hardcoded literal. Real exceptions: `src/model/handoutRoster.fixtures.ts` is a transcribed catalog table with no sibling module (it also exports `HANDOUT_ROSTER_SLUGS`, which `campaign.fixtures.ts` imports); `src/App.fixtures.ts` and `src/party-gear/gearHands.fixtures.ts` cover UI helpers outside `src/model/`.
- `src/store/useAppStore.fixtures.ts` is different in kind: its blocks drive one shared Zustand store at module load, so the order of the arrays in `run-fixtures.test.ts` is part of the test, and each block must capture its `actual` values while it runs — a lazily-read `actual` would observe a later block's state.
- All fixture arrays are imported and concatenated in [src/run-fixtures.test.ts](src/run-fixtures.test.ts). **Adding a new fixtures file requires wiring its export into that file** (import + spread into `manualFixtures`), or it silently never runs.
- `npm run test` ([scripts/run-tests.mjs](scripts/run-tests.mjs)) esbuild-bundles that file to `.test-dist/` and runs it; the first mismatch throws with the fixture's `name`. There is no single-test runner — the whole suite runs together.

Because comparison is `JSON.stringify`, object **key order matters** (build `expected` in the order the code emits) and `undefined`/`NaN` follow JSON rules. The `encumbrance-rules` skill documents this convention in more depth.

## Architecture

Layers, from pure to stateful:

- **`src/model/`** — pure domain logic, no React. This is where rules live: types, app/party state, entities, characters, inventory record creation/movement, slot/encumbrance math, AC and save-table calculations, validation, and the GM/player permission model. Functions here are the unit under test (nearly every module has a `.fixtures.ts` sibling; see Testing for the exceptions).
- **`src/store/useAppStore.ts`** — a single Zustand store. All mutations (entity CRUD, inventory create/move/swap/delete, coin spend/transfer, party switching, user profiles) go through store actions, which call into `model/`, enforce permissions, and persist. It also owns the Firebase sync lifecycle.
- **`src/persistence/`** — Firebase config detection + `firebaseSync.ts` (lazy-imports the `firebase` SDK, anonymous auth, Firestore real-time subscription). Mode is chosen automatically: Firebase if all `VITE_FIREBASE_*` vars are set, otherwise local.
- **UI** — split into feature folders, not one file. [src/App.tsx](src/App.tsx) is the routing shell + top-level wiring. Feature views live in `src/pages/`, `src/party-gear/` (the Inventory board — Party Gear internally — and all drag-and-drop), `src/character/`, `src/inventory/`, `src/entity/`, `src/audit/`, `src/modals/`; reusable widgets in `src/ui/` and `src/components/`. Shared view types are in `src/view-types.ts`, display helpers in `src/formatters.ts`. Plain CSS in `src/styles.css`.

### Key data-model concepts (see `MODEL_SPEC.md` for canon)

- Two domain objects: **`Entity`** (character / retainer / mount / vehicle / storage — anything that owns inventory) and **`InventoryRecord`** (coins / treasure / weapon / armor / equipment). A container is *not* a separate type — it's an `InventoryRecord` with `container` data.
- **Character-like entities** (character, retainer) use an `equipped` vs `stowed` location model with a single top-level stowed container (the "Backpack"). Coins are ordinary records that may live anywhere except a hand. **Non-character entities** (mount, vehicle, storage) use a flat `contents` model — do not force them into equipped/stowed.
- **Derived, not stored:** slots, equipped/stowed burden, coin value, encumbrance state, movement state, AC, and display summaries are all computed by `model/` functions. Only store a derived value if there's a clear performance reason.
- **PartyState** wraps `AppState` (entities, inventoryRecords, auditLog) plus party metadata and user profiles. The app is multi-party; the same logical shape is used in both local and Firebase modes.
- **Permissions** are enforced in two layers that must agree: `firestore.rules` (the server boundary, party-document level) and `src/model/permissions.ts` + the store (fine-grained GM/player actions and GM-only secret inventory fields that rules can't see). Identity is the Firebase Auth UID (`party.gmUid`, `party.members`), not the local user id. See the `firestore-permissions` skill before touching any of this.

## Source-of-truth documents

Behavior is spec-driven. Treat these as authoritative and update the spec *before* adding model fields to satisfy UI needs:

- `APP_SPEC.md` — goals, constraints, persistence behavior.
- `MODEL_SPEC.md` — canonical data model, invariants, derived calculations.
- `ENCUMBRANCE_SPEC.md` — encumbrance/movement rules.
- `GEAR_VIEW_SPEC.md` — the Inventory board (Party Gear internally), the Floor, and the drag-and-drop contract (view + interaction only).
- `SYNC_SPEC.md` — Firestore document shape and field-level write/merge behavior.
- `CONTENT_GUIDE.md` — how to author the bundled rule-content JSON libraries and their provenance requirements.
- `TASKS.md` — what is done, in progress, and open, plus the explicit **post-1.0** list (e.g. stack splitting). Don't implement post-1.0 items unless re-scoped.

## Conventions

- Use **`entity`** terminology everywhere (code, UI, docs). Canonical terms are `entity`, `equipped`, `stowed`, and "top-level stowed container".
- Prefer minimal, focused diffs; no unrelated refactors. Keep the inventory model simple — avoid a generic rules engine and separate item-definition/instance layers (a bundled catalog for autocomplete is fine).
- **Validation philosophy:** hard-block structurally impossible state; use soft warnings for table-adjudicated problems; never silently fix user data.
- **Local/Firebase parity:** every feature should behave the same in both modes unless unavoidably Firebase-only.

## Skills

Project skills live in `.claude/skills/<name>/SKILL.md` and trigger on relevant tasks:

- **`encumbrance-rules`** — slot/burden/movement invariants and the manual-fixture test convention (read before changing inventory/encumbrance/movement logic or adding tests).
- **`firestore-permissions`** — the two-layer auth/permission model, party membership, and secret-field handling (read before touching `firestore.rules`, `permissions.ts`, roles, or the parties collection).
- **`ose-conventions`** — OSR house rules and rule-data provenance for saves, AC, class tables, coins, and the item catalog.
- **`spec-sync`** — keeps the spec docs in sync with code; maps each code area to its governing spec. A non-blocking `Stop` hook ([.claude/hooks/spec-sync-reminder.sh](.claude/hooks/spec-sync-reminder.sh)) reminds you when `src/model/**`, `src/store/**`, or `src/persistence/**` changed without a spec edit.
- **`uncodixify`** — strict UI style guide; avoid generic "AI dashboard" aesthetics (gradients, glassmorphism, eyebrow labels, oversized radii, KPI-card grids). Reuse existing project colors.

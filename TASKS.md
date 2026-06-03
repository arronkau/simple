# TASKS

## Goal

Continue the app after Firebase mode with a regression-hardening pass and then table-facing campaign workflow features. Keep the implementation simple, local-first, Firebase-compatible, and aligned with the existing inventory model.

This file controls implementation sequencing. Earlier phases 1-6 are considered complete and should not be reimplemented except where regression hardening identifies a specific bug.

## Current Priority

Run Phase 7B before adding new features. The app now needs post-Firebase correctness coverage so later feature work does not build on unstable inventory, persistence, or sync behavior.

## Global Guardrails

- Favor minimal diffs.
- Do not add unrelated refactors.
- Do not add a separate item-definition layer unless a later phase explicitly requires a narrow reusable catalog.
- Preserve localStorage mode when Firebase env vars are absent.
- Preserve Firebase mode when Firebase env vars are present.
- Do not change the canonical inventory model casually.
- Keep character-like inventory distinct from non-character entity inventory.
- Character-like entities use equipped/stowed placement, hands, coin purse display, and a literal backpack container.
- Mounts, vehicles, and storage use simple contents inventory, not equipped/stowed placement.
- Coin purse remains a placement/display concept, not a real container.
- Prepared treasure hoards and shopping data should create normal inventory records when awarded or purchased.
- Drag-and-drop remains optional and last.

## Standard Validation Commands

Run these after each phase unless a phase gives more specific validation:

```bash
npm install
npm run typecheck
npm run test
npm run build
```

Also manually verify both modes when persistence or state shape changes:

- Run with Firebase env vars missing and confirm localStorage mode still works.
- Run with Firebase env vars configured and confirm Firestore sync still works.

---

## Phase 7B — Post-Firebase Regression Hardening

### Task

Stabilize the completed local/Firebase app before adding new features. Fix spec drift, invalid UI affordances, inventory edge cases, and missing regression coverage.

### Context

Phases 1-6 are complete. Firebase has been added after local behavior stabilized. The next risk is subtle breakage in inventory invariants, Firestore persistence, local fallback, and UI workflows.

### Scope

- Audit the current implementation against `MODEL_SPEC.md`, `APP_SPEC.md`, and `ENCUMBRANCE_SPEC.md`.
- Update specs only where they contradict the implemented and intended model.
- Add regression fixtures/tests for high-risk inventory behavior.
- Fix broken or misleading UI affordances that cannot work safely.

### Requirements

- Tighten delete confirmation for valuable records:
  - Require explicit confirmation for non-empty containers, coin records, treasure, and records with `gpValue` or meaningful coin value.
  - Continue blocking deletion of non-empty containers unless the existing model already supports safe recursive deletion.
- Make coin display safe when coin records lack names.
  - Coin rows should not require `name` for display.
  - Coin labels should derive from denomination counts when needed.
- Filter obviously invalid container destinations before submit where practical.
  - Hide or disable the current record, descendants, cross-entity invalid containers, non-empty nested containers, and destinations that violate entity location rules.
  - Keep validation helpers authoritative; UI filtering is a convenience, not the only defense.
- Add regression tests/fixtures for:
  - default backpack creation
  - missing backpack warning
  - duplicate backpack prevention
  - coin purse placement and stowed burden
  - non-character coin records in contents or containers
  - container movement across entities
  - descendant entityId updates after container moves
  - held hands-required container exclusion from movement burden
  - non-empty hands-required container warning when not held
  - sibling sort ordering
  - invalid container destination rejection
  - valuable-record delete confirmation behavior where testable
- Ensure localStorage and Firebase modes preserve the same logical `AppState` shape.

### Non-goals

- Do not add new feature surfaces beyond hardening existing behavior.
- Do not implement audit log yet.
- Do not implement party summary yet.
- Do not redesign visual layout.
- Do not add drag-and-drop.

### Likely Files

- `TASKS.md`
- `MODEL_SPEC.md`
- `APP_SPEC.md`
- `ENCUMBRANCE_SPEC.md`
- `src/App.tsx`
- `src/model/types.ts`
- `src/model/calculations.ts`
- `src/model/encumbrance.ts`
- `src/model/validation.ts`
- `src/model/inventoryDisplay.ts`
- `src/model/*fixtures.ts`
- `src/store/useAppStore.ts`
- `src/store/useAppStore.fixtures.ts`
- Firebase/local persistence files if separate from the store

### Validation

```bash
npm run typecheck
npm run test
npm run build
```

Manual checks:

- Add/edit/move/delete each record type in local mode.
- Repeat representative add/edit/move/delete flows in Firebase mode.
- Confirm invalid moves are blocked before persistence.
- Confirm UI no longer offers record-type edits that cannot safely work.
- Confirm valuable records require stronger confirmation before deletion.

### Stop Condition

Stop when regression tests cover the listed edge cases, all validation commands pass, and no new feature work has been added.

---

## Phase 8 — Audit Log

### Task

Add an audit log for significant campaign and inventory edits.

### Context

The app is now Firebase-capable, which makes shared edits more likely. The referee needs visibility into major changes without logging every harmless keystroke.

### Scope

- Add an append-only audit log to app state.
- Record significant events from inventory/entity workflows.
- Display a readable audit log view.
- Keep logging compatible with localStorage and Firebase modes.

### Requirements

- Add an `AuditLogEntry` model with at least:
  - `id`
  - `createdAt`
  - `actorId` or actor label when available
  - `eventType`
  - `entityId` when applicable
  - `recordId` when applicable
  - short human-readable `summary`
  - structured `details` for before/after values where useful
- Log significant inventory edits:
  - create/delete entity
  - create/delete inventory record
  - move record between entities
  - change coin totals, storing denomination deltas where practical
  - edit treasure value
  - mark entity active/inactive
- Avoid logging trivial UI-only state.
- Add an audit log screen or panel reachable from the app.
- Show newest entries first by default.
- Allow basic filtering by entity and event type if simple.
- Keep the audit log append-only in normal UI.
- Add a reasonable retention strategy only if needed for state size; otherwise defer pruning.

### Non-goals

- Do not build role-based permissions yet.
- Do not build a full undo system.
- Do not log every field blur or temporary form edit.
- Do not make audit entries editable.

### Likely Files

- `src/model/types.ts`
- `src/model/appState.ts`
- `src/store/useAppStore.ts`
- `src/App.tsx`
- `src/styles.css`
- `src/model/*fixtures.ts`
- Persistence/sync files if separate

### Validation

```bash
npm run typecheck
npm run test
npm run build
```

Manual checks:

- Create, edit, move, and delete records; confirm expected audit entries appear.
- Change coins; confirm delta is readable.
- Move an item between two entities; confirm source and destination are clear.
- Confirm local mode persists audit entries.
- Confirm Firebase mode syncs audit entries without duplicating them.

### Stop Condition

Stop when significant edits produce stable, readable audit entries in both local and Firebase modes without adding permissions or undo behavior.

---

## Phase 9 — Party Summary

### Task

Add a referee-facing party summary view for quick table use.

### Context

The inventory view is detailed. The referee also needs a compact overview of the party’s operational state: HP, AC, movement, encumbrance, coin/treasure, warnings, and relevant notes.

### Scope

- Add a party summary route/view.
- Summarize active character-like entities first.
- Include non-character entities in a separate support/storage section.

### Requirements

- Add navigation to the summary view.
- For each active character/retainer, show:
  - name
  - type/class/level if present
  - HP current/max if present
  - AC if present
  - movement derived from encumbrance
  - equipped slots
  - stowed slots
  - total carried slots
  - coin totals and GP value
  - treasure GP value
  - warning count with expandable warning text
  - short notes if present
- For mounts, vehicles, and storage, show:
  - name
  - type
  - used/capacity slots when capacity exists
  - contents summary
  - coin/treasure value
  - warnings
- Include party totals:
  - total coin value
  - total treasure value
  - total combined value
  - total warnings
- Keep the view read-only except links/buttons to open the relevant entity in existing edit/detail flows.

### Non-goals

- Do not replace the detailed inventory view.
- Do not implement permissions.
- Do not add drag-and-drop.
- Do not create separate character-sheet automation.

### Likely Files

- `src/App.tsx`
- `src/styles.css`
- `src/model/calculations.ts`
- `src/model/encumbrance.ts`
- `src/model/inventoryDisplay.ts`
- `src/model/types.ts`

### Validation

```bash
npm run typecheck
npm run test
npm run build
```

Manual checks:

- Confirm active characters/retainers appear before inactive entities.
- Confirm movement matches inventory view calculations.
- Confirm coin/treasure totals match underlying records.
- Confirm warnings match existing validation/encumbrance helpers.

### Stop Condition

Stop when the party summary gives a correct read-only operational overview without changing inventory behavior.

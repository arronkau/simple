# TASKS

## Goal

Implement the app from the current specs with minimal diffs, local-first behavior, and no unrelated refactors.

This file controls implementation sequencing.

## Current Priority

Build the local-only app and inventory model first. Add Firebase sync only after local behavior is stable.

## Phase 1 — Scaffold Local App

### Task

Create the React/Vite/TypeScript app structure and local persistence shell.

### Requirements

- Use React 19, Vite, TypeScript, React Router, Zustand, and plain CSS.
- Add localStorage persistence for the `AppState` shape from `MODEL_SPEC.md`.
- App must run with no Firebase configuration.
- Add `.env.example` with the Firebase variable names from `APP_SPEC.md`.

### Non-goals

- Do not add Firebase behavior yet.
- Do not add drag-and-drop.
- Do not add legacy migration code.
- Do not add a separate item-definition layer.

### Validation

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run typecheck` if configured

### Stop Condition

Stop after the app boots locally and persists the empty app state without errors.

## Phase 2 — Implement Canonical Model Types

### Task

Add TypeScript types and validation helpers matching `MODEL_SPEC.md`.

### Requirements

- Implement `Entity`, `InventoryRecord`, `InventoryLocation`, `SlotProfile`, and type-specific data interfaces.
- Enforce entity-type-specific location rules.
- Use `locationType`, not `carryState`, as the stored location discriminator.
- Use `entity` terminology only.
- Ensure all non-coin records require a non-empty trimmed `name`.
- Allow arbitrary string alignment.
- Add derived calculations for:
  - coin count
  - coin GP value
  - record slot burden
  - container used slots
  - equipped slots
  - stowed slots
  - contents slots
  - total entity slots
  - hand occupancy
  - warnings

### Non-goals

- Do not automate modifiers.
- Do not implement detailed character-sheet rules.
- Do not add legacy migration logic.

### Validation

- `npm run typecheck`
- Unit tests for validation and derived calculations if a test runner exists.

### Stop Condition

Stop when model types compile and validation covers all hard invariants from `MODEL_SPEC.md`.

## Phase 3 — Entity CRUD

### Task

Implement entity list and add/edit/delete flows.

### Requirements

- Support entity types: character, retainer, mount, vehicle, storage.
- Active entities display before inactive entities.
- Use `sortOrder`.
- Creating a character or retainer creates a default backpack container.
- Mounts, vehicles, and storage do not get backpacks or coin purses.
- Use localStorage persistence.

### Non-goals

- Do not implement Firebase.
- Do not implement drag-and-drop.
- Do not implement a full character sheet.

### Validation

- Create, edit, deactivate, and delete entities.
- Confirm character-like entities receive one backpack.
- Confirm non-character entities do not receive backpacks.

### Stop Condition

Stop when entity CRUD is stable and persisted locally.

## Phase 4 — Inventory Display

### Task

Implement inventory display according to `INVENTORY_VIEW_SPEC.md`.

### Requirements

- Characters and retainers show:
  - header
  - equipped hands
  - other equipped
  - stowed coin purse
  - stowed backpack
  - containers inline
- Mounts, vehicles, and storage show:
  - header
  - contents
  - containers inline
- Show slot counts and warnings.
- Show movement state from slower equipped/stowed burden for character-like entities.
- Show contents slots for non-character entities.
- Do not show coin purse/backpack/hands on non-character entities.

### Non-goals

- Do not implement drag-and-drop.
- Do not redesign the whole app.
- Do not automate combat or retrieval timing.

### Validation

- `npm run build`
- Manual check with sample character, retainer, mount, vehicle, and storage.

### Stop Condition

Stop when the inventory screen displays all entity types correctly using sample data.

## Phase 5 — Inventory Add/Edit/Move

### Task

Implement record add/edit/move workflows with type-specific forms.

### Requirements

- Use the form matrix in `INVENTORY_VIEW_SPEC.md`.
- Character-like non-coin records default to equipped loose.
- Character-like coins default to coin purse.
- Non-character records default to contents.
- Character-like non-coin records can be moved to backpack only if the character has a backpack container.
- Coin creation updates the existing entity coin record instead of creating duplicates.
- Container moves update descendant entity IDs when moved across entities.
- Prevent invalid hand occupancy.
- Prevent non-empty containers from being nested.
- Block deleting non-empty containers.

### Non-goals

- Do not implement drag-and-drop.
- Do not create item templates.
- Do not add legacy import or migration.

### Validation

- Add/edit each record type.
- Move records between allowed locations.
- Verify invalid moves are blocked or warned according to the specs.
- Verify add/edit forms do not expose irrelevant fields.

### Stop Condition

Stop when CRUD and move flows satisfy the minimal acceptance criteria in `INVENTORY_VIEW_SPEC.md`.

## Phase 6 — Firebase Mode

### Task

Add Firebase anonymous auth and Firestore sync after local behavior is stable.

### Requirements

- Use Firebase mode only when all required env vars are present.
- Preserve the same logical `AppState` shape.
- Keep localStorage mode working.
- Avoid UI behavior differences except sync availability.

### Non-goals

- Do not change the model shape during Firebase implementation.
- Do not add multiplayer permissions unless specified later.

### Validation

- Run with Firebase env vars missing.
- Run with Firebase env vars configured.
- Confirm local mode still works.
- Confirm Firestore mode syncs app state.

### Stop Condition

Stop when Firebase mode works without breaking local mode.

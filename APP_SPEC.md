# App Spec

## Overview

This is a small-scale hobby TTRPG character and inventory tracker for table use.

Favor practical, table-usable behavior over heavy abstractions. Local responsiveness and simple workflows matter more than exhaustive rules enforcement.

The app should support:

- Character and party inventory tracking.
- Retainers, mounts, vehicles, and storage as inventory-carrying entities.
- Slot-based encumbrance.
- Character-like inventory with a clear distinction between equipped and stowed carried items.
- A top-level stowed container, normally a backpack, for character-like stowed non-coin inventory.
- Character coin purse display for coin records.
- Simple contents inventory for mounts, vehicles, and storage.
- Coins, treasure, weapons, armor, and equipment as inventory records.
- A read-only audit log for significant entity and inventory changes.
- Local/demo use without Firebase configuration.
- Firebase-backed sync when Firebase environment variables are configured.

## Source-of-Truth Documents

Use these files as the implementation source of truth:

- `APP_SPEC.md` — app-level goals, constraints, tech stack, and persistence expectations.
- `MODEL_SPEC.md` — canonical data model, interfaces, invariants, and derived calculations.
- `INVENTORY_VIEW_SPEC.md` — canonical inventory UI layout and behavior.
- `TASKS.md` — current implementation priorities and sequencing.

Do not duplicate model rules inside view specs.

Do not infer new model fields from UI needs unless `MODEL_SPEC.md` is first updated.

## Tech Stack

- React 19
- Vite
- TypeScript
- React Router
- Zustand
- Plain CSS
- Firebase anonymous auth and Firestore when configured
- localStorage fallback when Firebase is not configured

## Environment

Firebase config is read from Vite environment variables.

Use `.env.example` as the template:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

When these values are missing, the app must continue to run against localStorage.

## Persistence Behavior

The app should support two persistence modes.

### Firebase Mode

Use Firebase mode when all required Firebase environment variables are present.

Firebase mode should:

- Use Firebase anonymous auth.
- Store shared app state in Firestore.
- Support real-time sync where practical.
- Use the same logical `AppState` shape as local mode, including `auditLog`, unless a later migration explicitly changes it.

### Local Mode

Use local mode automatically when Firebase config is missing.

Local mode should:

- Store state in localStorage.
- Require no cloud setup.
- Support local development, demos, and single-table play.
- Preserve the same visible app behavior except for unavailable sync.
- Persist audit entries in the same app-state document shape used by Firebase mode.

## Design Constraints

- Prefer minimal, understandable data models.
- Avoid a generic rules engine.
- Avoid separate item-definition and inventory-instance layers for v1.
- Keep inventory records self-contained enough to be edited directly.
- Use derived calculations for slots, equipped burden, stowed burden, coin value, encumbrance state, movement state, and display summaries.
- Store derived values only if there is a clear performance need.
- Keep validation focused on preventing corrupt or nonsensical state.
- Use warnings for table-adjudicated problems where strict enforcement would slow play.
- Favor minimal diffs and no unrelated refactors during implementation.
- Do not implement drag-and-drop in the initial pass.
- Do not include legacy migration code or legacy terminology.
- Use `entity` terminology everywhere.

## Core Inventory Rules

The app uses two inventory models depending on entity type.

### Character-Like Entities

Characters and retainers are character-like entities.

Every carried record owned by a character-like entity is either:

1. `equipped`
2. `stowed`

#### Equipped Items

Equipped items are held, actively used, worn, sheathed, or otherwise ready to use at short notice.

Examples:

- Armor worn
- Shield or weapon held in hand
- Two-handed weapon held in both hands
- Sheathed weapon ready at short notice
- Worn ring, amulet, cloak, or similar active gear
- Any item not placed into valid stowed storage

Default location for newly added non-coin records on character-like entities is equipped loose.

#### Stowed Items

Stowed items are packed away and not ready at short notice.

For character-like entities, stowed inventory is allowed only in:

- Coin purse placement for coin records.
- The character's top-level stowed container, normally a backpack.
- A valid container inside the top-level stowed container.
- A valid container currently held in hand.

On character or retainer creation, create exactly one default backpack record.

Validation hard rule: a character-like entity may not have more than one top-level stowed container.

Soft warning: an existing character-like entity with zero top-level stowed containers should warn.

Move/add hard rule: non-coin stowed records must be placed inside a valid container. Additional containers, including backpacks, may be carried in hand if hand-capacity rules allow, but they do not become additional stowed roots.

#### Coin Purse

The coin purse is not a real container.

It is a placement/display concept for a character-like entity's coin record.

Coin records in the coin purse count toward stowed slots.

### Non-Character Entities

Mounts, vehicles, and storage entities do not use equipped/stowed inventory.

They use a simpler contents model.

These entities may contain:

- Coins
- Treasure
- Weapons
- Armor
- Equipment
- Containers
- Records inside containers

Mounts, vehicles, and storage do not require a backpack or coin purse.

Coin records for mounts, vehicles, and storage may be placed directly in contents or inside ordinary containers.

## Core Domain Objects

The app has two main domain objects.

### Entity

An `Entity` is a character, retainer, mount, vehicle, or storage location that can own inventory.

Use `entity` terminology everywhere in code, UI labels, and documentation.

### InventoryRecord

An `InventoryRecord` is a specific record owned by an entity.

It may represent coins, treasure, a weapon, armor, or equipment.

Containers are not a separate record type. A container is an `InventoryRecord` with `container` data.

## Entity Types

```ts
type EntityType =
  | "character"
  | "retainer"
  | "mount"
  | "vehicle"
  | "storage";
```

## Inventory Record Types

```ts
type InventoryRecordType =
  | "coins"
  | "treasure"
  | "weapon"
  | "armor"
  | "equipment";
```

## Inventory Location Model

Character-like entities use equipped and stowed locations.

Non-character entities use contents locations.

Do not force mounts, vehicles, or storage into equipped/stowed state.

## Inventory View Layout

The inventory view is the central workflow and should be optimized first.

For character and retainer entities, the inventory view uses:

1. Entity header
2. Equipped
   - Hands
   - Other equipped
3. Stowed
   - Coin purse
   - Stowed container and its contents
   - Containers inline

For mount, vehicle, and storage entities, the view uses:

1. Entity header
2. Contents
   - Containers inline

Containers are displayed inline in the stowed-container or contents list rather than as a separate top-level layout section.

## Record Add/Edit Modal

The inventory page uses its existing add/edit entry points. The record modal owns item creation and editing details; adding modal fields must not add new page-level add buttons or inventory-page controls.

For non-coin records, the default modal stays compact: type, name, quantity, slots/items field, stackable checkbox, description, type-specific core fields, and checkbox-driven optional sections. Location controls are hidden by default and open from a Move button in the footer.

Coin records use a compact coin-only body with PP, GP, SP, and CP fields. Movement remains available through the same hidden Move section.

Optional modal sections expose container data, unidentified data, light source data, uses/charges, modifiers, GM notes, and weapon qualities. Light source burn state uses the shared uses object; light data stores only lit state and free-text light description.

## High-Level UI Areas

The app should eventually include:

- Party overview
- Character/entity detail view
- Inventory view
- Record add/edit modal
- Entity add/edit modal
- Settings or data-management view if needed

## Non-Goals

- No full automation of all OSE rules.
- No separate item-definition database for v1 unless imported reference data already exists.
- No exhaustive magic-item rules engine.
- No strict enforcement of every encumbrance edge case unless it prevents invalid state.
- No drag-and-drop in the initial implementation.
- No unrelated visual redesign while implementing the model.

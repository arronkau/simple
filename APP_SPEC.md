# App Spec

## Overview

This is a small-scale hobby TTRPG character and inventory tracker for table use.

Favor practical, table-usable behavior over heavy abstractions. Local responsiveness and simple workflows matter more than exhaustive rules enforcement.

The app should support:

- Character and party inventory tracking.
- Retainers, mounts, vehicles, and storage as inventory-carrying entities.
- Slot-based encumbrance.
- A rules-compliant split between equipped and stowed carried items.
- Containers displayed inline inside stowed inventory.
- Coins, treasure, weapons, armor, and equipment as inventory records.
- Local/demo use without Firebase configuration.
- Firebase-backed sync when Firebase environment variables are configured.

## Source-of-Truth Documents

Use these files as the implementation source of truth:

- `APP_SPEC.md` — app-level goals, constraints, tech stack, and persistence expectations.
- `MODEL_SPEC.md` — canonical data model, interfaces, invariants, and derived calculations.
- `INVENTORY_VIEW_SPEC.md` — canonical inventory UI layout and behavior.
- `TASKS.md` — current implementation priorities and sequencing, once created.

Do not duplicate model rules inside view specs. Do not infer new model fields from UI needs unless `MODEL_SPEC.md` is first updated.

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
- Use the same logical `AppState` shape as local mode unless a later migration explicitly changes it.

### Local Mode

Use local mode automatically when Firebase config is missing.

Local mode should:

- Store state in localStorage.
- Require no cloud setup.
- Support local development, demos, and single-table play.
- Preserve the same visible app behavior except for unavailable sync.

## Design Constraints

- Prefer minimal, understandable data models.
- Avoid a generic rules engine.
- Avoid separate item-definition and inventory-instance layers for v1.
- Keep inventory records self-contained enough to be edited directly.
- Use derived calculations for slots, equipped burden, stowed burden, coin value, encumbrance state, and display summaries.
- Store derived values only if there is a clear performance need.
- Keep validation focused on preventing corrupt or nonsensical state.
- Use warnings for table-adjudicated problems where strict enforcement would slow play.
- Favor minimal diffs and no unrelated refactors during implementation.

## Core Inventory Rule

Every carried item is classified as either equipped or stowed.

### Equipped Items

Equipped items are held, actively used, worn, sheathed, or otherwise ready to use at short notice.

Examples:

- Armor worn
- Shield or weapon held in hand
- Two-handed weapon held in both hands
- Sheathed weapon ready at short notice
- Worn ring, amulet, cloak, or similar active gear

### Stowed Items

Stowed items are packed away and not ready at short notice. They may be in a coin purse, backpack, pocket, sack, chest, or other container.

In combat, retrieving a stowed item may take one round by table ruling. The app should represent this distinction clearly but does not need to automate combat timing.

## Core Domain Objects

The app has two main domain objects.

### Entity

An `Entity` is a character, retainer, mount, vehicle, or storage location that can own or carry inventory.

Entity and holder are the same concept. Use `entity` terminology everywhere in code, UI labels, and documentation unless referring to legacy code that has not yet been renamed.

### InventoryRecord

An `InventoryRecord` is a specific record owned by an entity. It may represent coins, treasure, a weapon, armor, or equipment.

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

The model uses two primary inventory states:

```ts
type CarryState = "equipped" | "stowed";
```

Character-like entities subdivide those states as follows:

```md
Equipped
  Hands
    Left hand
    Right hand
    Both hands
  Other equipped / loose ready items

Stowed
  Coin purse
  Backpack
    Containers inline
```

Do not create separate primary categories for hands, armor, containers, backpack, or coin purse. Those are placements or view sections under equipped/stowed.

## Inventory View Layout

The inventory view is the central workflow and should be optimized first.

For character and retainer entities, the inventory view uses:

1. Entity header
2. Equipped
   - Hands
   - Other equipped
3. Stowed
   - Coin purse
   - Backpack
     - Containers inline

For mount, vehicle, and storage entities, the view may use a simpler contents list.

Containers are displayed inline in the backpack or contents list rather than as a separate top-level layout section.

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
- No unrelated visual redesign while implementing the model.

# App Spec

## Overview

This is a small-scale hobby TTRPG character and inventory tracker for table use.

Favor practical, table-usable behavior over heavy abstractions. Local responsiveness and simple workflows matter more than exhaustive rules enforcement.

The app should support:

- Character and party inventory tracking.
- Retainers, mounts, vehicles, and storage as inventory-carrying entities.
- Slot-based encumbrance.
- Containers and nested inventory where allowed.
- Coins, treasure, weapons, armor, and equipment as inventory records.
- Local/demo use without Firebase configuration.
- Firebase-backed sync when Firebase environment variables are configured.

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

Firebase config is read from Vite environment variables. Use `.env.example` as the template:

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

The app should support two persistence modes:

1. **Firebase mode**
   - Used when all required Firebase env vars are present.
   - Uses anonymous auth.
   - Stores shared app state in Firestore.
   - Should support real-time sync where practical.

2. **Local mode**
   - Used automatically when Firebase config is missing.
   - Stores state in localStorage.
   - Should require no cloud setup.
   - Should be usable for local development, demos, and single-table play.

Persistence mode should not change the visible app behavior except for sync availability.

## Design Constraints

- Prefer minimal, understandable data models.
- Avoid a generic rules engine.
- Avoid creating separate item-definition and inventory-instance layers unless a later requirement clearly needs it.
- Keep inventory records self-contained enough to be edited directly.
- Use derived calculations for slots, coin value, encumbrance state, and display summaries.
- Keep validation focused on preventing corrupt or nonsensical state.
- Use warnings for table-adjudicated problems where strict enforcement would slow play.
- Favor minimal diffs and no unrelated refactors during implementation.

## Core Domain Objects

The app has two main domain objects:

1. **Entity**
   - A character, retainer, mount, vehicle, or storage location that can own or carry inventory.

2. **InventoryRecord**
   - A specific item, stack, treasure, coin pile, container, weapon, or armor record in an entity inventory.

Entity and holder are the same concept. Use `entity` terminology everywhere in code, UI labels, and documentation unless referring to legacy code that has not yet been renamed.

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

## High-Level UI Areas

The app should eventually include:

- Party overview
- Character/entity detail view
- Inventory view
- Record add/edit modal
- Entity add/edit modal
- Settings or data-management view if needed

The inventory view is the central workflow and should be optimized first.

## Non-Goals

- No full automation of all OSE rules.
- No separate item-definition database for v1 unless imported reference data already exists.
- No exhaustive magic-item rules engine.
- No strict enforcement of every encumbrance edge case unless it prevents invalid state.
- No unrelated visual redesign while implementing the model.

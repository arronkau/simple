# App Spec

## Overview

This is a small-scale hobby TTRPG character and inventory tracker for table use. Favor practical, table-usable behavior over heavy abstractions. Local responsiveness and simple workflows matter more than exhaustive rules enforcement.

The app should support:

- Character and party inventory tracking.
- Retainers, mounts, vehicles, and storage as inventory-carrying entities.
- Item-based encumbrance and movement display.
- A rules-compliant split between equipped and stowed carried items for character-like entities.
- Explicit contents inventory for mounts, vehicles, and storage.
- Literal backpack and coin-purse containers for character-like entities.
- Containers displayed inline inside backpack, held hands-required containers, or non-character contents.
- Coins, treasure, weapons, armor, and equipment as inventory records.
- Generic hand accounting for any item with `handsRequired > 0`.
- Local/demo use without Firebase configuration.
- Firebase-backed sync when Firebase environment variables are configured.

## Source-of-Truth Documents

Use these files as the implementation source of truth:

- `APP_SPEC.md` — app-level goals, constraints, tech stack, and persistence expectations.
- `MODEL_SPEC.md` — canonical data model, interfaces, invariants, examples, and derived calculations.
- `INVENTORY_VIEW_SPEC.md` — canonical inventory UI layout and behavior.
- `ENCUMBRANCE_SPEC.md` — canonical encumbrance and movement behavior.
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

Firebase config is read from Vite environment variables:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

When these are missing, the app should continue to run against localStorage.

## Persistence Expectations

For v1, the logical app state shape is defined in `MODEL_SPEC.md`.

LocalStorage mode should persist the full logical `AppState` shape.

Firebase mode may either:

1. persist the full logical `AppState` shape in one document for simplicity; or
2. persist normalized collections while hydrating the same logical shape in app state.

Do not invent a Firebase schema during unrelated inventory work. If Firebase sync is in scope, document the chosen schema before implementation.

## Implementation Priorities

Initial implementation should prioritize:

1. canonical model types;
2. pure calculation and validation helpers;
3. localStorage-backed Zustand state;
4. explicit-control inventory movement;
5. inventory UI rendering;
6. encumbrance display.

Initial implementation should not require:

- drag-and-drop;
- Firebase sync;
- permission model;
- audit log;
- full character automation;
- full magic item automation.

## Interaction Constraint

The app should not require drag-and-drop for core inventory management. Drag-and-drop may be added later, but all required inventory operations must be possible through explicit controls such as buttons, menus, or selects.

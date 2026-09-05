# App Spec

## Overview

This is a small-scale hobby TTRPG character and inventory tracker for table use.

Favor practical, table-usable behavior over heavy abstractions. Local responsiveness and simple workflows matter more than exhaustive rules enforcement.

The app should support:

- Character and party inventory tracking.
- Lightweight character-sheet fields for class, level, HP, XP, alignment, ability scores, skills, languages, features, and notes.
- Retainers, mounts, vehicles, and storage as inventory-carrying entities.
- Slot-based encumbrance.
- Character-like inventory with a clear distinction between equipped and stowed carried items.
- A top-level stowed container, normally a backpack, for character-like stowed inventory.
- Simple contents inventory for mounts, vehicles, and storage.
- Coins, treasure, weapons, armor, and equipment as inventory records.
- A read-only audit log for significant entity and inventory changes.
- Local/demo use without Firebase configuration.
- Firebase-backed sync when Firebase environment variables are configured.

## Source-of-Truth Documents

Use these files as the implementation source of truth:

- `APP_SPEC.md` — app-level goals, constraints, tech stack, and persistence expectations.
- `MODEL_SPEC.md` — canonical data model, interfaces, invariants, and derived calculations.
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

- Use Firebase anonymous auth so a first visit needs no account.
- Let any user upgrade the anonymous session to a Google account (account linking keeps the same UID, so GM and member status survive). If the Google account is already bound to another Firebase user, sign in as that user instead and re-resolve membership.
- Grant party access by membership, not by URL. The party URL alone does not let a new user read the party.
- Take membership and `gmUid` from the party document only. A client must not assign itself GM from local state before the first remote snapshot, or opening a party URL would make a visitor its GM locally.
- Make document creation the moment GM is assigned: the first visitor of a party whose document does not exist writes it with their authenticated UID as `party.gmUid` and as a `gm` member (which is also what the Firestore create rule requires).
- Treat a denied read as no access: the role stays unresolved, sync status is `error` with "You are not a member of this party. Ask the GM for an invite link.", GM controls stay hidden, store mutations are refused instead of being treated as player actions, and the party is not remembered as the last party.
- Let the GM share an invite link (`/party/{partyId}?invite={inviteCode}`). Opening it as a non-member adds the user to `party.members` as a player. The GM can regenerate the invite code to invalidate old links.
- Store shared app state in Firestore.
- Support real-time sync where practical.
- Use the same logical `AppState` shape as local mode, including `auditLog`, unless a later migration explicitly changes it.

Firestore's wire shape, field-level merge behavior, and legacy-document upgrade path are defined in [SYNC_SPEC.md](SYNC_SPEC.md).

### Local Mode

Use local mode automatically when Firebase config is missing.

Local mode should:

- Store state in localStorage.
- Treat the local user as the GM of every local party (there is no remote membership document to resolve a role against).
- Distinguish "nothing stored" from "stored data could not be read". Unreadable stored party data (invalid JSON, another party's id, or a shape validation rejects, such as a future `schemaVersion`) is never silently overwritten: the raw string is copied to `simple.inventory.partyState.corrupt.v1.{partyId}.{ISO timestamp}` before anything writes to the party key, the party then opens empty, and the app header shows a warning naming the backup key and pointing to Manage → Import JSON.
- Require no cloud setup.
- Support local development, demos, and single-table play.
- Preserve the same visible app behavior except for unavailable sync.
- Persist audit entries in the same app-state document shape used by Firebase mode.

## Design Constraints

- Prefer minimal, understandable data models.
- Avoid a generic rules engine.
- Avoid separate item-definition and inventory-instance layers for user inventory state in v1. A bundled/imported standard item catalog is allowed for autocomplete, defaults, and reference lookup as long as inventory records remain self-contained.
- Keep inventory records self-contained enough to be edited directly.
- Use derived calculations for slots, equipped burden, stowed burden, coin value, encumbrance state, movement state, and display summaries.
- Store derived values only if there is a clear performance need.
- Keep validation focused on preventing corrupt or nonsensical state.
- Use warnings for table-adjudicated problems where strict enforcement would slow play.
- Favor minimal diffs and no unrelated refactors during implementation.
- Drag-and-drop is allowed when it uses the same validation and move semantics as non-drag workflows.
- Legacy migration code is allowed where needed to safely read older stored data, but canonical current-state terminology should remain `entity`, `stowed`, and top-level stowed container terminology.
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

Default location for newly added non-coin records on character-like entities is equipped loose. A newly added coin record defaults into the top-level stowed container when the entity has one, and to equipped loose when it does not.

#### Stowed Items

Stowed items are packed away and not ready at short notice.

For character-like entities, stowed inventory is allowed only in:

- The character's top-level stowed container, normally a backpack.
- A valid container inside the top-level stowed container.
- A valid container currently held in hand.

On character or retainer creation, create exactly one default top-level stowed container record, normally named Backpack.

Validation hard rule: a character-like entity may not have more than one top-level stowed container.

Soft warning: an existing character-like entity with zero top-level stowed containers should warn.

Move/add hard rule: stowed records must be placed inside a valid container. Additional containers may be carried in hand if hand-capacity rules allow, but they do not become additional stowed roots.

#### Coins

Coins are ordinary inventory records with no placement of their own. An entity may hold any number of them, anywhere a non-container record may sit — the only exception is a hand.

A coin record counts toward the burden of wherever it sits: stowed inside the top-level stowed container, equipped at loose placement, or contents on a non-character entity.

Dragging a coin record onto a target on the **same** entity is an ordinary move. Dragging it onto any target on a **different** entity opens the transfer dialog instead, prefilled with the whole pile: confirming hands it all over, editing the amounts splits it. A container holding coins is a plain move — the coins ride along with it.

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

Mounts, vehicles, and storage do not require a top-level stowed container.

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

Optional modal sections expose container data, unidentified data, light source data, uses/charges, modifiers, GM notes, and weapon qualities. The unidentified and GM-notes sections are GM-only: a non-GM never sees an item's notes, and a non-GM opening an unidentified item gets a read-only form (every field disabled, no Save, a one-line "only the GM can edit this item" note) built from the redacted record. Redaction itself is one rule in the model (`MODEL_SPEC.md`, Player Visibility); the app supplies the viewer's role once, at the app shell, and display surfaces read it from there. Light source burn state uses the shared uses object; light data stores only lit state and free-text light description. On the character sheet, each light source row carries a flame toggle: unlit lights one item (splitting it off a stack and moving it to a free hand when it needs one); lit opens a "Put out" dialog offering "burned out" or "turns remaining" (see `MODEL_SPEC.md`, Light and Snuff Actions).

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
- No user-managed separate item-definition database for v1. A bundled/imported standard item catalog is allowed for autocomplete, defaults, and reference lookup.
- No exhaustive magic-item rules engine.
- No strict enforcement of every encumbrance edge case unless it prevents invalid state.
- Drag-and-drop must not bypass validated move/swap behavior.
- No unrelated visual redesign while implementing the model.

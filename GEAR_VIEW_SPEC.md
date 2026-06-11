# Gear View Spec

## Goal

Define the **Party Gear** screen — the "Ready / Stowed" party board and the
**Floor** loot-staging bar — as a presentation + interaction layer over the
existing model.

This file is the source of truth for the Party Gear *layout and drag-and-drop
contract* only. It does not define new model rules. Where this file and the
model/encumbrance specs disagree on rules, the model specs win.

- Data model fields: see `MODEL_SPEC.md`.
- Movement/encumbrance numbers: see `ENCUMBRANCE_SPEC.md`.
- Canonical inventory view layout: see `APP_SPEC.md` / `INVENTORY_VIEW_SPEC.md`.

This feature adds **no new domain-model fields**. The Floor is an ordinary
`storage` entity; the only new state is a UI-only setting recording which
`storage` entity is acting as the Floor.

## Route

The screen lives at `/party/:partyId/gear`, reachable from the primary
top navigation ("Gear"). It has no left sidebar.

## Party board

A responsive grid of entity cards:

```css
grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
```

All **active** entities are shown, sorted by `sortOrder`, except the entity
currently designated as the Floor (which is rendered in the bottom bar).

### Character / retainer card ("Ready / Stowed")

Mirrors the canonical inventory layout, restyled:

- **Header** — name (serif), `className` + `level` subtitle, an OSE movement
  badge `120′ (40′)` colored by tier (normal / amber / red; overloaded shows
  `0′`), and an encumbrance line `equipped X · stowed Y · total Z/16` (plus the
  overload reason when overloaded).
- **Ready** (the `equipped` zone, accent left edge) — uppercase "Ready" label;
  hands stacked vertically (a single full-width "Both hands" slot when a
  `bothHands` record is equipped, otherwise "Left" and "Right" rows); then a
  "Worn" sub-section listing `equipped` `loose` records.
- **Stowed** (recessed background) — uppercase "Stowed" label; the coin-purse
  line (denominations + `ceil(totalCoins/100)` slot cost, display-only); the
  top-level stowed container (`stowedRoot`) with `usedContentsSlots /
  capacitySlots` capacity and its child rows; nested containers inline.

All header/section numbers come from the encumbrance module. The component
never recomputes movement or burden.

### Mount / vehicle / storage card ("Contents")

Header with name, a quiet type label, and `baseMovementFeet` shown plainly (no
equipped/stowed tiers). A single **Contents** section with a `used / capacity`
readout and the records / inline containers.

### Record row

Each row shows: display name (respecting identification — when
`identified === false`, the public `name`/"Unidentified item" is shown, never
secret fields), state markers (lit → flame + `light.lightDescription` + `uses`,
unidentified marker, active-AC), and a quiet slot-cost indicator on the right.
The record name is the loudest element; chrome recedes; color is reserved for
load/movement status, light, and the drag accent.

## The Floor

The Floor is a `storage` entity. Its identity is held in a **UI-only** setting
(a small Zustand store persisted to `localStorage`, keyed by party id) — never
in `AppState` or `Entity`. A "create the Floor if missing" action creates a
`storage` entity (default name "Floor") through the normal entity-creation path.

It renders as a fixed bottom bar on the Party Gear page (page content is given
bottom padding so nothing hides behind it):

- Header: "The Floor" label, a `N lots · M slots` summary, collapse/expand.
- Body: the Floor entity's top-level Contents as draggable chips/rows.
- The whole bar is a drop target → moves the dropped record into the Floor
  entity's Contents (a cross-entity validated move).
- Empty state: "nothing on the floor".

## Drag-and-drop contract

Uses `@dnd-kit/core` (pointer + keyboard + touch sensors, live-region
announcements). The Party Gear page is wrapped in a single `DndContext`.

- **Draggable** = each record row. Draggable id = `rec:{recordId}`.
- **Droppable** = each placement zone, id-encoded:
  - `drop:{entityId}:equipped:leftHand`
  - `drop:{entityId}:equipped:rightHand`
  - `drop:{entityId}:equipped:bothHands`
  - `drop:{entityId}:equipped:loose` (the "Worn" area)
  - `drop:{entityId}:container:{containerId}` (backpack + every nested/contents container)
  - `drop:{entityId}:contents` (mounts/vehicles/storage and the Floor)
  - The Stowed zone's empty area maps to the top-level stowed container as
    `container:{backpackId}` (records cannot sit at a bare `stowedRoot`).

`onDragEnd` parses `over.id` into an `InventoryRecordLocationInput` and calls
the **existing validated move action** (`useAppStore.moveInventoryRecord`).
The action enforces every invariant (single stowed root, hand-occupancy
collisions, `bothHands` vs `leftHand`/`rightHand` exclusivity, non-coin must be
in a container, held-container rules, no cross-entity containment, cycle
prevention) and reparents container descendants. A blocked/warning result is
surfaced (toast/live region) and state is left unchanged. The drag layer holds
**no copy** of the movement tables or invariants.

Two-handed records dropped on `leftHand`/`rightHand` are passed straight
through to the action (placement is allowed; hands-required never prohibits
placement). The UI does not auto-displace items.

### Live projection

On `onDragOver`, the hovered zone shows a projection pill computed by the
**shared encumbrance module** against an in-memory clone of the records with the
move applied (the move is resolved with the same `createInventoryLocation` +
pure `moveInventoryRecord` the store uses):

- character-like target → `eq X · st Y · tot Z/16`; pill + ring turn red if the
  move would overload (equipped > 9, stowed > 16, total > 16, a carried
  container over capacity, or a non-empty hands-required container left unheld).
- contents target → `used/capacity`; red if it would exceed `capacitySlots`.

Projection is display-only and must use the shared module — never hardcode the
tables. A `DragOverlay` shows the dragged record's name; the dropped row briefly
flashes in its new location.

## Non-goals (first pass)

- Within-zone sortable reordering, coin-amount drag/splitting, multi-select drag.
- The referee Party HUD and the Character detail sheet.
- Any restyle of screens other than Party Gear.

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
  `0′`), and a load readout `Eq X/9 · St Y/16±STR` — each side against its own
  limit, no combined total (plus the overload reason when overloaded).
- **Ready** (the `equipped` zone, accent left edge) — uppercase "Ready" label;
  hands stacked vertically (a single full-width "Both hands" slot when a
  `bothHands` record is equipped, otherwise "Left" and "Right" rows); then a
  "Worn" sub-section listing `equipped` `loose` records.
  - A held record that is a container renders as a full container block
    (header + resolved capacity + its contents), not a bare row. Only its
    **body** is a drop target nested inside the hand's; the header row belongs
    to the hand, so dropping on it means "into this hand" (displacing the held
    container to Worn) while dropping on the body means "into this container".
  - Every held record carries an inline grip button, in the row for a plain
    record and in the container header for a container: "both hands" while in
    `leftHand`/`rightHand`, "one hand" while in `bothHands`. The "one hand"
    direction is omitted for a `handsRequired: 2` record, which cannot be held
    in one hand; the "both hands" direction always shows. It runs the same
    validated move sequence as a drag onto that hand.
- **Stowed** (recessed background) — uppercase "Stowed" label; the coin-purse
  line (denominations + `ceil(totalCoins/100)` slot cost, display-only); the
  top-level stowed container (`stowedRoot`) with a resolved-capacity readout
  (`used/6`, `used/12`, or `used/—` when not applicable) and its child rows;
  nested containers inline.

All header/section numbers come from the encumbrance module. The component
never recomputes movement or burden.

### Mount / vehicle / storage card ("Contents")

Header with name, a quiet type label, and `baseMovementFeet` shown plainly (no
equipped/stowed tiers). A single **Contents** section with a `used / capacity`
readout and the records / inline containers.

### Record row

Each row shows: display name (respecting identification — when
`identified === false`, the public `name`/"Unidentified item" is shown, never
secret fields), state markers (a flame toggle on every light source — grey
unlit, fire when lit, with `light.lightDescription` + `uses` in the title;
clicking lights one item or opens the put-out dialog, same as the character
sheet — plus the unidentified marker and active-AC), and a quiet slot-cost
indicator on the right.
The record name is the loudest element; chrome recedes; color is reserved for
load/movement status, light, and the drag accent.

## The Floor

The Floor is a `storage` entity. Its identity is held in a **UI-only** setting
(a small Zustand store persisted to `localStorage`, keyed by party id) — never
in `AppState` or `Entity`. A "create the Floor if missing" action creates a
`storage` entity (default name "Floor") through the normal entity-creation path.

Because that setting is per-device while the entity is shared party data, a
client with no local mapping (e.g. a second player on a Firebase party)
deterministically falls back to the first `storage` entity literally named
"Floor", then records that id locally. This keeps the Floor recoverable across
clients and prevents a second client from creating a duplicate; "create the
Floor" is only offered when no such entity exists.

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
  - `drop:{entityId}:stowedRoot` — shown only when the character has **no**
    top-level stowed container, so a container can be dropped in to become one.
  - The Stowed zone's empty area maps to the top-level stowed container as
    `container:{backpackId}` when one exists (ordinary records cannot sit at a
    bare `stowedRoot`).

`onDragEnd` parses `over.id` into an `InventoryRecordLocationInput` and calls
the **existing validated move action** (`useAppStore.moveInventoryRecord`).
The action enforces every invariant (single stowed root, hand-occupancy
collisions, `bothHands` vs `leftHand`/`rightHand` exclusivity, non-coin must be
in a container, held-container rules, no cross-entity containment, cycle
prevention) and reparents container descendants. A blocked/warning result is
surfaced (toast/live region) and state is left unchanged. The drag layer holds
**no copy** of the movement tables or invariants.

A drop on a hand is taken literally: `bothHands` grips with both hands and
`leftHand`/`rightHand` with one, except that a `handsRequired: 2` record always
takes both hands (placement is never prohibited; the upgrade is a convenience).
Whatever occupied the hands being claimed is displaced to Worn first, and the
displacements plus the placement are sent as one batched validated mutation.

### Coin drag

Coin records on **non-character** entities (the Floor, mounts, storage) are
draggable like any other record:

- Dropped on a non-character zone → a whole-record validated move (non-character
  entities may hold multiple coin records).
- Dropped anywhere on a **character/retainer** card → no move. Instead the coin
  **transfer modal** opens pre-filled (source = the dragged coin record,
  destination = the character) with a **Take all** shortcut and per-denomination
  amounts ("take some"); the remainder stays on the source. The transfer goes
  through the validated `transferCoins` action, which merges into the
  character's single purse record and removes a fully drained non-character
  source record.

The character coin-purse line itself is display-only (not draggable); partial
amounts always go through the Spend/Transfer modals.

### Live projection

On `onDragOver`, the hovered zone shows a projection pill computed by the
**shared encumbrance module** against an in-memory clone of the records with the
move applied (the move is resolved with the same `createInventoryLocation` +
pure `moveInventoryRecord` the store uses):

- character-like target → `eq X/9 · st Y/16±STR`; pill + ring turn red if the
  move would overload (equipped > 9, stowed > 16 + STR modifier, a carried
  container over capacity, or a non-empty hands-required container left unheld).
- container target → the container's own `used/capacity` leads the pill
  (`used/cap · eq X/9 · st Y/16±STR` on a character-like entity, `used/capacity`
  alone elsewhere), red if the container would go over its resolved capacity.
- contents target → `used/capacity`; red if it would exceed `capacitySlots`.
- coins over a character-like target → a neutral `→ purse` pill (the drop opens
  the transfer modal rather than moving the record).

Projection is display-only and must use the shared module — never hardcode the
tables. A `DragOverlay` shows the dragged record's name; the dropped row briefly
flashes in its new location.

## Non-goals (first pass)

- Within-zone sortable reordering, multi-select drag, dragging the character
  coin purse.
- The referee Party HUD and the Character detail sheet.
- Any restyle of screens other than Party Gear.

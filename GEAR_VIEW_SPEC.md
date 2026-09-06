# Gear View Spec

## Goal

Define the **Inventory** screen — the "Equipped / Stowed" party board and the
**Floor** loot-staging bar — as a presentation + interaction layer over the
existing model. The board is called **Party Gear** internally (route, folder,
component names, and the rest of this spec); the only name the user sees, in
the top navigation and the page heading, is "Inventory".

This file is the source of truth for the Party Gear *layout and drag-and-drop
contract* only. It does not define new model rules. Where this file and the
model/encumbrance specs disagree on rules, the model specs win.

- Data model fields: see `MODEL_SPEC.md`.
- Movement/encumbrance numbers: see `ENCUMBRANCE_SPEC.md`.
- Canonical inventory view layout: see `APP_SPEC.md`, "Inventory View Layout".

This feature adds **no new domain-model fields**. The Floor is an ordinary
`storage` entity; the only new state is a UI-only setting recording which
`storage` entity is acting as the Floor.

## Route

The screen lives at `/party/:partyId/gear`, reachable from the primary
top navigation ("Inventory"), and carries an `h2` "Inventory" heading like the
Party and Characters pages. It has no left sidebar.

## Party board

A responsive grid of entity cards:

```css
grid-template-columns: repeat(auto-fill, minmax(338px, 1fr));
```

All **active** entities are shown, sorted by `sortOrder`, except the entity
currently designated as the Floor (which is rendered in the bottom bar).

### Character / retainer card ("Equipped / Stowed")

Mirrors the canonical inventory layout, restyled:

- **Header** — name (serif), `className` + `level` subtitle, an OSE movement
  badge `120′ (40′)` colored by tier (normal / amber / red; overloaded shows
  `0′`), and a load readout `Eq X/9 · St Y/16±STR` — each side against its own
  limit, no combined total (plus the overload reason when overloaded). Both are
  popovers: the movement badge opens the rate breakdown (each side's lookup,
  any overload condition, which of them set the rate — `getMovementExplanation`),
  and each load side opens its band table with the current row marked
  (`getEquippedMovementBands` / `getStowedMovementBands`, the stowed one
  shifted by STR). The character sheet's Move box and inventory header reuse
  the same popovers. Numbers come from `ENCUMBRANCE_SPEC.md` helpers only.
- **Equipped** (the `equipped` zone, accent left edge) — uppercase "Equipped"
  label; a "Hands" sub-section with the hands stacked vertically (a single
  full-width "Both hands" slot when a `bothHands` record is equipped, otherwise
  "Left hand" and "Right hand" rows); then an "Other equipped" sub-section
  listing `equipped` `loose` records. Hand placements are always written out in
  full — "Left hand", "Right hand", "Both hands" — here and on the character
  sheet; only the party table abbreviates them (L / R / Both, each with the full
  form as its `title`).
  - A held record that is a container renders as a full container block
    (header + resolved capacity + its contents), not a bare row. Only its
    **body** is a drop target nested inside the hand's; the header row belongs
    to the hand, so dropping on it means "into this hand" (displacing the held
    container to Other equipped) while dropping on the body means "into this
    container".
  - Every held record carries an inline grip button, in the row for a plain
    record and in the container header for a container: "both hands" while in
    `leftHand`/`rightHand`, "one hand" while in `bothHands`. The "one hand"
    direction is omitted for a `handsRequired: 2` record, which cannot be held
    in one hand. The "both hands" direction shows only for a record that
    benefits from a second hand — hand-dependent container capacity
    (`container.capacityByHands`) or the Versatile weapon quality — so a plain
    one-handed record carries no grip button at all. It runs the same validated
    move sequence as a drag onto that hand.
- **Stowed** (recessed background) — uppercase "Stowed" label; the
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

Glyph rule: an unidentified item shows `?`; otherwise a magic item shows `✦`.
`?` wins — an unidentified item never shows the magic star, for the GM either.
Rows render the viewer-visible record (`MODEL_SPEC.md`, Player Visibility), so a
non-GM sees neither the star nor the burn time or gp value of an unidentified
item, and the Identify action appears for the GM only.
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

- Header: "The Floor" label, a `N lots · M slots` summary, a "+ Add item"
  link that opens the record form for the Floor entity (GM only — placing loot
  is the referee's job; the role is fail-closed, so it is hidden until a GM
  role is confirmed), collapse/expand.
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
  - `drop:{entityId}:equipped:loose` (the "Other equipped" area)
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
collisions, `bothHands` vs `leftHand`/`rightHand` exclusivity, a stowed record
must be in a container, held-container rules, no cross-entity containment, cycle
prevention) and reparents container descendants. A blocked/warning result is
surfaced (toast/live region) and state is left unchanged. The drag layer holds
**no copy** of the movement tables or invariants.

A drop on `leftHand`/`rightHand` is taken literally, except that a
`handsRequired: 2` record always takes both hands (placement is never
prohibited; the upgrade is a convenience). A drop on **Both hands** grips with
both hands only for a record that benefits from a second hand — a container
with hand-dependent capacity (`container.capacityByHands`) or a weapon with the
Versatile quality; any other one-handed record dropped on Both hands lands in
the **right hand**. "Versatile" is matched as a catalog-authored quality string
in `weapon.qualities` (free text, compared trimmed and case-insensitively).
Whatever occupied the hands being claimed is displaced to Other equipped first,
and the displacements plus the placement are sent as one batched validated
mutation.

### Coin drag

Every coin record is a draggable row wherever it sits — inside a character's
backpack, equipped, in the Floor's contents, in a sack:

- Dropped on a zone of the **same** entity → an ordinary whole-record validated
  move (reorder, into a sack, out to Other equipped), exactly like any other
  record.
- Dropped on a zone of a **different** entity → no move. Instead the coin
  **transfer modal** opens pre-filled: source = the dragged coin record,
  destination = the target entity, amounts = the **whole pile**. Confirming is
  one click; editing the amounts splits it and the remainder stays behind. The
  transfer goes through the validated `transferCoins` action, which merges into
  the destination's default coin record (creating one at the default location
  when it holds none) and removes a source record the transfer drains to zero,
  whatever kind of entity holds it.
- A container holding coins is a plain move; the coins ride along inside it.

Coin rows are not containers and never accept a drop.

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
- coins over a target on another entity → a neutral `→ transfer` pill (the drop
  opens the transfer modal rather than moving the record).

Projection is display-only and must use the shared module — never hardcode the
tables. A `DragOverlay` shows the dragged record's name; the dropped row briefly
flashes in its new location.

### Within-zone reordering

Reordering inside a zone is implemented. Each list renders gap droppables
(`gear-gap`) between its rows; the collision strategy prefers a gap when the
pointer is between two rows, and `onDragEnd` turns the gap's index into a
`targetIndex` on the move location, adjusting by one when the dragged row is
already earlier in the same list and cancelling the drop when the index does not
change. `targetIndex` rides through the same validated
`useAppStore.moveInventoryRecord` action as every other drop and only decides
`sortOrder` among siblings; it never changes containment or burden.

## Non-goals (first pass)

- Multi-select drag.
- The referee Party HUD and the Character detail sheet.
- Any restyle of screens other than Party Gear.

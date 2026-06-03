
## Phase 10 — Time Tracker and Notes

### Task

Add a campaign time tracker with campaign notes.

### Context

The app should support common OSR campaign operations: tracking days, watches, dungeon turns, rest timing, and session/campaign notes.

### Scope

- Add campaign time state.
- Add simple controls to advance/reverse time.
- Add notes tied optionally to campaign time.
- Keep this independent from inventory rules unless later explicitly connected.

### Requirements

- Add `CampaignTime` state with at least:
  - day number or date label
  - time-of-day label or minutes since day start
  - dungeon turn count or equivalent turn index
  - optional calendar name/notes
- Add controls for:
  - advance 10-minute turn
  - advance 1 hour
  - advance watch if watches are modeled
  - advance day
  - manually edit current time values
- Add campaign notes with:
  - `id`
  - `createdAt`
  - optional `updatedAt`
  - optional time snapshot
  - title
  - body
  - tags or category if simple
- Display recent notes near the tracker.
- Allow editing and deleting notes with confirmation for non-empty notes.
- Persist and sync time/notes in both local and Firebase modes.
- Log time changes and note creation/deletion in the audit log if Phase 8 exists.

### Non-goals

- Do not build a full custom fantasy calendar engine unless explicitly scoped later.
- Do not automate random encounters.
- Do not automate spell durations.
- Do not require time tracking for inventory use.

### Likely Files

- `src/model/types.ts`
- `src/model/appState.ts`
- `src/store/useAppStore.ts`
- `src/App.tsx`
- `src/styles.css`
- Audit helper files from Phase 8 if present

### Validation

```bash
npm run typecheck
npm run test
npm run build
```

Manual checks:

- Advance time in each supported increment.
- Manually edit time and confirm persistence.
- Create/edit/delete notes.
- Confirm notes preserve time snapshots where applicable.
- Confirm local and Firebase modes behave consistently.

### Stop Condition

Stop when campaign time and notes are usable, persisted, and isolated from unrelated inventory changes.

---

## Phase 11 — Prepared Treasure Hoards

### Task

Add prepared treasure hoards that can be created ahead of play and awarded into party inventory later.

### Context

The referee needs prebuilt treasure bundles. Awarding a hoard should create normal inventory records and coin deltas rather than introducing a parallel treasure system.

### Scope

- Add hoard templates/state.
- Add create/edit/delete flows for prepared hoards.
- Add an award flow that transfers hoard contents into a chosen entity/location.

### Requirements

- Add `PreparedTreasureHoard` with at least:
  - `id`
  - `name`
  - optional `description`
  - coin denominations
  - treasure/item entries
  - optional source/location note
  - `createdAt` / `updatedAt`
  - status: prepared/awarded if useful
- Hoard item entries should map cleanly to normal `InventoryRecord` creation.
- Award flow must:
  - choose destination entity
  - choose valid destination location/container where needed
  - create or update coin records according to existing coin rules
  - create treasure/equipment records according to existing inventory rules
  - reject invalid destinations using existing validation helpers
- Show total GP value for each hoard.
- Preserve the prepared hoard after award by default, marking it awarded or recording award history rather than deleting it automatically.
- Log award events in the audit log if Phase 8 exists.

### Non-goals

- Do not add procedural treasure generation yet.
- Do not add item-definition catalogs unless required for a minimal form autocomplete.
- Do not bypass inventory validation.
- Do not create a second inventory model for hoards.

### Likely Files

- `src/model/types.ts`
- `src/model/appState.ts`
- `src/model/calculations.ts`
- `src/model/validation.ts`
- `src/store/useAppStore.ts`
- `src/App.tsx`
- `src/styles.css`

### Validation

```bash
npm run typecheck
npm run test
npm run build
```

Manual checks:

- Create a coin-only hoard and award it to a character coin purse.
- Create a mixed coin/treasure hoard and award it to a backpack/container.
- Award treasure to storage contents.
- Confirm invalid destinations are rejected.
- Confirm awarded records appear in normal inventory views and party summary totals.

### Stop Condition

Stop when prepared hoards can be created, edited, valued, and awarded into normal inventory without creating a parallel inventory system.

---

## Phase 12 — Shopping Page

### Task

Add a shopping page for buying standard equipment and adding purchases to inventory.

### Context

At-table inventory entry is slow. A shopping workflow should let the referee/player choose common goods, calculate cost, and add normal inventory records to a selected entity.

### Scope

- Add a simple purchasable item catalog.
- Add shopping cart behavior.
- Add checkout into selected entity inventory.
- Optionally subtract coins if straightforward and safe.

### Requirements

- Add a small static catalog for common OSE-style purchases:
  - weapons
  - armor
  - equipment
  - containers
  - ammunition/stackables where already supported
- Catalog entries should include only fields needed to create normal inventory records:
  - name
  - recordType
  - cost/value
  - slots or stack profile
  - optional container capacity
  - optional notes
- Add shopping UI:
  - browse/search/filter catalog
  - quantity controls
  - cart total
  - destination entity
  - destination location/container
- Checkout must create normal inventory records using existing validation.
- Character-like non-coin purchases default to equipped loose or backpack destination according to existing rules.
- Non-character purchases default to contents.
- Coin subtraction is optional for first pass:
  - If implemented, show before/after coin totals and block impossible payment unless user allows unpaid purchase.
  - If not implemented, clearly label checkout as adding purchases only.
- Log purchases in the audit log if Phase 8 exists.

### Non-goals

- Do not build vendor inventories.
- Do not build price negotiation.
- Do not build encumbrance optimization.
- Do not add external APIs or remote catalogs.

### Likely Files

- `src/model/types.ts`
- `src/model/appState.ts`
- `src/model/inventoryRecords.ts`
- `src/model/validation.ts`
- `src/store/useAppStore.ts`
- `src/App.tsx`
- `src/styles.css`
- New catalog file, likely `src/model/shoppingCatalog.ts`

### Validation

```bash
npm run typecheck
npm run test
npm run build
```

Manual checks:

- Add one weapon, one armor item, one equipment item, one container, and one stackable item.
- Checkout to a character backpack.
- Checkout to storage contents.
- Confirm invalid destinations are not accepted.
- Confirm purchased records display correctly in inventory and party summary.

### Stop Condition

Stop when catalog purchases create valid normal inventory records and no payment automation is half-implemented.

---

## Phase 13 — Campaign Operations Polish

### Task

Polish referee-facing workflows that cut across inventory, audit log, summary, time, notes, treasure, and shopping.

### Context

After major feature surfaces exist, the app needs operational coherence: navigation, empty states, import/export safety, Firebase/local clarity, and cleanup of rough edges.

### Scope

- Improve navigation and page organization.
- Add operational safety affordances.
- Add simple data management tools.
- Tighten cross-feature consistency.

### Requirements

- Add a coherent top-level navigation structure for:
  - Inventory
  - Party Summary
  - Audit Log
  - Time/Notes
  - Treasure Hoards
  - Shopping
- Add clear empty states for each major page.
- Add app status indicators:
  - local mode vs Firebase mode
  - sync/loading/error state if available
- Add export/import JSON for the full app state if not already present.
  - Import must validate basic shape before replacing state.
  - Require confirmation before destructive import.
- Add reset/demo-data controls only if clearly labeled and protected by confirmation.
- Add consistent confirmation language for destructive actions.
- Ensure audit entries, notes, hoards, shopping additions, and inventory edits use consistent entity/record naming.
- Review mobile/tablet usability for all pages.
- Fix obvious accessibility issues:
  - labels for form controls
  - button text that describes action
  - keyboard-accessible modals/forms where practical

### Non-goals

- Do not redesign the visual identity yet; that is Phase 14.
- Do not add permissions/roles unless separately scoped.
- Do not add drag-and-drop.
- Do not add cloud backup beyond existing Firebase sync.

### Likely Files

- `src/App.tsx`
- `src/styles.css`
- `src/store/useAppStore.ts`
- `src/model/appState.ts`
- Feature files introduced in Phases 8-12

### Validation

```bash
npm run typecheck
npm run test
npm run build
```

Manual checks:

- Navigate through every page on desktop and narrow mobile width.
- Export and re-import app state.
- Confirm destructive actions require clear confirmation.
- Confirm local/Firebase status is visible and accurate.

### Stop Condition

Stop when the app feels operationally coherent without broad visual redesign or new rule systems.

---

## Phase 14 — Visual Design

### Task

Perform a visual design pass for clarity, table usability, and consistency.

### Context

The app should be readable at the table, including on laptops/tablets. This phase should improve hierarchy and usability without changing the data model or feature behavior.

### Scope

- Improve layout, spacing, typography, and visual hierarchy.
- Standardize cards, forms, warnings, buttons, and tables/lists.
- Improve responsive behavior.

### Requirements

- Keep plain CSS unless a separate decision is made.
- Define or clean up design tokens for:
  - spacing
  - border radius
  - type scale
  - warning/error/success states
  - muted text
  - card backgrounds/borders
- Make high-priority table information scannable:
  - movement
  - warnings
  - coin/treasure totals
  - slot burden
  - entity names
- Standardize button styles by action type:
  - primary
  - secondary
  - destructive
  - subtle/link-like
- Make forms easier to scan and less cramped.
- Improve modal/dialog readability if modals exist.
- Improve mobile/narrow layouts for inventory, summary, audit, notes, hoards, and shopping.
- Preserve existing behavior and state shape.

### Non-goals

- Do not change the inventory model.
- Do not add new features.
- Do not add drag-and-drop.
- Do not introduce a component library unless explicitly approved.

### Likely Files

- `src/styles.css`
- `src/App.tsx`
- Feature components/files if the app has been split by this point

### Validation

```bash
npm run typecheck
npm run test
npm run build
```

Manual checks:

- Review every major page at desktop width.
- Review every major page at mobile/narrow width.
- Confirm warnings and destructive actions are visually distinct.
- Confirm no visual changes alter calculations or persistence.

### Stop Condition

Stop when the UI is more readable and consistent without behavior changes or large structural rewrites.

---

## Phase 15 — Optional Drag-and-Drop

### Task

Optionally add drag-and-drop inventory movement and ordering after the core app is stable.

### Context

Drag-and-drop is useful but high-risk. It should only be added after the model, validation, persistence, audit log, and core workflows are stable.

### Scope

- Add drag-and-drop for reordering siblings and moving records between valid destinations.
- Use existing validation helpers as the source of truth.
- Keep existing non-drag move/edit workflows.

### Requirements

- Dragging an inventory record may support:
  - reorder within the same visible sibling bucket
  - move to valid equipped/stowed/contents/container destinations
  - move across entities when valid
- Invalid destinations must be visually rejected and blocked on drop.
- Dropping into a container must obey all existing container rules.
- Dropping across entities must update descendant entity IDs for containers and contents.
- Drag reorder must update `sortOrder` predictably without disturbing unrelated records.
- Keep keyboard/form-based move workflows fully available.
- Log drag-based moves in the audit log if Phase 8 exists.
- Add regression tests for reorder and move helper behavior where practical.

### Non-goals

- Do not make drag-and-drop the only move mechanism.
- Do not bypass validation for convenience.
- Do not redesign the inventory model.
- Do not add nested draggable complexity beyond what current containment rules allow.

### Likely Files

- `src/App.tsx`
- `src/styles.css`
- `src/store/useAppStore.ts`
- `src/model/validation.ts`
- `src/model/inventoryDisplay.ts`
- New drag helper/component files if the UI is split by this point

### Validation

```bash
npm run typecheck
npm run test
npm run build
```

Manual checks:

- Reorder records within the same bucket.
- Move an item from equipped loose to backpack.
- Move an item from backpack to a valid container.
- Move a container across entities and confirm descendants follow.
- Attempt invalid drops into descendants, non-empty nested containers, wrong entity locations, and overloaded hands.
- Confirm existing non-drag move workflow still works.

### Stop Condition

Stop when drag-and-drop is an optional enhancement over existing validated move workflows, not a replacement or alternate rules path.
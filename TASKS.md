# TASKS.md

# Simple 1.0 Implementation Plan

## Purpose

This document defines the implementation plan for the remaining 1.0 scope of **Simple**, an OSR/OSE-focused party, inventory, time, and character tracking app.

The goal for 1.0 is a stable, usable campaign tool with shared party access, basic user identity, campaign time/notes, cleaner modals, practical coin handling, AC calculation, and improved character sheets.

This plan intentionally avoids higher-risk inventory extensions that have been moved to post-1.0.

## Current 1.0 Scope

Implement these phases in order:

1. Multi-party support
2. Multi-user support
3. Modal cleanup
4. Time tracker and notes
5. Coin display summary
6. Easy coin transfer
7. AC calculation
8. Character sheet improvements
9. Visual design pass before 1.0 release

## Explicitly Post-1.0

Do not implement these as part of 1.0 unless explicitly re-scoped later:

- Stack splitting, partial stack movement, stack merging, and stack-specific action handling
- Item action buttons: split, light/extinguish, cast, eat/consume, generic use
- Floor / scene inventory for dropped items and referee-placed treasure
- Light and ad hoc duration tracking connected to campaign time
- Prepared treasure hoards
- Shopping page
- Spell reference
- Per-party configurable rule sets
- Permissions or access-control schemes beyond basic GM/Player labels
- Drag-and-drop

Existing quantity/stack display or burden behavior may remain if already present, but do not expand it into full stack handling for 1.0.

---

# Phase 1 — Multi-Party Support

## Task

Add support for multiple parties, with each party keyed to a unique URL.

## Intended Behavior

The app should no longer assume a single global party state. A party should be loaded by URL. Users can create a new party, open an existing party URL, and share that URL with others.

Security by obscurity is acceptable for 1.0. Party URLs should use long random IDs that are not easily guessable, but no permission system is required.

## Decisions Already Made

- The first-load experience with no party ID should be automatic party creation.
- Existing local state does not need to be migrated or supported.
- Old saves do not need to be supported.
- Party IDs should be stable; renaming a party should not change the URL.
- Local and Firebase modes should use the same party-shaped state model where practical.

## Requirements

- Add a party-scoped app state model.
- Add a route or URL format for party access, preferably `/party/{partyId}`.
- Add a first-load screen when no party ID is present.
- Creating a party should generate a long random party ID.
- Each party should have a display name.
- Renaming a party should not change its ID or URL.
- Firebase persistence should store party state under the party ID.
- Local mode should still behave consistently and should not require a separate state model.
- Existing old local saves may be ignored for now.
- If import/export already exists, ensure it applies to the current party rather than global app state.

## Non-Goals

- Do not add permission enforcement.
- Do not add invite approval.
- Do not add accounts/passwords.
- Do not support old save migration unless it is already trivial.
- Do not build a party directory or public listing.

## Likely Files

- `src/model/types.ts`
- `src/model/appState.ts`
- `src/store/useAppStore.ts`
- `src/App.tsx`
- Firebase configuration/persistence files
- Import/export helpers if present
- Routing/bootstrap files if present

## Implementation Guidance

Keep this phase boring and structural. The key success condition is that every meaningful piece of app state belongs to one current party. Avoid adding feature behavior while doing the party scoping work.

## Validation

```bash
npm run typecheck
npm run test
npm run build
```

Manual checks:

- Loading the app without a party ID creates a new party with a random ID.
- Creating a party produces a unique URL.
- Reloading the party URL opens the same party.
- Renaming the party does not change the URL.
- Two different party URLs do not share inventory, characters, notes, time, or audit data.
- Local mode and Firebase mode remain coherent.

## Stop Condition

Stop when the app reliably loads and persists data for a specific party ID, and no new 1.0 feature has to be built against unscoped global party state.

---

# Phase 2 — Multi-User Support

## Task

Add basic multi-user identity: each anonymous user can name themselves and label themselves as GM or Player.

## Intended Behavior

Users sharing a party should be able to see who made meaningful changes. GM/Player is a descriptive label only. It does not restrict actions or hide information in 1.0.

## Decisions Already Made

- GM/Player is descriptive only for 1.0.
- No permissions or access-control schemes are required.
- Users should be able to name themselves.
- Display name should be per user per party, with a reasonable default if possible.
- Duplicate display names are allowed.
- Meaningful mutations should include actor attribution where practical.

## Requirements

- Use anonymous auth identity where Firebase auth is available.
- Add a per-party user profile record or equivalent local state with:
  - anonymous user ID or local user ID
  - display name
  - role label: GM or Player
- Prompt users to set a display name and role when first joining a party if not already set.
- Allow users to edit their display name and role later.
- Attach actor information to meaningful audit entries and state changes where practical.
- Actor attribution should include at least:
  - display name
  - role label
  - stable internal user ID where available
- Do not enforce role-based restrictions.

## Non-Goals

- No permissions.
- No GM-only hidden data.
- No player ownership model.
- No account linking.
- No password/email login.
- No uniqueness requirement for display names.

## Likely Files

- `src/model/types.ts`
- `src/model/appState.ts`
- `src/store/useAppStore.ts`
- `src/App.tsx`
- Audit helper files if present
- Firebase auth/persistence files
- `src/styles.css`

## Implementation Guidance

Treat user identity as attribution metadata, not authorization. The app should continue to allow all users to do everything they could already do.

Avoid hardcoding `Local user` throughout the app. Centralize actor creation so later features can consistently attach actor metadata.

## Validation

```bash
npm run typecheck
npm run test
npm run build
```

Manual checks:

- A new user joining a party can enter a display name and choose GM/Player.
- User name and role can be edited later.
- Audit-relevant changes show the actor name/role.
- Two users in the same party can have different names.
- Duplicate names do not break the app.
- No role-based restrictions are enforced.

## Stop Condition

Stop when shared-party activity can be attributed to named users without introducing a permission system.

---

# Phase 3 — Modal Cleanup

## Task

Improve the layout, clarity, and consistency of modals and modal-like forms across the app.

## Intended Behavior

Modals should be scannable and predictable. They should use consistent structure, aligned controls, clear button hierarchy, and safe destructive actions. This phase should improve usability without changing underlying data behavior.

## Requirements

- Establish a consistent modal structure:
  - header/title
  - body/content
  - footer/actions
- Standardize button hierarchy:
  - primary action
  - secondary/cancel action
  - destructive action
- Improve form layout:
  - aligned labels and inputs
  - sensible grouping
  - larger text areas where descriptions/notes are expected
  - less wasted space
  - fewer haphazard conditional fields
- Improve destructive actions:
  - clear confirmation language
  - destructive buttons visually distinct
  - avoid accidental deletion
- Apply the cleanup to major existing modal flows, especially:
  - add/edit item
  - add/edit entity
  - move/transfer flows if modal-based
  - coin-related forms if already present
  - note forms once added, or ensure patterns are ready for notes
- Allow click-outside dismissal for simple detail popovers where safe.
- Do not allow click-outside dismissal to silently discard dirty edit forms.

## Non-Goals

- Do not redesign the entire app visual identity here.
- Do not add new inventory behavior.
- Do not add drag-and-drop.
- Do not add action buttons.

## Likely Files

- `src/App.tsx`
- `src/styles.css`
- Modal component files if the app has been split
- Feature components containing form/modal markup

## Implementation Guidance

This should be a usability cleanup, not a behavioral rewrite. If modal markup is duplicated, introduce light shared structure, but avoid large refactors unrelated to the current flows.

Preserve existing behavior unless the current behavior is clearly unsafe or unclear.

## Validation

```bash
npm run typecheck
npm run test
npm run build
```

Manual checks:

- Add/edit item modal is aligned and scannable.
- Entity add/edit modal is aligned and scannable.
- Destructive actions require clear confirmation.
- Cancel/save behavior is clear.
- Dirty forms are not silently discarded by accidental outside clicks.
- Modal layout works at desktop and narrow widths.

## Stop Condition

Stop when the app has consistent modal conventions that later 1.0 features can reuse without creating new modal design debt.

---

# Phase 4 — Campaign Time Tracker Sidebar

## Task

Add a lightweight OSR campaign time tracker as a sidebar on the Party page.

The tracker should help the referee track campaign time during play, write time-stamped notes, manage manually created timers, and see urgent reminders without leaving the Party page.

This feature should be useful at the table, but it should remain modest. Do not build a full calendar engine, inventory integration, automatic spell rules, or automatic random encounter rolling.

## Context

The app currently focuses on party/inventory management. This task adds a referee-facing timekeeping sidebar to the existing Party page.

The intended UI is a narrow vertical sidebar that works on both desktop and mobile:

- On desktop/wide layouts, the Party page should remain primary, with the time tracker visible as a side panel.
- On narrow/mobile layouts, the time tracker should remain usable as a compact vertical panel with large controls and a readable timeline.
- The tracker should use normal day/clock labels, not visible arbitrary turn numbers.
- Internally, the app may still use an absolute turn count for correctness.

Example display:

```text
Day 3 · 8:10 AM

At Hand
- Mal torch expires now
- Yost torch: 20 minutes left
- Bless: 20 minutes left
- Encounter check due at 8:20 AM

Timeline
7:40 AM — searched 3-133, found the secret door
7:50 AM — Encounter check
8:00 AM — encounter with gelatinous cube
8:10 AM — room 3-140: books, desk
          Mal torch expires
8:20 AM — Encounter check
8:30 AM — 3-140 chest + treasure
          Bless ends
```

## Intended Behavior

The sidebar should answer four questions quickly:

1. What time is it now?
2. What just happened?
3. What is about to happen?
4. What timers/effects require attention?

The core referee loop should be:

```text
Write note → advance one 10-minute turn
```

The tracker should support:

- 10-minute dungeon turns.
- Notes tied to campaign time.
- Manually created timers.
- Reminders when timers expire.
- Encounter check reminders as intermittent events.
- Longer timers measured in hours, days, weeks, or months.
- Direct editing by clicking/tapping relevant objects where reasonable.

## Decisions Already Made

- A turn is 10 minutes.
- Tracking in 10-minute increments is sufficient.
- Watches are not modeled explicitly.
- Notes live at a campaign time.
- The visible UI should use day/clock time, such as `Day 3 · 8:10 AM`.
- Internally, an absolute turn count is preferred as the source of truth.
- The current time should be editable.
- Ordinary 10-minute advancement should not create audit noise.
- Manual time edits should be audited.
- Light duration tracking is manual in this phase.
- Random encounter checks are reminders only, not automated rolls.
- Spell/effect timers are manual in this phase.
- Inventory integration is explicitly out of scope for this phase.

## Scope

Implement the smallest complete version that supports:

- Campaign time state.
- Party page time tracker sidebar.
- Current time display.
- Note + Turn action.
- + Turn action.
- Set Current Time action.
- Start Timer action.
- Turn/time-bound notes.
- Manually managed timers.
- At Hand timer/reminder display.
- Basic timer controls:
  - pause
  - dismiss
  - edit
- Persistence in local and Firebase modes.
- Import/export support.
- Focused tests.

## Non-Goals

Do not implement:

- A full fantasy calendar engine.
- Watches.
- Automatic inventory consumption.
- Automatic torch/lantern creation from inventory.
- Automatic random encounter rolls.
- Spell-specific duration rules.
- Inventory behavior that depends on campaign time.
- A separate full Time Tracker page unless already trivial.
- Complex recurring-event automation.
- Large redesign of the Party page.
- Rendering every long-term timer in the visible 10-minute timeline.

## UI Requirements

### Party Page Placement

Add the time tracker as a sidebar on the Party page.

The sidebar should not replace the existing Party page content. It should supplement it.

On wide layouts:

- Main Party page content remains the primary area.
- Time tracker appears as a right sidebar or equivalent side panel.
- Sidebar should be visually compact but readable.

On narrow/mobile layouts:

- Time tracker should still work as a vertical panel.
- Primary controls should be reachable and not tiny.
- Do not require horizontal scrolling for the main time tracker.
- Timeline rows should stack cleanly.

### Sidebar Structure

The sidebar should contain:

1. Current time header.
2. Main controls.
3. At Hand panel.
4. Vertical timeline.

Suggested order:

```text
Day 3 · 8:10 AM
Now: Mal torch expires
Next: encounter check at 8:20 AM

[Note + Turn] [+ Turn]
[Set Time]    [Start Timer]

At Hand
- Mal torch expires now
- Yost torch: 20 minutes left
- Bless: 20 minutes left

Timeline
7:40 AM — searched 3-133, found the secret door
7:50 AM — Encounter check
8:00 AM — encounter with gelatinous cube
8:10 AM — room 3-140: books, desk
          Mal torch expires
8:20 AM — Encounter check
8:30 AM — 3-140 chest + treasure
          Bless ends
```

### Current Time Header

Display current time clearly.

Use day/clock notation:

```text
Day 3 · 8:10 AM
```

Do not make arbitrary turn numbers the primary visible label.

The current time label should be clickable/tappable to open the Set Current Time control if this is simple and accessible. If not, use the explicit Set Time button only.

### Main Controls

Use this minimal primary control set:

```text
[Note + Turn]  [+ Turn]  [Set Time]  [Start Timer]
```

On narrow/mobile layouts, this may wrap into two rows:

```text
[Note + Turn]  [+ Turn]
[Set Time]     [Start Timer]
```

Do not add extra always-visible buttons unless needed.

### Note + Turn

This is the primary table-use action.

Behavior:

1. Open a note input for the current time.
2. Save the note at the current campaign time.
3. Advance the campaign time by one 10-minute turn.

The note form should also allow saving without advancing if simple:

```text
Note for Day 3, 8:10 AM

[Save Note] [Save + Advance Turn]
```

This avoids needing a separate always-visible Add Note button.

### + Turn

Advances current campaign time by 10 minutes without creating a note.

This should still process timer/reminder state:

- expired timers become due
- encounter reminders become due
- future reminders that reach current time are surfaced

Do not audit ordinary + Turn.

### Set Time

Manual current-time editing.

Fields:

- day
- hour
- minute, in 10-minute increments

Example:

```text
Set Current Time

Day: [3]
Hour: [8 AM]
Minute: [10]

[Set Time]
```

Manual time edits should be audited.

This control is for correcting or directly setting campaign time. It is not ordinary turn advancement.

### Start Timer

Opens a compact timer form.

Fields:

- name
- duration number
- duration unit
- optional owner
- category/type

Example:

```text
Start Timer

Name: [Mal torch]
Duration: [6] [turns]
Category: [Light]
Owner: [Mal]

[Start Timer]
```

Duration units should support:

- turns
- hours
- days
- weeks
- months

Useful presets if simple:

```text
Torch
Lantern
3 turns
1 hour
4 hours
1 day
2 weeks
```

Presets are optional for this phase, but the model should not prevent adding them later.

## Timeline Requirements

Use a vertical timeline in the sidebar.

Each ordinary row represents one 10-minute time position.

Rows should show:

- clock time
- compact timer bars if useful
- notes/events for that time

The active/current row should be visually emphasized.

The current row should always be visible if possible.

When space allows, show at least:

- 2 past rows
- the current row
- 2 future rows

More rows may be shown on desktop/wide layouts.

Example:

```text
7:40 AM — searched 3-133, found the secret door
7:50 AM — Encounter check
8:00 AM — encounter with gelatinous cube
8:10 AM — room 3-140: books, desk
          Mal torch expires
8:20 AM — Encounter check
8:30 AM — 3-140 chest + treasure
          Bless ends
```

### Timer Bars

Where practical, show narrow timer bars beside the visible timeline.

Rules:

- Each active torch has its own bar.
- Each active lantern has its own bar.
- Each spell/effect timer may have its own bar if it is relevant in the visible window.
- Do not merge all torches into one “torch” bar.
- Do not merge all lights into one “light” bar.
- Do not render every timer if there are many.
- Prioritize visible bars for:
  - due now
  - due within visible window
  - active light sources
  - pinned/important timers
  - currently relevant spell/effect timers

### Encounter Checks

Encounter checks are not duration bars.

Represent encounter checks as intermittent reminders/events.

Example:

```text
8:20 AM — Encounter check
```

Do not roll random encounters automatically.

Preferred minimal behavior:

- Store optional encounter-check cadence, such as every 2 turns.
- When a check is due, show it in the timeline and/or At Hand panel.
- Provide a simple way to mark the check handled if practical.

If encounter cadence controls are too much for this phase, hard-code or defer cadence configuration, but do not model encounter checks as continuous duration bars.

### Compressed Time Blocks

The timeline may eventually show compressed time blocks.

Example:

```text
9:00–10:00 AM — 1 hour resting
```

For this phase, compressed blocks are optional. Do not build a large jump-time workflow unless it is straightforward.

However, the data model should not make compressed time blocks impossible later.

## Notes

Notes live at a specific campaign time.

Minimum note fields:

- id
- createdAt
- optional updatedAt
- absoluteTurn
- body

Optional fields if easy:

- title
- category
- tags

A single note body is enough for this phase.

Notes should be editable by clicking/tapping note text if simple.

Clicking an empty visible timeline row may open “Add note at this time” if simple. Otherwise, rely on Note + Turn.

Deleting a non-empty note should require confirmation.

## At Hand Panel

The At Hand panel shows active and urgent timers/reminders.

Always prioritize:

1. due now
2. due soon
3. active lights
4. active spells/effects
5. long timers due today or soon

Example:

```text
At Hand

Mal torch
expires now
[Replace] [Pause] [Dismiss] [Edit]

Yost torch
20 minutes left

Party lantern
2 hours left

Bless
20 minutes left
```

If many timers exist, group lower-priority timers.

Suggested groups:

```text
Due / Soon
Light
Spells / Effects
Long Timers
Hidden / Later
```

## Timer Controls

Each timer should support:

- pause
- dismiss
- edit

For light timers, support a restart/replace action if simple:

- Replace torch
- Refill lantern
- Restart timer

This can be contextual and does not need to appear for every timer category.

### Pause Timer

Paused timers do not tick down when time advances.

If pause creates too much complexity, keep the data model ready for `paused` but hide the control temporarily. Preferred behavior is to include it now.

### Dismiss Timer

For expired timers, dismiss means “handled.”

For active timers, dismiss means “stop tracking.”

Require confirmation only if dismissing an active, non-expired timer would be destructive or surprising.

### Edit Timer

Allow editing:

- name
- owner
- category
- duration/end time
- paused status
- description, if present

## Long Timers and Day Notes

The timer model should support longer durations:

- days
- weeks
- months

Examples:

```text
Faction response — Day 5 morning
Hireling penalty — next month
Research complete — in 2 weeks
```

For this phase:

- Long timers should appear in At Hand if due soon.
- Long timers may be grouped under “Long Timers.”
- Long timers do not need to render into every 10-minute timeline row.

Day notes may be useful:

```text
Day 3 — entered level 3; beastmen alerted
```

If day-level notes are simple to support using the same note model, include them. Otherwise, defer explicit day notes.

## Direct Interaction Guidance

Use direct interaction to reduce button clutter:

- Click/tap current time header → Set Current Time.
- Click/tap note text → Edit note.
- Click/tap empty visible row → Add note at that time, if simple.
- Click/tap timer card → Edit timer.
- Click/tap timer bar → Edit timer, if bars are interactive.
- Click/tap compressed block → Edit block, if compressed blocks are implemented.
- Due light timer should expose direct actions:
  - Replace/restart
  - Dismiss
  - Edit

Do not add separate buttons for every editable object if the object itself can reasonably be clicked.

## Data Model Guidance

Use an internal absolute turn count as the source of truth.

Suggested campaign time state:

```ts
campaignTime: {
  absoluteTurn: number;
  turnsPerDay: number;
  dayStartHour?: number;
  updatedAt?: string;
}
```

Display day/hour/minute from `absoluteTurn`.

Example visible label:

```text
Day 3 · 8:10 AM
```

The exact day start hour can be simple. If no campaign calendar exists, assume a basic 24-hour day and 10-minute increments.

Suggested note model:

```ts
campaignNotes: {
  id: string;
  createdAt: string;
  updatedAt?: string;
  absoluteTurn: number;
  body: string;
  title?: string;
  category?: string;
}[]
```

Suggested timer model:

```ts
campaignTimers: {
  id: string;
  name: string;
  category: "light" | "spell" | "effect" | "encounter" | "faction" | "downtime" | "other";
  ownerName?: string;
  startTurn: number;
  endTurn?: number;
  durationTurns?: number;
  dueTurn?: number;
  status: "active" | "paused" | "expired" | "dismissed";
  description?: string;
  createdAt: string;
  updatedAt?: string;
}[]
```

For long timers, either convert duration to turns or store a due day/date representation if the existing app has date handling.

Use the simplest representation that preserves correct display.

Do not connect timers to inventory items in this phase.

## Persistence

Persist and sync campaign time, notes, and timers in both local and Firebase modes.

Import/export should include:

- campaign time state
- campaign notes
- campaign timers
- timer statuses

Existing saves without these fields should still load safely with default empty values.

## Audit Logging

Audit:

- manual current time edits
- day changes caused by manual time edits
- deleting non-empty notes if existing audit policy would normally log deletes
- deleting/dismissing active timers if consistent with existing audit behavior

Do not audit:

- ordinary + Turn
- Note + Turn advancement
- timer countdown progression
- ordinary timer expiration
- ordinary note creation unless existing audit policy already does this

The audit log should not become a turn-by-turn noise log.

## Likely Files

Likely affected files may include:

- `src/model/types.ts`
- `src/model/appState.ts`
- `src/store/useAppStore.ts`
- `src/App.tsx`
- Party page / party view components
- `src/styles.css`
- persistence/import/export helpers
- Firebase sync helpers
- audit helper files if present
- tests for model/store behavior

Adjust based on the current code organization.

## Implementation Guidance

Favor minimal diffs.

Build the time tracker as a Party page sidebar component, not as a broad app redesign.

Suggested implementation order:

1. Add campaign time state.
2. Add note model tied to absolute turn.
3. Add timer model.
4. Add store actions:
   - advance one turn
   - create note
   - note and advance one turn
   - set current time
   - start timer
   - pause timer
   - dismiss timer
   - edit timer
5. Add persistence/import/export handling.
6. Add the Party page sidebar UI.
7. Add the At Hand panel.
8. Add the vertical timeline.
9. Add focused tests.
10. Validate local and Firebase behavior.

Do not implement inventory integration or complex calendar features.

## Validation

Run:

```bash
npm run typecheck
npm run test
npm run build
```

Manual checks:

- Party page shows the time tracker sidebar.
- Current time displays as day + clock time, not only arbitrary turn number.
- Active/current time row is visually obvious.
- Sidebar shows at least a couple of past and future rows around current time when space allows.
- `+ Turn` advances 10 minutes.
- `Note + Turn` creates a note at the current time and advances 10 minutes.
- Note can be saved without advancing if that option is implemented.
- Clicking/tapping current time opens Set Current Time if direct editing is implemented.
- Setting current time supports day/hour/minute in 10-minute increments.
- Manual current time edit creates an audit entry.
- Start Timer creates a visible timer.
- Separate torches/lanterns appear as separate timer records.
- Active timers appear in At Hand.
- Due timers are emphasized.
- Timer can be paused.
- Timer can be dismissed.
- Timer can be edited.
- Expired light timer can be replaced/restarted if that action is implemented.
- Notes can be edited.
- Deleting a non-empty note requires confirmation.
- Local mode persists time, notes, and timers.
- Firebase mode syncs time, notes, and timers.
- Import/export preserves time, notes, and timers.
- Existing imported data without time tracker fields still loads safely.

## Acceptance Criteria

- The Party page includes a usable vertical time tracker sidebar.
- The current campaign time can be advanced in 10-minute increments.
- The current campaign time can be manually set.
- Notes can be created at campaign times.
- `Note + Turn` supports the core referee loop.
- Timers can be started, paused, dismissed, and edited.
- Timers support turns, hours, days, weeks, and months at the model/input level.
- Timer reminders surface clearly when due.
- Encounter checks, if implemented, are shown as intermittent reminders and not duration bars.
- Time tracker state is persisted in local mode and Firebase mode.
- Import/export includes the time tracker state.
- Ordinary turn advancement does not create audit noise.
- Manual time editing is audited.
- No inventory behavior depends on the time tracker.

## Stop Condition

Stop when the Party page has a functional vertical time tracker sidebar with:

- current day/clock time
- Note + Turn
- + Turn
- Set Current Time
- Start Timer
- turn-bound notes
- manually managed timers
- At Hand timer display
- pause/dismiss/edit timer controls
- local/Firebase persistence
- import/export support

Do not continue into inventory integration, automatic encounter rolling, full calendar systems, watches, or unrelated Party page redesign.

---


# Phase 6 — Easy Coin Transfer

## Task

Add a simple workflow for transferring coins between entities.

## Intended Behavior

Users should be able to move coins from one entity to another without manually editing coin records. The workflow should be clear, safe, and audit-friendly.

## Decisions Already Made

- Coin transfer should not automatically make change in 1.0.
- Transfers should require available exact denominations.
- Negative coins should not be allowed.
- Any entity that can hold inventory can receive coins.
- Transfers should be audited.

## Requirements

- Add a coin transfer workflow.
- The user should choose:
  - source entity
  - destination entity
  - denomination amounts
  - optional note if simple
- Validate that the source has enough of each transferred denomination.
- Do not automatically convert denominations.
  - Example: if source has 10 sp but no gp, transferring 1 gp should be rejected.
- Update coin records according to existing coin rules.
- Destination may be a character, retainer, storage entity, mount, or other valid inventory-holding entity.
- If multiple coin records/locations exist for a source, either:
  - use a clear default source behavior, or
  - allow choosing source location only when necessary.
- Log transfer event in audit log with:
  - actor
  - source
  - destination
  - denominations moved
  - optional note

## Non-Goals

- No automatic change-making.
- No pooled party wallet unless already present.
- No shopping/payment checkout.
- No coin weight/burden rule changes.
- No arbitrary debt/negative coin balances.

## Likely Files

- `src/model/types.ts`
- `src/model/calculations.ts`
- `src/model/validation.ts`
- `src/store/useAppStore.ts`
- `src/App.tsx`
- `src/styles.css`
- Audit helper files if present
- Tests for coin mutations if present

## Implementation Guidance

Prefer a simple transfer form. Do not expose raw coin records unless the user needs to resolve ambiguity. The common case should be fast: choose source, choose destination, enter amounts, transfer.

Use the modal conventions established in Phase 3.

## Validation

```bash
npm run typecheck
npm run test
npm run build
```

Manual checks:

- Transfer gp from one character to another.
- Transfer mixed denominations.
- Transfer coins to storage.
- Attempt to transfer more than source has; confirm it is blocked.
- Attempt denomination conversion; confirm it is not automatic.
- Confirm coin displays update after transfer.
- Confirm audit entry includes actor/source/destination/amounts.

## Stop Condition

Stop when coins can be transferred safely without manual record editing or automatic change-making.

---

# Phase 7 — AC Calculation

## Task

Calculate and display character AC from equipped armor and shield state, with warning handling and manual override support.

## Intended Behavior

AC should be visible and useful on the character/party views. It should be calculated from equipped armor and shield where possible, while still allowing manual exceptions.

## Decisions Already Made

- Base ascending AC is 10 unless existing rules already specify otherwise.
- Shield counts only when held in hand.
- Armor counts when equipped.
- Armor does not count when stowed.
- There is no separate “worn” category; equipped means actively in use.
- If multiple armors are equipped, show warning: `Multiple armors equipped.`
- If multiple armors are equipped, use the best armor for calculation.
- Manual override should be allowed.

## Requirements

- Add or complete AC calculation for characters and retainers where relevant.
- Calculate AC from:
  - base AC
  - equipped armor
  - shield held in hand
  - manual modifier/override if present
- Armor contributes only when in equipped state.
- Stowed armor does not contribute.
- Shield contributes only when held in hand.
- Stowed shield does not contribute.
- Shield in an ambiguous non-hand location should not contribute unless the existing model clearly treats it as held/equipped.
- If multiple armors are equipped:
  - show warning: `Multiple armors equipped.`
  - use best armor for calculation
- Display AC prominently on relevant character and party views.
- Provide a way to see calculation details, such as:
  - base AC
  - armor source
  - shield source
  - override/manual modifier if active
- Allow manual override for exceptions.
- Clearly indicate when AC is manually overridden.

## Non-Goals

- Do not build a full combat engine.
- Do not automate Dexterity modifiers unless already unambiguously supported.
- Do not automate magic item AC unless item data explicitly supports it.
- Do not support rule-set variations yet.
- Do not change inventory placement rules.

## Likely Files

- `src/model/types.ts`
- `src/model/calculations.ts`
- `src/model/validation.ts`
- `src/store/useAppStore.ts`
- `src/App.tsx`
- `src/styles.css`
- Existing warning/display helper files
- Tests for calculations/warnings

## Implementation Guidance

Do not calculate AC by brittle item-name matching if there is already structured armor/shield data. Use item type/properties where available.

If the data model is not clean enough to identify armor and shield reliably, prefer a small explicit metadata field over a large heuristic system.

## Validation

```bash
npm run typecheck
npm run test
npm run build
```

Manual checks:

- No armor/shield: AC is base value.
- Equipped armor changes AC.
- Stowed armor does not change AC.
- Shield held in hand changes AC.
- Shield stowed does not change AC.
- Multiple equipped armors show warning and use best armor.
- Manual override displays and takes precedence where intended.
- Party summary displays correct AC.

## Stop Condition

Stop when AC is calculated from normal equipped state, warnings are clear, and manual exceptions are supported without adding combat-system complexity.

---

# Phase 8 — Character Sheet Improvements

## Task

Improve character sheet support for saves, skills, and other table-facing character data.

## Intended Behavior

The app should be usable as a lightweight character reference during play, not only an inventory tracker. The party summary already has the correct information; this phase should not rework that page unnecessarily.

## Decisions Already Made

- Saves should be calculated from class tables.
- Skills should be manually entered for 1.0.
- Party summary currently has the correct information already.
- Character sheet improvements should avoid full character creation/progression automation.

## Requirements

- Add or complete save calculation from class tables.
- Saves should derive from class and level where possible.
- Support the classes currently allowed/supported by the app’s rule baseline.
- If a class is unknown or unsupported, provide a safe fallback such as manual fields or clear missing-data display.
- Add manually editable skills/class ability fields for 1.0.
- Preserve or improve display of existing character fields:
  - name
  - class/level
  - HP
  - AC
  - movement
  - XP
  - ability scores
  - alignment
  - languages
  - notes
- Do not substantially change the party summary information if it is already correct.
- Character and retainer sheets should receive the main improvements.
- Mounts/storage should only show fields relevant to those entity types.

## Non-Goals

- No full character builder.
- No automated class progression beyond save lookup.
- No automated skill progression in 1.0.
- No spell reference.
- No spell slot automation unless already present and trivial.
- No per-party rule-set switching.

## Likely Files

- `src/model/types.ts`
- `src/model/calculations.ts`
- `src/model/appState.ts`
- `src/store/useAppStore.ts`
- `src/App.tsx`
- `src/styles.css`
- New save table data file if needed, e.g. `src/model/saveTables.ts`
- Tests for save calculation

## Implementation Guidance

Keep saves data explicit and testable. Do not bury save lookup in UI code. Character sheet fields should remain editable where automation is not settled.

Use the existing party summary as source guidance; do not redesign it unless necessary to display AC/saves data consistently.

## Validation

```bash
npm run typecheck
npm run test
npm run build
```

Manual checks:

- Saves calculate correctly for supported class/level combinations.
- Unsupported/unknown class does not crash the app.
- Skills can be manually edited and persist.
- Character sheet remains readable on desktop and narrow widths.
- Party summary retains currently correct information.
- AC and movement display remain consistent with previous phases.

## Stop Condition

Stop when character sheets provide useful table reference data, saves are calculated from class tables, and skills remain editable without introducing full character-builder scope.

---

# Phase 9 — Visual Design Pass Before 1.0

## Task

Perform a focused visual design pass for clarity, consistency, and table usability before the 1.0 release.

## Intended Behavior

The app should be readable during play on laptops and tablets. This pass should improve hierarchy and consistency without changing feature behavior or data shape.

## Decisions Already Made

- A visual design pass should happen before 1.0 release.
- This is broader than modal cleanup, but still should not become a feature redesign.

## Requirements

- Review all 1.0 pages and major flows:
  - party summary
  - inventory
  - character sheets
  - audit log
  - time/notes
  - coin transfer
  - settings/setup/join screens
- Improve visual hierarchy for high-priority information:
  - entity names
  - movement
  - AC
  - warnings
  - coin summary
  - time tracker state
  - note titles/current turn
- Standardize visual treatment of:
  - cards
  - item rows
  - warnings/errors
  - buttons
  - forms
  - modals
  - tables/lists
- Ensure destructive actions are visually distinct.
- Improve mobile/narrow-width behavior where practical.
- Keep plain CSS unless a separate decision is made.
- Preserve existing calculations and persistence behavior.

## Non-Goals

- Do not change the inventory model.
- Do not add new features.
- Do not add drag-and-drop.
- Do not introduce a component library unless explicitly approved.
- Do not redesign page information architecture beyond obvious cleanup.

## Likely Files

- `src/styles.css`
- `src/App.tsx`
- Feature components/files if the app has been split

## Implementation Guidance

This is a polish pass, not a new design system rewrite. Favor small, visible improvements and consistency fixes. Do not destabilize working features immediately before 1.0.

## Validation

```bash
npm run typecheck
npm run test
npm run build
```

Manual checks:

- Review every major page at desktop width.
- Review every major page at tablet/narrow width.
- Confirm warnings and destructive actions are visually distinct.
- Confirm no visual changes alter calculations or persistence.
- Confirm modal cleanup conventions remain intact.

## Stop Condition

Stop when the app is more readable and consistent across 1.0 features without behavior changes or large structural rewrites.

---

# Cross-Cutting Requirements for All 1.0 Work

## Audit Logging

Meaningful user actions should be audit-friendly and actor-attributed where practical.

Audit these in 1.0:

- manual time edits
- day advancement
- note creation/edit/delete
- coin transfers
- character sheet edits where meaningful
- AC override changes
- destructive imports/resets if present

Do not create noisy audit entries for simple 10-minute turn advancement.

## Local and Firebase Parity

Every 1.0 feature should work consistently in both local and Firebase modes unless a feature is explicitly Firebase-only for unavoidable reasons.

Do not leave features half-working in one mode.

## Import/Export

If import/export already exists, keep it compatible with the current party state.

If import/export is incomplete, add or preserve at least basic full-party export/import before 1.0 if feasible. Import should validate basic shape and require confirmation before replacing current party state.

Old save migration is not required for now.

## Validation Philosophy

- Hard-block structurally impossible actions.
- Do not silently fix user data.
- Allow game-state warnings where appropriate.
- Surface critical warnings clearly.
- Avoid broad refactors unless needed to make the current phase safe.

## UI Philosophy

- Favor clarity at the table over dense configuration.
- Keep common actions fast.
- Hide details until needed.
- Use click/tap-accessible details, not hover-only behavior.
- Avoid adding new visual patterns when existing cleaned-up patterns work.

---

# Suggested 1.0 Completion Checklist

Before declaring 1.0 ready:

- A new user can create a party and get a shareable party URL.
- Another user can open the party URL and set their display name/role.
- Meaningful changes show actor attribution in audit where applicable.
- Modals are readable and consistent.
- Campaign time tracks days and 10-minute turns.
- Notes are associated with turns and persist.
- Coins show compact value/burden summaries.
- Coins can be transferred between entities without manual record editing.
- AC calculates from equipped armor and shield-in-hand behavior.
- Multiple equipped armors warn and use best armor.
- Saves calculate from class tables.
- Skills are manually editable.
- Party summary still shows the currently correct information.
- Visual pass has been completed across all major pages.
- Local and Firebase modes behave consistently.
- Typecheck, tests, and build pass.

```bash
npm run typecheck
npm run test
npm run build
```

---

# Post-1.0 Backlog

## High-Value Post-1.0

1. Floor / scene inventory
   - dropped items
   - referee-placed treasure
   - pickup/drop workflows

2. Stack handling
   - split stacks
   - partial movement
   - merge behavior if desired
   - hand-placement special cases

3. Item action buttons
   - split if not handled above
   - light/extinguish
   - eat/consume
   - cast
   - generic use

4. Light and ad hoc duration tracking
   - attach durations to active effects/items
   - evaluate against campaign time
   - expiration warnings

## Lower or Later Post-1.0

5. Prepared treasure hoards
6. Shopping page
7. Spell reference
8. Per-party configurable rule sets
9. Drag-and-drop


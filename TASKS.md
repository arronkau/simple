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

## Stop Condition

Stop when the app has consistent modal conventions that later 1.0 features can reuse without creating new modal design debt.

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


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


# TASKS.md

## 0.1 Launch Standard

The 0.1 launch target is **usable and helpful in actual table play**, not feature complete.

The app should support a referee running a real session with enough confidence that:

- imports and exports are safe enough for real campaign data;
- encumbrance, containers, hands, coins, and warnings are trustworthy;
- party state can be inspected quickly during play;
- standard inventory can be added without tedious manual entry;
- common table actions like spending coins and identifying magic items are supported.

0.1 is explicitly **single-user / referee-facing**. It does not need player accounts, role management, drag-and-drop, or final visual design.

---

## 0.1 Scope Summary

### 0.1 Blockers

1. Import/export safety and hard rejection of malformed imports.
2. Warning correctness pass.
3. Core calculation regression test review/fill-in.
4. One-level nested containers.
5. Coin spend action with audit note.
6. Unidentified item workflow with audit log.
7. Standard item autofill.
8. Compact party view.
9. Focused 0.1 UI cleanup.

### Deferred Post-0.1

The following are explicitly out of scope for 0.1:

- GM vs player roles.
- Role management.
- Player permissions.
- Role-gated secret fields.
- Drag-and-drop.
- Full audit log beyond required 0.1 events.
- Shopping page.
- Prepared treasure hoards.
- Full referee operations dashboard beyond the compact party view.
- Full visual design pass.
- Mobile/tablet-specific design work.
- Automatic backup/recovery beyond import/export.
- Demo party/fixture polish unless needed for tests.

---

# Phase 0 — Lock 0.1 Scope

## Goal

Make the 0.1 launch scope explicit so implementation does not drift into deferred features.

## Requirements

- Treat 0.1 as referee-facing, single-user table support.
- Keep the launch standard focused on actual table usefulness, not completeness.
- Do not add dependencies on multiplayer, player accounts, role management, or drag-and-drop.
- Import/export is sufficient as the 0.1 data recovery path.
- Demo fixture work is not required for 0.1 unless needed for tests.

## Non-goals

- No GM/player role system.
- No permission model.
- No role-gated data visibility.
- No drag-and-drop.
- No full design pass.
- No automatic backup history.

## Acceptance Criteria

- 0.1 tasks can be completed without adding auth, permissions, or drag/drop.
- Deferred work is clearly separated from launch blockers.
- Future Codex tasks can refer to this file as the source of truth for 0.1 scope.

---

# Phase 1 — Import/Export Safety

## Goal

Make import/export safe enough for real use without building a larger recovery system.

## Requirements

### Export

- Export current app state as JSON.
- Export should include all data needed to restore the current campaign state.
- Export format should remain compatible with current import expectations.

### Import

- Import is destructive.
- Show a clear warning before import.
- Require explicit confirmation before replacing current state.
- Hard reject malformed imports.
- Do not partially import invalid data.
- On failure, preserve existing app state.

Suggested confirmation text:

```text
Import replaces all current app data. Export a backup first. Type "import" to continue.
```

### Reset

- Reset data remains destructive.
- Require typing `delete` before reset proceeds.

## Non-goals

- No automatic backup system.
- No backup history.
- No partial import recovery.
- No migration UI beyond hard rejecting invalid data.
- No import preview unless already trivial.

## Acceptance Criteria

- Malformed JSON cannot overwrite current data.
- Invalid import shape cannot partially overwrite current data.
- User must explicitly confirm destructive import.
- User must explicitly confirm reset.
- Exported JSON can be re-imported successfully.

## Validation

Run the existing test suite and add targeted import/export tests where practical.

Suggested commands:

```bash
npm test
npm run build
```

---

# Phase 2 — Warning Correctness Pass

## Goal

Make warnings accurate enough that users can trust them during play.

## Requirements

### Remove inappropriate warnings

- Remove warnings about non-held containers from non-character entities.
- Non-character entities include storage, mounts, vehicles, banks, and similar inventory holders.
- These entities should not use character-style equipped/stowed/held assumptions unless explicitly modeled.

### Keep character-like warnings

For characters and retainers, keep or add warnings for:

- Missing backpack where backpack is required.
- More than one backpack, if still forbidden by the model.
- Stowed non-coin item with no valid backpack destination.
- Invalid item location.
- Overfilled hands.
- Overfilled container.
- Overloaded entity.
- Movement reduced by encumbrance.
- Hands-required non-empty container not held, if this remains a rule.
- Lit items where light status affects display.
- Unidentified items with secret fields.

### Warning structure

- Warnings should be generated generically enough that the UI can later show them behind an icon.
- For now, correctness matters more than compact presentation.

## Non-goals

- No full warning redesign yet.
- No hover-only warning system.
- No mobile/touch warning interaction work.
- No role-specific warning visibility.

## Acceptance Criteria

- Storage, mount, bank, and similar non-character containers do not warn merely because they are not held.
- Character/retainer warning cases remain covered.
- Warning tests cover at least:
  - character with missing backpack;
  - overfilled backpack;
  - non-character entity with non-held container;
  - overloaded character;
  - invalid hand state.

## Validation

```bash
npm test
npm run build
```

---

# Phase 3 — One-Level Nested Containers

## Goal

Allow ordinary table-use cases like a scroll case, pouch, or small sack inside a backpack without allowing unlimited recursive complexity.

## Intended Behavior

Allow this:

```text
Character
  Backpack
    Scroll case
      Scroll
```

Allow this:

```text
Storage
  Chest
    Pouch
      Gems
```

Do not allow this:

```text
Character
  Backpack
    Sack
      Scroll case
        Scroll
```

## Requirements

- Containers may be nested one level deep inside another container.
- The UI should display one nested container level clearly.
- Destination validation must prevent deeper nesting.
- Encumbrance calculations must count nested container contents correctly.
- Container capacity calculations must include nested contents correctly.
- Non-character entities may contain containers without held-container warnings.
- Character/retainer stowed inventory should still respect backpack rules.

## Rule Notes

- A character-like entity’s stowed non-coin items should still normally be in the backpack.
- The backpack may contain items and one level of containers.
- Nested containers may contain items.
- Nested containers may not contain additional containers.
- The held-container exception still applies only where relevant to character-like entities.

## Non-goals

- No arbitrary recursive nesting.
- No drag-and-drop support.
- No visual redesign of the inventory tree.
- No complex container-type-specific nesting rules unless already present.

## Acceptance Criteria

- User can place a scroll case inside a backpack.
- User can place a scroll inside that scroll case.
- User cannot place another container inside the scroll case.
- Nested contents count toward capacity and encumbrance as intended.
- Non-character entities can contain nested containers without irrelevant held warnings.
- Regression tests cover allowed and disallowed nesting.

## Validation

```bash
npm test
npm run build
```

---

# Phase 4 — Core Calculation Regression Tests

## Goal

Ensure the app’s rule calculations are trustworthy before adding more UI.

This may already be mostly done. The task is to review existing coverage and fill gaps.

## Required Test Coverage

### Missing or insufficient test coverage

- Direct global 16-slot overload test where equipped + stowed > 16 but neither side individually overloads.
- Mirror slower-of test where stowed burden is slower than equipped burden.
- Explicit coin boundary tests at 99/100/101 coins and mixed denominations.
- Explicit stackable equipment burden tests.
- Exact-at-capacity and over-capacity container slot usage tests.
- Store/action-level invalid destination tests, not just validation-state tests.
- Held overfilled container test: contents excluded from movement but still over-capacity warning.
- Clean held-container test with backpack present, avoiding unrelated missing-backpack warning.

## Non-goals

- No exhaustive property-based testing.
- No full fixture overhaul unless needed.
- No demo party requirement for 0.1.

## Acceptance Criteria

- Existing tests are reviewed for the required cases.
- Missing coverage is added.
- Test names clearly describe the rule being protected.
- All tests pass.

## Validation

```bash
npm test
npm run build
```


---

# Phase 5 — Coin Spend Action with Audit Note

## Goal

Support a common table action: spending coins and recording why.

## Requirements

- Add a **Spend** action for coin records.
- User can choose coin type and amount.
- User can add an optional note.
- Spending reduces the coin amount.
- Spending cannot reduce a coin type below zero.
- Spending writes to the audit log.
- Audit log should include:
  - entity name;
  - amount spent;
  - coin type;
  - optional note.

Example audit log entry:

```text
Yost spent 25 gp — paid temple donation.
```

## Non-goals

- No full accounting ledger.
- No vendor/shop integration.
- No automatic currency conversion.
- No mixed-coin spend UI unless already trivial.
- No role-gated audit log.

## Acceptance Criteria

- Spending 10 gp from 50 gp leaves 40 gp.
- Spending more coins than available is blocked.
- Spending with a note records the note in the audit log.
- Spending without a note still records the spend.
- Coin spending is covered by tests where practical.

## Validation

```bash
npm test
npm run build
```

---

# Phase 6 — Unidentified Item Workflow with Audit Log

## Goal

Support unidentified magic or special items without exposing referee information in public fields.

## Data Model

Use or add fields equivalent to:

```ts
name: string;
description?: string;
secretName?: string;
secretDescription?: string;
isIdentified?: boolean;
```

## Intended Behavior

Before identification:

- Public display uses `name`.
- Public display uses `description`.
- Referee/edit UI can see and edit `secretName`.
- Referee/edit UI can see and edit `secretDescription`.
- Item is marked unidentified if `isIdentified` is false and secret fields exist.

On identification:

- The Identify action copies `secretName` into `name`.
- The Identify action copies `secretDescription` into `description`.
- The item becomes identified.
- The action writes to the audit log.

Example audit log entry:

```text
Identified rusty sword as Sword of Sundering +2.
```

## Requirements

- Rename/adjust extra fields to:
  - `secretName`
  - `secretDescription`
- Add an **Identify** button where appropriate.
- Identify button should be available only when there is something to identify.
- Identifying should update public fields.
- Identifying should write a clear audit log entry.
- If either secret field is missing, identify should still behave sensibly:
  - secret name only: update name;
  - secret description only: update description;
  - neither: no-op or disabled.
- Preserve the old public name for the audit message before overwriting it.

## Non-goals

- No GM/player role visibility yet.
- No partial reveal system.
- No identify permissions.
- No complex history of prior public names/descriptions beyond the audit log.
- No automatic magic item rules.

## Acceptance Criteria

- An item named `rusty sword` with `secretName: Sword of Sundering +2` identifies into public name `Sword of Sundering +2`.
- Audit log records: `Identified rusty sword as Sword of Sundering +2.`
- Secret description copies into public description when present.
- Identify button is disabled or hidden when no secret fields are present.
- Identification behavior is covered by tests where practical.

## Validation

```bash
npm test
npm run build
```

---

# Phase 7 — Standard Item Autofill

## Goal

Make adding common inventory fast enough for table use.

## Requirements

Add or expand an item catalog for common OSE/Dolmenwood-style inventory:

- Standard adventuring equipment.
- Weapons.
- Armor.
- Containers.
- Light sources.
- Rations.
- Tools.
- Treasure placeholders if useful.
- Common stackables such as torches, iron spikes, rations, oil, arrows/bolts if modeled.

Autofill should populate relevant fields:

- Name.
- Record type.
- Quantity.
- Slots per item or items per slot.
- Stackable flag.
- Hands required.
- Container capacity.
- Light-related fields.
- Weapon/armor metadata where already supported.

## UI Requirements

- Add/edit modal should support selecting from standard items.
- Custom item creation must remain possible.
- Autofill should not prevent editing fields after selection.
- Search/filter is preferred if the list is long.

## Non-goals

- No complete sourcebook database.
- No pricing/shop system.
- No automatic equipment packs.
- No import from external equipment compendia.
- No new item taxonomy unless required by existing model.

## Acceptance Criteria

- User can quickly add:
  - torch;
  - lantern;
  - rations;
  - rope;
  - backpack;
  - sack;
  - scroll case;
  - sword;
  - dagger;
  - bow;
  - shield;
  - leather armor;
  - chain mail.
- Autofilled items can still be edited before creation.
- Autofill does not break custom item creation.
- Standard item data matches current model field names.

## Validation

```bash
npm test
npm run build
```

---

# Phase 8 — Compact Party View

## Goal

Give the referee a table-facing party overview that avoids opening every character sheet during play.

## Scope

Show compact cards for:

- characters;
- retainers.

Mounts/storage do not need full cards in this view unless already easy. They may be linked or summarized separately.

## Card Requirements

Each card should show:

- Name.
- Class/level.
- Current/max HP.
- Movement.
- Languages.
- Hands contents.
- Warning icon or concise warning summary.
- Light source indicator.

Optional if already easy:

- AC.
- Equipped/stowed slot totals.
- Link/button to open full inventory or character detail.

## Layout Requirements

- Cards should be more compact than the current full-width character inventory display.
- Use columns or wrapping layout where practical.
- Keep text scannable.
- Do not surface nonessential metadata.

## Non-goals

- No full redesign.
- No drag/drop.
- No role-specific visibility.
- No mobile-specific design work.
- No advanced party analytics yet.

## Acceptance Criteria

- Referee can see all characters and retainers in one overview.
- Referee can quickly see who is hurt, slow, holding light, or has warnings.
- Hands contents are visible without opening each character.
- Movement is visible without expanding inventory details.
- Party view links to the existing detailed view where needed.

## Validation

```bash
npm test
npm run build
```

---

# Phase 9 — Focused 0.1 UI Cleanup

## Goal

Reduce friction in actual table use without doing the full post-0.1 design pass.

## Requirements

Prioritize these small cleanups:

1. Improve light display.
2. Improve hand item layout.
3. Allow containers to collapse.
4. Show only essential info on item/container headings.
5. Move warning details behind a generic warning icon using click/tap, not hover only.
6. Use character columns where this is straightforward.

## Essential Heading Info

Inventory item headings should generally show only:

- Name.
- Quantity, when relevant.
- Slot usage.
- Status icons, such as lit/unidentified/warning.
- Value only for treasure/coins.

Avoid showing in normal compact headings:

- Internal location.
- Hands required.
- Damage die.
- Modifiers.
- Long descriptions.
- IDs.
- Debug metadata.

## Non-goals

- No final visual design pass.
- No mobile/tablet optimization beyond avoiding obvious breakage.
- No drag/drop.
- No icon perfection.
- No animation work.

## Acceptance Criteria

- Lit items are easy to spot.
- Held items are easy to understand.
- Containers can be collapsed.
- Warning details are available by click/tap.
- Item rows/headings are less cluttered.
- Existing edit flows still work.

## Validation

```bash
npm test
npm run build
```

---

# Final 0.1 Checklist

0.1 is ready when:

- Import/export works.
- Bad imports do not corrupt state.
- Destructive actions require confirmation.
- Warnings are accurate and not noisy.
- Non-character entities do not receive character-only held-container warnings.
- Encumbrance and movement tests pass.
- One-level nested containers work.
- Coin spending works and logs notes.
- Identifying an item copies secret fields into public fields and logs the event.
- Standard items can be added quickly.
- Party view gives a useful table overview.
- UI is compact enough for live play.
- Deferred features are clearly not required for 0.1.

---

# Suggested Build Order

1. Update scope and confirm deferred work is excluded.
2. Import/export safety and hard import rejection.
3. Warning correctness pass.
4. Core calculation regression test review/fill-in.
5. One-level nested containers.
6. Coin spend action with audit note.
7. Unidentified item workflow with audit log.
8. Standard item autofill.
9. Compact party view.
10. Focused 0.1 UI cleanup.

# Tasks

The working backlog for `simple`. `APP_SPEC.md`, `MODEL_SPEC.md`,
`ENCUMBRANCE_SPEC.md`, `GEAR_VIEW_SPEC.md`, `SYNC_SPEC.md`, and
`CONTENT_GUIDE.md` say what the app *should* do; this file says what is done,
what is being worked on, and what is known to be wrong or missing. One line per
item, with the file it lives in.

Post-1.0 items are out of scope until they are re-scoped here.

## Done on this branch

- Unreadable local party data is backed up before anything overwrites it, and the party opens empty with a warning naming the backup key — `src/model/appState.ts`, `src/store/useAppStore.ts`.
- No phantom GM: membership and `gmUid` come from the party document only, and an unresolved role refuses writes instead of falling back to `"player"` — `src/store/useAppStore.ts`, `src/model/appState.ts`.
- Firestore write lifecycle hardened: offline cache, retry on a backoff, rollback of a permission-denied write, and an unload guard — `src/persistence/firebaseSync.ts`, `retryBackoff.ts`, `syncWindowListeners.ts`, `firebaseWriteLifecycle.ts`.
- The audit log is bounded (cap plus trim hysteresis so most writes stay `arrayUnion`) and the GM can clear it — `src/model/auditLog.ts`, `src/store/useAppStore.ts`, `src/modals/ManageDataModal.tsx`.
- Party create, switch, forget, and delete, with a local party index — `src/modals/ManageDataModal.tsx`, `src/store/useAppStore.ts`, `src/model/appState.ts`.
- Armor class applies `armorClass` item modifiers on equipped records, penalties included — `src/model/calculations.ts`.
- Character sheet edits save as you go from a single edit entry point that also covers entity name, type, bench, and delete — `src/character/`.
- Documentation drift fixed and this backlog restored — specs, skills, `.claude/hooks/spec-sync-reminder.sh`.
- A deleted party is no longer resurrected by a client that was subscribed when it went: sync stops before the delete and subscribed clients forget the party instead of writing it back — `src/persistence/firebaseSync.ts`, `src/store/useAppStore.ts`.
- One shared native-dialog shell for every modal: `showModal()`, Escape, backdrop click, focus containment and restore, stacked confirmations, and a non-dismissible required dialog — `src/ui/Modal.tsx`, `src/modals/`, `src/inventory/`, `src/entity/`.
- Vocabulary unified onto the spec terms across UI strings: Equipped (Hands / Other equipped) and Stowed, full hand names, "record" for inventory records, Bench, and an Inventory heading on the gear page — `src/character/`, `src/party-gear/`, `src/inventory/`, `src/formatters.ts`.
- Spell suggestions on the character sheet: the class's spell list is offered while typing a spell name, picking one fills name and level, through the same combobox the inventory record form uses — `src/ui/AutocompleteField.tsx`, `src/character/CharacterSheetEditForm.tsx`, `src/model/spellLibrary.ts`.
- Rule text kept out of the repo: `systems/<system>/` (git-ignored) holds the source PDF plus transcribed `spell_library.json` and `class_content.json`, loaded at build time over the in-repo skeletons — `src/model/systemContent.ts`, `scripts/extract-oseaf-spells.mjs`, `systems/README.md`.
- Class hit die shown read-only in the sheet header from the class reference — `src/character/CharacterSheet.tsx`.
- Party switcher in the header: the party title opens the device's party list with last-opened dates and a New party action; Manage shows the same dates — `src/App.tsx`, `src/modals/ManageDataModal.tsx`, `src/formatters.ts`.
- Spell rows carry editable duration and range beside description, seeded from the library on pick and shown in place of the library's values; divine and nature casters can add every spell of a level at once — `src/model/spellLibrary.ts`, `src/character/CharacterSheetEditForm.tsx`, `src/formatters.ts`.

## In progress

- Nothing.

## Open

- Move the remaining in-repo OSE content (`ose_class_reference.json`, `ose_ability_modifiers.json`, `standardItemCatalog.json`, `arden_vul_campaign.json`) under `systems/` with the same build-time loading, so one rule system is one folder — `src/model/systemContent.ts`.
- Deferred until spell suggestions have been used at the table: seed class abilities into `features` on class change (only untouched seeded rows may be replaced), and seed a class's d6 skill roster into `skills` (roster still to be decided; the handout names no skills) — `src/character/CharacterSheetEditForm.tsx`, `src/model/classContent.ts`.
- The drow's extra magic-user spell (web, from 3rd level) is not modeled; `spellListId` links one list per class — `src/model/classContent.ts`.
- Dead permission guards: every entity and inventory action except the GM-field and identify ones is player-allowed, so those `assert*Action` calls and their `try`/`catch` can never throw — `src/model/permissions.ts`, `src/store/useAppStore.ts`.
- Decide whether players may delete entities (and items), then either restrict the action or delete the guards that pretend it is restricted — `src/model/permissions.ts`.
- Every mutation validates the whole party state, so one pre-existing error blocks unrelated edits, while import, remote snapshots, and local load skip validation entirely — `src/store/useAppStore.ts`, `src/model/validation.ts`.
- `entity.capacitySlots`, `baseMovementFeet`, and `notes` have no editor: the entity form edits name and type only, and `UpdateEntityInput` does not carry the first two — `src/entity/EntityModals.tsx`, `src/model/entities.ts`.
- Entity mutations return `void` (or `EntityId | undefined`) and fail silently while inventory mutations return a result object; unify on one result type — `src/store/useAppStore.ts`.
- A same-entity location change is audited from the record edit form but not from a drag, and `MODEL_SPEC.md` says not to log same-entity moves — `src/store/useAppStore.ts`.
- `swapInventoryRecords` has no callers outside its own fixtures; wire it up or remove it — `src/store/useAppStore.ts`.
- Rules living in the store belong in `model/` with fixtures: draining a coin record to zero, revealing secret fields on identify, and spend-amount normalization in `src/store/useAppStore.ts`, plus the inline party-role resolution in `src/App.tsx` that duplicates `resolvePartyRole`.
- Gear rows are drag wrappers that dnd-kit gives `role="button"` and a tab stop, wrapping real buttons — nested interactive elements, so keyboard and screen-reader order are wrong — `src/party-gear/PartyGearPage.tsx`.
- No favicon: nothing is declared and there is no `public/`, so every load 404s on `/favicon.ico` — `index.html`.
- The storage-key / Firestore-document debug footer renders for every viewer, players included — `src/App.tsx`.
- Three numeric-input patterns coexist: the shared `NumberField`, raw `type="number"` inputs, and text inputs with `inputMode="numeric"` — `src/ui/NumberField.tsx`, `src/inventory/CoinModals.tsx`, `src/inventory/LightModals.tsx`, `src/character/CharacterSheet.tsx`.
- CSS cleanup: two overlapping color-token families (`--icon-*`, `--gear-*`) with duplicated values, and only a handful of `:focus-visible` rules across a 3.6k-line sheet — `src/styles.css`.
- The gear grid's 338px column minimum exceeds the 320px body minimum, and the fixed Floor tray (150px of page padding) has no small-screen treatment — `src/styles.css`, `src/party-gear/PartyGearPage.tsx`.
- `sample-party.json` is not loaded by anything and still uses the removed `coinPurse` location; refresh it or delete it — `sample-party.json`.
- No rules-emulator case for a player writing the whole `appState.auditLog` array with `set`, which is what a trim produces — `scripts/test-rules.mjs`.
- A client that was not subscribed when a party was deleted still recreates it on next open, because a missing document means "create it"; needs a tombstone or a mint-locally-only rule — `src/persistence/firebaseSync.ts`, `firestore.rules`.
- The identity modal's role dropdown is cosmetic: it sets `UserProfile.role`, which only decorates audit entries, while `PartyMember.role` is the authority — derive the displayed label from the party role instead — `src/modals/UserIdentityModal.tsx`.
- Lighting one item out of a stack creates a new record but logs only `inventoryRecordLit`, so the created record never appears in the audit log — `src/store/useAppStore.ts`.
- A non-GM can create a record with `identification.identified: false` (only the secret fields are gated) and is then refused when editing it; the form hides the toggle, so the gap is store-level — `src/store/useAppStore.ts`.
- Audit details carry a treasure record's `gpValue` even when the record is unidentified, so the log leaks what the item view redacts — `src/store/useAppStore.ts`.

## Post-1.0

- Stack splitting (splitting a stacked record into two records by quantity).
- Dark mode.

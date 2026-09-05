# Model Spec

## Goal

Define the canonical data model for the app.

This file is the source of truth for TypeScript interfaces, required and optional fields, invariants, and derived calculations.

UI layout belongs outside this model spec.

## Principles

- Keep the model small and explicit.
- Use `Entity` for anything that can own inventory.
- Use `InventoryRecord` for every inventory-capable thing.
- Do not split v1 data into item definitions and inventory instances.
- Do not store derived values unless a specific performance issue requires it.
- Prefer warnings over hard blocks except where data would become corrupt or nonsensical.
- Use equipped/stowed only for character-like entities.
- Use contents-only inventory for mounts, vehicles, and storage.
- Legacy migration code is allowed where needed to safely read older stored data.
- Use current canonical terminology in new model code and UI.
- Use `entity` terminology everywhere.

## Content Libraries

Rule content (class reference tables, spell lists, per-class content, ability-score modifiers) lives in bundled JSON files under `src/model/`, read by pure lookup functions. Provenance is per file and declared in each file's `schemaVersion` / `sourceBasis` (see `CONTENT_GUIDE.md`): the class reference, ability modifiers, and campaign files carry a real `sourceBasis`, while `ose_spell_library.json` and `ose_class_content.json` are `0.1.0-skeleton` — format references with sample entries.

Transcribed rule text is kept out of version control in `systems/<system>/` (git-ignored; see `systems/README.md`). At build time `src/model/systemContent.ts` globs `systems/*/spell_library.json` and `systems/*/class_content.json`; when at least one system provides a file of a kind, that kind's in-repo skeleton is replaced: the keyed collection is the system files merged by entry id (path order, later wins) and every other top-level field is taken from the system files (later wins, skeleton as fallback); otherwise the skeleton loads. The fixture bundle never sees `systems/`. Model functions keep taking an injectable library so fixtures are independent of what is installed.

- `ose_class_reference.json` — per-class metadata (`hitDie` and optional `expertise`) plus per-level progression (xp, attack, saves, spell slots). See Class Progression Derivations.
- `arden_vul_campaign.json` — campaign class and standard-item allowlists; hidden library entries remain resolvable for existing records.
- `ose_spell_library.json` — spell lists by list id and spell level (`src/model/spellLibrary.ts`). A list may declare `access` (`"wholeList"` for prayed lists such as cleric and druid, `"spellbook"` for arcane ones; absent means `"spellbook"`); `getSpellListAccess` and `getSpellsMissingAtLevel` back the editor's add-a-whole-level action. A `SpellEntry` may carry `reversedName` beside `reversible`. `filterSpellSuggestions` lists one list's spells matching a query, ordered by spell level then name, for the sheet's spell picker; it returns nothing without a list.
- `ose_class_content.json` — library-wide `commonSkills` (the d6 skills every character starts with), and per-class prime requisites, class abilities, spell-list link (`spellListId`, read through `getClassSpellListId`), an optional class `skills` roster, optional `skillBases` (a class's starting chance for a common skill), and generic level-indexed tables such as turn undead (`src/model/classContent.ts`). `getSkillRoster` merges common skills and class roster; `createMissingRosterSkills` and `applyClassSkillBases` seed and rebase sheet rows.
- `ose_ability_modifiers.json` — shared ability-score modifier bands (`src/model/abilityModifiers.ts`).

Rules:

- Content libraries are **never part of `PartyState`** and are never persisted per party.
- Characters reference content by **name** (e.g. `className`, spell `name`); lookups fuzzy-match (lowercase, strip non-alphanumerics) against `id` or `displayName` and return `ok: false` results when unmatched.
- Missing or partially authored content degrades gracefully (placeholders / hidden sections); it is never an error and never blocks editing.
- Authoring format and provenance requirements are documented in `CONTENT_GUIDE.md`.

## App State

```ts
export type AppState = {
  schemaVersion: 1;
  entities: Entity[];
  inventoryRecords: InventoryRecord[];
  auditLog: AuditLogEntry[];
};
```

Both Firebase mode and localStorage mode should persist the same logical app state shape for v1.

Older stored v1 data without `auditLog` should load as `auditLog: []`.

## Party State

`PartyState` wraps `AppState` with party metadata. The same shape is used for the localStorage document and the Firestore `parties/{partyId}` document.

```ts
export type PartyState = {
  schemaVersion: 1;
  party: {
    id: PartyId;
    displayName: string;
    gmUid?: string;          // Firebase Auth UID of the GM
    members?: PartyMembers;  // keyed by Firebase Auth UID
    inviteCode?: string;     // GM-only secret carried by the invite link
  };
  appState: AppState;
  userProfiles: UserProfile[];
};

export type PartyMember = {
  role: "gm" | "player";
  joinedAt?: ISODateTimeString;
  displayName?: string;
  inviteCode?: string;       // the party invite code this member joined with
};

export type UserProfile = {
  id: UserId;                // the local user id, not the Firebase Auth UID
  displayName: string;
  role: UserRole;            // "GM" | "Player" — a self-chosen display label
  updatedAt?: ISODateTimeString;
};
```

`UserProfile` and `PartyMember` both carry a "role" and they are not the same
thing. `PartyMember.role` (`"gm" | "player"`, keyed by Firebase Auth UID) is the
permission authority: `resolvePartyRole` reads it, `permissions.ts` and
`firestore.rules` enforce it. `UserProfile.role` (`"GM" | "Player"`) is a label
the user picks for themselves in the identity modal; it grants nothing and is
only used to stamp audit entries (see Audit Log). A player who sets their
profile role to "GM" gains no permission.

Party state rules:

- `party.gmUid`, `party.members`, `party.displayName`, and `party.inviteCode` are GM-only fields. Players may not change them.
- `party.inviteCode` is a random lowercase alphanumeric string of 8–64 characters (the app generates 20). The GM client generates one for any party it loads that lacks one, and may regenerate it at any time. Regenerating invalidates old invite links but does not remove existing members.
- A signed-in non-member joins by adding exactly one entry, `members[ownUid]`, with `role: "player"` and `inviteCode` equal to the party's current `inviteCode`. Nothing else in the document may change in that write. This is the only write a non-member may make.
- `members[uid].inviteCode` is informational after the join; it is not re-validated.
- In local mode the invite code exists but has no effect; there is no one to join.

## Shared IDs and Timestamps

```ts
export type EntityId = string;
export type InventoryRecordId = string;
export type AuditLogEntryId = string;
export type ISODateTimeString = string;
export type UserId = string;
export type UserRole = "GM" | "Player";
```

IDs should be stable strings generated by the app.

Do not use display names as IDs.

Timestamps are optional for most v1 records. Audit log entries must include a creation timestamp.

## Audit Log

```ts
export type AuditEventType =
  | "entityCreated"
  | "entityDeleted"
  | "entityActivated"
  | "entityDeactivated"
  | "inventoryRecordCreated"
  | "inventoryRecordDeleted"
  | "inventoryRecordMoved"
  | "inventoryRecordLit"
  | "inventoryRecordSnuffed"
  | "coinsChanged"
  | "treasureValueChanged"
  | "inventoryRecordIdentified";

export type AuditLogDetailValue = string | number | boolean | null;

export type AuditLogEntry = {
  id: AuditLogEntryId;
  createdAt: ISODateTimeString;
  actorLabel: string;
  actorRole?: UserRole;
  actorUserId?: UserId;
  eventType: AuditEventType;
  entityId?: EntityId;
  recordId?: InventoryRecordId;
  summary: string;
  details?: Record<string, AuditLogDetailValue>;
};
```

Audit log rules:

- Append entries only after successful store mutations.
- Do not log failed validation attempts, temporary form state, remote snapshot application, or reset state.
- Log entity create/delete and active/inactive changes.
- Log inventory record create/delete.
- Log record moves only when the owning entity changes. Do not log reordering or movement within the same entity.
  - Known deviation: the record edit form's save path logs a move whenever the location differs, including a same-entity move, while the drag/move action follows the rule. See `TASKS.md`.
- Log character coin merges with denomination deltas where practical.
- Log treasure value edits when the value changes.
- Detail values may be omitted or set to `undefined` when a field is optional and not meaningful for that event.
- `actorLabel` is stamped by the store at append time from the current user's `UserProfile`: `"<displayName> (<role>)"` — for example `"Wren (Player)"` — using the profile's self-chosen `UserProfile.role`, and `actorRole`/`actorUserId` alongside it. A user with no stored profile is logged as `"Anonymous user"` with `actorUserId` but no `actorRole`.
- `DEFAULT_AUDIT_ACTOR_LABEL` (`"Local user"`, in `src/model/auditLog.ts`) is only the parser/factory default for an entry that arrives without a label; display treats it as "no known actor" and omits the actor line.
- Keep audit entries in `AppState.auditLog`; do not split them into a separate Firestore collection for v1.

Bounding the log:

- `AUDIT_LOG_MAX_ENTRIES` (500, in `src/model/auditLog.ts`) is the size
  `AppState.auditLog` is trimmed back to. The whole log lives inside the single
  Firestore party document, which Firestore caps at 1 MiB; an unbounded log
  eventually makes every write for that party fail permanently.
- `AUDIT_LOG_TRIM_SLACK` (50) is headroom above that size before a trim runs, so
  the log drifts between 500 and 550 entries. The slack exists for sync, not for
  the model: a trim shortens the array and so must be written to Firestore as a
  whole-array `set` instead of a merging `arrayUnion`. Trimming on every append
  past the cap would make *every* later audit write a `set` and permanently give
  up merging; with slack only one write in every `slack + 1` appends is a `set`.
- `trimAuditLog(auditLog, maxEntries = AUDIT_LOG_MAX_ENTRIES, slack =
  AUDIT_LOG_TRIM_SLACK)` is pure: it returns the input unchanged while the log
  is at or under `maxEntries + slack`, and otherwise keeps the newest
  `maxEntries` entries (the log is stored oldest-first, so it drops from the
  front) in their existing order. The store applies it in
  `appendAuditLogEntries`, so the bound holds after every mutation that logs.
- The GM may empty the log outright with the store's `clearAuditLog` action
  (GM-only via `assertPartyAction(role, "clearAuditLog")`; it returns
  `{ ok: true } | { ok: false; message }` rather than failing silently).
  Exposed in Manage → Danger behind a typed "clear" confirmation.
- Neither the trim nor the clear is itself logged, matching the rule above that
  reset state is not logged: an entry describing a clear would be the only
  survivor of the clear, and trim entries would consume the cap they enforce.
- Trim and clear both shrink the array, which the Firestore wire cannot express
  as an `arrayUnion`; see `SYNC_SPEC.md` for the whole-array write and its
  last-writer-wins window.

## Entity

```ts
export type EntityType =
  | "character"
  | "retainer"
  | "mount"
  | "vehicle"
  | "storage";

export type Entity = {
  id: EntityId;
  name: string;
  entityType: EntityType;
  active: boolean;
  sortOrder: number;

  capacitySlots?: number;
  baseMovementFeet?: number;

  character?: CharacterData;

  notes?: string;
  createdAt?: ISODateTimeString;
  updatedAt?: ISODateTimeString;
};
```

### Entity Field Rules

- `id`, `name`, `entityType`, `active`, and `sortOrder` are required.
- `name` must be a non-empty trimmed string.
- `capacitySlots` is optional.
- When `capacitySlots` is absent, the entity has no explicit capacity limit.
- `baseMovementFeet` is optional.
- Use `baseMovementFeet` for characters, retainers, mounts, or vehicles when movement display is useful.
- `character` is optional and should only be present for character-like entities.
- Retainers may use `character` data if they need character-like stats.
- Mounts, vehicles, and storage may own inventory but must not use hand slots or equipped/stowed inventory locations.
- When creating an entity, assign `sortOrder` as max existing entity sort order + 1000.

## Character-Like Entities

Character-like entities are:

```ts
entity.entityType === "character" || entity.entityType === "retainer"
```

Character-like entities use equipped/stowed locations.

On character or retainer creation, create exactly one default top-level stowed container record, normally named Backpack.

That record is a normal `recordType: "equipment"` record with `container` data and `location.kind === "stowedRoot"`. Do not use `container.isBackpack`; top-level stowed-container role is determined by location, not special metadata.

Validation hard rule: a character-like entity may not have more than one top-level stowed container. The default backpack normally fills this role, but the invariant is about stowed-root placement, not the item name.

Soft warning: an existing character-like entity with zero top-level stowed containers should warn.

Move/add hard rule: stowed records must be placed inside a valid same-entity container. That container may be the top-level stowed container, a valid nested container, or a valid container currently carried in hand. Coins are no exception: only a container may sit at `stowedRoot`, so a coin record dropped there is refused like any other non-container. Additional containers may be carried in hand if hand-capacity rules allow, but they do not become additional stowed roots.

## Non-Character Entities

Non-character entities are:

```ts
entity.entityType === "mount" ||
entity.entityType === "vehicle" ||
entity.entityType === "storage"
```

Non-character entities use contents locations.

They do not use:

- `carryState`
- equipped placement
- stowed placement
- hands
- top-level stowed-container requirement

Mounts, vehicles, and storage may contain coin records directly in contents or inside ordinary containers.

## Character Data

```ts
export type CharacterAlignment = "Law" | "Neutrality" | "Chaos" | "";

export type AbilityScores = {
  strength: number | null;
  intelligence: number | null;
  wisdom: number | null;
  dexterity: number | null;
  constitution: number | null;
  charisma: number | null;
};

export type CharacterSkill = {
  id: string;
  name: string;
  chanceInSix: number;
  description?: string;
};

export type CharacterFeature = {
  id: string;
  name: string;
  description: string;
};

export type CharacterSpell = {
  id: string;
  name: string;
  level: number;
  memorized: number;
  description?: string;
  duration?: string;
  range?: string;
};

export type CharacterData = {
  className: string;
  level: number | null;
  alignment: CharacterAlignment;
  xp: number | null;
  hp: {
    current: number | null;
    max: number | null;
  };
  armorClass: {
    modifier: number;
    override: number | null;
  };
  abilityScores: AbilityScores;
  skills: CharacterSkill[];
  spells: CharacterSpell[];
  languages: string[];
  description: string;
  features: CharacterFeature[];
};
```

Character data supports a lightweight character-sheet layer in addition to inventory ownership. It is still not a full OSE automation engine.

`alignment` is intentionally limited to the OSE-style options used by the app: `"Law"`, `"Neutrality"`, `"Chaos"`, or an empty string when unset.

Armor class is derived, ascending, from a base of `10`: the single best equipped armor record (by `baseArmorClass + armorBonus`) replaces the base, a shield held in a hand adds its `armorBonus`, and the sum of every `armorClass` modifier on the entity's equipped records — any equipped placement, penalties included — is added. Multiple equipped armors produce a warning and the best one is used.

`armorClass.modifier` is a flat integer bonus or penalty added on top of that derived value. `armorClass.override` replaces the entire derived AC when non-null.

Armor class is computed from full records for every viewer; redaction never changes it (see Player Visibility).

`CharacterSkill.chanceInSix` is an integer from 1 through 6 representing a 1-in-6 chance skill system. It is not nullable. Every character starts with the class content's common skills (for this campaign: Open Doors, Find Secret Doors, Find Room Trap, Listen at Doors), seeded when the entity is created. A roster skill's base chance is the class's `skillBases` value when it names the skill, else 1, except Open Doors, whose base is the STR modifier floored at 1 (the expertise derivation uses the same rule). When the sheet editor resolves `className` to a different class it appends the roster rows the sheet lacks (fuzzy name match, never removing or rewriting rows) and moves a common skill still at its generic base to the new class's base, leaving any row the player has changed alone; likewise an Open Doors row still at the base for the previous STR score follows a STR change; the same seeding is available as an explicit action. Seeded rows are ordinary skills afterwards.

`CharacterFeature.name` is the feature's display name. Legacy stored data may use `title` as an alias; parsers should accept both and normalize to `name`.

`CharacterSpell` rows are the character's spell state. `name` is fuzzy-matched against the spell library for display details; an unmatched name is allowed and simply renders without library details. `level` is the spell's level (integer, at least 1) and is stored, not looked up — the model never silently corrects a stored level that disagrees with the library. `duration` and `range` are optional free text with the same rule as `description`: stored text is what the sheet and party overview show, and the library's value only fills in for a row without one. The sheet editor offers the class's spell list as suggestions while typing a name; picking one fills `name`, `level`, `description`, `duration`, and `range` from the library as starting values, the same way picking a catalog item fills an inventory record, and all of them stay editable. For a class whose spell list has `access: "wholeList"` (divine and nature casters choose from the whole list each day) the editor can also add every library spell of one level at once, skipping names already on the sheet and leaving `memorized` at 0. `memorized` is the number of copies currently memorized/prepared (integer, at least 0). `description` is optional free text; it is never shown inline — the character sheet and the party overview reveal it on demand, behind the spell's name, after the library's duration/range line. When it is set it is the text shown; the library's description is only the fallback for a row without one, so a row seeded from the library and then edited shows the edit, not both. Older stored data may use `notes` for this field; parsers accept it and normalize to `description`. A magic-user's spellbook is the full row set including `memorized: 0` entries (known but not prepared); divine casters typically only carry rows for what is memorized today. Older stored data without `spells` normalizes to an empty array.

Memorized totals exceeding the class's derived spell slots are a soft warning, never a block (scrolls, bonuses, and house rules are table-adjudicated).

Expertise allocation is derived for classes with `expertise` metadata; it is
never stored on `CharacterData`. Every d6 skill has a base chance of 1-in-6,
except a skill whose normalized name is `opendoors`, whose base is the greater
of 1 and the character's STR modifier (falling back to 1 when STR cannot be
resolved). The stored `chanceInSix` remains structurally valid through 6; the
campaign's 5-in-6 limit is a soft warning.

Character-sheet fields may be displayed, edited, and validated, but inventory ownership and encumbrance semantics must not depend on ability scores, skills, features, description, or languages unless a later task explicitly adds that behavior.

## Inventory Record

`InventoryRecord` is a discriminated union on `recordType`, not one flat object.
Every variant excludes the other variants' type-specific data with `?: never`,
so a weapon record cannot carry `coins` and a coin record cannot carry
`container` — the exclusions are checked by the compiler, not by convention.

```ts
export type InventoryRecordType =
  | "coins"
  | "treasure"
  | "weapon"
  | "armor"
  | "equipment";

type InventoryRecordShared = {
  id: InventoryRecordId;
  entityId: EntityId;
  description?: string;
  location: InventoryLocation;
  sortOrder: number;
  uses?: UsesData;
  light?: LightData;
  modifiers?: Modifier[];
  notes?: string;              // GM-only, see Player Visibility
  createdAt?: ISODateTimeString;
  updatedAt?: ISODateTimeString;
};

type NonCoinInventoryRecordShared = InventoryRecordShared & {
  quantity: number;
  burden: InventoryBurden;
  handsRequired?: HandsRequired;   // 0 | 1 | 2, see General Hand Requirement
  isMagic?: boolean;
};

export type CoinsRecord = InventoryRecordShared & {
  recordType: "coins";
  name?: string;
  coins: CoinData;
  treasure?: never; weapon?: never; armor?: never;
  container?: never; identification?: never;
};

export type TreasureRecord = NonCoinInventoryRecordShared & {
  recordType: "treasure";
  name: string;
  treasure: TreasureData;
  identification?: IdentificationData;
  container?: never; coins?: never; weapon?: never; armor?: never;
};

export type WeaponRecord = NonCoinInventoryRecordShared & {
  recordType: "weapon";
  name: string;
  weapon: WeaponData;
  container?: ContainerData;
  identification?: IdentificationData;
  coins?: never; treasure?: never; armor?: never;
};

export type ArmorRecord = NonCoinInventoryRecordShared & {
  recordType: "armor";
  name: string;
  armor: ArmorData;
  container?: ContainerData;
  identification?: IdentificationData;
  coins?: never; treasure?: never; weapon?: never;
};

export type EquipmentRecord = NonCoinInventoryRecordShared & {
  recordType: "equipment";
  name: string;
  container?: ContainerData;
  identification?: IdentificationData;
  coins?: never; treasure?: never; weapon?: never; armor?: never;
};

export type InventoryRecord =
  | CoinsRecord
  | TreasureRecord
  | WeaponRecord
  | ArmorRecord
  | EquipmentRecord;
```

### Inventory Record Field Rules

- `id`, `recordType`, `location`, and `sortOrder` are required.
- `name` is optional only for `recordType: "coins"`.
- All non-coin records must have a non-empty trimmed `name`.
- All non-coin records must have `quantity` and `burden`.
- `coins` is required when `recordType === "coins"` and is ignored on other record types.
- `treasure` is required when `recordType === "treasure"` and is ignored on other record types.
- `weapon` is optional detail data for `recordType === "weapon"`; a weapon record may exist without a populated `weapon` object.
- `armor` is optional detail data for `recordType === "armor"`; an armor record may exist without a populated `armor` object.
- Type-specific data from the wrong record type should not be used by calculations or display. Parsers may tolerate excess fields from older or hand-edited data, but new write paths should avoid creating irrelevant type-specific fields.
- `container` may appear on weapon, armor, or equipment records if that record can contain other records; treasure records do not use container data.
- `identification` may appear on `treasure`, `weapon`, `armor`, or `equipment` records. It may also be tolerated on imported or legacy records.
- Coins are always identified in normal inventory display.
- `isMagic` is optional on non-coin records: a flag the item modal sets ("Magic item") that drives the `✦` display glyph and nothing else. It is never set on coins, and it is dropped from an unidentified record shown to a non-GM (see Player Visibility).
- `modifiers` are optional.
- `armorClass` modifiers on an equipped record are applied to the derived armor class: every such modifier counts, positive or negative. All other modifier targets are edit/display-only for v1 — do not apply them automatically to attack, saves, movement, or character sheet fields.
- When creating a record, assign `sortOrder` as max existing sibling sort order + 1000.

## Inventory Location

Inventory records carry entity ownership separately from placement. Containment is structural: a record inside a container has only `location.kind: "container"` plus `containerId`; it does not also encode whether that container is a backpack, stowed, equipped, or contents root.

```ts
export type EquippedPlacement =
  | "leftHand"
  | "rightHand"
  | "bothHands"
  | "loose";

export type InventoryLocation =
  | {
      kind: "equipped";
      placement: EquippedPlacement;
    }
  | {
      kind: "stowedRoot";
    }
  | {
      kind: "contents";
    }
  | {
      kind: "container";
      containerId: InventoryRecordId;
    };
```

### Location Meaning

- `kind: "equipped"` means the root record is held, worn, actively used, or ready at short notice.
- `kind: "stowedRoot"` is the character-like entity's one top-level stowed container.
- `kind: "contents"` means the root record belongs directly to a non-character entity's contents.
- `kind: "container"` means the record is inside another inventory record with `container` data.
- `placement: "leftHand"`, `"rightHand"`, and `"bothHands"` are equipped hand placements.
- `placement: "loose"` is for equipped items that are not hand-held, such as worn armor, a sheathed weapon, a ring, an amulet, or other ready gear.

### Location Rules

- Every inventory record has a top-level `entityId`.
- Every inventory record must have a location.
- Every inventory record must have an owning `entityId`, including records inside containers.
- `record.entityId` must point to an existing entity.
- Character-like entities may use `equipped`, `stowedRoot`, or `container` locations.
- Non-character entities may use `contents` or `container` locations.
- `kind: "container"` must include `containerId`.
- `containerId` must point to an existing `InventoryRecord` with `container` data.
- For character-like entities, a contained record may be inside any valid same-entity container, including the top-level stowed container, a valid nested container, or a valid hand-held/equipped container. Effective equipped/stowed/excluded status is derived from the containing ancestor chain.
- A contained record's `entityId` must match the owning entity of its container.
- Moving a container to another entity must also update all contained descendant records to the new `entityId`.
- Cross-entity containment is invalid.
- Coin records use the same locations as any other non-container record, except a hand placement.
- Hand placements must use `kind: "equipped"`.
- Default location for newly created non-coin records on character-like entities is `kind: "equipped"` and `placement: "loose"` unless the user chooses another valid root/container location.
- Default location for a newly created coin record on a character-like entity is `kind: "container"` pointing at the entity's top-level stowed container when it has one, otherwise `kind: "equipped"` with `placement: "loose"`.
- Default location for newly created records on non-character entities is `kind: "contents"`.
- The retired `kind: "coinPurse"` location is migrated when state is loaded: the record moves into its entity's top-level stowed container when one exists, otherwise to `kind: "equipped"` with `placement: "loose"`.

## Inventory Quantity And Burden

```ts
export type InventoryBurden =
  | { kind: "fixed"; slotsPerItem: number }
  | { kind: "stacked"; itemsPerSlot: number }
  | { kind: "none" };
```

### Quantity And Burden Rules

- Every non-coin record has `quantity` and `burden`.
- Coin records do not use `quantity` or `burden`.
- `quantity` is the number of copies represented by the record.
- Use `fixed` for normal items, armor, weapons, treasure, and containers.
- Use `stacked` for records such as torches, rations, spikes, or ammunition when multiple units share slots.
- Use `none` for records with no slot burden regardless of quantity, such as zero-burden treasure.
- `quantity` must be a positive integer.
- `fixed.slotsPerItem` must be `>= 0`.
- `stacked.itemsPerSlot` must be a positive integer.
- Avoid fractional slots for v1 unless a later task explicitly requires them.

## Coin Data

```ts
export type CoinData = {
  pp: number;
  gp: number;
  sp: number;
  cp: number;
};
```

### Coin Rules

- Coins are ordinary inventory records. Any entity may hold any number of them, wherever a non-container record may sit.
- A coin record must not use a hand placement.
- Coin denomination fields are required and default to `0`.
- Coin denomination fields must be non-negative integers.
- A coin record counts toward the burden of wherever it sits: stowed inside the top-level stowed container, equipped at `placement: "loose"`, contents on a non-character entity.
- Coin records do not require a user-entered name.
- Adding coins without choosing a placement updates the entity's default coin record instead of creating a duplicate, on every entity type. Choosing a placement always creates a new record.
- An entity's **default coin record** is the coin record inside its top-level stowed container if it has one, otherwise its first coin record in sort order. It is the destination for a transfer and the source when no record is named.
- Coin transfers may target a specific source coin record (instead of the source entity's default coin record) so that a chosen pile can be drawn down.
- A coin record drained to zero by a spend or a transfer is removed as part of that action (with an audit entry), on every entity type. The next transfer in recreates one at the default location.

## Treasure Data

```ts
export type TreasureData = {
  gpValue: number;
};
```

### Treasure Rules

- `gpValue` is required for treasure.
- `gpValue` must be `>= 0`.
- Treasure records use normal inventory location and slot rules.
- Treasure may be unidentified. An unidentified treasure record hides its `gpValue` from non-GM viewers (see Player Visibility).
- Treasure may use `burden.kind: "fixed"`, `"stacked"`, or `"none"` depending on the record.

## Weapon Data

```ts
export type WeaponData = {
  damage?: string;
  /** @deprecated Use record-level handsRequired. */
  hands?: "oneHand" | "twoHands";
  range?: string;
  qualities?: string[];
};
```

### Weapon Rules

- New weapon records default to record-level `handsRequired: 1`.
- Legacy `weapon.hands` may be read only to derive missing record-level `handsRequired`.
- A sheathed or ready weapon that is not currently held should use `kind: "equipped"` and `placement: "loose"`.
- A packed-away weapon on a character-like entity should use a valid container location.

## General Hand Requirement

All non-coin records may use top-level hand requirement metadata:

```ts
handsRequired?: 0 | 1 | 2;
```

Rules:

- `handsRequired` is the minimum number of occupied hands needed for the record's active/use effect.
- `handsRequired: 0` is active whenever equipped, whether loose or held.
- `handsRequired: 1` is active when equipped in `leftHand`, `rightHand`, or `bothHands`.
- `handsRequired: 2` is active when equipped in `bothHands`.
- `handsRequired` does not prohibit hand placement; hand placements are still allowed for any non-coin equipped record subject to occupancy collisions.
- Creation defaults: a weapon created through the record form gets `1`; treasure, armor, and equipment get `0`.
- Reading a stored record is a different rule and does not re-apply the creation default. `getRecordHandsRequired` takes an explicit record-level `handsRequired`, else derives it from legacy `weapon.hands` (`"twoHands"` → 2, `"oneHand"` → 1), else from legacy `container.handsRequired`, else `0`. State parsing normalizes every stored record through it, so a legacy weapon with neither a record-level value nor `weapon.hands` normalizes to `0`, not `1`.
- Examples: torch `1`, shield `1`, 10 foot pole `2`, ring `0`.

## Armor Data

```ts
export type ArmorData = {
  baseArmorClass?: number;
  armorBonus?: number;
};
```

### Armor Rules

- Armor is active when `recordType === "armor"` and `location.kind === "equipped"`.
- There is no separate armor location.
- Stowed armor is inventory only and should not count as active armor.

## Container Data

```ts
export type ContainerData = {
  capacitySlots?: number;
  capacityByHands?: {
    oneHand: number;
    twoHands: number;
  };
  /** @deprecated Use record-level handsRequired. */
  handsRequired?: 0 | 1 | 2;
  /** @deprecated Containers always count own slots plus contents. */
  burdenMode?: "contentsOnlyWhenLoaded" | "containerPlusContents" | "fixedOnly";
};
```

### Container Rules

- A container is any non-coin `InventoryRecord` with `container` data.
- `capacitySlots`, when present, must be `>= 0`.
- `capacityByHands`, when present, must contain non-negative integer
  `oneHand` and `twoHands` values.
- Capacity resolves from placement: `leftHand`/`rightHand` use `oneHand`,
  `bothHands` uses `twoHands`, and every other placement uses `capacitySlots`
  when defined and otherwise falls back to `capacityByHands.twoHands` — a
  container can never hold more than its two-handed maximum, wherever it sits,
  except at the stowed root, which has no capacity of its own. Undefined
  resolved capacity means no capacity limit applies.
- A container at `stowedRoot` resolves to undefined capacity regardless of its
  `capacitySlots`: it is the character's packed list, and the stowed limit
  (16 + STR modifier, see `ENCUMBRANCE_SPEC.md`) governs it. Its own capacity
  applies again when it is carried in hand or packed inside another container.
- Legacy `container.handsRequired` may be read only to derive missing record-level `handsRequired`.
- Legacy `container.isBackpack` may be tolerated while reading older stored data, but it must not determine current top-level stowed-container behavior and should not be written by new code.
- Legacy `burdenMode` may exist in saved data but must not change slot accounting.
- On character or retainer creation, create exactly one default top-level stowed container record, normally named Backpack.
- A character-like entity may not have more than one top-level stowed container.
- An existing character-like entity with zero top-level stowed containers should warn.
- A top-level stowed container may carry any `handsRequired` value (a backpack legitimately needs two hands to carry in hand); hands requirements are not enforced at `stowedRoot`, so the value is informational there.
- `handsRequired` on a container describes carrying it in hand. A non-empty container with nonzero record-level `handsRequired` creates an overload condition only when its own location is `equipped` with `placement: "loose"`. It is never enforced at `stowedRoot` (worn on the back), inside another container (packed cargo), in non-character contents, or in a hand placement.
- A non-empty hands-required container may contain records even while the container itself is equipped.
- Containers count their own slot burden whether empty or full in raw and
  container-usage calculations. A `stowedRoot` record contributes 0 own burden
  only to equipped/stowed movement totals.
- Contents inside containers also count toward movement encumbrance, except when the container is carried in hand.
- When a container is carried in hand, the container itself still counts but its contents are excluded from movement encumbrance.
- Empty containers may be placed inside another container.
- A container nested inside another container may contain ordinary non-container records.
- Nested containers may not contain additional containers.
- Non-empty containers may not be moved into another container unless the resulting containment still satisfies the one-level nesting rule.
- Container cycles are invalid.
- Deleting a non-empty container should be blocked unless a later task adds explicit delete-with-contents behavior.

### Top-Level Stowed Container Rules

- The top-level stowed container is a real inventory record, normally named Backpack.
- On character or retainer creation, create exactly one default top-level stowed container record.
- Validation hard rule: a character-like entity may not have more than one top-level stowed container.
- Soft warning: an existing character-like entity with zero top-level stowed containers should warn.
- Move/add hard rule: stowed records must be placed inside a valid same-entity container.
- The top-level stowed container is represented by an `InventoryRecord` with `recordType: "equipment"`, `container` data, and `location.kind === "stowedRoot"`.
- Its authored raw burden and container-usage math are unchanged, but its own
  burden contributes 0 to equipped/stowed movement totals while it remains at
  `stowedRoot`.
- Do not use `container.isBackpack` or any replacement special-case flag in current-state creation, updates, or calculations. The stowed-root role is location-derived. Parsers may tolerate and discard old `container.isBackpack` values during migration.
- Additional containers may be carried in hand if hand-capacity rules allow, but they do not become additional stowed roots.
- Character-like stowed records directly in the top-level stowed container, coin records included, use `kind: "container"` and `containerId` set to the stowed-root record ID.
- The UI should offer an action to create a top-level stowed container for a character-like entity if missing.

Suggested default top-level stowed container factory:

```ts
const createDefaultTopLevelStowedContainer = (entityId: EntityId): InventoryRecord => ({
  id: generatedId,
  recordType: "equipment",
  name: "Backpack",
  entityId,
  location: {
    kind: "stowedRoot",
  },
  sortOrder: 0,
  quantity: 1,
  burden: { kind: "fixed", slotsPerItem: 1 },
  handsRequired: 0,
  container: {
    capacitySlots: 16,
  },
});
```

## Identification Data

```ts
export type IdentificationData = {
  identified: boolean;
  secretName?: string;
  secretDescription?: string;
};
```

### Identification Rules

- Identification data is optional.
- If absent, the record is treated as identified.
- Identification data may appear on `treasure`, `weapon`, `armor`, or `equipment` records. Coins are always identified; imported or legacy identification data on coin records is ignored.
- When `identified === false`, normal inventory display should use the public `name` and `description` fields and hide/collapse `secretName` and `secretDescription`.
- When an item is identified, copy `secretName` to `name` when present, copy `secretDescription` to `description` when present, then remove the `identification` data.
- Legacy `unidentifiedName` / `unidentifiedDescription` fields may be read as aliases for `secretName` / `secretDescription` during migration, but new writes should use `secretName` / `secretDescription`.
- Unidentified records are read-only for players: only the GM may edit one. Players may still move, light, and put out an unidentified item.

## Player Visibility

Redaction is a **display** concern. Derived calculations — armor class, attack, damage, encumbrance, movement, light burn — always run on the full record for every viewer. Equipping an unidentified item grants its bonus; the risk is that it is cursed. Never feed a redacted record into the store or into rules math.

`getVisibleInventoryRecord(record, viewerRole)` is the single redaction rule, applied at display boundaries. It fails closed: only a confirmed `"gm"` role sees everything; players and unresolved/non-member (`null`) roles do not.

- `notes` is GM-only **always**, identified or not: never displayed to a non-GM, never editable by one, and a non-GM save carries the stored value through unchanged rather than wiping it.
- An unidentified record is reduced for a non-GM viewer to its **public shell**, in this key order: `id`, `entityId`, `recordType`, `name`, `description`, `location`, `sortOrder`, `quantity`, `burden`, `handsRequired`, `container`, `identification: { identified: false }`, `light: { isLit }` (light sources only), `createdAt`, `updatedAt`, then the type-specific field.
- The shell drops `isMagic`, `uses`, `modifiers`, `notes`, `secretName`, `secretDescription`, and `light.lightDescription`; a weapon keeps `weapon: {}`, armor keeps `armor: {}`, and treasure keeps `treasure: { gpValue: 0 }`.
- Coin records are never unidentified; they pass through unchanged apart from `notes`.
- The wire carries full records. Firestore rules cannot filter fields inside an inventory record, so this layer is UX and table etiquette, not a security boundary.

## Uses and Light Data

```ts
export type UsesData = {
  current: number;
  max?: number;
};

export type LightData = {
  isLit: boolean;
  lightDescription?: string;
};
```

### Uses and Light Rules

- Uses and light data are optional.
- `uses.current` must be `>= 0`.
- `uses.max`, if present, must be `>= uses.current`.
- `light.lightDescription`, if present, is a free-text table description such as radius or beam shape.
- Light burn duration and remaining burn/use state use the shared `uses` object.
- Do not automate light depletion unless a later task explicitly adds turn tracking.

### Light and Snuff Actions

Lighting and putting out a light are store actions backed by pure helpers in
`src/model/lightSources.ts` (`lightRecord`, `snuffRecord`). They never
automate burn time.

- **Light** applies to a non-coin record with `light` data that is not lit.
  A stack (`quantity > 1`) splits one item off into a new record with
  `quantity: 1` and `light.isLit: true`; the original stack loses one. A single
  item is lit in place. If the item needs hands and the character has a free
  hand (left preferred, then right; both hands for a two-handed item), the lit
  item moves into that hand; otherwise it stays where it is. A stack that is
  already held keeps the lit item in that hand and moves the remainder to the
  top-level stowed container (or equipped/loose without one).
- **Snuff** applies to a lit record and takes one of two outcomes:
  - `burnedOut`: a `stacked`-burden light (torch, candle) is consumed — the
    record is removed, or a lit stack loses one item; a `fixed`/`none`-burden
    light (lantern) stays, unlit, with `uses.current` set to 0 when uses exist.
  - `turnsRemaining: n`: the record stays, unlit, with `uses.current = n`
    (`n` a whole number ≥ 0 and ≤ `uses.max` when a max exists).
- Lit singles are never merged back into a stack; their burn state would be lost.
- Both actions write an audit entry (`inventoryRecordLit`, `inventoryRecordSnuffed`).

## Modifiers

```ts
export type Modifier = {
  target:
    | "armorClass"
    | "attack"
    | "damage"
    | "savingThrow"
    | "ability"
    | "skill"
    | "movement"
    | string;
  value: number;
  label?: string;
};
```

Modifiers are optional. They allow records such as magic rings, cloaks, or weapons to capture relevant bonuses and penalties without requiring full automation.

`armorClass` modifiers are the one target the app applies automatically: see the armor class calculation under Character Data. Every other target is edit/display-only for v1.

## Derived Calculations

Do not persist these values unless a later performance task proves it necessary.

### Coin Count

```ts
coinCount = pp + gp + sp + cp
```

### Coin GP Value

```ts
gpValue = pp * 5 + gp + sp / 10 + cp / 100
```

### Coin Slots

```ts
coinSlots = Math.ceil(coinCount / 100)
```

A coin record with zero total coins uses `0` slots.

### Fixed Slots

```ts
fixedSlots = quantity * burden.slotsPerItem
```

### Stacked Slots

```ts
stackedSlots = Math.ceil(quantity / burden.itemsPerSlot)
```

A record with `burden.kind === "none"` uses `0` slots.

### Base Record Slots

```ts
baseRecordSlots =
  recordType === "coins"
    ? Math.ceil(totalCoins(record.coins) / 100)
    : burden.kind === "fixed"
      ? quantity * burden.slotsPerItem
      : burden.kind === "stacked"
        ? Math.ceil(quantity / burden.itemsPerSlot)
        : 0
```

### Container Used Slots

```ts
containerUsedSlots = sum(effectiveRecordSlots(child) for each direct child record)

containerCapacity(record) =
  record.location is stowedRoot
    ? undefined
    : record.container.capacityByHands && record.location is leftHand/rightHand
      ? record.container.capacityByHands.oneHand
      : record.container.capacityByHands && record.location is bothHands
        ? record.container.capacityByHands.twoHands
        : record.container.capacitySlots ?? record.container.capacityByHands?.twoHands
```

Container used slots include child record burdens.

Container used slots do not include the container record itself.

An undefined resolved container capacity means no capacity limit or capacity
warning applies in that placement.

### Effective Record Slots

Keep movement-effective burden separate from raw record-and-contents burden:

```ts
if record is inside a container carried in "leftHand", "rightHand", or "bothHands":
  movementEffectiveRecordSlots(record) = 0
else if record's own location is `stowedRoot`:
  movementEffectiveRecordSlots(record) = 0
else:
  movementEffectiveRecordSlots(record) = baseRecordSlots(record)

totalRecordAndContentsSlots(record) =
  baseRecordSlots(record) +
  sum(totalRecordAndContentsSlots(child) for each direct child record)
```

Default container behavior:

- Empty container: contributes its own slot burden.
- Non-empty container: contributes its own slot burden plus contents.
- Held container: contributes its own slot burden; contents are excluded from movement encumbrance.
- Top-level stowed container: contributes 0 own movement burden; contents keep
  their ordinary stowed burden.

### Equipped Slots

For character-like entities:

```ts
equippedSlots = sum(effectiveRecordSlots(record) for records directly or indirectly contributing to equipped burden)
```

Equipped slots include equipped records unless excluded by the held-container rule.

### Stowed Slots

For character-like entities:

```ts
stowedSlots = sum(effectiveRecordSlots(record) for records directly or indirectly contributing to stowed burden)
```

Stowed slots include the top-level stowed container's contents (coin records
included) and stowed container contents unless excluded by the held-container
movement exception. The record
whose own location is `stowedRoot` contributes 0 own movement burden.

### Contents Slots

For non-character entities:

```ts
contentsSlots = sum(effectiveRecordSlots(record) for records in contents)
```

### Entity Used Slots

For character-like entities:

```ts
entityUsedSlots = equippedSlots + stowedSlots
```

For non-character entities:

```ts
entityUsedSlots = contentsSlots
```

### Treasure Value Per Entity

```ts
treasureValue = sum(record.treasure.gpValue for entity treasure records)
```

### Hand Occupancy

Derived from records where `location.kind === "equipped"` and `location.placement` is `leftHand`, `rightHand`, or `bothHands`.

A valid character-like entity has either:

- zero or one record in `leftHand` and zero or one record in `rightHand`; or
- zero or one record in `bothHands`;

but not both hand modes at once.

### Entity Capacity Warning

If `entity.capacitySlots` is present:

```ts
isEntityOverCapacity = entityUsedSlots > entity.capacitySlots
```

### Container Capacity Warning

```ts
resolvedCapacity = getContainerCapacity(containerRecord)
isContainerOverCapacity =
  resolvedCapacity !== undefined && containerUsedSlots > resolvedCapacity
```

### Character-Like Movement

Movement is determined by the slower of equipped and stowed burden when no overload condition applies.

The following are overload conditions and set movement to `0 / 0`:

- Equipped burden above the equipped limit (9).
- Stowed burden above the stowed limit (16 + STR modifier).
- Container over capacity on a character-like entity.
- Non-empty hands-required container left at equipped/loose (not held in a hand).

For v1, keep the movement tier logic in one calculation module.

Do not duplicate movement calculations in UI components.

The load readout shows equipped and stowed against their own limits
(`Eq n/9 · St n/16±STR`). There is no combined total limit to show.

### Hand Occupancy

Suggested helper:

```ts
getHandOccupancy(entityId, records): {
  leftHand?: InventoryRecordId;
  rightHand?: InventoryRecordId;
  bothHands?: InventoryRecordId;
  errors: string[];
}
```

Rules:

- If any record uses `bothHands`, no record may use `leftHand` or `rightHand`.
- If a record uses `leftHand`, no other record may use `leftHand` or `bothHands`.
- If a record uses `rightHand`, no other record may use `rightHand` or `bothHands`.
- Hand occupancy does not validate whether `handsRequired` is satisfied for active/use effects.

### Class Progression Derivations

Derived from `ose_class_reference.json` via class name + level lookup; never stored on the entity:

- **Attack bonus** — per-class, per-level value (existing save lookup).
- **THAC0** — `19 - attackBonus`. The helper remains a pure derivation for existing consumers and fixtures, but THAC0 is no longer displayed on the character sheet; ascending attack bonus is the canonical displayed value.
- **Weapon damage (Weapon Mastery)** — count the distinct `attackBonus` values among the class's level records from level 1 through the character's current level, inclusive. That count is the mastery step. Step 1 is `1 × HD`; step 2 is one die one size above the original Hit Die (`d4 → d6`, `d6 → d8`, `d8 → d10`); step 3 is `2 × HD`; step 4 is `3 × HD`; step 5 is `4 × HD`; steps beyond 5 remain `4 × HD`. The original Hit Die comes from class metadata. A class without `hitDie`, an unknown class, or an out-of-range level returns an unsuccessful lookup.
- **Expertise** — only classes with `expertise` metadata receive a summary. `pool = starting + perLevel × (level − 1)`. `spent = Σ max(0, chanceInSix − base)` across stored skills, where `base = 1` except normalized `opendoors`, whose base is `max(1, STR modifier)` with a fallback of 1 when STR is null or its modifier cannot be resolved. `delta = spent − pool`; a non-zero delta produces an over- or under-allocation warning. A null or zero level returns an unsuccessful lookup.
- **XP progress** — the current level's `xpThreshold`, the next level's `xpThreshold` (or `null` at the class's maximum level), and the remaining XP to the next level clamped at 0 (or `null` when the character's XP is unset or there is no next level).
- **Spell slots** — the level entry's `spellSlots` map as a sorted `{ spellLevel, count }[]` (empty for non-casters) plus `maxSpellLevel`.

Unknown class names or out-of-range levels return `ok: false` results; the UI renders placeholders and never blocks on missing rule data.

## Hard Invariants

The app should prevent state that violates these invariants:

- Every entity has a unique `id`.
- Every inventory record has a unique `id`.
- Every inventory record points to an existing entity.
- Every inventory record has a valid location for its entity type.
- Every inventory record points to an existing entity through `record.entityId`.
- Every non-character root inventory record uses `kind: "contents"`; non-character contained records use `kind: "container"`.
- Every contained inventory record points to an existing container.
- Character-like entities have at most one `stowedRoot` container.
- Every container reference points to a record with `container` data.
- No container cycles.
- No cross-entity containment.
- Any entity may have multiple coin records.
- Coin records use only `recordType: "coins"` and `coins`, at any location valid for their entity type other than a hand placement.
- Coin records do not use identification data.
- Character-like hand state cannot contain both `bothHands` and `leftHand`/`rightHand` records.
- A hand placement cannot contain more than one record.
- If any record uses `bothHands`, no record may use `leftHand` or `rightHand`.
- If a record uses `leftHand`, no other record may use `leftHand` or `bothHands`.
- If a record uses `rightHand`, no other record may use `rightHand` or `bothHands`.
- A record cannot be placed inside a non-container.
- Only a container record may sit at `stowedRoot`. Stowing anything else — a coin record included — is refused, and so is a stow request naming a container that does not exist or is not a valid target, so stowing on a character-like entity with no top-level stowed container is blocked rather than warned.
- A nested container may contain ordinary non-container records.
- A nested container may not contain another container.
- All non-coin records must have a non-empty trimmed `name`.

## Soft Warnings

The app may warn without blocking for:

- Entity over capacity.
- Container over capacity on non-character entities.
- Character-like entity missing a top-level stowed container.
- Missing optional metadata.
- Unidentified treasure, equipment, armor, or weapon lacking a secret name (spec intention; not yet implemented in `validation.ts`).
- Memorized spells exceeding the class's derived spell slots at a given spell level, or a spell above the class's maximum castable spell level.
- A level-1 character's maximum HP below the class minimum: d4 → 3, d6 → 4, or d8 → 5. No warning applies when maximum HP is null, the level is not 1, or class Hit Die metadata cannot be resolved.
- Any d6 skill above 5-in-6. Stored 6-in-6 values are warned about, not clamped or rewritten.
- Expertise over- or under-allocation when derived `spent` differs from the class's derived `pool`.
- HP state is derived for display without rewriting HP: null current HP is `unknown`, current HP above 0 is `active`, a character at 0 is at `deathDoor`, and a retainer at 0 is `dead`.

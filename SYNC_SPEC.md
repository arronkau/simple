# Sync Spec — Firestore field-level writes

Governs `src/persistence/firebaseSync.ts`, `src/persistence/firestoreDocument.ts`, `src/persistence/partyStateDiff.ts`, the Firebase write path in `src/store/useAppStore.ts`, and the party document shape in Firestore. Local mode is unaffected.

## Goal

Two clients editing different parts of the same party at the same time must never overwrite each other. Today every mutation writes the whole document with `setDoc`, so the later writer silently discards the earlier writer's change if it had not yet received that change's snapshot.

Target behavior:

- Edits to different entities, inventory records, user profiles, member entries, or party fields merge on the server.
- Two edits to the *same* record are last-writer-wins for that record only. This is acceptable for table play.
- Audit log entries appended by different clients are all kept, except across a trim or clear (see Known limits).
- The model (`PartyState`, `AppState`) keeps its array shape. Only the Firestore document shape changes. Local mode keeps storing the model shape in localStorage exactly as today.

## Wire shape (Firestore `parties/{partyId}`), version 2

```ts
type FirestorePartyDocument = {
  schemaVersion: 1;          // unchanged: PartyState schema
  wireVersion: 2;            // absent on legacy documents
  party: {
    id: PartyId;
    displayName: string;
    gmUid?: string;
    members?: Record<string, PartyMember>;
    inviteCode?: string;
  };
  appState: {
    schemaVersion: 1;
    entities: Record<EntityId, Entity>;               // keyed by entity.id
    inventoryRecords: Record<InventoryRecordId, InventoryRecord>; // keyed by record.id
    auditLog: AuditLogEntry[];                         // array; arrayUnion on append, whole-array set on trim/clear
  };
  userProfiles: Record<UserId, UserProfile>;           // keyed by profile.id
};
```

Legacy documents (no `wireVersion`) have `appState.entities`, `appState.inventoryRecords`, and `userProfiles` as arrays. They must keep loading.

### Conversion (`src/persistence/firestoreDocument.ts`, pure)

- `toFirestorePartyDocument(partyState: PartyState): FirestorePartyDocument` — arrays to id-keyed maps. Duplicate ids: last one wins; do not throw.
- `fromFirestorePartyDocument(data: unknown, expectedPartyId?: PartyId): PartyState | undefined` — accepts either shape. Convert maps to arrays, then run the existing `parsePartyState` so all current normalization/migration applies. The key of a map entry is authoritative for the id if the value lacks one; if both exist and differ, the key wins.
- Arrays rebuilt from maps are ordered deterministically: entities and inventory records by `sortOrder` ascending then `id` ascending; user profiles by `id`. Audit log keeps document order.
- `isLegacyFirestorePartyDocument(data: unknown): boolean` — true when `wireVersion !== 2`.
- `canonicalizePartyState(partyState): PartyState` — same deterministic ordering applied to a model-shape state. Used for equality checks so array order never causes spurious re-applies or diffs.

### Ordering note

Array order is not semantic anywhere in the model: entities and records both carry `sortOrder`, and rendering sorts by it (`getSortedEntities`, `sortInventoryRecordsBySortOrder`). The implementer must verify this claim by grepping for index-based ordering assumptions and report any found; if any exist, they are a finding to fix, not a reason to keep array order on the wire.

## Write algorithm

### Pure diff (`src/persistence/partyStateDiff.ts`)

```ts
type FieldUpdate =
  | { path: string[]; op: "set"; value: unknown }
  | { path: string[]; op: "delete" }
  | { path: string[]; op: "arrayUnion"; value: unknown[] };

function diffPartyStates(previous: PartyState, next: PartyState): FieldUpdate[];
function mergeFieldUpdates(pending: FieldUpdate[], incoming: FieldUpdate[]): FieldUpdate[];
```

`diffPartyStates` compares canonicalized states and emits, in this order:

- `["party","displayName"]`, `["party","gmUid"]`, `["party","inviteCode"]`: `set` when changed, `delete` when removed.
- `["party","members",uid]`: `set` per changed/added uid, `delete` per removed uid. Never write the whole members map.
- `["appState","entities",id]`: `set` when the entity's JSON differs, `delete` when removed.
- `["appState","inventoryRecords",id]`: same.
- `["userProfiles",id]`: same.
- `["appState","auditLog"]`: if `next.auditLog` equals `previous.auditLog` followed by zero or more new entries, emit `arrayUnion` of the new entries (omit when none). Otherwise (entries removed or reordered) emit `set` with the whole array. The log shrinks in exactly two ways — the cap trim (back to `AUDIT_LOG_MAX_ENTRIES`, and only once the log passes `AUDIT_LOG_MAX_ENTRIES + AUDIT_LOG_TRIM_SLACK`; see `MODEL_SPEC.md`) and the GM's `clearAuditLog` — and both take this `set` branch, a clear writing `[]`.

Comparison is `JSON.stringify` on the individual entry, matching the repo's fixture convention. No update is emitted for unchanged paths. An empty result means nothing to write.

`mergeFieldUpdates` combines a pending batch with a newer one: a later `set`/`delete` on a path replaces an earlier update on that path; two `arrayUnion`s on the same path concatenate (dedupe by entry `id`); a `set` on the audit log replaces any pending `arrayUnion`.

### Store write path (`src/store/useAppStore.ts`)

Replace the single pending `PartyState` with a pending `FieldUpdate[]`:

- The store subscriber already receives `(state, previousState)`. When not applying a remote snapshot and persistence is Firebase, compute `diffPartyStates(previous, next)` and merge it into the pending batch, then flush.
- `flushFirebasePartyStateWrite` sends the pending batch through a new sync callback `applyFieldUpdates(updates)`; on failure the batch is merged back in front of anything queued meanwhile (same retry semantics as today).
- The first-snapshot gate is unchanged: no writes before the first remote snapshot; the pending batch is discarded when the first snapshot is applied.
- The same gate applies to membership: the store never assigns `party.gmUid` from local state in Firebase mode. A party loaded from localStorage is used as cached — a missing `members[gmUid]` entry may be repaired, but GM is never handed to the reader — and `gmUid`/`members` are replaced by the first snapshot. Auth resolving a UID only sets the current user id.
- Applying a snapshot is also what records the party as `lastPartyId`, so a party whose read was denied is not reopened by default.
- An unresolved role (no snapshot yet, or a denied read) refuses store mutations; it is not downgraded to a player role.
- Keep `lastSyncedPartyState` (the canonical state last applied from a snapshot or successfully written) only if needed for retries; the simpler design is diff-per-mutation plus merge, which is what is specified here.
- `arePartyStatesEqual` compares canonicalized states.
- Import (`replaceAppState`) and reset (`resetLocalState`) go through the same diff. They are GM-only and produce large but correct batches.

### Sync layer (`src/persistence/firebaseSync.ts`)

`onReadyToWrite` provides:

```ts
type FirebaseWriter = {
  applyFieldUpdates: (updates: FieldUpdate[]) => Promise<void>;
  replaceDocument: (partyState: PartyState) => Promise<void>;
};
```

- `applyFieldUpdates` converts to one `updateDoc(ref, FieldPath, value, FieldPath, value, ...)` call. Always use `FieldPath` objects (never dotted strings) so ids and uids with unusual characters are safe. `delete` becomes `deleteField()`, `arrayUnion` becomes `arrayUnion(...entries)`. An empty batch is a no-op.
- `replaceDocument` is `setDoc(ref, toFirestorePartyDocument(partyState))`. Used only for document creation (snapshot with `exists() === false`, as today) and the legacy upgrade below.
- Document creation writes wire version 2, and it is where GM is assigned: the state is passed through `assignPartyGm(partyState, uid)` with the authenticated UID, so the created document always has `party.gmUid == uid` and a `gm` entry in `party.members` (any GM identity cached from an earlier local session is replaced). Creation is skipped with an error if there is no authenticated user.
- Every snapshot passes through `fromFirestorePartyDocument`.

### Legacy upgrade

Applying a field path such as `appState.entities.<id>` to a document whose `appState.entities` is still an array would replace the array with a one-entry map and lose data. Therefore:

- When a snapshot arrives for a legacy document, the client runs a transaction: read the document; if it is still legacy, `set` it with `toFirestorePartyDocument(fromFirestorePartyDocument(data))`; if it is already version 2, do nothing. The transaction prevents two clients upgrading concurrently and one overwriting the other's later edits.
- Any member may perform the upgrade. Rules allow a player's full write when GM-only fields are unchanged, and the upgrade changes nothing but shape.
- Field updates are blocked (queued) until the upgrade transaction resolves and a version 2 snapshot has been applied. Status stays `syncing` meanwhile.
- The upgrade must not lose `party.inviteCode`, members, or user profiles.

## Firestore rules

Rules do not reference the app state shape, so `firestore.rules` should need no logic change. Verify and add these cases to `scripts/test-rules.mjs`, with seeds in version 2 shape:

1. Player `updateDoc` on `appState.entities.<id>` succeeds.
2. Player `updateDoc` on `appState.inventoryRecords.<id>` with `deleteField()` succeeds.
3. Player `updateDoc` with `arrayUnion` on `appState.auditLog` succeeds; so does a player's whole-array `set` on the same path (the trim runs on any member's mutation).
4. Player `updateDoc` on `userProfiles.<ownId>` succeeds.
5. Player `updateDoc` on `party.displayName` fails; on `party.inviteCode` fails; on `party.members.<otherUid>` fails; on `party.gmUid` fails.
6. GM `updateDoc` on `party.members.<uid>` and `party.inviteCode` succeeds.
7. Legacy-shape seed: player full `setDoc` in version 2 shape with identical content succeeds (the upgrade path); the same write with a changed `displayName` fails.
8. Invite join still works against a version 2 seed.

## Invariants

- The model shape never changes because of this spec. No `Record`-shaped `entities` or `inventoryRecords` may leak into `AppState`, the store, UI, or localStorage.
- A client never writes a whole document except on creation or legacy upgrade.
- GM identity comes from the document. Only the creation path assigns it, and only to the authenticated UID.
- No write before the first snapshot; the first snapshot discards pending local diffs.
- Every write is expressible as the union of per-id sets and deletes plus an audit-log union, so two clients' writes commute unless they touch the same id.

## Known limits (accepted)

- Same-record concurrent edits are last-writer-wins per record.
- Multi-record operations (swap, move with reindex) can interleave with another client's move of one of the records and produce a state the client-side validator would have blocked, for example two records at the same slot. The existing soft warnings surface this; no server-side fix.
- **Audit-log trim and clear are last-writer-wins for the log.** A whole-array `set` overwrites whatever the server holds, so entries another client appended between this client's last snapshot and the write are lost. The window is one write, and the trim's hysteresis (`AUDIT_LOG_TRIM_SLACK`) keeps it rare: a trim only fires once the log passes `max + slack` and then cuts back to `max`, so at most one write in every `slack + 1` appends is a `set` — roughly one in fifty. Without the slack, every append past the cap would trim, every audit write would be a `set`, and the log would lose merging permanently rather than for one write. Ordinary appends stay `arrayUnion` and still merge. Losing a few audit entries at a trim is acceptable at the table, and the alternative — leaving the log unbounded — makes every write for the party fail once the document reaches 1 MiB.
- Firestore rules are unaffected: `isAllowedPlayerUpdate()` only compares party-level fields, so a player's trim `set` on `appState.auditLog` is allowed, and the GM's clear passes under `isGm()`. No rules change is needed for either.
- The 1 MiB document limit is unchanged; the audit-log cap is what keeps a long-running party's document inside it.

## Testing

- Fixtures (repo convention, wired into `src/run-fixtures.test.ts`): `firestoreDocument.fixtures.ts` (to/from, legacy parse, ordering, id-key precedence, round trip preserves inviteCode and members) and `partyStateDiff.fixtures.ts` (each path kind, audit-log union vs set, no-op diff is empty, merge semantics, canonical ordering ignores array order).
- `npm run typecheck`, `npm test`, `npm run build`, `npm run test:rules` (needs Java: `export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"`).

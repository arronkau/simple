# Sync Spec — Firestore field-level writes

Governs `src/persistence/firebaseSync.ts`, `src/persistence/firestoreDocument.ts`, `src/persistence/partyStateDiff.ts`, `src/persistence/firebaseWriteLifecycle.ts`, `src/persistence/retryBackoff.ts`, `src/persistence/syncWindowListeners.ts`, the Firebase write path in `src/store/useAppStore.ts`, and the party document shape in Firestore. Local mode is unaffected.

## Goal

Two clients editing different parts of the same party at the same time must never overwrite each other. A mutation therefore writes only the fields it changed: the store diffs the previous and next `PartyState` and sends the result as one `updateDoc` of per-id field paths. A whole-document `setDoc` happens only on document creation and on the legacy upgrade.

Behavior:

- Edits to different entities, inventory records, user profiles, member entries, or party fields merge on the server.
- Two edits to the *same* record are last-writer-wins for that record only. This is acceptable for table play.
- Audit log entries appended by different clients are all kept, except across a trim or clear (see Known limits).
- The model (`PartyState`, `AppState`) keeps its array shape. Only the Firestore document shape differs. Local mode stores the model shape in localStorage.

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

Array order is not semantic anywhere in the model: entities and records both carry `sortOrder`, and rendering sorts by it (`getSortedEntities`, `sortInventoryRecordsBySortOrder`). Nothing depends on array index, so map order on the wire is safe. The audit log is the one ordered array and keeps document order.

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

The pending write is a `FieldUpdate[]`, not a `PartyState`:

- The store subscriber receives `(state, previousState)`. When not applying a remote snapshot and persistence is Firebase, it computes `diffPartyStates(previous, next)`, merges it into the pending batch, and flushes.
- `flushFirebasePartyStateWrite` sends the pending batch through the sync callback `applyFieldUpdates(updates)`. One write is in flight at a time; anything queued meanwhile is flushed when it settles, so batches reach Firestore in order.
- On a retryable failure the batch is merged back in front of anything queued meanwhile and a retry is scheduled (see *Failure handling*).
- The first-snapshot gate: no writes before the first remote snapshot for this connection; the pending batch is discarded when that snapshot is applied, because the remote document is authoritative on first contact.
- The same gate applies to membership: the store never assigns `party.gmUid` from local state in Firebase mode. A party loaded from localStorage is used as cached — a missing `members[gmUid]` entry may be repaired, but GM is never handed to the reader — and `gmUid`/`members` are replaced by the first snapshot. Auth resolving a UID only sets the current user id.
- Applying an acknowledged snapshot is also what records the party as `lastPartyId`, so a party whose read was denied is not reopened by default.
- An unresolved role (no snapshot yet, or a denied read) refuses store mutations; it is not downgraded to a player role.
- `arePartyStatesEqual` compares canonicalized states.
- A snapshot with `hasPendingWrites` is this client's own echo: it holds what the SDK has, which is behind any update still queued in the app and ahead of what the server confirmed. It moves the status and nothing else — applying it would revert queued edits. The acknowledgement snapshot carries the same content plus whatever another client changed meanwhile.
- `lastRemotePartyState` holds the state from the most recent acknowledged (not `hasPendingWrites`) snapshot. It exists for the permission-denied rollback below, and is not consulted when diffing.
- Import (`replaceAppState`) and reset (`resetLocalState`) go through the same diff. They are GM-only and produce large but correct batches.

### Sync layer (`src/persistence/firebaseSync.ts`)

`onReadyToWrite` provides:

```ts
type FirebaseWriter = {
  applyFieldUpdates: (updates: FieldUpdate[]) => Promise<void>;
  offlineWritesDurable: boolean;
  replaceDocument: (partyState: PartyState) => Promise<void>;
};

type RemoteSnapshotMetadata = {
  fromCache: boolean;
  hasPendingWrites: boolean;
};
```

- `applyFieldUpdates` converts to one `updateDoc(ref, FieldPath, value, FieldPath, value, ...)` call. Always use `FieldPath` objects (never dotted strings) so ids and uids with unusual characters are safe. `delete` becomes `deleteField()`, `arrayUnion` becomes `arrayUnion(...entries)`. An empty batch is a no-op.
- `replaceDocument` is `setDoc(ref, toFirestorePartyDocument(partyState))`. Used only for document creation and the legacy upgrade below.
- Document creation happens on a snapshot with `exists() === false` **that is not `fromCache`** and that the subscription has not previously seen exist. An offline client reports "missing" for any document it has never cached, and creating the document from local state there would overwrite the real party on reconnect. A document that disappears under a live subscription was deleted by its GM; recreating it would both resurrect the party and, because creation assigns GM, hand GM to whichever member was still subscribed. Those clients raise `onPartyDeleted(partyId)` instead — the store drops the cached party state, the party-index entry and `lastPartyId` for that id, so "/" cannot reopen it — and report "This party was deleted by the GM." The client stays on the party it is showing; nothing navigates on its behalf.
- Document creation writes wire version 2, and it is where GM is assigned: the state is passed through `assignPartyGm(partyState, uid)` with the authenticated UID, so the created document always has `party.gmUid == uid` and a `gm` entry in `party.members` (any GM identity cached from an earlier local session is replaced). Creation is skipped with an error if there is no authenticated user.
- Every snapshot passes through `fromFirestorePartyDocument` and is delivered to the store with its `RemoteSnapshotMetadata`.
- The listener is registered with `includeMetadataChanges: true`, because acknowledgement of a write that leaves the document unchanged is otherwise never reported.

### Offline persistence

`initializeFirestore` is called once per app (a second call with different settings throws) and the instance is reused by every later sync session — party switch, sign-in, sign-out. Settings:

- `ignoreUndefinedProperties: true`.
- `localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })`, so the party document and unsent writes live in IndexedDB and several tabs share one connection.

Where IndexedDB is unavailable (some private modes, unsupported browsers, the fixture runner) initialization falls back to the default in-memory cache and sync works exactly as before, minus durability across reloads. The writer reports which one is active as `offlineWritesDurable`; the unload guard is the only consumer.

Consequences the rest of the design depends on:

- The first snapshot of a session may come from the cache. It still opens the write gate, which is what makes offline editing possible, and it is still authoritative on first contact — a client whose cached copy is behind adopts the cached state and re-sends nothing.
- While offline, `updateDoc` neither resolves nor rejects. The in-flight write therefore stays in flight, later edits accumulate in the pending batch, and everything is sent in order once the connection returns.
- A legacy (pre-`wireVersion`) document cannot be upgraded offline: the upgrade is a transaction, which requires the server. The upgrade keeps retrying and no field updates are sent until it succeeds.

### Legacy upgrade

Applying a field path such as `appState.entities.<id>` to a document whose `appState.entities` is still an array would replace the array with a one-entry map and lose data. Therefore:

- When a snapshot arrives for a legacy document, the client runs a transaction: read the document; if it is still legacy, `set` it with `toFirestorePartyDocument(fromFirestorePartyDocument(data))`; if it is already version 2, do nothing. The transaction prevents two clients upgrading concurrently and one overwriting the other's later edits.
- Any member may perform the upgrade. Rules allow a player's full write when GM-only fields are unchanged, and the upgrade changes nothing but shape.
- Field updates are blocked (queued) until the upgrade transaction resolves and a version 2 snapshot has been applied. Status stays `syncing` meanwhile.
- The upgrade must not lose `party.inviteCode`, members, or user profiles.

## Failure handling

A failed write is not the user's problem to notice. Nothing else re-sends a batch, so a flush that fails and is only retried on the next edit leaves the party document behind indefinitely — and re-sends a rejected batch forever.

Failures are classified in `src/persistence/firebaseWriteLifecycle.ts`:

- **`permission-denied` — never retried.** The batch is dropped, the rest of the pending queue with it, and local state is restored from `lastRemotePartyState` so the client cannot keep showing an edit the party document will never contain. The message is role-aware (`getPermissionDeniedWriteMessage`): GM, player, and non-member each get a different one, and it is surfaced through the same friendly formatter as every other sync error (`formatFirebaseError`, which the store's `formatSyncError` delegates to). Status becomes `error`.
- **Everything else — retried.** The batch is merged back in front of anything queued meanwhile and a retry is scheduled: 1s, doubling, capped at 30s, counted from the first failure and reset on the first success (`createRetryScheduler` in `src/persistence/retryBackoff.ts`, shared with the legacy upgrade so there is one backoff implementation). Status becomes `error` with the retry delay named in the message; the retry runs independently of user activity.

The retry is subject to the same generation gating as the original write: a superseded connection's retry is cancelled when sync stops, and a settled write from a superseded generation never touches status or the queue.

## Status semantics

`synced` means server-acknowledged, not "sent". With the persistent cache a write is applied to the local copy immediately and echoed back as a snapshot long before the backend sees it, so status is derived rather than assumed (`deriveSnapshotSyncStatus`):

| Condition | Status |
|---|---|
| A retry is scheduled | unchanged (the failure message stays) |
| `hasPendingWrites`, a write in flight, or a non-empty pending batch | `saving` |
| `fromCache` with nothing outstanding | `syncing` (local copy shown, backend not reached) |
| Server snapshot, nothing outstanding | `synced` |

The write promise resolving is the other source of `synced`: with the persistent cache `updateDoc` settles on server acknowledgement.

## Unload and connectivity

Registered when a sync session starts and removed when it stops, so a party switch or a re-auth cannot leak or stack them (`src/persistence/syncWindowListeners.ts`):

- **`beforeunload`** warns while updates have not reached the Firestore SDK yet — a non-empty pending batch, or a write in flight when writes are memory-only. Once the SDK has a write and the persistent cache is active, the write survives the reload and the guard stays quiet (`shouldBlockUnloadForFirebaseWrites`).
- **`pagehide`** cannot prompt, so it hands the pending batch to the SDK instead: a normal flush, or a direct hand-off when a write is already in flight.
- **`online`** clears the backoff and flushes immediately instead of waiting out the timer.

## Queue reset windows

`resetFirebaseWriteQueue` (sign-in with a changed UID, sign-out, party switch) first attempts to hand the pending batch to Firestore under the still-valid writer. The result is ignored — the generation is about to be superseded — but the SDK has taken the write, which is enough with the persistent cache. The pending batch belongs to the party being left, and the writer still points at that document, so this writes to the right place.

Two windows remain, both accepted:

- Updates queued before the writer exists or before the first snapshot of the session cannot be sent at all and are dropped. They are still in localStorage; the next snapshot for that party is authoritative and reconciles local state to the server, so the result is consistent, not half-applied.
- A hand-off that has reached the SDK but not IndexedDB when the tab is discarded is lost.

## Firestore rules

Rules do not reference the app state shape, so field-level writes needed no rules change. `scripts/test-rules.mjs` covers, with seeds in version 2 shape: player field update on one entity; player field delete on one inventory record; player `arrayUnion` on the audit log; player field update on their own user profile; player field updates on `party.displayName`, `party.inviteCode`, `party.members.<otherUid>` and `party.gmUid` all failing; GM field updates on members and invite code; the legacy shape-only upgrade succeeding while the same write with a changed `displayName` fails; and an invite join against a version 2 party. A player's whole-array `set` on `appState.auditLog` (what the cap trim produces on any member's mutation) passes the same rule but has no test case yet.

## Invariants

- The model shape never changes because of this spec. No `Record`-shaped `entities` or `inventoryRecords` may leak into `AppState`, the store, UI, or localStorage.
- A client never writes a whole document except on creation or legacy upgrade.
- GM identity comes from the document. Only the creation path assigns it, and only to the authenticated UID.
- No write before the first snapshot; the first snapshot discards pending local diffs.
- Every write is expressible as the union of per-id sets and deletes plus an audit-log union, so two clients' writes commute unless they touch the same id.
- A failed write is either retried on a schedule or rolled back. It is never left in the queue waiting for the user to edit something else.
- Local state never keeps a change the server refused.

## Known limits (accepted)

- Same-record concurrent edits are last-writer-wins per record.
- Multi-record operations (swap, move with reindex) can interleave with another client's move of one of the records and produce a state the client-side validator would have blocked, for example two records at the same slot. The existing soft warnings surface this; no server-side fix.
- **Audit-log trim and clear are last-writer-wins for the log.** A whole-array `set` overwrites whatever the server holds, so entries another client appended between this client's last snapshot and the write are lost. The window is one write, and the trim's hysteresis (`AUDIT_LOG_TRIM_SLACK`) keeps it rare: a trim only fires once the log passes `max + slack` and then cuts back to `max`, so at most one write in every `slack + 1` appends is a `set` — roughly one in fifty. Without the slack, every append past the cap would trim, every audit write would be a `set`, and the log would lose merging permanently rather than for one write. Ordinary appends stay `arrayUnion` and still merge. Losing a few audit entries at a trim is acceptable at the table, and the alternative — leaving the log unbounded — makes every write for the party fail once the document reaches 1 MiB.
- Firestore rules are unaffected: `isAllowedPlayerUpdate()` only compares party-level fields, so a player's trim `set` on `appState.auditLog` is allowed, and the GM's clear passes under `isGm()`. No rules change is needed for either.
- The 1 MiB document limit is unchanged; the audit-log cap is what keeps a long-running party's document inside it.
- A `permission-denied` rollback discards every queued update, not only the rejected one. The client is reconciled to the server rather than trying to re-apply the edits that were still legal.
- **A client that was not subscribed when the party was deleted still recreates it.** An offline client, a bookmark, or an old link reaching a deleted id sees exactly what a never-created party looks like — a server snapshot with `exists() === false` — and creates an empty party under that id with itself as GM. Only a subscription that saw the document exist is protected, and only that subscription's device is cleaned up. The stronger fix is to create documents only for party ids minted on this device (or to leave a tombstone the rules keep), which is a future change and is **not** implemented.
- An acknowledged snapshot that lands while the app still holds unsent updates reverts those edits on screen until the queue flushes and the next snapshot brings them back.
- The queue reset windows above.

## Testing

- Fixtures (repo convention, wired into `src/run-fixtures.test.ts`): `firestoreDocument.fixtures.ts` (to/from, legacy parse, ordering, id-key precedence, round trip preserves inviteCode and members), `partyStateDiff.fixtures.ts` (each path kind, audit-log union vs set, no-op diff is empty, merge semantics, canonical ordering ignores array order), `firebaseWriteLifecycle.fixtures.ts` (generation gating, failure classification, role-aware permission-denied messages, unload guard, status derivation), `retryBackoff.fixtures.ts` (delay schedule, pending-retry replacement, reset) and `syncWindowListeners.fixtures.ts` (guarded unload, online/pagehide dispatch, handler removal).
- `npm run typecheck`, `npm test`, `npm run build`, `npm run test:rules` (needs Java: `export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"`).

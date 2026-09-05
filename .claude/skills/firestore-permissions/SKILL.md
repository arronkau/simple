---
name: firestore-permissions
description: Security-rules and party-permission model for the `simple` TTRPG app's Firebase/Firestore sync. Use whenever changing firestore.rules, party membership, GM vs player roles, the permissions model, protected/secret inventory fields, or anything touching the parties collection or auth UID handling.
---

# Firestore Permissions & Party Model

Keeps changes to auth, sync, and the GM/player permission model consistent and safe. There are **two enforcement layers** and they must stay in agreement.

## The two layers (keep them in sync)

1. **Firestore security rules** — [firestore.rules](../../../firestore.rules). The real security boundary. Server-enforced, coarse-grained (party-document level).
2. **App/model layer** — [src/model/permissions.ts](../../../src/model/permissions.ts) + [src/store/useAppStore.ts](../../../src/store/useAppStore.ts). Fine-grained, UX-facing, and enforces what rules *cannot* (per-item secret fields).

A change to who-can-do-what almost always needs edits in BOTH. If you relax one, check the other didn't just become the weak link.

## Data shape

- Single document per party at `parties/{partyId}` (collection const: `FIREBASE_PARTY_STATE_COLLECTION` in [src/persistence/firebaseSync.ts](../../../src/persistence/firebaseSync.ts)). **No subcollections** — rules deny all `parties/{partyId}/{document=**}` defensively; keep it that way.
- **Wire shape:** [SYNC_SPEC.md](../../../SYNC_SPEC.md) version 2 stores entities, inventory records, and user profiles as id-keyed maps; the model and localStorage keep their array shape, and the audit log remains an array.
- Identity is the **Firebase Auth UID**, not the local user id. `party.gmUid` and the `party.members` map are keyed by UID. Role resolution: `resolvePartyRole(uid, gmUid, members)` → `"gm" | role | null`.

## Rules invariants (don't weaken without cause)

- **read:** authenticated party member (`isMember`), or any authenticated user when the document does not exist (`resource == null`) so a client can discover it must create the party.
- **create:** caller must set themselves as `gmUid` AND be in `members`.
- **update:** `isGm()` OR (`isMember()` AND `isAllowedPlayerUpdate()`) OR `isInviteJoin()`.
- **delete:** GM only.
- **GM-only party-level fields** a player update must NOT change: `party.gmUid`, `party.members`, `party.displayName`, `party.inviteCode`. If you add another protected party-level field, add it to `isAllowedPlayerUpdate()`.
- **Invite join** (`isInviteJoin`): a signed-in non-member may add exactly one entry, `party.members[ownUid]`, with `role == 'player'` and `inviteCode == party.inviteCode`, via `updateDoc` with a `FieldPath("party","members",uid)`. Nothing else may change (`diff().affectedKeys()` checks at document, party, and members level). The client side is `joinPartyWithInvite` in `firebaseSync.ts`: probe with `getDoc`, join only on `permission-denied`.

## App-layer model (`permissions.ts`)

- GM bypasses all checks (`role === "gm"` ⇒ true everywhere).
- GM-only action sets: `GM_ONLY_PARTY_ACTIONS`, `GM_ONLY_ENTITY_ACTIONS`, `GM_ONLY_INVENTORY_ACTIONS`. Add new privileged actions to the right set, and the action to the corresponding `*Action` union type.
- `assert*Action` throws `PermissionError` (codes: `not-authenticated | not-party-member | gm-only | protected-field | invalid-membership-update`).
- **Secret inventory fields** (`identification.secretName`, `identification.secretDescription`) are GM-only and **cannot be validated in Firestore rules** (they're nested inside individual inventory records). They are enforced ONLY here via `getProtectedInventoryFieldViolations(patch)`. If you add a new secret/GM field, update this function — rules will not catch it.
- **Deleting a party** (`deleteParty`) is GM-only in both layers. The client path is the store's `deleteCurrentParty` → `deletePartyDocument` in `firebaseSync.ts`: it asserts the action, **stops the snapshot subscription before the delete** (a subscribed client treats a missing party document as one it must create and would write the party straight back), then clears the local party state, the local party index entry, and the last-opened party id. Other clients subscribed to the party do **not** recreate it: the snapshot handler tracks whether it has seen the document exist, and reports "This party was deleted by the GM." instead of writing it back — without that, creation's `assignPartyGm` would hand GM to whichever member was still subscribed.
- **Write gates in the store's `updateInventoryRecord`:** a non-GM may not edit a record that is stored unidentified ("Only the GM can edit an unidentified item."), and a non-GM's save carries the stored `notes` through unchanged so it cannot be wiped by a form that never showed it.

## Display redaction (third layer, UX only)

`src/model/recordVisibility.ts` — `getVisibleInventoryRecord(record, viewerRole)` — is the single rule for what a viewer may *see*: `notes` is dropped for any non-GM, and an unidentified record collapses to its public shell (no `isMagic`, `uses`, `modifiers`, weapon/armor detail, `light.lightDescription`, treasure `gpValue`, or secret fields). See `MODEL_SPEC.md` → Player Visibility.

- It fails closed on `null` (unresolved / non-member) roles, same as everything else here.
- The viewer's role is provided once by `ViewerRoleContext` (`src/components/ViewerRole.tsx`) and consumed at display boundaries via `useVisibleRecord`. Do not redact where app state enters a page: derived calculations (AC, encumbrance, light burn) must keep using full records.
- **This is not a security boundary.** The wire still carries full records — Firestore rules cannot filter fields inside a record — so a determined player with devtools can read them. Real GM-only secrets need a different storage shape, not a display rule.

## When you change permissions
1. Update `firestore.rules` (party-level boundary) and `permissions.ts` (action/field granularity) together.
2. Add fixtures to [src/model/permissions.fixtures.ts](../../../src/model/permissions.fixtures.ts) covering both allowed and denied paths (incl. the `PermissionError` code). This repo uses manual fixtures — see the `encumbrance-rules` skill for the convention; run `npm test && npm run typecheck`.
3. **Rules are not covered by `npm test`.** Run `npm run test:rules` (Firestore emulator via `firebase-tools`, needs a Java runtime). Cases live in [scripts/test-rules.mjs](../../../scripts/test-rules.mjs); add a case for every rule change, allowed and denied.
4. Consider running `/security-review` on rules or permission changes.

## Auth / identity
- Sessions start anonymous. `linkOrSignInWithGoogle` in `firebaseSync.ts` links Google to the anonymous user (UID unchanged). On `auth/credential-already-in-use` it signs in as the existing Google-bound user instead; the UID changes and the store restarts sync so role is re-resolved. Sign-out restarts sync under a new anonymous UID.
- Google sign-in requires the Google provider enabled in Firebase Auth and the hosting domain in Auth → Authorized domains.

## Where GM identity comes from (Firebase mode)

- **The party document, never the local cache.** `migratePartyMembership` (assigns the current user as GM when a party has no `gmUid`) is for local-mode parties and the document-creation path only. A Firebase client that has not seen a snapshot yet uses `repairPartyMembership`, which repairs a missing `members[gmUid]` entry but never hands GM to the reader.
- **Creation assigns GM.** The `exists() === false` branch in `firebaseSync.ts` writes the document through `assignPartyGm(partyState, user.uid)`, matching the create rule (caller must be both `gmUid` and a member). This is the only place a client claims GM.
- **Unresolved role fails closed.** `resolvePartyRole` returning `null` (not a member, or no snapshot yet) must not be read as `"player"`. Store actions resolve through `resolveActionRole(role, persistenceMode)`: `"player"` in local mode, `null` in Firebase mode, and a `null` result throws `PermissionError("not-party-member")` so the mutation is refused.
- A denied read keeps the role `null`, sets `syncStatus` to `error`, hides GM controls, and does not record the party as `lastPartyId`.

## Gotchas
- A previously-fixed bug: GM identity was lost when the Firebase UID differed from the local user id (commit 16db8d6). Anything new that maps local ids ↔ UIDs must preserve GM resolution — test with `gmUid !== localUserId`.
- A previously-fixed bug: a non-member who opened a party URL in Firebase mode became a *local* GM, because the GM-assignment migration ran against the empty local cache before the first snapshot. Any new code path that writes `gmUid` outside the document-creation path reintroduces it.
- Don't trust the client role for security decisions that matter — the rules are the boundary; `permissions.ts` is for UX and the secret-field gap rules can't cover.

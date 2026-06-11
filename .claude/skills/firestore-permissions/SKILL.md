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
- Identity is the **Firebase Auth UID**, not the local user id. `party.gmUid` and the `party.members` map are keyed by UID. Role resolution: `resolvePartyRole(uid, gmUid, members)` → `"gm" | role | null`.

## Rules invariants (don't weaken without cause)

- **read:** authenticated party member only (`isAuthenticatedMember`).
- **create:** caller must set themselves as `gmUid` AND be in `members`.
- **update:** member AND (`isGm()` OR `isAllowedPlayerUpdate()`).
- **delete:** GM only.
- **GM-only party-level fields** a player update must NOT change: `party.gmUid`, `party.members`, `party.displayName`. If you add another protected party-level field, add it to `isAllowedPlayerUpdate()`.

## App-layer model (`permissions.ts`)

- GM bypasses all checks (`role === "gm"` ⇒ true everywhere).
- GM-only action sets: `GM_ONLY_PARTY_ACTIONS`, `GM_ONLY_ENTITY_ACTIONS`, `GM_ONLY_INVENTORY_ACTIONS`. Add new privileged actions to the right set, and the action to the corresponding `*Action` union type.
- `assert*Action` throws `PermissionError` (codes: `not-authenticated | not-party-member | gm-only | protected-field | invalid-membership-update`).
- **Secret inventory fields** (`identification.secretName`, `identification.secretDescription`) are GM-only and **cannot be validated in Firestore rules** (they're nested in the `inventoryRecords` array). They are enforced ONLY here via `getProtectedInventoryFieldViolations(patch)`. If you add a new secret/GM field, update this function — rules will not catch it.

## When you change permissions
1. Update `firestore.rules` (party-level boundary) and `permissions.ts` (action/field granularity) together.
2. Add fixtures to [src/model/permissions.fixtures.ts](../../../src/model/permissions.fixtures.ts) covering both allowed and denied paths (incl. the `PermissionError` code). This repo uses manual fixtures — see the `encumbrance-rules` skill for the convention; run `npm test && npm run typecheck`.
3. **Rules are not covered by `npm test`.** There is an open TODO at the top of `firestore.rules` listing the required emulator-based test cases (non-member read/write denied, player cannot edit party settings/members, GM admin writes, subcollection denial). If you touch rules, exercise those cases against the Firestore emulator manually before relying on them.
4. Consider running `/security-review` on rules or permission changes.

## Gotchas
- A previously-fixed bug: GM identity was lost when the Firebase UID differed from the local user id (commit 16db8d6). Anything new that maps local ids ↔ UIDs must preserve GM resolution — test with `gmUid !== localUserId`.
- Don't trust the client role for security decisions that matter — the rules are the boundary; `permissions.ts` is for UX and the secret-field gap rules can't cover.

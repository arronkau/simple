// Firestore security-rules tests. Run via `npm run test:rules`, which starts
// the Firestore emulator around this script. Cases mirror the invariants in
// .claude/skills/firestore-permissions/SKILL.md.
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  arrayUnion,
  deleteDoc,
  deleteField,
  doc,
  FieldPath,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const PROJECT_ID = "simple-rules-test";
const GM = "uid-gm";
const PLAYER = "uid-player";
const STRANGER = "uid-stranger";
const INVITE = "abcdefgh1234567890ab";

function party(overrides = {}) {
  return {
    schemaVersion: 1,
    wireVersion: 2,
    party: {
      id: "party-1",
      displayName: "Test Party",
      gmUid: GM,
      members: {
        [GM]: { role: "gm", joinedAt: "2026-01-01T00:00:00.000Z" },
        [PLAYER]: { role: "player", joinedAt: "2026-01-02T00:00:00.000Z" },
      },
      inviteCode: INVITE,
      ...overrides,
    },
    appState: { schemaVersion: 1, entities: {}, inventoryRecords: {}, auditLog: [] },
    userProfiles: {},
  };
}

function legacyParty(overrides = {}) {
  const current = party(overrides);
  const { wireVersion: _wireVersion, ...legacy } = current;
  return {
    ...legacy,
    appState: {
      ...legacy.appState,
      entities: Object.values(legacy.appState.entities),
      inventoryRecords: Object.values(legacy.appState.inventoryRecords),
    },
    userProfiles: Object.values(legacy.userProfiles),
  };
}

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8089").split(":");
const env = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: { host, port: Number(port), rules: readFileSync("firestore.rules", "utf8") },
});

const ref = (ctx) => doc(ctx.firestore(), "parties", "party-1");
const as = (uid) => env.authenticatedContext(uid);
const anon = () => env.unauthenticatedContext();

async function seed(data = party()) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(ref(ctx), data);
  });
}

const memberPath = (uid) => new FieldPath("party", "members", uid);
const joinEntry = (code = INVITE) => ({
  role: "player",
  joinedAt: "2026-09-01T00:00:00.000Z",
  inviteCode: code,
});

const cases = [
  ["unauthenticated user cannot read party", async () => {
    await seed();
    await assertFails(getDoc(ref(anon())));
  }],
  ["unauthenticated user cannot write party", async () => {
    await seed();
    await assertFails(setDoc(ref(anon()), party({ displayName: "x" })));
  }],
  ["non-member cannot read party", async () => {
    await seed();
    await assertFails(getDoc(ref(as(STRANGER))));
  }],
  ["non-member cannot write party", async () => {
    await seed();
    await assertFails(setDoc(ref(as(STRANGER)), party()));
  }],
  ["member can read party", async () => {
    await seed();
    await assertSucceeds(getDoc(ref(as(PLAYER))));
  }],
  ["signed-in user can read a missing party (to create it)", async () => {
    await env.clearFirestore();
    await assertSucceeds(getDoc(ref(as(STRANGER))));
    await assertFails(getDoc(ref(anon())));
  }],
  ["creator must be GM and member", async () => {
    await env.clearFirestore();
    await assertFails(setDoc(ref(as(STRANGER)), party()));
    await env.clearFirestore();
    await assertSucceeds(setDoc(ref(as(GM)), party()));
  }],
  ["player can perform allowed writes", async () => {
    await seed();
    const next = party();
    next.appState.entities = { "entity-1": { id: "entity-1", name: "Fighter" } };
    next.userProfiles = { [PLAYER]: { id: PLAYER, displayName: "P", role: "Player", updatedAt: "x" } };
    await assertSucceeds(setDoc(ref(as(PLAYER)), next));
  }],
  ["player cannot rename party", async () => {
    await seed();
    await assertFails(setDoc(ref(as(PLAYER)), party({ displayName: "Renamed" })));
  }],
  ["player cannot change gmUid", async () => {
    await seed();
    await assertFails(setDoc(ref(as(PLAYER)), party({ gmUid: PLAYER })));
  }],
  ["player cannot edit members map", async () => {
    await seed();
    await assertFails(updateDoc(ref(as(PLAYER)), memberPath(STRANGER), joinEntry()));
    await assertFails(updateDoc(ref(as(PLAYER)), memberPath(PLAYER), { role: "gm" }));
  }],
  ["player cannot change or remove invite code", async () => {
    await seed();
    await assertFails(setDoc(ref(as(PLAYER)), party({ inviteCode: "zzzzzzzzzzzz" })));
    const { inviteCode: _omit, ...withoutInvite } = party().party;
    await assertFails(setDoc(ref(as(PLAYER)), { ...party(), party: withoutInvite }));
  }],
  ["GM can perform administrative writes", async () => {
    await seed();
    await assertSucceeds(setDoc(ref(as(GM)), party({ displayName: "Renamed", inviteCode: "newcodenewcode" })));
    await assertSucceeds(updateDoc(ref(as(GM)), memberPath(PLAYER), { role: "player", displayName: "P" }));
    await assertSucceeds(deleteDoc(ref(as(GM))));
  }],
  ["player cannot delete party", async () => {
    await seed();
    await assertFails(deleteDoc(ref(as(PLAYER))));
  }],
  ["stranger can join with the correct invite code", async () => {
    await seed();
    await assertSucceeds(updateDoc(ref(as(STRANGER)), memberPath(STRANGER), joinEntry()));
    const snap = await getDoc(ref(as(STRANGER)));
    if (snap.data().party.members[STRANGER]?.role !== "player") {
      throw new Error("joined member entry missing");
    }
  }],
  ["join fails with a wrong invite code", async () => {
    await seed();
    await assertFails(updateDoc(ref(as(STRANGER)), memberPath(STRANGER), joinEntry("wrongcodewrongcode")));
  }],
  ["join fails when the party has no invite code", async () => {
    const { inviteCode: _omit, ...withoutInvite } = party().party;
    await seed({ ...party(), party: withoutInvite });
    await assertFails(updateDoc(ref(as(STRANGER)), memberPath(STRANGER), joinEntry()));
  }],
  ["join cannot claim gm role", async () => {
    await seed();
    await assertFails(updateDoc(ref(as(STRANGER)), memberPath(STRANGER), { ...joinEntry(), role: "gm" }));
  }],
  ["join cannot add a different uid", async () => {
    await seed();
    await assertFails(updateDoc(ref(as(STRANGER)), memberPath("uid-other"), joinEntry()));
  }],
  ["join cannot add a second member in the same write", async () => {
    await seed();
    await assertFails(updateDoc(
      ref(as(STRANGER)),
      memberPath(STRANGER), joinEntry(),
      memberPath("uid-other"), joinEntry(),
    ));
  }],
  ["join cannot touch other fields", async () => {
    await seed();
    await assertFails(updateDoc(
      ref(as(STRANGER)),
      memberPath(STRANGER), joinEntry(),
      new FieldPath("party", "displayName"), "Hijacked",
    ));
    await assertFails(updateDoc(
      ref(as(STRANGER)),
      memberPath(STRANGER), joinEntry(),
      new FieldPath("appState", "entities"), [{ id: "entity-1", name: "Smuggled" }],
    ));
  }],
  ["join via full-document write may not alter anything else", async () => {
    await seed();
    const identical = party();
    identical.party.members[STRANGER] = joinEntry();
    await assertSucceeds(setDoc(ref(as(STRANGER)), identical));
    await seed();
    const tampered = party({ displayName: "Hijacked" });
    tampered.party.members[STRANGER] = joinEntry();
    await assertFails(setDoc(ref(as(STRANGER)), tampered));
    await seed();
    const smuggled = party();
    smuggled.party.members[STRANGER] = joinEntry();
    smuggled.appState.entities = { "entity-1": { id: "entity-1", name: "Smuggled" } };
    await assertFails(setDoc(ref(as(STRANGER)), smuggled));
  }],
  ["existing member cannot re-join to change role", async () => {
    await seed();
    await assertFails(updateDoc(ref(as(PLAYER)), memberPath(PLAYER), joinEntry()));
  }],
  ["unauthenticated user cannot join", async () => {
    await seed();
    await assertFails(updateDoc(ref(anon()), memberPath("uid-x"), joinEntry()));
  }],
  ["subcollection paths are denied", async () => {
    await seed();
    const sub = doc(as(GM).firestore(), "parties", "party-1", "secrets", "x");
    await assertFails(setDoc(sub, { a: 1 }));
    await assertFails(getDoc(sub));
  }],
  ["v2 player field update on one entity succeeds", async () => {
    await seed();
    await assertSucceeds(updateDoc(
      ref(as(PLAYER)),
      new FieldPath("appState", "entities", "entity-1"),
      { id: "entity-1", name: "Fighter", sortOrder: 0 },
    ));
  }],
  ["v2 player field delete on one inventory record succeeds", async () => {
    const seeded = party();
    seeded.appState.inventoryRecords["record-1"] = {
      id: "record-1",
      entityId: "entity-1",
      name: "Rope",
      sortOrder: 0,
    };
    await seed(seeded);
    await assertSucceeds(updateDoc(
      ref(as(PLAYER)),
      new FieldPath("appState", "inventoryRecords", "record-1"),
      deleteField(),
    ));
  }],
  ["v2 player arrayUnion on the audit log succeeds", async () => {
    await seed();
    await assertSucceeds(updateDoc(
      ref(as(PLAYER)),
      new FieldPath("appState", "auditLog"),
      arrayUnion({ id: "audit-1", summary: "Moved rope" }),
    ));
  }],
  ["v2 player field update on their own user profile succeeds", async () => {
    await seed();
    await assertSucceeds(updateDoc(
      ref(as(PLAYER)),
      new FieldPath("userProfiles", PLAYER),
      { id: PLAYER, displayName: "Player", role: "Player" },
    ));
  }],
  ["v2 player field updates on protected party fields fail", async () => {
    await seed();
    await assertFails(updateDoc(
      ref(as(PLAYER)),
      new FieldPath("party", "displayName"),
      "Hijacked",
    ));
    await assertFails(updateDoc(
      ref(as(PLAYER)),
      new FieldPath("party", "inviteCode"),
      "new-invite-code",
    ));
    await assertFails(updateDoc(
      ref(as(PLAYER)),
      new FieldPath("party", "members", STRANGER),
      { role: "player" },
    ));
    await assertFails(updateDoc(
      ref(as(PLAYER)),
      new FieldPath("party", "gmUid"),
      PLAYER,
    ));
  }],
  ["v2 GM field updates on members and invite code succeed", async () => {
    await seed();
    await assertSucceeds(updateDoc(
      ref(as(GM)),
      new FieldPath("party", "members", STRANGER),
      { role: "player" },
      new FieldPath("party", "inviteCode"),
      "new-invite-code",
    ));
  }],
  ["legacy player shape-only upgrade succeeds but rename fails", async () => {
    await seed(legacyParty());
    await assertSucceeds(setDoc(ref(as(PLAYER)), party()));
    await seed(legacyParty());
    await assertFails(setDoc(ref(as(PLAYER)), party({ displayName: "Changed" })));
  }],
  ["invite join still succeeds against a v2 party", async () => {
    await seed();
    await assertSucceeds(updateDoc(
      ref(as(STRANGER)),
      memberPath(STRANGER),
      joinEntry(),
    ));
  }],
];

let failed = 0;
for (const [name, run] of cases) {
  try {
    await run();
    console.log(`ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL ${name}\n     ${error?.message ?? error}`);
  }
}

await env.cleanup();
console.log(`\n${cases.length - failed}/${cases.length} rules cases passed`);
process.exit(failed === 0 ? 0 : 1);

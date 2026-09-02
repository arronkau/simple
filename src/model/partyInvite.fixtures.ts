import { createPartyState, parsePartyState } from "./appState";
import {
  buildInviteUrl,
  createJoinMemberEntry,
  ensurePartyInviteCode,
  getInviteCodeFromSearch,
  isValidInviteCode,
} from "./partyInvite";

const gmParty = createPartyState({
  partyId: "party-1",
  gmUid: "uid-gm",
  members: { "uid-gm": { role: "gm" } },
});

export const PARTY_INVITE_MANUAL_FIXTURES = [
  {
    name: "buildInviteUrl appends the invite query param",
    actual: buildInviteUrl("https://example.test", "party-1", "abc12345"),
    expected: "https://example.test/party/party-1?invite=abc12345",
  },
  {
    name: "getInviteCodeFromSearch reads a valid code",
    actual: getInviteCodeFromSearch("?invite=abcdefgh12"),
    expected: "abcdefgh12",
  },
  {
    name: "getInviteCodeFromSearch ignores a missing param",
    actual: getInviteCodeFromSearch("?other=1") ?? null,
    expected: null,
  },
  {
    name: "getInviteCodeFromSearch rejects malformed codes",
    actual: getInviteCodeFromSearch("?invite=ABC%20!!") ?? null,
    expected: null,
  },
  {
    name: "isValidInviteCode rejects short and uppercase values",
    actual: [isValidInviteCode("abc"), isValidInviteCode("ABCDEFGHIJ"), isValidInviteCode(42)],
    expected: [false, false, false],
  },
  {
    name: "createJoinMemberEntry is a player carrying the invite code",
    actual: createJoinMemberEntry("abcdefgh12", "2026-09-01T00:00:00.000Z"),
    expected: { role: "player", joinedAt: "2026-09-01T00:00:00.000Z", inviteCode: "abcdefgh12" },
  },
  {
    name: "ensurePartyInviteCode adds a code for the GM",
    actual: ensurePartyInviteCode(gmParty, "uid-gm", () => "generatedcode").party,
    expected: {
      id: "party-1",
      displayName: "New Party",
      gmUid: "uid-gm",
      members: { "uid-gm": { role: "gm" } },
      inviteCode: "generatedcode",
    },
  },
  {
    name: "ensurePartyInviteCode leaves non-GM clients alone",
    actual: ensurePartyInviteCode(gmParty, "uid-player", () => "generatedcode").party,
    expected: gmParty.party,
  },
  {
    name: "ensurePartyInviteCode keeps an existing code",
    actual: ensurePartyInviteCode(
      createPartyState({ partyId: "party-1", gmUid: "uid-gm", inviteCode: "existingcode" }),
      "uid-gm",
      () => "generatedcode",
    ).party.inviteCode,
    expected: "existingcode",
  },
  {
    name: "ensurePartyInviteCode does nothing without a GM",
    actual: ensurePartyInviteCode(createPartyState({ partyId: "party-1" }), "uid-gm", () => "x").party,
    expected: { id: "party-1", displayName: "New Party" },
  },
  {
    name: "parsePartyState round-trips inviteCode on party and member",
    actual: parsePartyState(
      JSON.parse(
        JSON.stringify(
          createPartyState({
            partyId: "party-1",
            gmUid: "uid-gm",
            inviteCode: "abcdefgh12",
            members: { "uid-p": { role: "player", inviteCode: "abcdefgh12" } },
          }),
        ),
      ),
    )?.party,
    expected: {
      id: "party-1",
      displayName: "New Party",
      gmUid: "uid-gm",
      members: { "uid-p": { role: "player", inviteCode: "abcdefgh12" } },
      inviteCode: "abcdefgh12",
    },
  },
];

import type { PartyState } from "./appState";
import type { ISODateTimeString, PartyMember } from "./types";

export const INVITE_QUERY_PARAM = "invite";

const INVITE_CODE_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const INVITE_CODE_LENGTH = 20;

/** ~103 bits of entropy from a URL-safe lowercase alphabet. */
export function createInviteCode(): string {
  const bytes = new Uint8Array(INVITE_CODE_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  let code = "";
  for (const byte of bytes) {
    code += INVITE_CODE_ALPHABET[byte % INVITE_CODE_ALPHABET.length];
  }
  return code;
}

export function isValidInviteCode(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 8 &&
    value.length <= 64 &&
    /^[a-z0-9]+$/.test(value)
  );
}

export function buildInviteUrl(
  origin: string,
  partyId: string,
  inviteCode: string,
): string {
  return `${origin}/party/${partyId}?${INVITE_QUERY_PARAM}=${inviteCode}`;
}

/** Reads the invite code from a location search string, e.g. "?invite=abc". */
export function getInviteCodeFromSearch(search: string): string | undefined {
  const value = new URLSearchParams(search).get(INVITE_QUERY_PARAM);
  return isValidInviteCode(value) ? value : undefined;
}

/** The member entry a joining player writes for themselves. */
export function createJoinMemberEntry(
  inviteCode: string,
  joinedAt: ISODateTimeString,
): PartyMember {
  return { role: "player", joinedAt, inviteCode };
}

/**
 * GM clients add an invite code to parties that predate invites. Non-GM
 * clients never touch it (rules reject the write).
 */
export function ensurePartyInviteCode(
  partyState: PartyState,
  currentUid: string | undefined,
  generateCode: () => string = createInviteCode,
): PartyState {
  const { gmUid, inviteCode } = partyState.party;

  if (inviteCode !== undefined || !gmUid || gmUid !== currentUid) {
    return partyState;
  }

  return {
    ...partyState,
    party: { ...partyState.party, inviteCode: generateCode() },
  };
}

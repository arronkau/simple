import {
  canPerformEntityAction,
  canPerformInventoryAction,
  canPerformPartyAction,
  getProtectedInventoryFieldViolations,
  resolvePartyRole,
} from "./permissions";
import type { PartyMembers } from "./types";

const gmMembers: PartyMembers = {
  "uid-gm": { role: "gm", joinedAt: "2026-01-01T00:00:00.000Z" },
  "uid-player": { role: "player", joinedAt: "2026-01-02T00:00:00.000Z" },
};

export const PERMISSIONS_MANUAL_FIXTURES = [
  // --- Party actions ---
  {
    name: "GM can read party",
    actual: canPerformPartyAction("gm", "readParty"),
    expected: true,
  },
  {
    name: "GM can edit party settings",
    actual: canPerformPartyAction("gm", "editPartySettings"),
    expected: true,
  },
  {
    name: "GM can manage membership",
    actual: canPerformPartyAction("gm", "manageMembership"),
    expected: true,
  },
  {
    name: "GM can import party",
    actual: canPerformPartyAction("gm", "importParty"),
    expected: true,
  },
  {
    name: "GM can export party",
    actual: canPerformPartyAction("gm", "exportParty"),
    expected: true,
  },
  {
    name: "GM can clear audit log",
    actual: canPerformPartyAction("gm", "clearAuditLog"),
    expected: true,
  },
  {
    name: "player can read party",
    actual: canPerformPartyAction("player", "readParty"),
    expected: true,
  },
  {
    name: "player cannot edit party settings",
    actual: canPerformPartyAction("player", "editPartySettings"),
    expected: false,
  },
  {
    name: "player cannot delete party",
    actual: canPerformPartyAction("player", "deleteParty"),
    expected: false,
  },
  {
    name: "player cannot manage membership",
    actual: canPerformPartyAction("player", "manageMembership"),
    expected: false,
  },
  {
    name: "player cannot import party",
    actual: canPerformPartyAction("player", "importParty"),
    expected: false,
  },
  {
    name: "player can export party",
    actual: canPerformPartyAction("player", "exportParty"),
    expected: true,
  },
  {
    name: "player cannot clear audit log",
    actual: canPerformPartyAction("player", "clearAuditLog"),
    expected: false,
  },

  // --- Entity actions ---
  {
    name: "GM can create entity",
    actual: canPerformEntityAction("gm", "createEntity"),
    expected: true,
  },
  {
    name: "GM can edit entity",
    actual: canPerformEntityAction("gm", "editEntity"),
    expected: true,
  },
  {
    name: "GM can delete entity",
    actual: canPerformEntityAction("gm", "deleteEntity"),
    expected: true,
  },
  {
    name: "GM can view GM entity fields",
    actual: canPerformEntityAction("gm", "viewGmEntityFields"),
    expected: true,
  },
  {
    name: "player can create entity",
    actual: canPerformEntityAction("player", "createEntity"),
    expected: true,
  },
  {
    name: "player can edit entity",
    actual: canPerformEntityAction("player", "editEntity"),
    expected: true,
  },
  {
    name: "player can delete entity",
    actual: canPerformEntityAction("player", "deleteEntity"),
    expected: true,
  },
  {
    name: "player cannot view GM entity fields",
    actual: canPerformEntityAction("player", "viewGmEntityFields"),
    expected: false,
  },
  {
    name: "player cannot edit GM entity fields",
    actual: canPerformEntityAction("player", "editGmEntityFields"),
    expected: false,
  },

  // --- Inventory actions ---
  {
    name: "GM can add item",
    actual: canPerformInventoryAction("gm", "addItem"),
    expected: true,
  },
  {
    name: "GM can edit item",
    actual: canPerformInventoryAction("gm", "editItem"),
    expected: true,
  },
  {
    name: "GM can edit coins",
    actual: canPerformInventoryAction("gm", "editCoins"),
    expected: true,
  },
  {
    name: "GM can identify item",
    actual: canPerformInventoryAction("gm", "identifyItem"),
    expected: true,
  },
  {
    name: "GM can view unidentified GM fields",
    actual: canPerformInventoryAction("gm", "viewUnidentifiedGmFields"),
    expected: true,
  },
  {
    name: "GM can edit unidentified GM fields",
    actual: canPerformInventoryAction("gm", "editUnidentifiedGmFields"),
    expected: true,
  },
  {
    name: "player can add item",
    actual: canPerformInventoryAction("player", "addItem"),
    expected: true,
  },
  {
    name: "player can edit item",
    actual: canPerformInventoryAction("player", "editItem"),
    expected: true,
  },
  {
    name: "player can move item",
    actual: canPerformInventoryAction("player", "moveItem"),
    expected: true,
  },
  {
    name: "player can reorder item",
    actual: canPerformInventoryAction("player", "reorderItem"),
    expected: true,
  },
  {
    name: "player can delete item",
    actual: canPerformInventoryAction("player", "deleteItem"),
    expected: true,
  },
  {
    name: "player can edit coins",
    actual: canPerformInventoryAction("player", "editCoins"),
    expected: true,
  },
  {
    name: "player cannot identify item",
    actual: canPerformInventoryAction("player", "identifyItem"),
    expected: false,
  },
  {
    name: "player cannot view unidentified GM fields",
    actual: canPerformInventoryAction("player", "viewUnidentifiedGmFields"),
    expected: false,
  },
  {
    name: "player cannot edit unidentified GM fields",
    actual: canPerformInventoryAction("player", "editUnidentifiedGmFields"),
    expected: false,
  },

  // --- Protected field detection ---
  {
    name: "getProtectedInventoryFieldViolations finds secretName",
    actual: getProtectedInventoryFieldViolations({
      recordType: "weapon",
      identification: { identified: false, secretName: "Vorpal Sword" },
    } as Parameters<typeof getProtectedInventoryFieldViolations>[0]),
    expected: ["identification.secretName"],
  },
  {
    name: "getProtectedInventoryFieldViolations finds secretDescription",
    actual: getProtectedInventoryFieldViolations({
      recordType: "armor",
      identification: {
        identified: false,
        secretDescription: "Cursed armor",
      },
    } as Parameters<typeof getProtectedInventoryFieldViolations>[0]),
    expected: ["identification.secretDescription"],
  },
  {
    name: "getProtectedInventoryFieldViolations finds both GM fields",
    actual: getProtectedInventoryFieldViolations({
      recordType: "equipment",
      identification: {
        identified: false,
        secretName: "Ring of Power",
        secretDescription: "One ring to rule them all",
      },
    } as Parameters<typeof getProtectedInventoryFieldViolations>[0]),
    expected: [
      "identification.secretName",
      "identification.secretDescription",
    ],
  },
  {
    name: "getProtectedInventoryFieldViolations safe for quantity patch",
    actual: getProtectedInventoryFieldViolations({
      recordType: "weapon",
      quantity: 2,
    } as Parameters<typeof getProtectedInventoryFieldViolations>[0]),
    expected: [],
  },
  {
    name: "getProtectedInventoryFieldViolations safe for identified-only patch",
    actual: getProtectedInventoryFieldViolations({
      recordType: "weapon",
      identification: { identified: true },
    } as Parameters<typeof getProtectedInventoryFieldViolations>[0]),
    expected: [],
  },
  {
    name: "getProtectedInventoryFieldViolations safe for no identification patch",
    actual: getProtectedInventoryFieldViolations({
      recordType: "equipment",
    } as Parameters<typeof getProtectedInventoryFieldViolations>[0]),
    expected: [],
  },

  // --- Role resolution ---
  {
    name: "resolvePartyRole returns gm for gmUid match",
    actual: resolvePartyRole("uid-gm", "uid-gm", gmMembers),
    expected: "gm",
  },
  {
    name: "resolvePartyRole returns player for member",
    actual: resolvePartyRole("uid-player", "uid-gm", gmMembers),
    expected: "player",
  },
  {
    name: "resolvePartyRole returns null for non-member",
    actual: resolvePartyRole("uid-stranger", "uid-gm", gmMembers),
    expected: null,
  },
  {
    name: "resolvePartyRole returns null for undefined uid",
    actual: resolvePartyRole(undefined, "uid-gm", gmMembers),
    expected: null,
  },
  {
    name: "resolvePartyRole returns null when gmUid undefined (unmigrated party)",
    actual: resolvePartyRole("uid-gm", undefined, gmMembers),
    expected: null,
  },
  {
    name: "resolvePartyRole returns null when members undefined (unmigrated party)",
    actual: resolvePartyRole("uid-gm", "uid-gm", undefined),
    expected: null,
  },
  {
    name: "resolvePartyRole does not assume anonymous-auth — any uid string is valid",
    actual: resolvePartyRole(
      "permanent-uid-after-account-linking",
      "permanent-uid-after-account-linking",
      { "permanent-uid-after-account-linking": { role: "gm" } },
    ),
    expected: "gm",
  },
];

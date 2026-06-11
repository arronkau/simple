import type { InventoryRecord, PartyMembers, PartyRole } from "./types";

export type { PartyRole };

export type PermissionContext = {
  uid: string;
  role: PartyRole;
};

export type PartyAction =
  | "readParty"
  | "editPartySettings"
  | "deleteParty"
  | "manageMembership"
  | "importParty"
  | "exportParty"
  | "clearAuditLog";

export type EntityAction =
  | "createEntity"
  | "editEntity"
  | "deleteEntity"
  | "changeEntityType"
  | "viewGmEntityFields"
  | "editGmEntityFields";

export type InventoryAction =
  | "addItem"
  | "editItem"
  | "moveItem"
  | "reorderItem"
  | "deleteItem"
  | "editCoins"
  | "viewUnidentifiedGmFields"
  | "editUnidentifiedGmFields"
  | "identifyItem";

export class PermissionError extends Error {
  readonly code:
    | "not-authenticated"
    | "not-party-member"
    | "gm-only"
    | "protected-field"
    | "invalid-membership-update";

  constructor(
    message: string,
    code: PermissionError["code"],
  ) {
    super(message);
    this.name = "PermissionError";
    this.code = code;
  }
}

const GM_ONLY_PARTY_ACTIONS: Set<PartyAction> = new Set([
  "editPartySettings",
  "deleteParty",
  "manageMembership",
  "importParty",
  "clearAuditLog",
]);

const GM_ONLY_ENTITY_ACTIONS: Set<EntityAction> = new Set([
  "viewGmEntityFields",
  "editGmEntityFields",
]);

const GM_ONLY_INVENTORY_ACTIONS: Set<InventoryAction> = new Set([
  "viewUnidentifiedGmFields",
  "editUnidentifiedGmFields",
  "identifyItem",
]);

export function canPerformPartyAction(
  role: PartyRole,
  action: PartyAction,
): boolean {
  if (role === "gm") return true;
  return !GM_ONLY_PARTY_ACTIONS.has(action);
}

export function canPerformEntityAction(
  role: PartyRole,
  action: EntityAction,
): boolean {
  if (role === "gm") return true;
  return !GM_ONLY_ENTITY_ACTIONS.has(action);
}

export function canPerformInventoryAction(
  role: PartyRole,
  action: InventoryAction,
): boolean {
  if (role === "gm") return true;
  return !GM_ONLY_INVENTORY_ACTIONS.has(action);
}

export function assertPartyAction(role: PartyRole, action: PartyAction): void {
  if (!canPerformPartyAction(role, action)) {
    throw new PermissionError(
      `Players cannot perform: ${action}.`,
      "gm-only",
    );
  }
}

export function assertEntityAction(
  role: PartyRole,
  action: EntityAction,
): void {
  if (!canPerformEntityAction(role, action)) {
    throw new PermissionError(
      `Players cannot perform: ${action}.`,
      "gm-only",
    );
  }
}

export function assertInventoryAction(
  role: PartyRole,
  action: InventoryAction,
): void {
  if (!canPerformInventoryAction(role, action)) {
    throw new PermissionError(
      `Players cannot perform: ${action}.`,
      "gm-only",
    );
  }
}

/**
 * Returns the names of GM-only identification fields present in an inventory record patch.
 * A non-empty result means a player is attempting a protected-field write.
 */
export function getProtectedInventoryFieldViolations(
  patch: Partial<InventoryRecord>,
): string[] {
  const violations: string[] = [];
  const identification = (patch as { identification?: unknown }).identification;
  if (identification !== null && typeof identification === "object") {
    const id = identification as Record<string, unknown>;
    if ("secretName" in id) violations.push("identification.secretName");
    if ("secretDescription" in id)
      violations.push("identification.secretDescription");
  }
  return violations;
}

/**
 * Resolves a user's party role from membership data.
 * Returns null if the user is not authenticated or not a party member.
 */
export function resolvePartyRole(
  uid: string | undefined,
  gmUid: string | undefined,
  members: PartyMembers | undefined,
): PartyRole | null {
  if (!uid) return null;
  if (!gmUid || !members) return null;
  if (uid === gmUid) return "gm";
  const member = members[uid];
  if (!member) return null;
  return member.role;
}

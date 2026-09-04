import { createContext, useContext } from "react";
import { getVisibleInventoryRecord } from "../model/recordVisibility";
import type { InventoryRecord, PartyRole } from "../model/types";

/**
 * The party role of whoever is looking at the screen, provided once by the app
 * shell. Default `null` (unknown) fails closed: only a confirmed "gm" sees
 * unidentified detail and GM notes.
 */
export const ViewerRoleContext = createContext<PartyRole | null>(null);

export function useViewerRole(): PartyRole | null {
  return useContext(ViewerRoleContext);
}

/**
 * The record as this viewer may see it. Use at display boundaries only —
 * derived calculations (AC, encumbrance, light burn) keep using full records.
 */
export function useVisibleRecord(record: InventoryRecord): InventoryRecord {
  return getVisibleInventoryRecord(record, useContext(ViewerRoleContext));
}

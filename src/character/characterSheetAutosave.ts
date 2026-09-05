import { normalizeCharacterData } from "../model/characters";
import type { CharacterData, EntityId, EntityType } from "../model/types";

/**
 * Autosave rules for the inline character-sheet editor. The editor has no
 * Save button: every change reaches the store on its own, so the decisions
 * about *when* a change is committed, whether it is worth committing, and what
 * the status line says live here as pure functions.
 */

/** How long a typed edit waits after the last keystroke before it commits. */
export const SHEET_AUTOSAVE_DEBOUNCE_MS = 400;

/**
 * What produced an edit. Typed values wait for a pause so a save is not fired
 * per keystroke; discrete controls (selects, checkboxes, steppers, add/remove
 * of repeatable rows) commit at once because there is nothing more to type.
 */
export type SheetEditKind = "text" | "number" | "choice" | "structure";

export type SheetCommitSchedule =
  | { mode: "immediate" }
  | { mode: "debounced"; delayMs: number };

export function getSheetCommitSchedule(
  kind: SheetEditKind,
): SheetCommitSchedule {
  if (kind === "text" || kind === "number") {
    return { mode: "debounced", delayMs: SHEET_AUTOSAVE_DEBOUNCE_MS };
  }

  return { mode: "immediate" };
}

export type SheetSaveState =
  | { phase: "idle" }
  | { phase: "saving" }
  | { phase: "saved" }
  | { phase: "error"; message: string };

/** `tone` maps onto the existing form message classes in the editor. */
export type SheetSaveStatus = {
  tone: "muted" | "success" | "error";
  text: string;
};

export function getSheetSaveStatus(
  saveState: SheetSaveState,
): SheetSaveStatus | undefined {
  switch (saveState.phase) {
    case "saving":
      return { tone: "muted", text: "Saving…" };
    case "saved":
      return { tone: "success", text: "Saved" };
    case "error":
      return { tone: "error", text: `Couldn't save: ${saveState.message}` };
    default:
      return undefined;
  }
}

/**
 * A draft only reaches the store when it would actually change stored data,
 * so re-typing the same value or adding a still-empty repeatable row does not
 * produce a write. The stored side is normalized because that is the shape
 * `updateCharacterData` writes back after a successful save.
 */
export function isCharacterDataDirty(
  draftCharacterData: CharacterData,
  storedCharacterData: unknown,
): boolean {
  return (
    JSON.stringify(draftCharacterData) !==
    JSON.stringify(normalizeCharacterData(storedCharacterData))
  );
}

export type EntityDraft = {
  name: string;
  entityType: EntityType;
};

/**
 * Mirrors `applyEntityUpdate`: a blank name is never written, so clearing the
 * name field is not a change worth sending (the typed draft still stays on
 * screen).
 */
export function isEntityDraftDirty(
  draft: EntityDraft,
  entity: EntityDraft,
): boolean {
  const nextName = draft.name.trim();

  return (
    (nextName.length > 0 && nextName !== entity.name) ||
    draft.entityType !== entity.entityType
  );
}

/**
 * The editor seeds its draft once per entity — when it opens, and again only
 * if the entity it is editing changes. Remote updates that land while the
 * editor is open are deliberately NOT merged into the draft, so a field being
 * typed in can never be overwritten mid-keystroke.
 *
 * Limitation: while the editor is open, a remote edit to this same sheet is
 * not shown, and the next local commit writes the whole sheet and so
 * overwrites it. Closing and reopening the editor re-seeds from the store.
 */
export function shouldReseedSheetDraft(
  seededEntityId: EntityId | undefined,
  entityId: EntityId,
): boolean {
  return seededEntityId !== entityId;
}

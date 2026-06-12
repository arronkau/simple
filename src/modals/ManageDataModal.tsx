import { type ChangeEvent, useState } from "react";
import {
  parseAppState,
  parseAppStateResult,
  type ParseResult,
  type PartyId,
} from "../model/appState";
import type { AppState } from "../model/appState";
import type { PartyRole } from "../model/types";
import type { AppStateExport, ManageMessage } from "../view-types";

export function ManageDataModal({
  appState,
  currentUserPartyRole,
  partyDisplayName,
  partyId,
  onClose,
  onImportAppState,
  onRenameParty,
  onReset,
}: {
  appState: AppState;
  currentUserPartyRole: PartyRole | null;
  partyDisplayName: string;
  partyId: PartyId;
  onClose: () => void;
  onImportAppState: (appState: AppState) => void;
  onRenameParty: (displayName: string) => void;
  onReset: () => void;
}) {
  const [importMessage, setImportMessage] = useState<ManageMessage | undefined>();
  const [pendingImportAppState, setPendingImportAppState] = useState<
    AppState | undefined
  >();
  const [importConfirmation, setImportConfirmation] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [editingPartyName, setEditingPartyName] = useState(partyDisplayName);
  const [urlCopied, setUrlCopied] = useState(false);
  const isGm = currentUserPartyRole === "gm";
  const importEnabled =
    isGm && pendingImportAppState !== undefined && importConfirmation === "import";
  const resetEnabled = isGm && resetConfirmation === "delete";
  const partyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/party/${partyId}`
      : `/party/${partyId}`;

  function exportAppData() {
    const exportData: AppStateExport = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: appState,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `simple-export-${formatExportDate(new Date())}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function importAppData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    let parsedValue: unknown;

    try {
      parsedValue = JSON.parse(await file.text());
    } catch (error) {
      setPendingImportAppState(undefined);
      setImportConfirmation("");
      setImportMessage({
        tone: "error",
        text: formatJsonImportParseError(error),
      });
      return;
    }

    let importResult: ParseResult<AppState>;

    try {
      importResult = parseImportedAppStateResult(parsedValue);
    } catch (error) {
      console.error("Import app-state validation failed", error);
      setPendingImportAppState(undefined);
      setImportConfirmation("");
      setImportMessage({
        tone: "error",
        text:
          "Import failed. The file is valid JSON, but the app state could not be imported.",
      });
      return;
    }

    if (!importResult.ok) {
      setPendingImportAppState(undefined);
      setImportConfirmation("");
      setImportMessage({
        tone: "error",
        text: formatImportValidationError(importResult),
      });
      return;
    }

    setPendingImportAppState(importResult.value);
    setImportConfirmation("");
    setImportMessage({
      tone: "success",
      text: "Import file is valid. Type import to replace current data.",
    });
  }

  async function copyPartyUrl() {
    try {
      await navigator.clipboard.writeText(partyUrl);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 1600);
    } catch {
      // Clipboard can be unavailable (permissions, non-secure context);
      // the focused input still allows manual copy.
    }
  }

  function confirmImport() {
    if (!pendingImportAppState || !importEnabled) {
      return;
    }

    onImportAppState(pendingImportAppState);
    setPendingImportAppState(undefined);
    setImportConfirmation("");
    setImportMessage({ tone: "success", text: "Import complete." });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-label="Manage party"
        aria-modal="true"
        className="modal-panel manage-modal"
        role="dialog"
      >
        <div className="modal-header">
          <h2>Manage Party</h2>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-body">
          <section className="manage-section">
            <h5>Party</h5>
            {isGm && (
              <div className="manage-row">
                <label className="manage-grow">
                  <span>Party name</span>
                  <input
                    value={editingPartyName}
                    onChange={(event) => setEditingPartyName(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => onRenameParty(editingPartyName)}
                >
                  Save
                </button>
              </div>
            )}
            <div className="manage-row">
              <label className="manage-grow">
                <span>Party URL — share to invite</span>
                <input readOnly value={partyUrl} onFocus={(event) => event.target.select()} />
              </label>
              <button type="button" onClick={copyPartyUrl}>
                {urlCopied ? "Copied" : "Copy"}
              </button>
            </div>
            {isGm && (
              <p className="field-help">
                GM access is tied to this browser session. Clearing browser data
                or switching devices can lose it until account linking is added.
              </p>
            )}
          </section>

          {isGm ? (
            <section className="manage-section">
              <h5>Data</h5>
              <div className="manage-row">
                <button type="button" onClick={exportAppData}>
                  Export JSON
                </button>
                <label className="file-button">
                  <span>Import JSON…</span>
                  <input
                    accept="application/json,.json"
                    type="file"
                    onChange={importAppData}
                  />
                </label>
              </div>
              <p className="field-help">
                Import replaces everything in this party. Export a backup first.
              </p>
              {pendingImportAppState ? (
                <div className="manage-row">
                  <label className="manage-grow">
                    <span>Type “import” to confirm</span>
                    <input
                      autoComplete="off"
                      value={importConfirmation}
                      onChange={(event) =>
                        setImportConfirmation(event.target.value)
                      }
                    />
                  </label>
                  <button
                    className="danger-button"
                    disabled={!importEnabled}
                    type="button"
                    onClick={confirmImport}
                  >
                    Replace data
                  </button>
                </div>
              ) : null}
              {importMessage ? (
                <p
                  className={
                    importMessage.tone === "error"
                      ? "form-error"
                      : "form-success"
                  }
                >
                  {importMessage.text}
                </p>
              ) : null}
            </section>
          ) : null}

          {isGm ? (
            <section className="manage-section danger-section">
              <h5>Danger</h5>
              <div className="manage-row">
                <label className="manage-grow">
                  <span>Type “delete” to reset all party data</span>
                  <input
                    autoComplete="off"
                    value={resetConfirmation}
                    onChange={(event) => setResetConfirmation(event.target.value)}
                  />
                </label>
                <button
                  className="danger-button"
                  disabled={!resetEnabled}
                  type="button"
                  onClick={onReset}
                >
                  Reset data
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </div>
  );
}

// ---- Import / export utilities (also used by tests) ----

export function parseImportedAppState(value: unknown): AppState | undefined {
  const result = parseImportedAppStateResult(value);

  return result.ok ? result.value : undefined;
}

export function parseImportedAppStateResult(
  value: unknown,
): ParseResult<AppState> {
  const directAppState = parseAppStateResult(value);

  if (directAppState.ok) {
    return directAppState;
  }

  if (!value || typeof value !== "object") {
    return {
      ok: false,
      message: "Expected app export object.",
    };
  }

  const candidateExport = value as Partial<AppStateExport>;

  if (!("data" in candidateExport)) {
    return {
      ok: false,
      path: "data",
      message: 'Missing top-level "data" object.',
    };
  }

  if (candidateExport.version !== 1) {
    return {
      ok: false,
      path: "version",
      message:
        candidateExport.version === undefined
          ? "Missing top-level export version."
          : `Unsupported export version: ${String(candidateExport.version)}.`,
    };
  }

  if (typeof candidateExport.exportedAt !== "string") {
    return {
      ok: false,
      path: "exportedAt",
      message: 'Missing top-level "exportedAt" timestamp.',
    };
  }

  if (!candidateExport.data || typeof candidateExport.data !== "object") {
    return {
      ok: false,
      path: "data",
      message: 'Missing top-level "data" object.',
    };
  }

  return parseAppStateResult(candidateExport.data);
}

function formatJsonImportParseError(error: unknown): string {
  const detail =
    error instanceof Error && error.message.length <= 160
      ? ` JSON parse error: ${error.message}.`
      : "";

  return `Import failed. The selected file is not valid JSON.${detail}`;
}

function formatImportValidationError(
  result: Extract<ParseResult<AppState>, { ok: false }>,
): string {
  return `Import failed. ${result.path ? `${result.path}: ` : ""}${result.message}`;
}

function formatExportDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

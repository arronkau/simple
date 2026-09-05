import { type ChangeEvent, useState } from "react";
import {
  parseAppState,
  parseAppStateResult,
  type ParseResult,
  type PartyId,
} from "../model/appState";
import type { AppState } from "../model/appState";
import { AUDIT_LOG_MAX_ENTRIES } from "../model/auditLog";
import { buildInviteUrl } from "../model/partyInvite";
import type { PartyRole } from "../model/types";
import type { FirebaseAuthAccount } from "../persistence/firebaseSync";
import type { PersistenceMode } from "../persistence/types";
import type {
  AccountActionResult,
  PartyActionResult,
} from "../store/useAppStore";
import type { AppStateExport, ManageMessage } from "../view-types";

export function ManageDataModal({
  appState,
  authAccount,
  currentUserPartyRole,
  inviteCode,
  partyDisplayName,
  partyId,
  persistenceMode,
  onClearAuditLog,
  onClose,
  onImportAppState,
  onRegenerateInviteCode,
  onRenameParty,
  onReset,
  onSignInWithGoogle,
  onSignOut,
}: {
  appState: AppState;
  authAccount?: FirebaseAuthAccount;
  currentUserPartyRole: PartyRole | null;
  inviteCode?: string;
  partyDisplayName: string;
  partyId: PartyId;
  persistenceMode: PersistenceMode;
  onClearAuditLog: () => PartyActionResult;
  onClose: () => void;
  onImportAppState: (appState: AppState) => void;
  onRegenerateInviteCode: () => void;
  onRenameParty: (displayName: string) => void;
  onReset: () => void;
  onSignInWithGoogle: () => Promise<AccountActionResult>;
  onSignOut: () => Promise<AccountActionResult>;
}) {
  const [importMessage, setImportMessage] = useState<ManageMessage | undefined>();
  const [pendingImportAppState, setPendingImportAppState] = useState<
    AppState | undefined
  >();
  const [importConfirmation, setImportConfirmation] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [clearAuditConfirmation, setClearAuditConfirmation] = useState("");
  const [auditMessage, setAuditMessage] = useState<ManageMessage | undefined>();
  const [editingPartyName, setEditingPartyName] = useState(partyDisplayName);
  const [copiedField, setCopiedField] = useState<"url" | "invite" | undefined>();
  const [accountMessage, setAccountMessage] = useState<ManageMessage | undefined>();
  const [accountBusy, setAccountBusy] = useState(false);
  const isGm = currentUserPartyRole === "gm";
  const isFirebase = persistenceMode === "firebase";
  const importEnabled =
    isGm && pendingImportAppState !== undefined && importConfirmation === "import";
  const resetEnabled = isGm && resetConfirmation === "delete";
  const clearAuditEnabled = isGm && clearAuditConfirmation === "clear";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const partyUrl = `${origin}/party/${partyId}`;
  const inviteUrl = inviteCode ? buildInviteUrl(origin, partyId, inviteCode) : undefined;

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

  async function copyToClipboard(field: "url" | "invite", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(undefined), 1600);
    } catch {
      // Clipboard can be unavailable (permissions, non-secure context);
      // the focused input still allows manual copy.
    }
  }

  async function runAccountAction(action: () => Promise<AccountActionResult>) {
    setAccountBusy(true);
    setAccountMessage(undefined);
    try {
      const result = await action();
      if (!result.ok) {
        setAccountMessage({ tone: "error", text: result.message });
      }
    } finally {
      setAccountBusy(false);
    }
  }

  function confirmClearAuditLog() {
    if (!clearAuditEnabled) {
      return;
    }

    const result = onClearAuditLog();

    setClearAuditConfirmation("");
    setAuditMessage(
      result.ok
        ? { tone: "success", text: "Audit log cleared." }
        : { tone: "error", text: result.message },
    );
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
                <span>Party URL</span>
                <input readOnly value={partyUrl} onFocus={(event) => event.target.select()} />
              </label>
              <button type="button" onClick={() => copyToClipboard("url", partyUrl)}>
                {copiedField === "url" ? "Copied" : "Copy"}
              </button>
            </div>
            {isGm && inviteUrl ? (
              <>
                <div className="manage-row">
                  <label className="manage-grow">
                    <span>Invite link — share with players</span>
                    <input
                      readOnly
                      value={inviteUrl}
                      onFocus={(event) => event.target.select()}
                    />
                  </label>
                  <button type="button" onClick={() => copyToClipboard("invite", inviteUrl)}>
                    {copiedField === "invite" ? "Copied" : "Copy"}
                  </button>
                  <button type="button" onClick={onRegenerateInviteCode}>
                    New link
                  </button>
                </div>
                <p className="field-help">
                  Anyone who opens the invite link joins as a player. “New link”
                  invalidates the old one; current members keep access.
                </p>
              </>
            ) : null}
            {!isGm && isFirebase ? (
              <p className="field-help">
                New players need an invite link from the GM. The party URL alone
                does not grant access.
              </p>
            ) : null}
          </section>

          {isFirebase ? (
            <section className="manage-section">
              <h5>Account</h5>
              <div className="manage-row">
                <p className="manage-grow">
                  {authAccount && !authAccount.isAnonymous
                    ? `Signed in as ${authAccount.email ?? authAccount.displayName ?? "Google account"}.`
                    : "Anonymous session. Your access lives in this browser only."}
                </p>
                {authAccount && !authAccount.isAnonymous ? (
                  <button
                    disabled={accountBusy}
                    type="button"
                    onClick={() => runAccountAction(onSignOut)}
                  >
                    Sign out
                  </button>
                ) : (
                  <button
                    disabled={accountBusy}
                    type="button"
                    onClick={() => runAccountAction(onSignInWithGoogle)}
                  >
                    Sign in with Google
                  </button>
                )}
              </div>
              {(!authAccount || authAccount.isAnonymous) ? (
                <p className="field-help">
                  {isGm
                    ? "Sign in to keep GM access if you clear browser data or switch devices."
                    : "Sign in to keep your membership across browsers and devices."}
                </p>
              ) : null}
              {accountMessage ? (
                <p className={accountMessage.tone === "error" ? "form-error" : "form-success"}>
                  {accountMessage.text}
                </p>
              ) : null}
            </section>
          ) : null}

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
              <div className="manage-row">
                <label className="manage-grow">
                  <span>Type “clear” to clear the audit log</span>
                  <input
                    autoComplete="off"
                    value={clearAuditConfirmation}
                    onChange={(event) =>
                      setClearAuditConfirmation(event.target.value)
                    }
                  />
                </label>
                <button
                  className="danger-button"
                  disabled={!clearAuditEnabled}
                  type="button"
                  onClick={confirmClearAuditLog}
                >
                  Clear audit log
                </button>
              </div>
              <p className="field-help">
                Deletes every audit entry for everyone in the party. Entities,
                inventory, and coins are untouched. The log trims itself back
                to its newest {AUDIT_LOG_MAX_ENTRIES} entries as it grows.
              </p>
              {auditMessage ? (
                <p
                  className={
                    auditMessage.tone === "error" ? "form-error" : "form-success"
                  }
                >
                  {auditMessage.text}
                </p>
              ) : null}
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

import { Navigate, Route, Routes } from "react-router-dom";
import { APP_STATE_STORAGE_KEY } from "./model/appState";
import { useAppStore } from "./store/useAppStore";

function LocalAppShell() {
  const appState = useAppStore((state) => state.appState);
  const resetLocalState = useAppStore((state) => state.resetLocalState);

  return (
    <main className="app-shell">
      <section className="workspace-panel" aria-labelledby="app-title">
        <div className="app-header">
          <div>
            <p className="eyebrow">Persistence: Local</p>
            <h1 id="app-title">Simple Inventory</h1>
          </div>
          <button type="button" onClick={resetLocalState}>
            Reset local state
          </button>
        </div>

        <dl className="state-summary">
          <div>
            <dt>Schema</dt>
            <dd>v{appState.schemaVersion}</dd>
          </div>
          <div>
            <dt>Entities</dt>
            <dd>{appState.entities.length}</dd>
          </div>
          <div>
            <dt>Inventory records</dt>
            <dd>{appState.inventoryRecords.length}</dd>
          </div>
        </dl>

        <div className="storage-key">
          <span>Storage key</span>
          <code>{APP_STATE_STORAGE_KEY}</code>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LocalAppShell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

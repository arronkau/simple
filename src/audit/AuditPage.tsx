import { AUDIT_EVENT_TYPE_LABELS, getNewestAuditLogEntries } from "../model/auditLog";
import { getSortedEntities } from "../model/entities";
import type { AppState } from "../model/appState";
import type { AuditEventType, AuditLogEntry, EntityId } from "../model/types";
import { getAuditEntryDisplay } from "../formatters";

export function AuditPage({
  appState,
  entityFilter,
  eventTypeFilter,
  onEntityFilterChange,
  onEventTypeFilterChange,
}: {
  appState: AppState;
  entityFilter: EntityId | "all";
  eventTypeFilter: AuditEventType | "all";
  onEntityFilterChange: (entityId: EntityId | "all") => void;
  onEventTypeFilterChange: (eventType: AuditEventType | "all") => void;
}) {
  return (
    <section className="entity-workspace" aria-labelledby="audit-page-title">
      <AuditLogPanel
        appState={appState}
        entityFilter={entityFilter}
        eventTypeFilter={eventTypeFilter}
        onEntityFilterChange={onEntityFilterChange}
        onEventTypeFilterChange={onEventTypeFilterChange}
        titleId="audit-page-title"
      />
    </section>
  );
}

function AuditLogPanel({
  appState,
  entityFilter,
  eventTypeFilter,
  onEntityFilterChange,
  onEventTypeFilterChange,
  titleId = "audit-title",
}: {
  appState: AppState;
  entityFilter: EntityId | "all";
  eventTypeFilter: AuditEventType | "all";
  onEntityFilterChange: (entityId: EntityId | "all") => void;
  onEventTypeFilterChange: (eventType: AuditEventType | "all") => void;
  titleId?: string;
}) {
  const filteredEntries = getFilteredAuditLogEntries(
    appState.auditLog,
    entityFilter,
    eventTypeFilter,
  );

  return (
    <section className="audit-panel" aria-labelledby={titleId}>
      <div className="section-heading">
        <div>
          <h2 id={titleId}>Audit Log</h2>
          <p>{formatAuditEntryCount(appState.auditLog.length)}</p>
        </div>
      </div>

      <div className="audit-filters">
        <label>
          <span>Entity</span>
          <select
            value={entityFilter}
            onChange={(event) =>
              onEntityFilterChange(event.target.value as EntityId | "all")
            }
          >
            <option value="all">All entities</option>
            {getAuditEntityFilterOptions(appState).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Event</span>
          <select
            value={eventTypeFilter}
            onChange={(event) =>
              onEventTypeFilterChange(
                event.target.value as AuditEventType | "all",
              )
            }
          >
            <option value="all">All events</option>
            {Object.entries(AUDIT_EVENT_TYPE_LABELS).map(([eventType, label]) => (
              <option key={eventType} value={eventType}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filteredEntries.length === 0 ? (
        <p className="empty-state compact">No audit entries</p>
      ) : (
        <ul className="audit-list" aria-label="Audit entries">
          {filteredEntries.map((entry) => (
            <AuditLogRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AuditLogRow({ entry }: { entry: AuditLogEntry }) {
  const display = getAuditEntryDisplay(entry);

  return (
    <li className="audit-entry">
      <div className="audit-entry-body">
        <p className="audit-entry-summary">{display.summary}</p>
        <p className="audit-entry-meta">
          <time dateTime={entry.createdAt}>{display.timestamp}</time>
          {display.metaLabels.length > 0 ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{display.metaLabels.join(" · ")}</span>
            </>
          ) : null}
        </p>
      </div>
    </li>
  );
}

export function getFilteredAuditLogEntries(
  auditLog: AuditLogEntry[],
  entityFilter: EntityId | "all",
  eventTypeFilter: AuditEventType | "all",
): AuditLogEntry[] {
  return getNewestAuditLogEntries(auditLog).filter((entry) => {
    if (entityFilter !== "all" && entry.entityId !== entityFilter) {
      return false;
    }

    return eventTypeFilter === "all" || entry.eventType === eventTypeFilter;
  });
}

export function getAuditEntityFilterOptions(
  appState: AppState,
): Array<{ label: string; value: EntityId }> {
  const optionsById = new Map<EntityId, string>();

  getSortedEntities(appState.entities).forEach((entity) => {
    optionsById.set(entity.id, entity.name);
  });

  appState.auditLog.forEach((entry) => {
    if (entry.entityId && !optionsById.has(entry.entityId)) {
      optionsById.set(entry.entityId, entry.entityId);
    }
  });

  return [...optionsById.entries()].map(([value, label]) => ({ label, value }));
}

function formatAuditEntryCount(count: number) {
  return count === 1 ? "1 entry" : `${count} entries`;
}

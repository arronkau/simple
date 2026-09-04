import { Fragment, useState } from "react";
import {
  getCharacterEncumbrance,
  getEncumbranceWarnings,
} from "../model/encumbrance";
import {
  getContainerContents,
  getInventorySections,
  getOwnedRecords,
  getRecordById,
} from "../model/inventoryDisplay";
import { validateInventoryState } from "../model/validation";
import type { AppState } from "../model/appState";
import { isLitRecord } from "../model/lightSources";
import type { Entity, InventoryRecord } from "../model/types";
import type { InventoryMutationResult } from "../store/useAppStore";
import { getRecordDisplayName } from "../formatters";
import { LoadReadout } from "../components/GearMeters";
import { WarningDetailsButton } from "../ui/WarningDetailsButton";
import { InventoryRowSummary } from "../inventory/InventoryDisplay";

export function CharacterSheetInventory({
  appState,
  entity,
  onStartAddRecord,
  onEditRecord,
  onLightRecord,
  onSnuffRecord,
}: {
  appState: AppState;
  entity: Entity;
  onStartAddRecord?: (entity: Entity) => void;
  onEditRecord?: (record: InventoryRecord) => void;
  onLightRecord?: (record: InventoryRecord) => InventoryMutationResult;
  onSnuffRecord?: (record: InventoryRecord) => void;
}) {
  const [lightError, setLightError] = useState<string | undefined>();
  const records = appState.inventoryRecords;
  const toggleLight =
    onLightRecord && onSnuffRecord
      ? (record: InventoryRecord) => {
          if (isLitRecord(record)) {
            setLightError(undefined);
            onSnuffRecord(record);
            return;
          }

          const result = onLightRecord(record);
          setLightError(result.ok ? undefined : result.message);
        }
      : undefined;
  const sections = getInventorySections(entity, records);
  const ownedRecords = getOwnedRecords(entity.id, records);
  const warnings = getEncumbranceWarnings(entity, records);
  const validationResult = validateInventoryState(appState.entities, records);
  const validationIssues = [
    ...validationResult.errors,
    ...validationResult.warnings,
  ].filter(
    (issue) =>
      issue.entityId === entity.id ||
      (issue.recordId !== undefined &&
        ownedRecords.some((record) => record.id === issue.recordId)),
  );

  if (sections.mode !== "characterLike") {
    return null;
  }

  const encumbrance = getCharacterEncumbrance(entity, records);

  const bothHandsRecord = getRecordById(sections.handRecordIds.bothHands, records);
  const leftHandRecord = getRecordById(sections.handRecordIds.leftHand, records);
  const rightHandRecord = getRecordById(sections.handRecordIds.rightHand, records);
  const handRows: Array<{ label: string; record: InventoryRecord | undefined }> =
    bothHandsRecord
      ? [{ label: "Both", record: bothHandsRecord }]
      : [
          { label: "L", record: leftHandRecord },
          { label: "R", record: rightHandRecord },
        ];

  return (
    <section className="sheet-inventory" aria-label={`${entity.name} inventory`}>
      <div className="sheet-inventory-header">
        <h6>Inventory</h6>
        <LoadReadout encumbrance={encumbrance} />
        <WarningDetailsButton
          validationIssues={validationIssues}
          warnings={warnings}
        />
      </div>
      {lightError ? <p className="form-error">{lightError}</p> : null}

      <div className="sheet-inventory-group">
        <h6>Hands</h6>
        {handRows.map(({ label, record }) => (
          <div className="sheet-inventory-row" key={label}>
            <span className="sheet-inventory-tag">{label}</span>
            {record ? (
              <InventoryRowSummary
                record={record}
                allRecords={records}
                onOpenRecord={onEditRecord}
                onToggleLight={toggleLight}
              />
            ) : (
              <span className="sheet-empty-value">—</span>
            )}
          </div>
        ))}
      </div>

      {sections.otherEquipped.length > 0 ? (
        <div className="sheet-inventory-group">
          <h6>Equipped</h6>
          {sections.otherEquipped.map((record) => (
            <div className="sheet-inventory-row" key={record.id}>
              <InventoryRowSummary
                record={record}
                allRecords={records}
                onOpenRecord={onEditRecord}
                onToggleLight={toggleLight}
              />
            </div>
          ))}
        </div>
      ) : null}

      <div className="sheet-inventory-group">
        <h6>
          {sections.topLevelStowedContainerRecord
            ? getRecordDisplayName(sections.topLevelStowedContainerRecord)
            : "Stowed"}
        </h6>
        {sections.topLevelStowedContainerContents.length === 0 ? (
          <p className="empty-state compact">Nothing stowed</p>
        ) : null}
        {sections.topLevelStowedContainerContents.map((record) => (
          <SheetInventoryRecordRow
            depth={0}
            key={record.id}
            record={record}
            records={records}
            onEditRecord={onEditRecord}
            onToggleLight={toggleLight}
          />
        ))}
      </div>

      {onStartAddRecord ? (
        <button
          className="add-link sheet-add-link"
          type="button"
          onClick={() => onStartAddRecord(entity)}
        >
          + Add item
        </button>
      ) : null}
    </section>
  );
}

function SheetInventoryRecordRow({
  record,
  records,
  depth,
  onEditRecord,
  onToggleLight,
}: {
  record: InventoryRecord;
  records: InventoryRecord[];
  depth: number;
  onEditRecord?: (record: InventoryRecord) => void;
  onToggleLight?: (record: InventoryRecord) => void;
}) {
  const contents = record.container
    ? getContainerContents(record, records)
    : [];

  return (
    <Fragment>
      <div className="sheet-inventory-row" data-depth={depth}>
        <InventoryRowSummary
          record={record}
          allRecords={records}
          onOpenRecord={onEditRecord}
          onToggleLight={onToggleLight}
        />
      </div>
      {contents.map((childRecord) => (
        <SheetInventoryRecordRow
          depth={depth + 1}
          key={childRecord.id}
          record={childRecord}
          records={records}
          onEditRecord={onEditRecord}
          onToggleLight={onToggleLight}
        />
      ))}
    </Fragment>
  );
}

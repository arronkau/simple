import {
  getCharacterEncumbrance,
  getContentsCapacity,
  getEncumbranceWarnings,
  type EncumbranceWarning,
} from "../model/encumbrance";
import { getOwnedRecords } from "../model/inventoryDisplay";
import {
  isCharacterLikeEntity,
  validateInventoryState,
  type ValidationIssue,
} from "../model/validation";
import type { AppState } from "../model/appState";
import type { Entity } from "../model/types";
import {
  formatCapacity,
  formatMovementFeet,
  formatWarningState,
} from "../formatters";
import { WarningDetailsButton } from "../ui/WarningDetailsButton";

export type EntityInventoryStatus = {
  capacity?: string;
  movement?: string;
  validationIssues: ValidationIssue[];
  warningCount: number;
  warnings: EncumbranceWarning[];
};

const GENERIC_MISSING_BACKPACK_MESSAGE =
  "Character-like entities should have one top-level stowed container.";

export function getDisplayValidationIssues(
  validationIssues: ValidationIssue[],
): ValidationIssue[] {
  return validationIssues.filter(
    (issue) =>
      !(
        issue.code === "missingBackpack" &&
        issue.message === GENERIC_MISSING_BACKPACK_MESSAGE
      ),
  );
}

export function getEntityInventoryStatus(
  entity: Entity,
  appState: AppState,
): EntityInventoryStatus {
  const ownedRecords = getOwnedRecords(entity.id, appState.inventoryRecords);
  const warnings = getEncumbranceWarnings(entity, appState.inventoryRecords);
  const validationResult = validateInventoryState(
    appState.entities,
    appState.inventoryRecords,
  );
  const validationIssues = [
    ...validationResult.errors,
    ...validationResult.warnings,
  ].filter(
    (issue) =>
      issue.entityId === entity.id ||
      (issue.recordId !== undefined &&
        ownedRecords.some((record) => record.id === issue.recordId)),
  );
  const displayValidationIssues = getDisplayValidationIssues(validationIssues);
  const warningCount = warnings.length + displayValidationIssues.length;

  if (isCharacterLikeEntity(entity)) {
    const encumbrance = getCharacterEncumbrance(entity, appState.inventoryRecords);

    return {
      movement: formatMovementFeet(encumbrance.movement.explorationFeet),
      validationIssues: displayValidationIssues,
      warningCount,
      warnings,
    };
  }

  const capacity = getContentsCapacity(entity, appState.inventoryRecords);

  return {
    capacity: formatCapacity(capacity.usedSlots, capacity.capacitySlots),
    validationIssues: displayValidationIssues,
    warningCount,
    warnings,
  };
}

export function EntityStatusSummary({ status }: { status: EntityInventoryStatus }) {
  if (!status.movement && status.warningCount === 0) {
    return null;
  }

  return (
    <div className="entity-status-summary">
      {status.movement ? <span>{status.movement}</span> : null}
      <WarningDetailsButton
        validationIssues={status.validationIssues}
        warnings={status.warnings}
      />
    </div>
  );
}

export function EntitySummary({
  appState,
  entity,
  onEditEntity,
}: {
  appState: AppState;
  entity: Entity;
  onEditEntity?: (entity: Entity) => void;
}) {
  const status = getEntityInventoryStatus(entity, appState);

  return (
    <div className="entity-main">
      <div className="entity-card-heading">
        <div className="entity-card-title">
          <div>
            {onEditEntity ? (
              <button
                className="entity-title-button"
                type="button"
                onClick={() => onEditEntity(entity)}
              >
                {entity.name}
              </button>
            ) : (
              <h3>{entity.name}</h3>
            )}
            {!entity.active ? (
              <p className="entity-subtle-status">Inactive</p>
            ) : null}
          </div>
        </div>
        <EntityStatusSummary status={status} />
      </div>
    </div>
  );
}

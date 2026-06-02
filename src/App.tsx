import { FormEvent, useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { APP_STATE_STORAGE_KEY } from "./model/appState";
import {
  getCoinCount,
  getCoinGpValue,
  getContainerSlotUsage,
  getDirectChildRecords,
  getRecordSlotBurden,
} from "./model/calculations";
import {
  getCharacterEncumbrance,
  getContentsCapacity,
  getEncumbranceWarnings,
  getEquippedSlots,
  getStowedSlots,
  type EncumbranceWarning,
} from "./model/encumbrance";
import {
  ENTITY_TYPE_LABELS,
  ENTITY_TYPES,
  getSortedEntities,
} from "./model/entities";
import {
  getContainerContents,
  getInventorySections,
  getOwnedRecords,
  getRecordById,
} from "./model/inventoryDisplay";
import type { AppState } from "./model/appState";
import type { Entity, EntityId, EntityType, InventoryRecord } from "./model/types";
import {
  findBackpackRecords,
  isCharacterLikeEntity,
  validateInventoryState,
  type ValidationIssue,
} from "./model/validation";
import { useAppStore } from "./store/useAppStore";

type EntityFormState = {
  name: string;
  entityType: EntityType;
};

const EMPTY_ENTITY_FORM: EntityFormState = {
  name: "",
  entityType: "character",
};

function LocalAppShell() {
  const appState = useAppStore((state) => state.appState);
  const createEntity = useAppStore((state) => state.createEntity);
  const updateEntity = useAppStore((state) => state.updateEntity);
  const setEntityActive = useAppStore((state) => state.setEntityActive);
  const deleteEntity = useAppStore((state) => state.deleteEntity);
  const resetLocalState = useAppStore((state) => state.resetLocalState);
  const sortedEntities = useMemo(
    () => getSortedEntities(appState.entities),
    [appState.entities],
  );
  const [formState, setFormState] =
    useState<EntityFormState>(EMPTY_ENTITY_FORM);
  const [editingEntityId, setEditingEntityId] = useState<EntityId | undefined>();
  const [editingName, setEditingName] = useState("");

  function handleCreateEntity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const createdEntityId = createEntity(formState);

    if (createdEntityId) {
      setFormState(EMPTY_ENTITY_FORM);
    }
  }

  function startEditing(entity: Entity) {
    setEditingEntityId(entity.id);
    setEditingName(entity.name);
  }

  function saveEditing(entityId: EntityId) {
    updateEntity(entityId, { name: editingName });
    setEditingEntityId(undefined);
    setEditingName("");
  }

  function cancelEditing() {
    setEditingEntityId(undefined);
    setEditingName("");
  }

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

        <section className="entity-workspace" aria-labelledby="entities-title">
          <div className="section-heading">
            <div>
              <h2 id="entities-title">Entities</h2>
              <p>Characters, retainers, mounts, vehicles, and storage.</p>
            </div>
          </div>

          <form className="entity-form" onSubmit={handleCreateEntity}>
            <label>
              <span>Name</span>
              <input
                autoComplete="off"
                maxLength={80}
                required
                type="text"
                value={formState.name}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    name: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              <span>Type</span>
              <select
                value={formState.entityType}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    entityType: event.target.value as EntityType,
                  }))
                }
              >
                {ENTITY_TYPES.map((entityType) => (
                  <option key={entityType} value={entityType}>
                    {ENTITY_TYPE_LABELS[entityType]}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit">Add entity</button>
          </form>

          {sortedEntities.length === 0 ? (
            <p className="empty-state">No entities yet.</p>
          ) : (
            <ul className="entity-list" aria-label="Entities">
              {sortedEntities.map((entity) => {
                const backpackCount = findBackpackRecords(
                  entity.id,
                  appState.inventoryRecords,
                ).length;
                const isEditing = editingEntityId === entity.id;

                return (
                  <li
                    className="entity-row"
                    data-inactive={!entity.active}
                    key={entity.id}
                  >
                    <div className="entity-main">
                      {isEditing ? (
                        <label className="edit-name">
                          <span>Name</span>
                          <input
                            autoComplete="off"
                            maxLength={80}
                            required
                            type="text"
                            value={editingName}
                            onChange={(event) =>
                              setEditingName(event.target.value)
                            }
                          />
                        </label>
                      ) : (
                        <div>
                          <h3>{entity.name}</h3>
                          <div className="entity-meta">
                            <span>{ENTITY_TYPE_LABELS[entity.entityType]}</span>
                            <span>{entity.active ? "Active" : "Inactive"}</span>
                            <span>Sort {entity.sortOrder}</span>
                          </div>
                        </div>
                      )}

                      <div className="entity-inventory-meta">
                        <span>{getEntityRecordCount(entity.id, appState)}</span>
                        <span>{getBackpackSummary(entity, backpackCount)}</span>
                      </div>
                    </div>

                    <div className="entity-actions">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => saveEditing(entity.id)}
                          >
                            Save
                          </button>
                          <button type="button" onClick={cancelEditing}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditing(entity)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEntityActive(entity.id, !entity.active)
                            }
                          >
                            {entity.active ? "Deactivate" : "Reactivate"}
                          </button>
                          <button
                            className="danger-button"
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete ${entity.name} and its inventory records?`,
                                )
                              ) {
                                deleteEntity(entity.id);
                              }
                            }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>

                    <InventoryDisplay entity={entity} appState={appState} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="storage-key">
          <span>Storage key</span>
          <code>{APP_STATE_STORAGE_KEY}</code>
        </div>
      </section>
    </main>
  );
}

function InventoryDisplay({
  entity,
  appState,
}: {
  entity: Entity;
  appState: AppState;
}) {
  const ownedRecords = getOwnedRecords(entity.id, appState.inventoryRecords);
  const sections = getInventorySections(entity, appState.inventoryRecords);
  const validationResult = validateInventoryState(
    appState.entities,
    appState.inventoryRecords,
  );
  const entityValidationIssues = [
    ...validationResult.errors,
    ...validationResult.warnings,
  ].filter(
    (issue) =>
      issue.entityId === entity.id ||
      (issue.recordId !== undefined &&
        ownedRecords.some((record) => record.id === issue.recordId)),
  );
  const warnings = getEncumbranceWarnings(entity, appState.inventoryRecords);

  return (
    <section className="inventory-display" aria-label={`${entity.name} inventory`}>
      <EntityInventoryHeader
        entity={entity}
        records={appState.inventoryRecords}
        warnings={warnings}
        validationIssues={entityValidationIssues}
      />

      {entityValidationIssues.length > 0 || warnings.length > 0 ? (
        <WarningList validationIssues={entityValidationIssues} warnings={warnings} />
      ) : null}

      {sections.mode === "characterLike" ? (
        <CharacterInventoryDisplay
          sections={sections}
          records={appState.inventoryRecords}
        />
      ) : (
        <ContentsInventoryDisplay contents={sections.contents} records={appState.inventoryRecords} />
      )}
    </section>
  );
}

function EntityInventoryHeader({
  entity,
  records,
  warnings,
  validationIssues,
}: {
  entity: Entity;
  records: InventoryRecord[];
  warnings: EncumbranceWarning[];
  validationIssues: ValidationIssue[];
}) {
  if (isCharacterLikeEntity(entity)) {
    const encumbrance = getCharacterEncumbrance(entity, records);
    const totalSlots = encumbrance.equippedItems + encumbrance.stowedItems;

    return (
      <div className="inventory-header">
        <span>Equipped {formatSlots(encumbrance.equippedItems)}</span>
        <span>Stowed {formatSlots(encumbrance.stowedItems)}</span>
        <span>Total {formatSlots(totalSlots)}</span>
        <span>
          Move {encumbrance.movement.explorationFeet}' /
          {encumbrance.movement.encounterFeet}'
        </span>
        <span>{formatWarningState(warnings, validationIssues)}</span>
      </div>
    );
  }

  const capacity = getContentsCapacity(entity, records);

  return (
    <div className="inventory-header">
      <span>Contents {formatSlots(capacity.usedSlots)}</span>
      <span>Total {formatSlots(capacity.usedSlots)}</span>
      <span>{formatCapacity(capacity.usedSlots, capacity.capacitySlots)}</span>
      <span>{formatWarningState(warnings, validationIssues)}</span>
    </div>
  );
}

function CharacterInventoryDisplay({
  sections,
  records,
}: {
  sections: ReturnType<typeof getInventorySections> & { mode: "characterLike" };
  records: InventoryRecord[];
}) {
  const bothHandsRecord = getRecordById(sections.handRecordIds.bothHands, records);
  const leftHandRecord = getRecordById(sections.handRecordIds.leftHand, records);
  const rightHandRecord = getRecordById(sections.handRecordIds.rightHand, records);

  return (
    <div className="inventory-sections">
      <InventorySection title="Equipped">
        <InventorySubsection title="Hands">
          {bothHandsRecord ? (
            <HandSlot label="Both hands" record={bothHandsRecord} records={records} />
          ) : (
            <div className="hand-grid">
              <HandSlot label="Left hand" record={leftHandRecord} records={records} />
              <HandSlot label="Right hand" record={rightHandRecord} records={records} />
            </div>
          )}
        </InventorySubsection>

        <InventorySubsection title="Other equipped">
          <RecordList records={sections.otherEquipped} allRecords={records} />
        </InventorySubsection>
      </InventorySection>

      <InventorySection title="Stowed">
        <InventorySubsection title="Coin purse">
          {sections.coinRecord ? (
            <CoinRecordRow record={sections.coinRecord} />
          ) : (
            <p className="empty-state compact">No coins</p>
          )}
        </InventorySubsection>

        <InventorySubsection title="Backpack">
          {sections.backpackRecord ? (
            <ContainerBlock
              containerRecord={sections.backpackRecord}
              records={records}
              nestedRecords={sections.backpackContents}
              titleSuffix="backpack"
            />
          ) : (
            <p className="empty-state compact">Missing backpack</p>
          )}
        </InventorySubsection>
      </InventorySection>
    </div>
  );
}

function ContentsInventoryDisplay({
  contents,
  records,
}: {
  contents: InventoryRecord[];
  records: InventoryRecord[];
}) {
  return (
    <div className="inventory-sections">
      <InventorySection title="Contents">
        <RecordList records={contents} allRecords={records} />
      </InventorySection>
    </div>
  );
}

function InventorySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="inventory-section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function InventorySubsection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="inventory-subsection">
      <h5>{title}</h5>
      {children}
    </div>
  );
}

function HandSlot({
  label,
  record,
  records,
}: {
  label: string;
  record?: InventoryRecord;
  records: InventoryRecord[];
}) {
  return (
    <div className="hand-slot">
      <span>{label}</span>
      {record ? (
        <RecordRow record={record} allRecords={records} />
      ) : (
        <p className="empty-state compact">Empty hand</p>
      )}
    </div>
  );
}

function RecordList({
  records,
  allRecords,
}: {
  records: InventoryRecord[];
  allRecords: InventoryRecord[];
}) {
  if (records.length === 0) {
    return <p className="empty-state compact">Empty</p>;
  }

  return (
    <ul className="record-list">
      {records.map((record) => (
        <li key={record.id}>
          <RecordRow record={record} allRecords={allRecords} />
        </li>
      ))}
    </ul>
  );
}

function RecordRow({
  record,
  allRecords,
}: {
  record: InventoryRecord;
  allRecords: InventoryRecord[];
}) {
  if (record.recordType === "coins") {
    return <CoinRecordRow record={record} />;
  }

  if (record.container) {
    return (
      <ContainerBlock
        containerRecord={record}
        records={allRecords}
        nestedRecords={getContainerContents(record, allRecords)}
      />
    );
  }

  return (
    <div className="record-row">
      <div>
        <strong>{getRecordDisplayName(record)}</strong>
        <RecordMeta record={record} allRecords={allRecords} />
      </div>
    </div>
  );
}

function ContainerBlock({
  containerRecord,
  records,
  nestedRecords,
  titleSuffix,
}: {
  containerRecord: InventoryRecord;
  records: InventoryRecord[];
  nestedRecords: InventoryRecord[];
  titleSuffix?: string;
}) {
  const slotUsage = getContainerSlotUsage(containerRecord, records);

  return (
    <div className="container-block">
      <div className="record-row">
        <div>
          <strong>{getRecordDisplayName(containerRecord)}</strong>
          {titleSuffix ? <span className="quiet-label"> {titleSuffix}</span> : null}
          <div className="record-meta">
            <span>{formatCapacity(slotUsage.usedSlots, slotUsage.capacitySlots)}</span>
            <span>{formatContainerHeldState(containerRecord)}</span>
          </div>
        </div>
      </div>
      <RecordList records={nestedRecords} allRecords={records} />
    </div>
  );
}

function CoinRecordRow({ record }: { record: InventoryRecord }) {
  if (record.recordType !== "coins") {
    return null;
  }

  return (
    <div className="record-row">
      <div>
        <strong>Coins</strong>
        <div className="record-meta">
          <span>{formatCoinDenominations(record)}</span>
          <span>{formatGpValue(getCoinGpValue(record.coins))} gp</span>
          <span>{formatSlots(getRecordSlotBurden(record))}</span>
        </div>
      </div>
    </div>
  );
}

function RecordMeta({
  record,
  allRecords,
}: {
  record: InventoryRecord;
  allRecords: InventoryRecord[];
}) {
  const metadata = getRecordMetadata(record, allRecords);

  if (metadata.length === 0) {
    return null;
  }

  return (
    <div className="record-meta">
      {metadata.map((metadataItem) => (
        <span key={metadataItem}>{metadataItem}</span>
      ))}
    </div>
  );
}

function WarningList({
  validationIssues,
  warnings,
}: {
  validationIssues: ValidationIssue[];
  warnings: EncumbranceWarning[];
}) {
  return (
    <ul className="warning-list">
      {validationIssues.map((issue) => (
        <li key={`validation-${issue.code}-${issue.recordId ?? issue.entityId}`}>
          {issue.message}
        </li>
      ))}
      {warnings.map((warning) => (
        <li key={`warning-${warning.code}-${warning.recordId ?? warning.entityId}`}>
          {warning.message}
        </li>
      ))}
    </ul>
  );
}

function getEntityRecordCount(entityId: EntityId, appState: AppStateLike) {
  const count = appState.inventoryRecords.filter(
    (record) => record.location.entityId === entityId,
  ).length;

  return count === 1 ? "1 record" : `${count} records`;
}

function getBackpackSummary(entity: Entity, backpackCount: number) {
  if (entity.entityType !== "character" && entity.entityType !== "retainer") {
    return "No backpack required";
  }

  if (backpackCount === 1) {
    return "1 backpack";
  }

  return `${backpackCount} backpacks`;
}

function getRecordDisplayName(record: InventoryRecord) {
  if (record.identification?.identified === false) {
    return record.identification.unidentifiedName ?? "Unidentified Item";
  }

  return record.name;
}

function getRecordMetadata(
  record: InventoryRecord,
  allRecords: InventoryRecord[],
): string[] {
  const metadata: string[] = [];
  const slots = getRecordSlotBurden(record);

  if (slots > 1) {
    metadata.push(formatSlots(slots));
  }

  if (record.recordType === "treasure") {
    metadata.push(`${formatGpValue(record.treasure.gpValue)} gp`);
  }

  if (record.recordType === "weapon") {
    metadata.push(record.weapon.hands === "twoHands" ? "Two hands" : "One hand");

    if (record.weapon.damage) {
      metadata.push(record.weapon.damage);
    }

    if (record.weapon.range) {
      metadata.push(record.weapon.range);
    }
  }

  if (record.recordType === "armor") {
    if (record.armor.baseArmorClass !== undefined) {
      metadata.push(`AC ${record.armor.baseArmorClass}`);
    }

    if (record.armor.armorBonus !== undefined) {
      metadata.push(`+${record.armor.armorBonus} AC`);
    }

    if (
      record.location.locationType === "equipped" &&
      record.location.placement === "loose"
    ) {
      metadata.push("Active");
    }
  }

  if (record.uses) {
    metadata.push(
      record.uses.max === undefined
        ? `${record.uses.current} uses`
        : `${record.uses.current}/${record.uses.max} uses`,
    );
  }

  if (record.light) {
    metadata.push(record.light.isLit ? "Lit" : "Unlit");
  }

  if (record.container) {
    const slotUsage = getContainerSlotUsage(record, allRecords);
    metadata.push(formatCapacity(slotUsage.usedSlots, slotUsage.capacitySlots));
  }

  return metadata;
}

function formatCoinDenominations(record: InventoryRecord) {
  if (record.recordType !== "coins" || getCoinCount(record.coins) === 0) {
    return "No coins";
  }

  const allDenominations: Array<[string, number]> = [
    ["pp", record.coins.pp],
    ["gp", record.coins.gp],
    ["sp", record.coins.sp],
    ["cp", record.coins.cp],
  ];
  const denominations = allDenominations.filter(([, count]) => count > 0);

  return denominations.map(([label, count]) => `${count} ${label}`).join(", ");
}

function formatSlots(slots: number) {
  return slots === 1 ? "1 slot" : `${slots} slots`;
}

function formatCapacity(usedSlots: number, capacitySlots: number | undefined) {
  if (capacitySlots === undefined) {
    return `${formatSlots(usedSlots)} used`;
  }

  return `${usedSlots}/${capacitySlots} slots`;
}

function formatGpValue(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

function formatWarningState(
  warnings: EncumbranceWarning[],
  validationIssues: ValidationIssue[],
) {
  const count = warnings.length + validationIssues.length;

  if (count === 0) {
    return "No warnings";
  }

  return count === 1 ? "1 warning" : `${count} warnings`;
}

function formatContainerHeldState(record: InventoryRecord) {
  if (!record.container || (record.container.handsRequired ?? 0) === 0) {
    return "No hands required";
  }

  if (
    record.location.locationType === "equipped" &&
    (record.location.placement === "leftHand" ||
      record.location.placement === "rightHand" ||
      record.location.placement === "bothHands")
  ) {
    return `Held in ${record.location.placement}`;
  }

  return `${record.container.handsRequired} hand required`;
}

type AppStateLike = ReturnType<typeof useAppStore.getState>["appState"];

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LocalAppShell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

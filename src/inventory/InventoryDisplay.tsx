import { Fragment, type ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  ItemStatusIcon,
} from "../components/InventoryIcons";
import {
  DraggableRecordItem,
  GapDropZone,
  InventoryTypeIconMarker,
  SlotDropZone,
  SortableRecordItem,
} from "../inventory-dnd/InventoryDnd";
import { type DragZone } from "../model/inventoryDnd";
import {
  getCharacterEncumbrance,
  getContentsCapacity,
  type EncumbranceWarning,
} from "../model/encumbrance";
import {
  getContainerContents,
  getInventorySections,
  getRecordById,
} from "../model/inventoryDisplay";
import {
  getInventoryRowDisplay,
  type InventoryRowStatus,
} from "../model/inventoryRowDisplay";
import { getRecordSlotBurden } from "../model/calculations";
import {
  isCharacterLikeEntity,
  type ValidationIssue,
} from "../model/validation";
import type { Entity, EntityId, InventoryRecord, InventoryRecordId } from "../model/types";
import type { InventoryMutationResult } from "../store/useAppStore";
import {
  formatCapacity,
  formatSlots,
  formatWarningState,
  getCollapsedContainerStatusIcons,
  getInventoryRowStatusIcon,
  getInventoryRowStatusTitle,
  getInventoryRowStatusTone,
  getRecordDisplayName,
  getUniqueInventoryRowStatuses,
} from "../formatters";
import { SlotPipIndicator } from "../ui/SlotPipIndicator";

export function InventoryDisplay({
  entity,
  appState,
  collapsedContainerIds,
  onDeleteRecord,
  onEditRecord,
  onIdentifyRecord,
  onSpendCoins,
  onStartAddRecord,
  onToggleContainerCollapsed,
}: {
  entity: Entity;
  appState: { inventoryRecords: InventoryRecord[] };
  collapsedContainerIds: Set<InventoryRecordId>;
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditRecord: (record: InventoryRecord) => void;
  onIdentifyRecord: (recordId: InventoryRecordId) => InventoryMutationResult;
  onSpendCoins: (record: InventoryRecord) => void;
  onStartAddRecord: (entity: Entity) => void;
  onToggleContainerCollapsed: (recordId: InventoryRecordId) => void;
}) {
  const sections = getInventorySections(entity, appState.inventoryRecords);

  return (
    <section className="inventory-display" aria-label={`${entity.name} inventory`}>
      <div className="inventory-toolbar">
        <button type="button" onClick={() => onStartAddRecord(entity)}>
          Add record
        </button>
      </div>

      {sections.mode === "characterLike" ? (
        <CharacterInventoryDisplay
          entityId={entity.id}
          sections={sections}
          records={appState.inventoryRecords}
          collapsedContainerIds={collapsedContainerIds}
          onDeleteRecord={onDeleteRecord}
          onEditRecord={onEditRecord}
          onIdentifyRecord={onIdentifyRecord}
          onSpendCoins={onSpendCoins}
          onToggleContainerCollapsed={onToggleContainerCollapsed}
        />
      ) : (
        <ContentsInventoryDisplay
          entityId={entity.id}
          contents={sections.contents}
          capacity={getContentsCapacity(entity, appState.inventoryRecords)}
          records={appState.inventoryRecords}
          collapsedContainerIds={collapsedContainerIds}
          onDeleteRecord={onDeleteRecord}
          onEditRecord={onEditRecord}
          onIdentifyRecord={onIdentifyRecord}
          onSpendCoins={onSpendCoins}
          onToggleContainerCollapsed={onToggleContainerCollapsed}
        />
      )}
    </section>
  );
}

export function EntityInventoryHeader({
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
  entityId,
  sections,
  records,
  collapsedContainerIds,
  onDeleteRecord,
  onEditRecord,
  onIdentifyRecord,
  onSpendCoins,
  onToggleContainerCollapsed,
}: {
  entityId: EntityId;
  sections: ReturnType<typeof getInventorySections> & { mode: "characterLike" };
  records: InventoryRecord[];
  collapsedContainerIds: Set<InventoryRecordId>;
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditRecord: (record: InventoryRecord) => void;
  onIdentifyRecord: (recordId: InventoryRecordId) => InventoryMutationResult;
  onSpendCoins: (record: InventoryRecord) => void;
  onToggleContainerCollapsed: (recordId: InventoryRecordId) => void;
}) {
  const coinPurseZone: DragZone = { entityId, placement: "coinPurse" };

  return (
    <div className="inventory-sections">
      <InventorySection title="Equipped">
        <HandRows
          entityId={entityId}
          sections={sections}
          records={records}
          onEditRecord={onEditRecord}
          onIdentifyRecord={onIdentifyRecord}
          onSpendCoins={onSpendCoins}
        />

        <RecordList
          zone={{ entityId, placement: "equippedLoose" }}
          records={sections.otherEquipped}
          allRecords={records}
          collapsedContainerIds={collapsedContainerIds}
          onDeleteRecord={onDeleteRecord}
          onEditRecord={onEditRecord}
          onIdentifyRecord={onIdentifyRecord}
          onSpendCoins={onSpendCoins}
          onToggleContainerCollapsed={onToggleContainerCollapsed}
        />
      </InventorySection>

      <InventorySection title="Stowed">
        <SlotDropZone
          entityId={entityId}
          placement="coinPurse"
          className="coin-purse-slot"
        >
          {sections.coinRecord ? (
            <DraggableRecordItem
              record={sections.coinRecord}
              zone={coinPurseZone}
            >
              {(handle) => (
                <CoinRecordRow
                  record={sections.coinRecord!}
                  dragHandle={handle}
                  onEditRecord={onEditRecord}
                />
              )}
            </DraggableRecordItem>
          ) : (
            <p className="empty-state compact">No coins</p>
          )}
        </SlotDropZone>

        {sections.topLevelStowedContainerRecord ? (
          <ContainerBlock
            entityId={entityId}
            containerRecord={sections.topLevelStowedContainerRecord}
            records={records}
            nestedRecords={sections.topLevelStowedContainerContents}
            collapsedContainerIds={collapsedContainerIds}
            onDeleteRecord={onDeleteRecord}
            onEditRecord={onEditRecord}
            onIdentifyRecord={onIdentifyRecord}
            onSpendCoins={onSpendCoins}
            onToggleContainerCollapsed={onToggleContainerCollapsed}
          />
        ) : (
          <p className="empty-state compact">Missing stowed container</p>
        )}
      </InventorySection>
    </div>
  );
}

function ContentsInventoryDisplay({
  entityId,
  capacity,
  contents,
  records,
  collapsedContainerIds,
  onDeleteRecord,
  onEditRecord,
  onIdentifyRecord,
  onSpendCoins,
  onToggleContainerCollapsed,
}: {
  entityId: EntityId;
  capacity: ReturnType<typeof getContentsCapacity>;
  contents: InventoryRecord[];
  records: InventoryRecord[];
  collapsedContainerIds: Set<InventoryRecordId>;
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditRecord: (record: InventoryRecord) => void;
  onIdentifyRecord: (recordId: InventoryRecordId) => InventoryMutationResult;
  onSpendCoins: (record: InventoryRecord) => void;
  onToggleContainerCollapsed: (recordId: InventoryRecordId) => void;
}) {
  return (
    <div className="inventory-sections">
      <InventorySection
        title="Contents"
        meta={formatCapacity(capacity.usedSlots, capacity.capacitySlots)}
      >
        <RecordList
          zone={{ entityId, placement: "contents" }}
          records={contents}
          allRecords={records}
          collapsedContainerIds={collapsedContainerIds}
          onDeleteRecord={onDeleteRecord}
          onEditRecord={onEditRecord}
          onIdentifyRecord={onIdentifyRecord}
          onSpendCoins={onSpendCoins}
          onToggleContainerCollapsed={onToggleContainerCollapsed}
        />
      </InventorySection>
    </div>
  );
}

function InventorySection({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="inventory-section">
      <div className="inventory-section-heading">
        <h4>{title}</h4>
        {meta ? <span>{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

function HandRows({
  entityId,
  sections,
  records,
  onEditRecord,
  onIdentifyRecord,
  onSpendCoins,
}: {
  entityId: EntityId;
  sections: ReturnType<typeof getInventorySections> & { mode: "characterLike" };
  records: InventoryRecord[];
  onEditRecord: (record: InventoryRecord) => void;
  onIdentifyRecord: (recordId: InventoryRecordId) => InventoryMutationResult;
  onSpendCoins: (record: InventoryRecord) => void;
}) {
  const bothHandsRecord = getRecordById(sections.handRecordIds.bothHands, records);

  if (bothHandsRecord) {
    return (
      <div className="hand-rows">
        <HandRow
          entityId={entityId}
          placement="bothHands"
          label="Hands"
          record={bothHandsRecord}
          records={records}
          doubleHeight
          onEditRecord={onEditRecord}
          onIdentifyRecord={onIdentifyRecord}
          onSpendCoins={onSpendCoins}
        />
      </div>
    );
  }

  return (
    <div className="hand-rows">
      <HandRow
        entityId={entityId}
        placement="leftHand"
        label="Left"
        record={getRecordById(sections.handRecordIds.leftHand, records)}
        records={records}
        onEditRecord={onEditRecord}
        onIdentifyRecord={onIdentifyRecord}
        onSpendCoins={onSpendCoins}
      />
      <HandRow
        entityId={entityId}
        placement="rightHand"
        label="Right"
        record={getRecordById(sections.handRecordIds.rightHand, records)}
        records={records}
        onEditRecord={onEditRecord}
        onIdentifyRecord={onIdentifyRecord}
        onSpendCoins={onSpendCoins}
      />
    </div>
  );
}

function HandRow({
  entityId,
  placement,
  doubleHeight = false,
  label,
  record,
  records,
  onEditRecord,
  onIdentifyRecord,
  onSpendCoins,
}: {
  entityId: EntityId;
  placement: "leftHand" | "rightHand" | "bothHands";
  doubleHeight?: boolean;
  label: string;
  record?: InventoryRecord;
  records: InventoryRecord[];
  onEditRecord?: (record: InventoryRecord) => void;
  onIdentifyRecord?: (recordId: InventoryRecordId) => InventoryMutationResult;
  onSpendCoins?: (record: InventoryRecord) => void;
}) {
  return (
    <SlotDropZone
      entityId={entityId}
      placement={placement}
      className={`hand-row${doubleHeight ? " hand-row-double" : ""}`}
    >
      <span className="hand-row-label">{label}</span>
      {record ? (
        <DraggableRecordItem record={record} zone={{ entityId, placement }}>
          {(handle) => (
            <div
              className="record-row record-drop-surface hand-record-card"
              data-record-id={record.id}
            >
              {handle}
              <InventoryRowSummary
                record={record}
                allRecords={records}
                onOpenRecord={onEditRecord}
              />
              {onSpendCoins && record.recordType === "coins" ? (
                <button
                  className="compact-row-action"
                  type="button"
                  onClick={() => onSpendCoins(record)}
                >
                  Spend
                </button>
              ) : null}
              {onIdentifyRecord && canIdentifyRecord(record) ? (
                <button
                  className="compact-row-action"
                  type="button"
                  onClick={() => onIdentifyRecord(record.id)}
                >
                  Identify
                </button>
              ) : null}
            </div>
          )}
        </DraggableRecordItem>
      ) : (
        <span className="hand-row-empty">Empty</span>
      )}
    </SlotDropZone>
  );
}

function RecordList({
  zone,
  records,
  allRecords,
  collapsedContainerIds,
  onDeleteRecord,
  onEditRecord,
  onIdentifyRecord,
  onSpendCoins,
  onToggleContainerCollapsed,
}: {
  zone: DragZone;
  records: InventoryRecord[];
  allRecords: InventoryRecord[];
  collapsedContainerIds: Set<InventoryRecordId>;
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditRecord: (record: InventoryRecord) => void;
  onIdentifyRecord: (recordId: InventoryRecordId) => InventoryMutationResult;
  onSpendCoins: (record: InventoryRecord) => void;
  onToggleContainerCollapsed: (recordId: InventoryRecordId) => void;
}) {
  if (records.length === 0) {
    return <GapDropZone zone={zone} index={0} empty />;
  }

  return (
    <ul className="record-list" data-drop-zone="record-list">
      <SortableContext
        items={records.map((record) => record.id)}
        strategy={verticalListSortingStrategy}
      >
        <GapDropZone zone={zone} index={0} />
        {records.map((record, index) => (
          <Fragment key={record.id}>
            <SortableRecordItem record={record} index={index} zone={zone}>
              {(handle) => (
                <RecordRow
                  record={record}
                  dragHandle={handle}
                  allRecords={allRecords}
                  collapsedContainerIds={collapsedContainerIds}
                  onDeleteRecord={onDeleteRecord}
                  onEditRecord={onEditRecord}
                  onIdentifyRecord={onIdentifyRecord}
                  onSpendCoins={onSpendCoins}
                  onToggleContainerCollapsed={onToggleContainerCollapsed}
                />
              )}
            </SortableRecordItem>
            <GapDropZone zone={zone} index={index + 1} />
          </Fragment>
        ))}
      </SortableContext>
    </ul>
  );
}

function RecordRow({
  record,
  dragHandle,
  allRecords,
  collapsedContainerIds,
  onDeleteRecord,
  onEditRecord,
  onIdentifyRecord,
  onSpendCoins,
  onToggleContainerCollapsed,
}: {
  record: InventoryRecord;
  dragHandle?: ReactNode;
  allRecords: InventoryRecord[];
  collapsedContainerIds: Set<InventoryRecordId>;
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditRecord: (record: InventoryRecord) => void;
  onIdentifyRecord: (recordId: InventoryRecordId) => InventoryMutationResult;
  onSpendCoins: (record: InventoryRecord) => void;
  onToggleContainerCollapsed: (recordId: InventoryRecordId) => void;
}) {
  if (record.recordType === "coins") {
    return (
      <CoinRecordRow
        record={record}
        dragHandle={dragHandle}
        onEditRecord={onEditRecord}
      />
    );
  }

  if (record.container) {
    return (
      <ContainerBlock
        entityId={record.entityId}
        containerRecord={record}
        dragHandle={dragHandle}
        records={allRecords}
        nestedRecords={getContainerContents(record, allRecords)}
        collapsedContainerIds={collapsedContainerIds}
        onDeleteRecord={onDeleteRecord}
        onEditRecord={onEditRecord}
        onIdentifyRecord={onIdentifyRecord}
        onSpendCoins={onSpendCoins}
        onToggleContainerCollapsed={onToggleContainerCollapsed}
      />
    );
  }

  return (
    <div className="record-row record-drop-surface" data-record-id={record.id}>
      {dragHandle ?? <InventoryTypeIconMarker record={record} />}
      <InventoryRowSummary
        record={record}
        allRecords={allRecords}
        onOpenRecord={onEditRecord}
      />
      {canIdentifyRecord(record) ? (
        <button
          className="compact-row-action"
          type="button"
          onClick={() => onIdentifyRecord(record.id)}
        >
          Identify
        </button>
      ) : null}
    </div>
  );
}

function ContainerHeaderDrop({
  entityId,
  containerId,
  children,
}: {
  entityId: EntityId;
  containerId: InventoryRecordId;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `container-header__${containerId}`,
    data: {
      type: "record",
      kind: "container",
      entityId,
      containerId,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`container-header-drop${isOver ? " drop-over" : ""}`}
    >
      {children}
    </div>
  );
}

function ContainerBlock({
  entityId,
  containerRecord,
  dragHandle,
  records,
  nestedRecords,
  collapsedContainerIds,
  onDeleteRecord,
  onEditRecord,
  onIdentifyRecord,
  onSpendCoins,
  onToggleContainerCollapsed,
}: {
  entityId: EntityId;
  containerRecord: InventoryRecord;
  dragHandle?: ReactNode;
  records: InventoryRecord[];
  nestedRecords: InventoryRecord[];
  collapsedContainerIds: Set<InventoryRecordId>;
  onDeleteRecord: (record: InventoryRecord) => void;
  onEditRecord: (record: InventoryRecord) => void;
  onIdentifyRecord: (recordId: InventoryRecordId) => InventoryMutationResult;
  onSpendCoins: (record: InventoryRecord) => void;
  onToggleContainerCollapsed: (recordId: InventoryRecordId) => void;
}) {
  const isCollapsed = collapsedContainerIds.has(containerRecord.id);
  const collapseLabel = isCollapsed ? "Expand" : "Collapse";

  const headerRow = (
    <div
      className="record-row record-drop-surface container-header-row"
      data-record-id={containerRecord.id}
    >
      {dragHandle ?? <InventoryTypeIconMarker record={containerRecord} />}
      <button
        className="container-toggle"
        type="button"
        aria-label={`${collapseLabel} ${getRecordDisplayName(containerRecord)}`}
        aria-expanded={!isCollapsed}
        onClick={() => onToggleContainerCollapsed(containerRecord.id)}
      >
        {isCollapsed ? "+" : "-"}
      </button>
      <InventoryRowSummary
        record={containerRecord}
        allRecords={records}
        extraStatusIcons={
          isCollapsed
            ? getCollapsedContainerStatusIcons(containerRecord, records)
            : undefined
        }
        onOpenRecord={onEditRecord}
      />
      {canIdentifyRecord(containerRecord) ? (
        <button
          className="compact-row-action"
          type="button"
          onClick={() => onIdentifyRecord(containerRecord.id)}
        >
          Identify
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="container-block" data-container-record-id={containerRecord.id}>
      <ContainerHeaderDrop entityId={entityId} containerId={containerRecord.id}>
        {headerRow}
      </ContainerHeaderDrop>
      {isCollapsed ? null : (
        <div className="container-contents">
          <RecordList
            zone={{
              entityId,
              placement: "container",
              containerId: containerRecord.id,
            }}
            records={nestedRecords}
            allRecords={records}
            collapsedContainerIds={collapsedContainerIds}
            onDeleteRecord={onDeleteRecord}
            onEditRecord={onEditRecord}
            onIdentifyRecord={onIdentifyRecord}
            onSpendCoins={onSpendCoins}
            onToggleContainerCollapsed={onToggleContainerCollapsed}
          />
        </div>
      )}
    </div>
  );
}

function CoinRecordRow({
  record,
  dragHandle,
  onEditRecord,
}: {
  record: InventoryRecord;
  dragHandle?: ReactNode;
  onEditRecord: (record: InventoryRecord) => void;
}) {
  if (record.recordType !== "coins") {
    return null;
  }

  return (
    <div className="record-row record-drop-surface" data-record-id={record.id}>
      {dragHandle ?? <InventoryTypeIconMarker record={record} />}
      <InventoryRowSummary
        record={record}
        allRecords={[record]}
        onOpenRecord={onEditRecord}
      />
    </div>
  );
}

export function InventoryRowSummary({
  record,
  allRecords,
  extraStatusIcons,
  onOpenRecord,
}: {
  record: InventoryRecord;
  allRecords: InventoryRecord[];
  extraStatusIcons?: InventoryRowStatus[];
  onOpenRecord?: (record: InventoryRecord) => void;
}) {
  const display = getInventoryRowDisplay(record, allRecords);
  const statusIcons = getUniqueInventoryRowStatuses([
    ...display.statusIcons,
    ...(extraStatusIcons ?? []),
  ]);

  return (
    <div className="record-summary">
      <div className="record-summary-main">
        {onOpenRecord ? (
          <button
            className="record-title-button"
            type="button"
            onClick={() => onOpenRecord(record)}
          >
            {display.primaryText}
          </button>
        ) : (
          <strong>{display.primaryText}</strong>
        )}
        {statusIcons.map((status) => (
          <span
            className="record-status-icon"
            key={status}
            title={getInventoryRowStatusTitle(status)}
          >
            <ItemStatusIcon
              name={getInventoryRowStatusIcon(status)}
              tone={getInventoryRowStatusTone(status)}
            />
          </span>
        ))}
        {display.secondaryText ? (
          <span className="record-secondary">· {display.secondaryText}</span>
        ) : null}
      </div>
      {display.rightKind === "burden" ? (
        <SlotPipIndicator slots={getRecordSlotBurden(record)} />
      ) : (
        <span className="record-right-meta">{display.rightText}</span>
      )}
    </div>
  );
}

function canIdentifyRecord(record: InventoryRecord): boolean {
  if (record.recordType === "coins" || record.recordType === "treasure") {
    return false;
  }

  return (
    record.identification?.identified === false &&
    (Boolean(record.identification.secretName?.trim()) ||
      Boolean(record.identification.secretDescription?.trim()))
  );
}

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { getSortedEntities } from "../model/entities";
import {
  getCharacterEncumbrance,
  getContentsCapacity,
  type CharacterEncumbranceResult,
} from "../model/encumbrance";
import {
  getCoinGpValue,
  getContainerSlotUsage,
  getRecordSlotBurden,
} from "../model/calculations";
import {
  getContainerContents,
  getInventorySections,
  getOwnedRecords,
  getRecordById,
  type CharacterInventorySections,
} from "../model/inventoryDisplay";
import { getInventoryRowDisplay } from "../model/inventoryRowDisplay";
import { isCharacterLikeEntity } from "../model/validation";
import { sortInventoryRecordsBySortOrder } from "../model/inventoryRecords";
import type {
  Entity,
  InventoryRecord,
  InventoryRecordId,
} from "../model/types";
import { useAppStore } from "../store/useAppStore";
import { SlotPipIndicator } from "../ui/SlotPipIndicator";
import {
  containerDropId,
  contentsDropId,
  dropTargetToLocationInput,
  handDropId,
  looseDropId,
  recordDraggableId,
  type GearDragData,
  type GearDropData,
  type GearDropTarget,
} from "./gearDnd";
import { projectMove, type MoveProjection } from "./gearProjection";
import { resolveFloorEntity, useFloorUiStore } from "./floorUiStore";

// ---------------------------------------------------------------------------
// Drag context — lets zones render their own hover ring + projection pill
// ---------------------------------------------------------------------------

type GearDragState = {
  activeRecordId: InventoryRecordId | null;
  overId: string | null;
  projection: MoveProjection | null;
  justMovedId: InventoryRecordId | null;
};

const GearDragContext = createContext<GearDragState>({
  activeRecordId: null,
  overId: null,
  projection: null,
  justMovedId: null,
});

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function PartyGearPage() {
  const appState = useAppStore((state) => state.appState);
  const partyId = useAppStore((state) => state.partyId);
  const moveInventoryRecord = useAppStore((state) => state.moveInventoryRecord);
  const createEntity = useAppStore((state) => state.createEntity);
  const floorByParty = useFloorUiStore((state) => state.floorByParty);
  const setFloorEntityId = useFloorUiStore((state) => state.setFloorEntityId);

  const records = appState.inventoryRecords;
  const entities = appState.entities;
  const sortedEntities = useMemo(() => getSortedEntities(entities), [entities]);
  const floorEntity = resolveFloorEntity(partyId, floorByParty, entities);

  const boardEntities = sortedEntities.filter(
    (entity) => entity.active && entity.id !== floorEntity?.id,
  );

  const [dragState, setDragState] = useState<GearDragState>({
    activeRecordId: null,
    overId: null,
    projection: null,
    justMovedId: null,
  });
  const [dragMessage, setDragMessage] = useState<string | undefined>();
  const justMovedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  function resetDrag(justMovedId: InventoryRecordId | null = null) {
    setDragState({
      activeRecordId: null,
      overId: null,
      projection: null,
      justMovedId,
    });
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as GearDragData | undefined;

    if (!data || data.type !== "gear-record") {
      return;
    }

    setDragMessage(undefined);
    setDragState({
      activeRecordId: data.recordId,
      overId: null,
      projection: null,
      justMovedId: null,
    });
  }

  function handleDragOver(event: DragOverEvent) {
    const activeData = event.active.data.current as GearDragData | undefined;
    const overData = event.over?.data.current as GearDropData | undefined;
    const overId = event.over ? String(event.over.id) : null;

    if (!activeData || !overData || overData.type !== "gear-zone" || !overId) {
      setDragState((state) => ({ ...state, overId: null, projection: null }));
      return;
    }

    const projection = projectMove(
      records,
      activeData.recordId,
      overData.target,
      entities,
    );

    setDragState((state) => ({ ...state, overId, projection }));
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeData = event.active.data.current as GearDragData | undefined;
    const overData = event.over?.data.current as GearDropData | undefined;

    if (!activeData || !overData || overData.type !== "gear-zone") {
      resetDrag();
      return;
    }

    const result = moveInventoryRecord(
      activeData.recordId,
      dropTargetToLocationInput(overData.target),
    );

    if (!result.ok) {
      setDragMessage(result.message);
      resetDrag();
      return;
    }

    setDragMessage(undefined);
    resetDrag(activeData.recordId);

    if (justMovedTimer.current) {
      clearTimeout(justMovedTimer.current);
    }

    justMovedTimer.current = setTimeout(() => {
      setDragState((state) =>
        state.justMovedId === activeData.recordId
          ? { ...state, justMovedId: null }
          : state,
      );
    }, 800);
  }

  function handleCreateFloor() {
    const floorId = createEntity({ name: "Floor", entityType: "storage" });

    if (floorId) {
      setFloorEntityId(partyId, floorId);
    } else {
      setDragMessage("Only the GM can create the Floor.");
    }
  }

  const activeRecord = dragState.activeRecordId
    ? getRecordById(dragState.activeRecordId, records)
    : undefined;

  return (
    <GearDragContext.Provider value={dragState}>
      <DndContext
        sensors={sensors}
        collisionDetection={gearCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => resetDrag()}
      >
        <section
          className={`gear-page${dragState.activeRecordId ? " is-dragging" : ""}`}
          aria-label="Party gear"
        >
          <div className="gear-board-heading">
            <h2>Gear</h2>
            <p>Drag records to repack a character or hand loot between entities.</p>
            <PartySummary
              entities={floorEntity ? [...boardEntities, floorEntity] : boardEntities}
              boardEntities={boardEntities}
              records={records}
            />
          </div>

          {boardEntities.length === 0 ? (
            <p className="empty-state">No active entities to outfit yet.</p>
          ) : (
            <div className="gear-board">
              {boardEntities.map((entity) => (
                <GearEntityCard
                  key={entity.id}
                  entity={entity}
                  records={records}
                />
              ))}
            </div>
          )}
        </section>

        <FloorBar
          floorEntity={floorEntity}
          records={records}
          onCreateFloor={handleCreateFloor}
        />

        <DragOverlay>
          {activeRecord ? (
            <div className="rs-item rs-item-overlay">
              <span className="rs-item-name">
                {getInventoryRowDisplay(activeRecord, records).primaryText}
              </span>
            </div>
          ) : null}
        </DragOverlay>

        <div className="drag-live-region" role="status" aria-live="polite">
          {dragMessage ?? ""}
        </div>
      </DndContext>
    </GearDragContext.Provider>
  );
}

const gearCollisionDetection: CollisionDetection = (args) => {
  const droppableContainers = args.droppableContainers.filter(
    (container) => container.data.current?.type === "gear-zone",
  );
  const scopedArgs = { ...args, droppableContainers };
  const pointerCollisions = pointerWithin(scopedArgs);

  return pointerCollisions.length > 0
    ? pointerCollisions
    : closestCenter(scopedArgs);
};

// ---------------------------------------------------------------------------
// Entity cards
// ---------------------------------------------------------------------------

function GearEntityCard({
  entity,
  records,
}: {
  entity: Entity;
  records: InventoryRecord[];
}) {
  if (isCharacterLikeEntity(entity)) {
    return <CharacterGearCard entity={entity} records={records} />;
  }

  return <ContentsGearCard entity={entity} records={records} />;
}

function CharacterGearCard({
  entity,
  records,
}: {
  entity: Entity;
  records: InventoryRecord[];
}) {
  const sections = getInventorySections(
    entity,
    records,
  ) as CharacterInventorySections;
  const encumbrance = getCharacterEncumbrance(entity, records);
  const subtitle = formatCharacterSubtitle(entity);

  return (
    <article className="gear-card" data-inactive={!entity.active}>
      <header className="gear-card-header">
        <div className="gear-card-identity">
          <h3 className="gear-card-name">{entity.name}</h3>
          {subtitle ? <p className="gear-card-subtitle">{subtitle}</p> : null}
        </div>
        <MovementBadge encumbrance={encumbrance} />
      </header>

      <EncumbranceLine encumbrance={encumbrance} />

      <section className="gear-zone gear-ready" aria-label="Ready">
        <p className="gear-zone-label">Ready</p>
        <HandRows entityId={entity.id} sections={sections} records={records} />
        <WornZone entityId={entity.id} records={records} worn={sections.otherEquipped} />
      </section>

      <section className="gear-zone gear-stowed" aria-label="Stowed">
        <p className="gear-zone-label">Stowed</p>
        <CoinPurseLine record={sections.coinRecord} />
        {sections.topLevelStowedContainerRecord ? (
          <ContainerBlock
            entityId={entity.id}
            container={sections.topLevelStowedContainerRecord}
            records={records}
          />
        ) : (
          <p className="empty-state compact">No stowed container.</p>
        )}
      </section>
    </article>
  );
}

function ContentsGearCard({
  entity,
  records,
}: {
  entity: Entity;
  records: InventoryRecord[];
}) {
  const capacity = getContentsCapacity(entity, records);
  const contents = sortInventoryRecordsBySortOrder(
    getOwnedRecords(entity.id, records).filter(
      (record) => record.location.kind === "contents",
    ),
  );

  return (
    <article className="gear-card" data-inactive={!entity.active}>
      <header className="gear-card-header">
        <div className="gear-card-identity">
          <h3 className="gear-card-name">{entity.name}</h3>
          <p className="gear-card-subtitle">
            {capitalize(entity.entityType)}
            {entity.baseMovementFeet !== undefined
              ? ` · ${entity.baseMovementFeet}′`
              : ""}
          </p>
        </div>
        <span className="gear-capacity-readout">
          {capacity.usedSlots}
          {capacity.capacitySlots === undefined ? "" : `/${capacity.capacitySlots}`}
        </span>
      </header>

      <section className="gear-zone gear-contents" aria-label="Contents">
        <p className="gear-zone-label">Contents</p>
        <GearDropZone
          dropId={contentsDropId(entity.id)}
          target={{ entityId: entity.id, placement: "contents" }}
          className="gear-zone-body"
        >
          <RecordRows
            entityId={entity.id}
            records={contents}
            allRecords={records}
            emptyLabel="Empty"
          />
        </GearDropZone>
      </section>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Header pieces
// ---------------------------------------------------------------------------

function PartySummary({
  entities,
  boardEntities,
  records,
}: {
  entities: Entity[];
  boardEntities: Entity[];
  records: InventoryRecord[];
}) {
  const entityIds = new Set(entities.map((entity) => entity.id));
  const treasureGp = records.reduce((total, record) => {
    if (!entityIds.has(record.entityId)) {
      return total;
    }

    if (record.recordType === "treasure") {
      return total + record.treasure.gpValue;
    }

    if (record.recordType === "coins") {
      return total + getCoinGpValue(record.coins);
    }

    return total;
  }, 0);

  const stowedHeadroom = boardEntities.reduce((headroom, entity) => {
    if (!isCharacterLikeEntity(entity)) {
      return headroom;
    }

    const { stowedItems } = getCharacterEncumbrance(entity, records);

    return headroom + Math.max(0, 16 - stowedItems);
  }, 0);

  return (
    <p className="gear-party-summary">
      <span>{formatGp(treasureGp)} gp on the table</span>
      <span aria-hidden="true">·</span>
      <span>{stowedHeadroom} stowed slots free across the party</span>
    </p>
  );
}

function formatGp(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString("en-US")
    : Number(value.toFixed(2)).toLocaleString("en-US");
}

function MovementBadge({
  encumbrance,
}: {
  encumbrance: CharacterEncumbranceResult;
}) {
  const tone = encumbrance.overloaded
    ? "crit"
    : encumbrance.band === "normal"
      ? "ok"
      : "warn";
  const text = encumbrance.overloaded
    ? "0′"
    : `${encumbrance.movement.explorationFeet}′ (${encumbrance.movement.encounterFeet}′)`;

  return <span className={`gear-move-badge tone-${tone}`}>{text}</span>;
}

function EncumbranceLine({
  encumbrance,
}: {
  encumbrance: CharacterEncumbranceResult;
}) {
  const total = encumbrance.equippedItems + encumbrance.stowedItems;
  const reason = encumbrance.overloaded
    ? ` — overloaded${encumbrance.overloadedReason ? ` (${encumbrance.overloadedReason})` : ""}`
    : "";

  return (
    <p
      className={`gear-enc-line${encumbrance.overloaded ? " is-overloaded" : ""}`}
    >
      equipped {encumbrance.equippedItems} · stowed {encumbrance.stowedItems} ·
      total {total}/16{reason}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Ready zone
// ---------------------------------------------------------------------------

function HandRows({
  entityId,
  sections,
  records,
}: {
  entityId: string;
  sections: CharacterInventorySections;
  records: InventoryRecord[];
}) {
  const bothHandsRecord = getRecordById(
    sections.handRecordIds.bothHands,
    records,
  );

  if (bothHandsRecord) {
    return (
      <div className="gear-hands">
        <HandSlot
          entityId={entityId}
          placement="bothHands"
          label="Both hands"
          record={bothHandsRecord}
          records={records}
        />
      </div>
    );
  }

  return (
    <div className="gear-hands">
      <HandSlot
        entityId={entityId}
        placement="leftHand"
        label="Left"
        record={getRecordById(sections.handRecordIds.leftHand, records)}
        records={records}
      />
      <HandSlot
        entityId={entityId}
        placement="rightHand"
        label="Right"
        record={getRecordById(sections.handRecordIds.rightHand, records)}
        records={records}
      />
    </div>
  );
}

function HandSlot({
  entityId,
  placement,
  label,
  record,
  records,
}: {
  entityId: string;
  placement: "leftHand" | "rightHand" | "bothHands";
  label: string;
  record?: InventoryRecord;
  records: InventoryRecord[];
}) {
  return (
    <GearDropZone
      dropId={handDropId(entityId, placement)}
      target={{ entityId, placement }}
      className="gear-hand-slot"
    >
      <span className="gear-hand-label">{label}</span>
      {record ? (
        <DraggableRecordRow record={record} allRecords={records} />
      ) : (
        <span className="gear-slot-empty">empty</span>
      )}
    </GearDropZone>
  );
}

function WornZone({
  entityId,
  worn,
  records,
}: {
  entityId: string;
  worn: InventoryRecord[];
  records: InventoryRecord[];
}) {
  return (
    <div className="gear-worn">
      <p className="gear-subzone-label">Worn</p>
      <GearDropZone
        dropId={looseDropId(entityId)}
        target={{ entityId, placement: "equippedLoose" }}
        className="gear-zone-body"
      >
        <RecordRows
          entityId={entityId}
          records={worn}
          allRecords={records}
          emptyLabel="Nothing worn"
        />
      </GearDropZone>
    </div>
  );
}

function CoinPurseLine({ record }: { record?: InventoryRecord }) {
  if (!record || record.recordType !== "coins") {
    return <p className="empty-state compact">No coins</p>;
  }

  const display = getInventoryRowDisplay(record, [record]);

  return (
    <div className="rs-item rs-item-static gear-coin-line">
      <span className="rs-item-name">{display.primaryText}</span>
      <SlotPipIndicator slots={getRecordSlotBurden(record)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Containers + record rows
// ---------------------------------------------------------------------------

function ContainerBlock({
  entityId,
  container,
  records,
}: {
  entityId: string;
  container: InventoryRecord;
  records: InventoryRecord[];
}) {
  const contents = getContainerContents(container, records);

  return (
    <div className="gear-container">
      <DraggableRecordRow record={container} allRecords={records} />
      <GearDropZone
        dropId={containerDropId(entityId, container.id)}
        target={{ entityId, placement: "container", containerId: container.id }}
        className="gear-container-body"
      >
        <RecordRows
          entityId={entityId}
          records={contents}
          allRecords={records}
          emptyLabel="Empty"
        />
      </GearDropZone>
    </div>
  );
}

function RecordRows({
  entityId,
  records,
  allRecords,
  emptyLabel,
}: {
  entityId: string;
  records: InventoryRecord[];
  allRecords: InventoryRecord[];
  emptyLabel: string;
}) {
  if (records.length === 0) {
    return <p className="gear-slot-empty">{emptyLabel}</p>;
  }

  return (
    <>
      {records.map((record) =>
        record.container ? (
          <ContainerBlock
            key={record.id}
            entityId={entityId}
            container={record}
            records={allRecords}
          />
        ) : record.recordType === "coins" ? (
          <div className="rs-item rs-item-static" key={record.id}>
            <RecordRowContent record={record} allRecords={allRecords} />
          </div>
        ) : (
          <DraggableRecordRow
            key={record.id}
            record={record}
            allRecords={allRecords}
          />
        ),
      )}
    </>
  );
}

function DraggableRecordRow({
  record,
  allRecords,
}: {
  record: InventoryRecord;
  allRecords: InventoryRecord[];
}) {
  const drag = useContext(GearDragContext);
  const data: GearDragData = { type: "gear-record", recordId: record.id };
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: recordDraggableId(record.id), data });
  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;
  const className = [
    "rs-item",
    isDragging ? "is-dragging" : "",
    drag.justMovedId === record.id ? "just-moved" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={setNodeRef} style={style} className={className} data-record-id={record.id}>
      <button
        type="button"
        className="rs-grip grip"
        aria-label={`Move ${getInventoryRowDisplay(record, allRecords).primaryText}`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <RecordRowContent record={record} allRecords={allRecords} />
    </div>
  );
}

function RecordRowContent({
  record,
  allRecords,
}: {
  record: InventoryRecord;
  allRecords: InventoryRecord[];
}) {
  const display = getInventoryRowDisplay(record, allRecords);
  const isLit = record.recordType !== "coins" && record.light?.isLit === true;
  const isUnidentified =
    record.recordType !== "coins" &&
    record.recordType !== "treasure" &&
    record.identification?.identified === false;

  return (
    <>
      <span className="rs-item-name">{display.primaryText}</span>
      {isUnidentified ? (
        <span className="rs-tag rs-tag-unid" title="Unidentified item">
          ?
        </span>
      ) : null}
      {isLit ? <LitMarker record={record} /> : null}
      {display.secondaryText ? (
        <span className="rs-item-secondary">· {display.secondaryText}</span>
      ) : null}
      <span className="rs-item-right">
        {record.container ? (
          <ContainerCapacity record={record} allRecords={allRecords} />
        ) : (
          <SlotPipIndicator slots={getRecordSlotBurden(record)} />
        )}
      </span>
    </>
  );
}

function ContainerCapacity({
  record,
  allRecords,
}: {
  record: InventoryRecord;
  allRecords: InventoryRecord[];
}) {
  const usage = getContainerSlotUsage(record, allRecords);
  const overCapacity =
    usage.capacitySlots !== undefined && usage.usedSlots > usage.capacitySlots;

  return (
    <span className={`rs-capacity${overCapacity ? " is-over" : ""}`}>
      {usage.usedSlots}
      {usage.capacitySlots === undefined ? "" : `/${usage.capacitySlots}`}
    </span>
  );
}

function LitMarker({ record }: { record: InventoryRecord }) {
  if (record.recordType === "coins") {
    return null;
  }

  const description = record.light?.lightDescription?.trim();
  const uses = record.uses;
  const usesText = uses
    ? uses.max !== undefined
      ? `${uses.current}/${uses.max}`
      : `${uses.current}`
    : undefined;

  return (
    <span className="rs-lit" title="Light source is lit">
      <span aria-hidden="true">🔥</span>
      {description ? <span className="rs-lit-desc">{description}</span> : null}
      {usesText ? <span className="rs-lit-uses">{usesText}</span> : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Drop zone
// ---------------------------------------------------------------------------

function GearDropZone({
  dropId,
  target,
  className,
  children,
}: {
  dropId: string;
  target: GearDropTarget;
  className: string;
  children: ReactNode;
}) {
  const drag = useContext(GearDragContext);
  const data: GearDropData = { type: "gear-zone", target };
  const { setNodeRef, isOver } = useDroppable({ id: dropId, data });
  const projection = isOver && drag.overId === dropId ? drag.projection : null;

  return (
    <div
      ref={setNodeRef}
      className={`dropzone ${className}${isOver ? " is-over" : ""}${
        projection?.invalid ? " is-invalid" : ""
      }`}
      data-projection={projection?.text ?? undefined}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Floor
// ---------------------------------------------------------------------------

function FloorBar({
  floorEntity,
  records,
  onCreateFloor,
}: {
  floorEntity?: Entity;
  records: InventoryRecord[];
  onCreateFloor: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (!floorEntity) {
    return (
      <div className="gear-floor">
        <div className="gear-floor-header">
          <span className="gear-floor-title">The Floor</span>
          <span className="gear-floor-summary">not set up</span>
          <button type="button" className="gear-floor-toggle" onClick={onCreateFloor}>
            Create the Floor
          </button>
        </div>
      </div>
    );
  }

  const capacity = getContentsCapacity(floorEntity, records);
  const contents = sortInventoryRecordsBySortOrder(
    getOwnedRecords(floorEntity.id, records).filter(
      (record) => record.location.kind === "contents",
    ),
  );

  return (
    <div className={`gear-floor${collapsed ? " is-collapsed" : ""}`}>
      <div className="gear-floor-header">
        <span className="gear-floor-title">The Floor</span>
        <span className="gear-floor-summary">
          {contents.length} {contents.length === 1 ? "lot" : "lots"} ·{" "}
          {capacity.usedSlots} {capacity.usedSlots === 1 ? "slot" : "slots"}
        </span>
        <button
          type="button"
          className="gear-floor-toggle"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </div>

      {collapsed ? null : (
        <GearDropZone
          dropId={contentsDropId(floorEntity.id)}
          target={{ entityId: floorEntity.id, placement: "contents" }}
          className="gear-floor-body"
        >
          {contents.length === 0 ? (
            <p className="gear-slot-empty">nothing on the floor</p>
          ) : (
            <div className="gear-floor-chips">
              {contents.map((record) =>
                record.container ? (
                  <ContainerBlock
                    key={record.id}
                    entityId={floorEntity.id}
                    container={record}
                    records={records}
                  />
                ) : record.recordType === "coins" ? (
                  <div className="rs-item rs-item-static" key={record.id}>
                    <RecordRowContent record={record} allRecords={records} />
                  </div>
                ) : (
                  <DraggableRecordRow
                    key={record.id}
                    record={record}
                    allRecords={records}
                  />
                ),
              )}
            </div>
          )}
        </GearDropZone>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCharacterSubtitle(entity: Entity): string {
  const character = entity.character;

  if (!character) {
    return capitalize(entity.entityType);
  }

  const className = character.className.trim();
  const parts: string[] = [];

  if (className) {
    parts.push(className);
  }

  if (character.level !== null) {
    parts.push(`level ${character.level}`);
  }

  return parts.length > 0 ? parts.join(" · ") : capitalize(entity.entityType);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

import { Link, useParams } from "react-router-dom";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getCharacterArmorClass } from "../model/calculations";
import { normalizeCharacterData } from "../model/characters";
import { getSortedEntities } from "../model/entities";
import {
  getCharacterEncumbrance,
  getEncumbranceWarnings,
} from "../model/encumbrance";
import {
  getInventorySections,
  getOwnedRecords,
} from "../model/inventoryDisplay";
import {
  isCharacterLikeEntity,
  validateInventoryState,
} from "../model/validation";
import type { AppState } from "../model/appState";
import type { Entity, EntityId, PartyRole } from "../model/types";
import {
  formatMovementFeet,
  formatMovementPair,
  formatNullablePartyNumber,
  formatPartyClassLevel,
  formatPartyHands,
  formatPartyHp,
  formatPartyLanguages,
  formatPartySpellLines,
  formatWarningState,
  getInventoryRowStatusIcon,
  getInventoryRowStatusTitle,
  getInventoryRowStatusTone,
  getPartyLitSources,
  isPartyMemberHurt,
} from "../formatters";
import type { PartyHandDisplay, PartyOverviewCard } from "../view-types";
import { ItemStatusIcon } from "../components/InventoryIcons";
import { WarningDetailsButton } from "../ui/WarningDetailsButton";
import { getDisplayValidationIssues } from "../entity/EntityStatus";

export const PARTY_BENCH_DROP_ID = "party-bench-zone";
export const PARTY_ACTIVE_DROP_ID = "party-active-zone";

export function PartyPage({
  appState,
  sortedEntities,
  currentUserPartyRole,
  onSetEntityActive,
  onReorderEntity,
}: {
  appState: AppState;
  sortedEntities: Entity[];
  currentUserPartyRole?: PartyRole | null;
  onSetEntityActive: (entityId: EntityId, active: boolean) => void;
  onReorderEntity: (entityId: EntityId, targetIndex: number) => void;
}) {
  const { partyId } = useParams<{ partyId: string }>();
  const includeSecrets = currentUserPartyRole !== "player";
  const cards = getPartyOverviewCards(appState, sortedEntities, includeSecrets);
  const activeCards = cards.filter((card) => card.active);
  const benchedCards = cards.filter((card) => !card.active);
  const activeById = new Map(cards.map((card) => [card.id, card.active]));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  // One drag interaction drives both marching order and benching: drop on a
  // row to take its place (activating first if dragged from the bench), drop
  // on the bench zone to deactivate.
  function handleDragEnd(event: DragEndEvent) {
    const draggedId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;

    if (!overId || overId === draggedId) {
      return;
    }

    const draggedIsActive = activeById.get(draggedId) ?? false;

    if (overId === PARTY_BENCH_DROP_ID) {
      if (draggedIsActive) {
        onSetEntityActive(draggedId, false);
      }
      return;
    }

    if (overId === PARTY_ACTIVE_DROP_ID) {
      if (!draggedIsActive) {
        onSetEntityActive(draggedId, true);
      }
      return;
    }

    if (activeById.get(overId) === undefined || !activeById.get(overId)) {
      return;
    }

    if (!draggedIsActive) {
      onSetEntityActive(draggedId, true);
    }

    // Rows above the drop target keep their indices through activation, so
    // the pre-change position of the target row is a stable target index.
    const targetIndex = sortedEntities.findIndex(
      (entity) => entity.id === overId,
    );

    if (targetIndex !== -1) {
      onReorderEntity(draggedId, targetIndex);
    }
  }

  return (
    <section
      className="entity-workspace party-page"
      aria-labelledby="party-title"
    >
      <div className="section-heading">
        <h2 id="party-title">Party</h2>
      </div>

      {cards.length === 0 ? (
        <p className="empty-state">No characters or retainers yet.</p>
      ) : (
        <>
          <PartySummary cards={activeCards} />

          <DndContext
            collisionDetection={closestCenter}
            sensors={sensors}
            onDragEnd={handleDragEnd}
          >
            {activeCards.length > 0 ? (
              <div className="party-table-scroll">
                <table className="party-table" aria-label="Party overview">
                  <thead>
                    <tr>
                      <th className="pt-grip-cell">
                        <span className="visually-hidden">Marching order</span>
                      </th>
                      <PartyHeaderCells />
                    </tr>
                  </thead>
                  <tbody>
                    <SortableContext
                      items={activeCards.map((card) => card.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {activeCards.map((card) => (
                        <SortablePartyRow card={card} key={card.id}>
                          <PartyRowCells card={card} partyId={partyId} />
                        </SortablePartyRow>
                      ))}
                    </SortableContext>
                  </tbody>
                </table>
              </div>
            ) : (
              <ActivateDropZone />
            )}

            <BenchedSection benchedCards={benchedCards} partyId={partyId} />
          </DndContext>
        </>
      )}
    </section>
  );
}

/** Drop target shown when everyone is benched. */
function ActivateDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: PARTY_ACTIVE_DROP_ID });

  return (
    <p
      ref={setNodeRef}
      className={`empty-state party-drop-strip${isOver ? " drop-over" : ""}`}
    >
      No active characters — drag someone here to activate.
    </p>
  );
}

function BenchedSection({
  benchedCards,
  partyId,
}: {
  benchedCards: PartyOverviewCard[];
  partyId: string | undefined;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: PARTY_BENCH_DROP_ID });

  return (
    <div
      ref={setNodeRef}
      className={`party-benched${isOver ? " drop-over" : ""}`}
    >
      <h3 className="micro">Benched</h3>
      {benchedCards.length === 0 ? (
        <p className="empty-state party-drop-strip">
          Drag a character here to bench them — splitting the party, staying in
          town, and so on.
        </p>
      ) : (
        <div className="party-table-scroll">
          <table className="party-table" aria-label="Benched characters">
            <tbody>
              {benchedCards.map((card) => (
                <DraggablePartyRow card={card} key={card.id}>
                  <PartyRowCells card={card} partyId={partyId} />
                </DraggablePartyRow>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PartyHeaderCells() {
  return (
    <>
      <th className="pt-name">Name</th>
      <th className="pt-num">HP</th>
      <th className="pt-num">AC</th>
      <th className="pt-num">MV</th>
      <th className="pt-hands">Hands</th>
      <th className="pt-spells">Spells</th>
      <th className="pt-languages">Languages</th>
    </>
  );
}

function SortablePartyRow({
  card,
  children,
}: {
  card: PartyOverviewCard;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  return (
    <tr
      ref={setNodeRef}
      className={isDragging ? "pt-dragging" : undefined}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <td className="pt-grip-cell">
        <button
          aria-label={`Reorder or bench ${card.name}`}
          className="pt-grip"
          type="button"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
      </td>
      {children}
    </tr>
  );
}

/** Benched rows aren't sortable among themselves; they just drag out. */
function DraggablePartyRow({
  card,
  children,
}: {
  card: PartyOverviewCard;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: card.id });

  return (
    <tr
      ref={setNodeRef}
      className={isDragging ? "pt-dragging" : undefined}
      style={{ transform: CSS.Translate.toString(transform) }}
    >
      <td className="pt-grip-cell">
        <button
          aria-label={`Activate ${card.name} by dragging into the party`}
          className="pt-grip"
          type="button"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
      </td>
      {children}
    </tr>
  );
}

/** The shared data cells (everything after the grip column). */
function PartyRowCells({
  card,
  partyId,
}: {
  card: PartyOverviewCard;
  partyId: string | undefined;
}) {
  return (
    <>
      <td className="pt-name">
        <div className="pt-name-cell">
          <Link
            className="pt-char-name"
            to={`/party/${partyId}/characters?c=${card.id}`}
          >
            {card.name}
          </Link>
          <WarningDetailsButton
            validationIssues={card.validationIssues}
            warnings={card.warnings}
          />
        </div>
        <div className="pt-class">{card.classLevel}</div>
      </td>
      <td className="pt-num" data-hurt={card.hurt}>
        {card.hp}
      </td>
      <td className="pt-num">{card.ac}</td>
      <td className="pt-num">
        <span className={`mv ${card.movementTone}`}>{card.movement}</span>
      </td>
      <td className="pt-hands">
        {card.hands.map((hand) => (
          <PartyHandRow hand={hand} key={hand.label} />
        ))}
      </td>
      <td className="pt-spells">
        {card.spellLines.map((line) => (
          <div className="pt-spell-line" key={line.label}>
            <span className="pt-hlabel">{line.label}</span>
            <span className="pt-spell-names">{line.text}</span>
          </div>
        ))}
      </td>
      <td className="pt-languages">{card.languages}</td>
    </>
  );
}

/** Referee strip above the table: slowest active movement, every working
 * light source, and the languages the active party can read or speak. */
function PartySummary({ cards }: { cards: PartyOverviewCard[] }) {
  if (cards.length === 0) {
    return null;
  }

  const slowestFeet = cards.reduce(
    (slowest, card) => Math.min(slowest, card.movementFeet),
    Number.POSITIVE_INFINITY,
  );
  const litSources = cards.flatMap((card) =>
    card.litSources.map((source) => ({ ...source, bearer: card.name })),
  );
  const languages = [
    ...new Set(cards.flatMap((card) => card.languagesList)),
  ];

  return (
    <div className="party-summary">
      <div className="party-summary-item">
        <span className="micro">Party move</span>
        <span className="party-summary-value mono">
          {formatMovementFeet(slowestFeet)}
        </span>
      </div>
      <div className="party-summary-item">
        <span className="micro">Light</span>
        {litSources.length === 0 ? (
          <span className="empty-label">none lit</span>
        ) : (
          <span className="party-summary-value">
            {litSources.map((source, index) => (
              <span className="party-light" key={`${source.bearer}-${index}`}>
                <span className="dot lit" />
                {source.name}
                <span className="party-light-meta">
                  {source.bearer}
                  {source.uses ? ` · ${source.uses}` : ""}
                </span>
              </span>
            ))}
          </span>
        )}
      </div>
      <div className="party-summary-item party-summary-languages">
        <span className="micro">Languages</span>
        {languages.length === 0 ? (
          <span className="empty-label">none</span>
        ) : (
          <span className="party-summary-value">{languages.join(", ")}</span>
        )}
      </div>
    </div>
  );
}

function PartyHandRow({ hand }: { hand: PartyHandDisplay }) {
  const glyphs = hand.statuses.map((status) =>
    status === "lit" ? (
      <span className="dot lit" key={status} title="Lit" />
    ) : (
      <span
        className="pt-glyph"
        key={status}
        title={getInventoryRowStatusTitle(status)}
      >
        <ItemStatusIcon
          name={getInventoryRowStatusIcon(status)}
          tone={getInventoryRowStatusTone(status)}
        />
      </span>
    ),
  );

  if (hand.text === null) {
    return (
      <div className="pt-hand">
        <span className="pt-hlabel">{hand.label}</span>
        <span className="empty-label">empty</span>
      </div>
    );
  }

  if (!hand.detail) {
    return (
      <div className="pt-hand">
        <span className="pt-hlabel">{hand.label}</span>
        <span className="pt-hand-item">{hand.text}</span>
        {glyphs}
      </div>
    );
  }

  return (
    <div className="pt-hand">
      <span className="pt-hlabel">{hand.label}</span>
      <details className="pt-hand-pop">
        <summary className="pt-hand-item">{hand.text}</summary>
        <div className="pt-hand-pop-panel">
          {hand.detail.weapon ? (
            <p className="pt-pop-line mono">{hand.detail.weapon}</p>
          ) : null}
          {hand.detail.uses ? (
            <p className="pt-pop-line mono">{hand.detail.uses}</p>
          ) : null}
          {hand.detail.light ? (
            <p className="pt-pop-line">{hand.detail.light}</p>
          ) : null}
          {hand.detail.description ? (
            <p className="pt-pop-line">{hand.detail.description}</p>
          ) : null}
          {hand.detail.secretName ? (
            <p className="pt-pop-secret">
              <span className="micro">GM</span> {hand.detail.secretName}
            </p>
          ) : null}
          {hand.detail.secretDescription ? (
            <p className="pt-pop-secret">{hand.detail.secretDescription}</p>
          ) : null}
        </div>
      </details>
      {glyphs}
    </div>
  );
}

export function getPartyOverviewCards(
  appState: AppState,
  sortedEntities: Entity[] = getSortedEntities(appState.entities),
  includeSecrets = false,
): PartyOverviewCard[] {
  const validationResult = validateInventoryState(
    appState.entities,
    appState.inventoryRecords,
  );

  return sortedEntities.filter(isCharacterLikeEntity).map((entity) => {
    const character = normalizeCharacterData(entity.character);
    const ownedRecords = getOwnedRecords(entity.id, appState.inventoryRecords);
    const sections = getInventorySections(entity, appState.inventoryRecords);
    const encumbrance = getCharacterEncumbrance(entity, appState.inventoryRecords);
    const armorClass = getCharacterArmorClass(
      entity,
      appState.inventoryRecords,
      character,
    );
    const warnings = getEncumbranceWarnings(entity, appState.inventoryRecords);
    const validationIssues = getDisplayValidationIssues([
      ...validationResult.errors,
      ...validationResult.warnings,
    ].filter(
      (issue) =>
        issue.entityId === entity.id ||
        (issue.recordId !== undefined &&
          ownedRecords.some((record) => record.id === issue.recordId)),
    ));

    return {
      id: entity.id,
      name: entity.name,
      entityType: entity.entityType,
      active: entity.active,
      classLevel: formatPartyClassLevel(character),
      hp: formatPartyHp(character),
      hurt: isPartyMemberHurt(character),
      movement: formatMovementPair(encumbrance.movement),
      movementTone: encumbrance.overloaded
        ? ("zero" as const)
        : encumbrance.band === "heavilyEncumbered"
          ? ("reduced" as const)
          : ("" as const),
      movementFeet: encumbrance.movement.explorationFeet,
      languages: formatPartyLanguages(character),
      languagesList: character.languages,
      litSources: getPartyLitSources(ownedRecords),
      spellLines: formatPartySpellLines(character),
      hands:
        sections.mode === "characterLike"
          ? formatPartyHands(sections, appState.inventoryRecords, includeSecrets)
          : [],
      ac: formatNullablePartyNumber(armorClass.armorClass),
      validationIssues,
      warningCount: warnings.length + validationIssues.length,
      warningSummary: formatWarningState(warnings, validationIssues),
      warnings,
    };
  });
}

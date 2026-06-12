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
import type { Entity } from "../model/types";
import {
  formatMovementFeet,
  formatNullablePartyNumber,
  formatPartyAbilityScores,
  formatPartyClassLevel,
  formatPartyHands,
  formatPartyHp,
  formatPartyLanguages,
  formatWarningState,
  getInventoryRowStatusIcon,
  getInventoryRowStatusTitle,
  getInventoryRowStatusTone,
  isPartyMemberHurt,
} from "../formatters";
import type { PartyHandDisplay, PartyOverviewCard } from "../view-types";
import { ItemStatusIcon } from "../components/InventoryIcons";
import { WarningDetailsButton } from "../ui/WarningDetailsButton";
import { getDisplayValidationIssues } from "../entity/EntityStatus";

const ABILITY_COLUMN_LABELS = ["S", "I", "W", "D", "C", "Ch"];

export function PartyPage({
  appState,
  sortedEntities,
}: {
  appState: AppState;
  sortedEntities: Entity[];
}) {
  const cards = getPartyOverviewCards(appState, sortedEntities);
  const movementFeet = cards.reduce(
    (slowestMovement, card) => Math.min(slowestMovement, card.movementFeet),
    Number.POSITIVE_INFINITY,
  );

  return (
    <section
      className="entity-workspace party-page"
      aria-labelledby="party-title"
    >
      <div className="section-heading">
        <div>
          <h2 id="party-title">Party</h2>
          <p>Table-facing character and retainer status.</p>
        </div>
        {cards.length > 0 ? (
          <span className="party-move-summary">
            Party move <b>{formatMovementFeet(movementFeet)}</b>
          </span>
        ) : null}
      </div>

      {cards.length === 0 ? (
        <p className="empty-state">No characters or retainers yet.</p>
      ) : (
        <div className="party-table-scroll">
          <table className="party-table" aria-label="Party overview">
            <thead>
              <tr>
                <th className="pt-name">Name</th>
                <th className="pt-num">HP</th>
                <th className="pt-num">AC</th>
                <th className="pt-num">MV</th>
                {ABILITY_COLUMN_LABELS.map((label) => (
                  <th className="pt-num pt-ability" key={label}>
                    {label}
                  </th>
                ))}
                <th className="pt-hands">Hands</th>
                <th className="pt-languages">Languages</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((card) => (
                <tr key={card.id}>
                  <td className="pt-name">
                    <div className="pt-name-cell">
                      <span className="pt-char-name">{card.name}</span>
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
                    <span className={`mv ${card.movementTone}`}>
                      {card.movement}
                    </span>
                  </td>
                  {card.abilityScores.map((score) => (
                    <td className="pt-num pt-ability" key={score.label}>
                      {score.value}
                    </td>
                  ))}
                  <td className="pt-hands">
                    {card.hands.map((hand) => (
                      <PartyHandRow hand={hand} key={hand.label} />
                    ))}
                  </td>
                  <td className="pt-languages">{card.languages}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PartyHandRow({ hand }: { hand: PartyHandDisplay }) {
  return (
    <div className="pt-hand">
      <span className="pt-hlabel">{hand.label}</span>
      {hand.text === null ? (
        <span className="empty-label">empty</span>
      ) : (
        <span className="pt-hand-item">{hand.text}</span>
      )}
      {hand.statuses.map((status) =>
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
      )}
    </div>
  );
}

export function getPartyOverviewCards(
  appState: AppState,
  sortedEntities: Entity[] = getSortedEntities(appState.entities),
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
      classLevel: formatPartyClassLevel(character),
      hp: formatPartyHp(character),
      hurt: isPartyMemberHurt(character),
      movement: `${formatMovementFeet(encumbrance.movement.explorationFeet)} (${formatMovementFeet(encumbrance.movement.encounterFeet)})`,
      movementTone: encumbrance.overloaded
        ? ("zero" as const)
        : encumbrance.band === "heavilyEncumbered"
          ? ("reduced" as const)
          : ("" as const),
      movementFeet: encumbrance.movement.explorationFeet,
      languages: formatPartyLanguages(character),
      hands:
        sections.mode === "characterLike"
          ? formatPartyHands(sections, appState.inventoryRecords)
          : [],
      abilityScores: formatPartyAbilityScores(character),
      ac: formatNullablePartyNumber(armorClass.armorClass),
      validationIssues,
      warningCount: warnings.length + validationIssues.length,
      warningSummary: formatWarningState(warnings, validationIssues),
      warnings,
    };
  });
}

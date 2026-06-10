import { NavLink } from "react-router-dom";
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
  formatPartyAbilityScores,
  formatPartyArmorClass,
  formatPartyClassLevel,
  formatPartyHands,
  formatPartyHp,
  formatPartyLanguages,
  formatWarningState,
  isPartyMemberHurt,
} from "../formatters";
import type { PartyOverviewCard } from "../view-types";
import { WarningDetailsButton } from "../ui/WarningDetailsButton";
import { getDisplayValidationIssues } from "../entity/EntityStatus";

export function PartyPage({
  appState,
  inventoryPath,
  sortedEntities,
}: {
  appState: AppState;
  inventoryPath: string;
  sortedEntities: Entity[];
}) {
  const cards = getPartyOverviewCards(appState, sortedEntities);
  const movementFeet = cards.reduce(
    (slowestMovement, card) => Math.min(slowestMovement, card.movementFeet),
    Number.POSITIVE_INFINITY,
  );

  return (
    <section className="entity-workspace" aria-labelledby="party-title">
      <div className="section-heading">
        <div>
          <h2 id="party-title">
            Party {cards.length > 0 ? `(${formatMovementFeet(movementFeet)})` : ""}
          </h2>
          <p>Table-facing character and retainer status.</p>
        </div>
        <NavLink className="text-link-button" to={inventoryPath}>
          Inventory
        </NavLink>
      </div>

      {cards.length === 0 ? (
        <p className="empty-state">No characters or retainers yet.</p>
      ) : (
        <ul className="party-card-grid" aria-label="Party overview">
          {cards.map((card) => (
            <li
              className="party-card"
              data-warning-state={card.warningCount > 0}
              key={card.id}
            >
              <div className="party-card-heading">
                <div>
                  <h3>{card.name}</h3>
                  <p>{card.classLevel}</p>
                </div>
                <div className="party-card-status">
                  <span>{card.movement}</span>
                  <WarningDetailsButton
                    validationIssues={card.validationIssues}
                    warnings={card.warnings}
                  />
                </div>
              </div>

              <div className="party-stat-grid">
                <span>HP {card.hp}</span>
                <span>{card.ac}</span>
              </div>

              <div className="party-ability-row" aria-label="Ability scores">
                {card.abilityScores.map((score) => (
                  <span key={score.label}>
                    <strong>{score.label}</strong>
                    {score.value}
                  </span>
                ))}
              </div>

              <div className="party-card-section">
                <span>Hands</span>
                <div className="party-hands-list">
                  {[0, 1].map((index) => (
                    <span key={index}>{card.hands[index] ?? " "}</span>
                  ))}
                </div>
              </div>
              <div className="party-card-section">
                <span>Languages</span>
                <p>{card.languages}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
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
      movement: formatMovementFeet(encumbrance.movement.explorationFeet),
      movementFeet: encumbrance.movement.explorationFeet,
      languages: formatPartyLanguages(character),
      hands:
        sections.mode === "characterLike"
          ? formatPartyHands(sections, appState.inventoryRecords)
          : [],
      abilityScores: formatPartyAbilityScores(character),
      ac: formatPartyArmorClass(armorClass.armorClass),
      validationIssues,
      warningCount: warnings.length + validationIssues.length,
      warningSummary: formatWarningState(warnings, validationIssues),
      warnings,
    };
  });
}

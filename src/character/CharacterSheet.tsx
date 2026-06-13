import { type FormEvent, useState } from "react";
import { getAbilityModifier } from "../model/abilityModifiers";
import { getCharacterArmorClass } from "../model/calculations";
import {
  ABILITY_SCORE_KEYS,
  ABILITY_SCORE_LABELS,
  getSpellMemorizationWarnings,
  normalizeCharacterData,
} from "../model/characters";
import {
  getClassContentLookup,
  getClassLevelTables,
} from "../model/classContent";
import { getCharacterEncumbrance } from "../model/encumbrance";
import {
  getCharacterSaveLookup,
  getClassSpellSlots,
  getThac0,
  getXpProgress,
} from "../model/saveTables";
import { getSpellLookup } from "../model/spellLibrary";
import type { AppState } from "../model/appState";
import type {
  CharacterData,
  CharacterSpell,
  Entity,
  EntityId,
  InventoryRecord,
} from "../model/types";
import type { EntityMutationResult } from "../store/useAppStore";
import {
  formatMovementFeet,
  formatNullablePartyNumber,
  formatPartyClassLevel,
  formatPartyLanguages,
  formatSignedNumber,
} from "../formatters";
import type { AbilityModifierResult } from "../model/abilityModifiers";
import { QuickStepper } from "./QuickStat";
import { CharacterSheetInventory } from "./CharacterSheetInventory";

export function CharacterSheet({
  appState,
  entity,
  onAdjustHp,
  onAdjustXp,
  onAdjustSpellMemorized,
  onEdit,
  onStartAddRecord,
  onEditRecord,
}: {
  appState: AppState;
  entity: Entity;
  onAdjustHp: (entityId: EntityId, delta: number) => EntityMutationResult;
  onAdjustXp: (entityId: EntityId, delta: number) => EntityMutationResult;
  onAdjustSpellMemorized: (
    entityId: EntityId,
    spellId: string,
    delta: number,
  ) => EntityMutationResult;
  onEdit: () => void;
  onStartAddRecord: (entity: Entity) => void;
  onEditRecord: (record: InventoryRecord) => void;
}) {
  const [quickError, setQuickError] = useState<string | undefined>();
  const character = normalizeCharacterData(entity.character);
  const armorClass = getCharacterArmorClass(
    entity,
    appState.inventoryRecords,
    character,
  );
  const encumbrance = getCharacterEncumbrance(entity, appState.inventoryRecords);
  const saveLookup = getCharacterSaveLookup(character.className, character.level);
  const xpProgress = getXpProgress(
    character.className,
    character.level,
    character.xp,
  );
  const spellSlots = getClassSpellSlots(character.className, character.level);
  const classContent = getClassContentLookup(character.className);
  const levelTables = getClassLevelTables(character.className, character.level);
  const memorizationWarnings = getSpellMemorizationWarnings(character);

  function reportQuickResult(result: EntityMutationResult) {
    setQuickError(result.ok ? undefined : result.message);
  }

  function adjustCurrentHp(delta: number) {
    reportQuickResult(onAdjustHp(entity.id, delta));
  }

  function adjustMemorized(spellId: string, delta: number) {
    reportQuickResult(onAdjustSpellMemorized(entity.id, spellId, delta));
  }

  const primeRequisiteText = classContent.ok
    ? classContent.primeRequisites
        .map((key) => ABILITY_SCORE_LABELS[key])
        .join(", ")
    : "";

  return (
    <section
      className="character-sheet-panel"
      aria-label={`${entity.name} character sheet`}
    >
      <div className="sheet-header">
        <div className="sheet-identity">
          <strong>{formatPartyClassLevel(character)}</strong>
          {primeRequisiteText ? <span>Prime {primeRequisiteText}</span> : null}
        </div>
        <div className="sheet-header-actions">
          <XpQuickAdd
            character={character}
            onAddXp={(amount) => reportQuickResult(onAdjustXp(entity.id, amount))}
          />
          <button type="button" onClick={onEdit}>
            Edit sheet
          </button>
        </div>
      </div>

      <XpProgressLine character={character} xpProgress={xpProgress} />

      {quickError ? <p className="form-error">{quickError}</p> : null}

      <div className="sheet-combat-strip">
        <div className="stat-box big">
          <span>HP</span>
          <div className="sheet-stat-value">
            <strong>
              {formatNullablePartyNumber(character.hp.current)}
              <em>/{formatNullablePartyNumber(character.hp.max)}</em>
            </strong>
            <QuickStepper
              decrementDisabled={(character.hp.current ?? 0) <= 0}
              label="current HP"
              onDecrement={() => adjustCurrentHp(-1)}
              onIncrement={() => adjustCurrentHp(1)}
            />
          </div>
        </div>
        <div
          className="stat-box big"
          title={
            armorClass.warnings.length > 0
              ? armorClass.warnings.join(" ")
              : undefined
          }
        >
          <span>AC</span>
          <strong>{formatNullablePartyNumber(armorClass.armorClass)}</strong>
        </div>
        <AttackBox
          label="Melee"
          attackBonus={saveLookup.ok ? saveLookup.attackBonus : null}
          abilityModifier={getAbilityModifier(character.abilityScores.strength)}
        />
        <AttackBox
          label="Missile"
          attackBonus={saveLookup.ok ? saveLookup.attackBonus : null}
          abilityModifier={getAbilityModifier(character.abilityScores.dexterity)}
        />
        <div className="stat-box big">
          <span>Move</span>
          <strong>{formatMovementFeet(encumbrance.movement.explorationFeet)}</strong>
          <em className="stat-sub">
            {formatMovementFeet(encumbrance.movement.encounterFeet)} encounter
          </em>
        </div>
      </div>

      {!saveLookup.ok ? (
        <p className="sheet-lookup-note">{saveLookup.message}</p>
      ) : null}

      <div className="sheet-grid">
        <div className="sheet-column">
          <section className="sheet-panel">
            <h5>Ability Scores</h5>
            <div className="sheet-stat-lines" aria-label="Ability scores">
              {ABILITY_SCORE_KEYS.map((key) => {
                const score = character.abilityScores[key];
                const modifier = getAbilityModifier(score);

                return (
                  <div className="sheet-stat-line" key={key}>
                    <span>{ABILITY_SCORE_LABELS[key]}</span>
                    <strong>
                      {formatNullablePartyNumber(score)}
                      {modifier.ok ? (
                        <em> {formatSignedNumber(modifier.modifier)}</em>
                      ) : null}
                    </strong>
                  </div>
                );
              })}
            </div>
            <h5>Saving Throws</h5>
            <div className="sheet-stat-lines" aria-label="Saving throws">
              {saveLookup.saves.map((save) => (
                <div className="sheet-stat-line" key={save.key}>
                  <span>{save.label}</span>
                  <strong>
                    {Number.isFinite(save.value) ? save.value : "—"}
                  </strong>
                </div>
              ))}
            </div>
          </section>
          {character.skills.length > 0 || levelTables.length > 0 ? (
            <section className="sheet-panel">
              <h5>Skills</h5>
              {character.skills.map((skill) => (
                <div className="sheet-skill-row" key={skill.id} title={skill.description}>
                  <span>{skill.name}</span>
                  <strong>{skill.chanceInSix} in 6</strong>
                </div>
              ))}
              {levelTables.map((table) => (
                <div className="sheet-level-table" key={table.id}>
                  <h6>{table.name}</h6>
                  <div
                    className="sheet-level-table-grid"
                    style={{
                      gridTemplateColumns: `repeat(${table.columns.length}, minmax(0, 1fr))`,
                    }}
                  >
                    {table.columns.map((column) => (
                      <span key={column}>{column}</span>
                    ))}
                    {table.columns.map((column, columnIndex) => (
                      <strong key={column}>
                        {table.values?.[columnIndex] ?? "—"}
                      </strong>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ) : null}

          <section className="sheet-panel">
            <h5>Languages</h5>
            <p className="sheet-text">{formatPartyLanguages(character)}</p>
          </section>
        </div>

        <div className="sheet-column">
          {(classContent.ok && classContent.abilities.length > 0) ||
          character.features.length > 0 ? (
            <section className="sheet-panel">
              <h5>Class Abilities</h5>
              {classContent.ok
                ? classContent.abilities.map((ability) => (
                    <details className="sheet-ability-details" key={ability.id}>
                      <summary>{ability.name}</summary>
                      <p>{ability.description}</p>
                    </details>
                  ))
                : null}
              {character.features.map((feature) => (
                <details className="sheet-ability-details" key={feature.id}>
                  <summary>{feature.name || "Feature"}</summary>
                  <p>{feature.description || "—"}</p>
                </details>
              ))}
            </section>
          ) : null}
          {character.spells.length > 0 ||
          (spellSlots.ok && spellSlots.slots.length > 0) ? (
            <section className="sheet-panel">
              <h5>Spells</h5>
              {spellSlots.ok && spellSlots.slots.length > 0 ? (
                <div className="sheet-slot-summary">
                  {spellSlots.slots.map((slot) => {
                    const memorized = character.spells
                      .filter((spell) => spell.level === slot.spellLevel)
                      .reduce((total, spell) => total + spell.memorized, 0);

                    return (
                      <span key={slot.spellLevel}>
                        L{slot.spellLevel}{" "}
                        <strong>
                          {memorized}/{slot.count}
                        </strong>
                      </span>
                    );
                  })}
                </div>
              ) : null}
              {memorizationWarnings.map((warning) => (
                <p className="sheet-warning" key={warning}>
                  {warning}
                </p>
              ))}
              {[...character.spells]
                .sort(
                  (left, right) =>
                    left.level - right.level ||
                    left.name.localeCompare(right.name),
                )
                .map((spell) => (
                  <SpellRow
                    key={spell.id}
                    preferredListId={
                      classContent.ok ? classContent.spellListId : undefined
                    }
                    spell={spell}
                    onAdjustMemorized={(delta) =>
                      adjustMemorized(spell.id, delta)
                    }
                  />
                ))}
            </section>
          ) : null}
        </div>

        <div className="sheet-column">
          <section className="sheet-panel">
            <CharacterSheetInventory
              appState={appState}
              entity={entity}
              onStartAddRecord={onStartAddRecord}
              onEditRecord={onEditRecord}
            />
          </section>
        </div>
      </div>

      {character.description ? (
        <details className="sheet-description">
          <summary>Description / notes</summary>
          <p>{character.description}</p>
        </details>
      ) : null}
    </section>
  );
}

/** Melee/missile attack: class attack bonus adjusted by STR or DEX, with the
 * matching THAC0 as a subline. Falls back to the base bonus when the ability
 * score or modifier table can't resolve. */
function AttackBox({
  label,
  attackBonus,
  abilityModifier,
}: {
  label: string;
  attackBonus: number | null;
  abilityModifier: AbilityModifierResult;
}) {
  if (attackBonus === null) {
    return (
      <div className="stat-box big">
        <span>{label}</span>
        <strong>—</strong>
      </div>
    );
  }

  const bonus = attackBonus + (abilityModifier.ok ? abilityModifier.modifier : 0);

  return (
    <div className="stat-box big">
      <span>{label}</span>
      <strong>{formatSignedNumber(bonus)}</strong>
      <em className="stat-sub">THAC0 {getThac0(bonus)}</em>
    </div>
  );
}

function XpQuickAdd({
  character,
  onAddXp,
}: {
  character: CharacterData;
  onAddXp: (amount: number) => void;
}) {
  const [amountText, setAmountText] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amount = Number(amountText);

    if (!Number.isInteger(amount) || amount === 0) {
      return;
    }

    if (amount < 0 && (character.xp ?? 0) + amount < 0) {
      return;
    }

    onAddXp(amount);
    setAmountText("");
  }

  return (
    <form className="sheet-xp-add" onSubmit={handleSubmit}>
      <input
        aria-label="XP to add"
        inputMode="numeric"
        placeholder="XP"
        size={6}
        type="text"
        value={amountText}
        onChange={(event) => setAmountText(event.target.value)}
      />
      <button type="submit">Add XP</button>
    </form>
  );
}

function XpProgressLine({
  character,
  xpProgress,
}: {
  character: CharacterData;
  xpProgress: ReturnType<typeof getXpProgress>;
}) {
  const xpText = formatNullablePartyNumber(character.xp);

  if (!xpProgress.ok || xpProgress.nextLevelXp === null) {
    return (
      <p className="sheet-xp-line">
        <span>XP {xpText}</span>
        {xpProgress.ok ? <span>Max level</span> : null}
      </p>
    );
  }

  const xp = character.xp ?? 0;
  const span = xpProgress.nextLevelXp - xpProgress.currentLevelXp;
  const progress =
    span > 0
      ? Math.min(1, Math.max(0, (xp - xpProgress.currentLevelXp) / span))
      : 0;

  return (
    <div className="sheet-xp-line">
      <span>
        XP {xpText} / {xpProgress.nextLevelXp}
      </span>
      <span
        aria-hidden="true"
        className="sheet-xp-bar"
        style={{ "--xp-progress": `${Math.round(progress * 100)}%` } as React.CSSProperties}
      />
      {xpProgress.xpToNext !== null ? (
        <span>{xpProgress.xpToNext} to level {xpProgress.level + 1}</span>
      ) : null}
    </div>
  );
}

function SpellRow({
  spell,
  preferredListId,
  onAdjustMemorized,
}: {
  spell: CharacterSpell;
  preferredListId?: string;
  onAdjustMemorized: (delta: number) => void;
}) {
  const lookup = getSpellLookup(spell.name, preferredListId);

  return (
    <div className="sheet-spell-row" data-memorized={spell.memorized > 0}>
      <div className="sheet-spell-main">
        <span className="sheet-inventory-tag">L{spell.level}</span>
        {lookup.ok ? (
          <details className="sheet-spell-details">
            <summary>{spell.name}</summary>
            <p>
              {[
                lookup.spell.reversible ? "Reversible" : "",
                lookup.spell.duration ? `Duration ${lookup.spell.duration}` : "",
                lookup.spell.range ? `Range ${lookup.spell.range}` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p>{lookup.spell.description}</p>
          </details>
        ) : (
          <span className="sheet-spell-name" title={spell.notes}>
            {spell.name}
          </span>
        )}
        {spell.notes ? (
          <span className="record-secondary">· {spell.notes}</span>
        ) : null}
      </div>
      <div className="sheet-spell-memorized">
        <strong>{spell.memorized}</strong>
        <QuickStepper
          decrementDisabled={spell.memorized <= 0}
          label={`${spell.name} memorized`}
          onDecrement={() => onAdjustMemorized(-1)}
          onIncrement={() => onAdjustMemorized(1)}
        />
      </div>
    </div>
  );
}

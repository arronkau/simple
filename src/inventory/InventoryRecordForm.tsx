import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  getUsableContainerRecords,
  getLocationPlacementKey,
  type InventoryRecordFormInput,
  type InventoryRecordPlacementKey,
} from "../model/inventoryRecords";
import {
  createInventoryRecordInputFromStandardItem,
  filterStandardItems,
  type StandardItemCatalogEntry,
} from "../model/standardItems";
import { getContainerContents, getRecordById } from "../model/inventoryDisplay";
import { getSortedEntities } from "../model/entities";
import { isCharacterLikeEntity } from "../model/validation";
import { getRecordHandsRequired } from "../model/types";
import type { AppState } from "../model/appState";
import type {
  Entity,
  HandsRequired,
  InventoryRecord,
  InventoryRecordId,
  InventoryRecordType,
  Modifier,
  PartyRole,
} from "../model/types";
import {
  MODIFIER_TARGET_OPTIONS,
  RECORD_TYPE_LABELS,
  RECORD_TYPES,
  createFormRowId,
  type ModifierFormRow,
  type RecordFormState,
} from "../view-types";
import { getRecordDisplayName } from "../formatters";
import { NumberField } from "../ui/NumberField";

export function InventoryRecordForm({
  appState,
  currentUserPartyRole,
  entity,
  formState,
  message,
  onCancel,
  onChange,
  onDelete,
  onSpendCoins,
  onSubmit,
  onTransferCoins,
}: {
  appState: AppState;
  currentUserPartyRole?: PartyRole | null;
  entity: Entity;
  formState: RecordFormState;
  message?: string;
  onCancel: () => void;
  onChange: (formState: RecordFormState) => void;
  onDelete?: () => void;
  onSpendCoins?: (record: InventoryRecord) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTransferCoins?: (record: InventoryRecord) => void;
}) {
  const targetEntity =
    appState.entities.find(
      (candidateEntity) => candidateEntity.id === formState.targetEntityId,
    ) ?? entity;
  const containerOptions = getContainerOptions({
    entity: targetEntity,
    isContainer: formState.isContainer,
    records: appState.inventoryRecords,
    editingRecordId: formState.recordId,
  });
  const placementOptions = getPlacementOptions({
    isContainer: formState.isContainer,
    recordType: formState.recordType,
    targetEntity,
    records: appState.inventoryRecords,
  }).filter(
    (placementOption) =>
      placementOption.value !== "container" || containerOptions.length > 0,
  );
  const showLocationControls = formState.showMovement;
  const showContainerSelect = formState.placement === "container";
  const showNonCoinFields = formState.recordType !== "coins";
  const showContainerFields =
    formState.recordType !== "coins" && formState.recordType !== "treasure";
  const showIdentificationFields =
    formState.recordType === "weapon" ||
    formState.recordType === "armor" ||
    formState.recordType === "equipment";
  const isGm = currentUserPartyRole === "gm" || currentUserPartyRole == null;
  const showGmIdentificationFields = showIdentificationFields && isGm;
  const standardItemSuggestions = getStandardItemSuggestions(formState);
  const [itemSuggestionsOpen, setItemSuggestionsOpen] = useState(false);
  const [highlightedItemSuggestionIndex, setHighlightedItemSuggestionIndex] =
    useState(0);
  const autocompleteRef = useRef<HTMLDivElement | null>(null);
  const autocompleteListboxId = useId();
  const highlightedItemSuggestion =
    itemSuggestionsOpen && standardItemSuggestions.length > 0
      ? standardItemSuggestions[highlightedItemSuggestionIndex]
      : undefined;
  const highlightedItemSuggestionId = highlightedItemSuggestion
    ? `${autocompleteListboxId}-${highlightedItemSuggestion.slug}`
    : undefined;
  const showItemSuggestions =
    itemSuggestionsOpen && standardItemSuggestions.length > 0;
  const locationSummary = formatRecordFormLocationSummary({
    containerOptions,
    formState,
    placementOptions,
    targetEntity,
  });
  const coinActionRecord = formState.recordId
    ? getRecordById(formState.recordId, appState.inventoryRecords)
    : undefined;

  useEffect(() => {
    if (standardItemSuggestions.length === 0) {
      setItemSuggestionsOpen(false);
      setHighlightedItemSuggestionIndex(0);
      return;
    }

    setHighlightedItemSuggestionIndex((currentIndex) =>
      Math.min(currentIndex, standardItemSuggestions.length - 1),
    );
  }, [standardItemSuggestions.length]);

  useEffect(() => {
    function closeSuggestionsOnOutsidePointerDown(event: PointerEvent) {
      if (
        autocompleteRef.current &&
        event.target instanceof Node &&
        !autocompleteRef.current.contains(event.target)
      ) {
        setItemSuggestionsOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeSuggestionsOnOutsidePointerDown);

    return () => {
      document.removeEventListener(
        "pointerdown",
        closeSuggestionsOnOutsidePointerDown,
      );
    };
  }, []);

  function selectStandardItemSuggestion(item: StandardItemCatalogEntry) {
    const input = createInventoryRecordInputFromStandardItem(item.slug);

    if (input) {
      onChange(applyInventoryRecordInputToFormState(formState, input));
    }

    setItemSuggestionsOpen(false);
  }

  function handleItemNameKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (standardItemSuggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setItemSuggestionsOpen(true);
      setHighlightedItemSuggestionIndex((currentIndex) =>
        itemSuggestionsOpen
          ? (currentIndex + 1) % standardItemSuggestions.length
          : 0,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setItemSuggestionsOpen(true);
      setHighlightedItemSuggestionIndex((currentIndex) =>
        itemSuggestionsOpen
          ? (currentIndex - 1 + standardItemSuggestions.length) %
            standardItemSuggestions.length
          : standardItemSuggestions.length - 1,
      );
      return;
    }

    if (event.key === "Enter" && itemSuggestionsOpen) {
      event.preventDefault();
      selectStandardItemSuggestion(
        standardItemSuggestions[highlightedItemSuggestionIndex],
      );
      return;
    }

    if (event.key === "Escape" && itemSuggestionsOpen) {
      event.preventDefault();
      setItemSuggestionsOpen(false);
    }
  }

  function changeRecordType(recordType: InventoryRecordType) {
    if (formState.mode === "edit" || recordType === formState.recordType) {
      return;
    }

    onChange({
      ...formState,
      recordType,
      handsRequired: getDefaultHandsRequired(recordType).toString() as
        | "0"
        | "1"
        | "2",
      placement: "default",
      containerId: "",
    });
  }

  return (
    <form className="record-form modal-form" onSubmit={onSubmit}>
      <div className="modal-header record-form-heading">
        <div>
          <h4>{formState.mode === "edit" ? "Edit item" : "Add item"}</h4>
          <p className="form-help">
            {formState.mode === "edit"
              ? `${RECORD_TYPE_LABELS[formState.recordType]} for ${entity.name}`
              : `New item for ${entity.name}`}
          </p>
          {message ? <p className="form-error">{message}</p> : null}
        </div>
      </div>

      <div
        aria-label="Item type"
        className="record-type-tabs"
        role="tablist"
      >
        {RECORD_TYPES.map((recordType) => {
          const active = recordType === formState.recordType;

          return (
            <button
              aria-disabled={formState.mode === "edit"}
              aria-selected={active}
              data-active={active}
              key={recordType}
              role="tab"
              type="button"
              onClick={() => changeRecordType(recordType)}
            >
              {RECORD_TYPE_LABELS[recordType]}
            </button>
          );
        })}
      </div>

      <div className="modal-body record-form-body">
        <section className="record-form-section record-core-section">
          {formState.recordType === "coins" ? (
            <div className="record-coin-grid">
              <NumberField
                label="PP"
                value={formState.pp}
                onChange={(value) => onChange({ ...formState, pp: value })}
              />
              <NumberField
                label="GP"
                value={formState.gp}
                onChange={(value) => onChange({ ...formState, gp: value })}
              />
              <NumberField
                label="SP"
                value={formState.sp}
                onChange={(value) => onChange({ ...formState, sp: value })}
              />
              <NumberField
                label="CP"
                value={formState.cp}
                onChange={(value) => onChange({ ...formState, cp: value })}
              />
            </div>
          ) : (
            <>
              <div className="record-core-grid">
                <div className="autocomplete-field" ref={autocompleteRef}>
                  <label>
                    <span>Name</span>
                    <input
                      aria-activedescendant={highlightedItemSuggestionId}
                      aria-autocomplete="list"
                      aria-controls={
                        showItemSuggestions ? autocompleteListboxId : undefined
                      }
                      aria-expanded={showItemSuggestions}
                      aria-haspopup="listbox"
                      autoComplete="off"
                      maxLength={100}
                      required
                      role="combobox"
                      type="text"
                      value={formState.name}
                      onChange={(event) => {
                        onChange({ ...formState, name: event.target.value });
                        setItemSuggestionsOpen(true);
                        setHighlightedItemSuggestionIndex(0);
                      }}
                      onFocus={() => {
                        if (standardItemSuggestions.length > 0) {
                          setItemSuggestionsOpen(true);
                          setHighlightedItemSuggestionIndex(0);
                        }
                      }}
                      onKeyDown={handleItemNameKeyDown}
                    />
                  </label>
                  {showItemSuggestions ? (
                    <div
                      id={autocompleteListboxId}
                      className="autocomplete-suggestions"
                      aria-label="Standard item suggestions"
                      role="listbox"
                    >
                      {standardItemSuggestions.map((item, itemIndex) => (
                        <button
                          id={`${autocompleteListboxId}-${item.slug}`}
                          aria-selected={
                            itemIndex === highlightedItemSuggestionIndex
                          }
                          className={
                            itemIndex === highlightedItemSuggestionIndex
                              ? "highlighted"
                              : undefined
                          }
                          key={item.slug}
                          role="option"
                          type="button"
                          onClick={() => selectStandardItemSuggestion(item)}
                          onMouseDown={(event) => {
                            event.preventDefault();
                          }}
                          onMouseEnter={() => {
                            setHighlightedItemSuggestionIndex(itemIndex);
                          }}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <NumberField
                  label="Quantity"
                  value={formState.quantity}
                  onChange={(value) =>
                    onChange({ ...formState, quantity: value })
                  }
                />
                <NumberField
                  label={
                    formState.stackable ? "Items per slot" : "Slots per item"
                  }
                  step={formState.stackable ? "1" : "0.25"}
                  value={
                    formState.stackable
                      ? formState.itemsPerSlot
                      : formState.slotsPerItem
                  }
                  onChange={(value) =>
                    onChange(
                      formState.stackable
                        ? { ...formState, itemsPerSlot: value }
                        : { ...formState, slotsPerItem: value },
                    )
                  }
                />
              </div>

              <label className="record-description-field">
                <span>Description</span>
                <textarea
                  className="description-field"
                  maxLength={160}
                  rows={3}
                  value={formState.description}
                  onChange={(event) =>
                    onChange({ ...formState, description: event.target.value })
                  }
                />
              </label>
            </>
          )}
        </section>

        {showNonCoinFields ? (
          <section className="record-form-section">
            <h5>Options</h5>
            <div className="record-options-grid">
              <label className="checkbox-field">
                <input
                  checked={formState.stackable}
                  type="checkbox"
                  onChange={(event) =>
                    onChange({
                      ...formState,
                      stackable: event.target.checked,
                    })
                  }
                />
                <span>Stackable</span>
              </label>
              {showContainerFields ? (
                <label className="checkbox-field">
                  <input
                    checked={formState.isContainer}
                    type="checkbox"
                    onChange={(event) =>
                      onChange({
                        ...formState,
                        isContainer: event.target.checked,
                      })
                    }
                  />
                  <span>Container</span>
                </label>
              ) : null}
              {showGmIdentificationFields ? (
                <label className="checkbox-field">
                  <input
                    checked={formState.isUnidentified}
                    type="checkbox"
                    onChange={(event) =>
                      onChange({
                        ...formState,
                        isUnidentified: event.target.checked,
                      })
                    }
                  />
                  <span>Unidentified</span>
                </label>
              ) : null}
              {showNonCoinFields ? (
                <label className="checkbox-field">
                  <input
                    checked={formState.isMagic}
                    type="checkbox"
                    onChange={(event) =>
                      onChange({
                        ...formState,
                        isMagic: event.target.checked,
                      })
                    }
                  />
                  <span>Magic item</span>
                </label>
              ) : null}
              <label className="checkbox-field">
                <input
                  checked={formState.isLight}
                  type="checkbox"
                  onChange={(event) =>
                    onChange({
                      ...formState,
                      isLight: event.target.checked,
                      trackUses: event.target.checked,
                    })
                  }
                />
                <span>Light source</span>
              </label>
              {!formState.isLight ? (
                <label className="checkbox-field">
                  <input
                    checked={formState.trackUses}
                    type="checkbox"
                    onChange={(event) =>
                      onChange({
                        ...formState,
                        trackUses: event.target.checked,
                      })
                    }
                  />
                  <span>Track uses / charges</span>
                </label>
              ) : null}
              <label className="checkbox-field">
                <input
                  checked={formState.addModifiers}
                  type="checkbox"
                  onChange={(event) =>
                    onChange({
                      ...formState,
                      addModifiers: event.target.checked,
                    })
                  }
                />
                <span>This item modifies a stat</span>
              </label>
              {formState.recordType === "weapon" ? (
                <label className="checkbox-field">
                  <input
                    checked={formState.addWeaponQualities}
                    type="checkbox"
                    onChange={(event) =>
                      onChange({
                        ...formState,
                        addWeaponQualities: event.target.checked,
                      })
                    }
                  />
                  <span>Add weapon qualities</span>
                </label>
              ) : null}
              <label className="checkbox-field">
                <input
                  checked={formState.notesEnabled}
                  type="checkbox"
                  onChange={(event) =>
                    onChange({
                      ...formState,
                      notesEnabled: event.target.checked,
                    })
                  }
                />
                <span>Add GM notes</span>
              </label>
            </div>
          </section>
        ) : null}

        {formState.recordType === "treasure" ? (
          <section className="record-form-section">
            <h5>Treasure details</h5>
            <div className="record-detail-grid two-column">
              <NumberField
                label="GP value"
                step="0.01"
                value={formState.gpValue}
                onChange={(value) =>
                  onChange({ ...formState, gpValue: value })
                }
              />
            </div>
          </section>
        ) : null}

        {formState.recordType === "weapon" ? (
          <section className="record-form-section">
            <h5>Weapon details</h5>
            <div className="record-detail-grid three-column">
              <label>
                <span>Hands required</span>
                <select
                  value={formState.handsRequired}
                  onChange={(event) =>
                    onChange({
                      ...formState,
                      handsRequired: event.target.value as "0" | "1" | "2",
                    })
                  }
                >
                  <option value="0">None</option>
                  <option value="1">One</option>
                  <option value="2">Two</option>
                </select>
              </label>
              <label>
                <span>Damage</span>
                <input
                  autoComplete="off"
                  maxLength={40}
                  type="text"
                  value={formState.damage}
                  onChange={(event) =>
                    onChange({ ...formState, damage: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Range</span>
                <input
                  autoComplete="off"
                  maxLength={40}
                  type="text"
                  value={formState.range}
                  onChange={(event) =>
                    onChange({ ...formState, range: event.target.value })
                  }
                />
              </label>
            </div>
          </section>
        ) : null}

        {formState.recordType === "armor" ? (
          <section className="record-form-section">
            <h5>Armor details</h5>
            <div className="record-detail-grid two-column">
              <NumberField
                label="Base AC"
                value={formState.baseArmorClass}
                onChange={(value) =>
                  onChange({ ...formState, baseArmorClass: value })
                }
              />
              <NumberField
                label="Armor bonus"
                value={formState.armorBonus}
                onChange={(value) =>
                  onChange({ ...formState, armorBonus: value })
                }
              />
            </div>
          </section>
        ) : null}

        {formState.isContainer && showContainerFields ? (
          <section className="record-form-section">
            <h5>Container details</h5>
            <div className="record-detail-grid three-column">
              <NumberField
                label="Container capacity"
                step="0.25"
                value={formState.capacitySlots}
                onChange={(value) =>
                  onChange({ ...formState, capacitySlots: value })
                }
              />
              <label>
                <span>Hands required to carry</span>
                <select
                  value={formState.handsRequired}
                  onChange={(event) =>
                    onChange({
                      ...formState,
                      handsRequired: event.target.value as "0" | "1" | "2",
                    })
                  }
                >
                  <option value="0">None</option>
                  <option value="1">One</option>
                  <option value="2">Two</option>
                </select>
              </label>
            </div>
          </section>
        ) : null}

        {formState.isUnidentified && showGmIdentificationFields ? (
          <section className="record-form-section">
            <h5>Identification details</h5>
            <div className="record-detail-grid two-column">
              <label>
                <span>Secret name</span>
                <input
                  autoComplete="off"
                  maxLength={100}
                  type="text"
                  value={formState.secretName}
                  onChange={(event) =>
                    onChange({
                      ...formState,
                      secretName: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>Secret description</span>
                <input
                  autoComplete="off"
                  maxLength={160}
                  type="text"
                  value={formState.secretDescription}
                  onChange={(event) =>
                    onChange({
                      ...formState,
                      secretDescription: event.target.value,
                    })
                  }
                />
              </label>
            </div>
          </section>
        ) : null}

        {formState.isLight && showNonCoinFields ? (
          <section className="record-form-section">
            <h5>Light source details</h5>
            <div className="record-detail-grid four-column">
              <label className="wide-field">
                <span>Light description</span>
                <input
                  autoComplete="off"
                  maxLength={120}
                  type="text"
                  value={formState.lightDescription}
                  onChange={(event) =>
                    onChange({
                      ...formState,
                      lightDescription: event.target.value,
                    })
                  }
                />
              </label>
              <label className="checkbox-field">
                <input
                  checked={formState.isLit}
                  type="checkbox"
                  onChange={(event) =>
                    onChange({ ...formState, isLit: event.target.checked })
                  }
                />
                <span>Currently lit</span>
              </label>
              <NumberField
                label="Current uses"
                value={formState.usesCurrent}
                onChange={(value) =>
                  onChange({ ...formState, usesCurrent: value })
                }
              />
              <NumberField
                label="Max uses"
                value={formState.usesMax}
                onChange={(value) =>
                  onChange({ ...formState, usesMax: value })
                }
              />
            </div>
          </section>
        ) : null}

        {formState.trackUses && !formState.isLight && showNonCoinFields ? (
          <section className="record-form-section">
            <h5>Uses / charges</h5>
            <div className="record-detail-grid two-column">
              <NumberField
                label="Current uses"
                value={formState.usesCurrent}
                onChange={(value) =>
                  onChange({ ...formState, usesCurrent: value })
                }
              />
              <NumberField
                label="Max uses"
                value={formState.usesMax}
                onChange={(value) =>
                  onChange({ ...formState, usesMax: value })
                }
              />
            </div>
          </section>
        ) : null}

        {formState.addModifiers && showNonCoinFields ? (
          <section className="record-form-section">
            <h5>Modifiers</h5>
            <div className="modifier-list">
              {formState.modifiers.map((modifierRow) => (
                <div className="modifier-row" key={modifierRow.id}>
                  <label>
                    <span>Target</span>
                    <select
                      value={modifierRow.target}
                      onChange={(event) =>
                        onChange({
                          ...formState,
                          modifiers: formState.modifiers.map(
                            (candidateRow) =>
                              candidateRow.id === modifierRow.id
                                ? {
                                    ...candidateRow,
                                    target: event.target.value,
                                  }
                                : candidateRow,
                          ),
                        })
                      }
                    >
                      {MODIFIER_TARGET_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <NumberField
                    label="Value"
                    min="-99"
                    value={modifierRow.value}
                    onChange={(value) =>
                      onChange({
                        ...formState,
                        modifiers: formState.modifiers.map((candidateRow) =>
                          candidateRow.id === modifierRow.id
                            ? { ...candidateRow, value }
                            : candidateRow,
                        ),
                      })
                    }
                  />
                  <label>
                    <span>Label</span>
                    <input
                      autoComplete="off"
                      maxLength={80}
                      type="text"
                      value={modifierRow.label}
                      onChange={(event) =>
                        onChange({
                          ...formState,
                          modifiers: formState.modifiers.map(
                            (candidateRow) =>
                              candidateRow.id === modifierRow.id
                                ? {
                                    ...candidateRow,
                                    label: event.target.value,
                                  }
                                : candidateRow,
                          ),
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...formState,
                        modifiers: formState.modifiers.filter(
                          (candidateRow) => candidateRow.id !== modifierRow.id,
                        ),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...formState,
                    modifiers: [
                      ...formState.modifiers,
                      createEmptyModifierFormRow(),
                    ],
                  })
                }
              >
                Add modifier
              </button>
            </div>
          </section>
        ) : null}

        {formState.recordType === "weapon" && formState.addWeaponQualities ? (
          <section className="record-form-section">
            <h5>Weapon qualities</h5>
            <label>
              <span>Qualities</span>
              <input
                autoComplete="off"
                maxLength={160}
                type="text"
                value={formState.qualities}
                onChange={(event) =>
                  onChange({ ...formState, qualities: event.target.value })
                }
              />
            </label>
          </section>
        ) : null}

        {formState.notesEnabled && showNonCoinFields ? (
          <section className="record-form-section">
            <h5>Private / GM notes</h5>
            <label>
              <span>GM notes</span>
              <textarea
                maxLength={1000}
                rows={3}
                value={formState.notes}
                onChange={(event) =>
                  onChange({ ...formState, notes: event.target.value })
                }
              />
            </label>
          </section>
        ) : null}

        <section className="record-form-section">
          <div className="record-location-heading">
            <div>
              <h5>Location</h5>
              <p>Currently: {locationSummary}</p>
            </div>
            {!formState.showMovement ? (
              <button
                type="button"
                onClick={() => onChange({ ...formState, showMovement: true })}
              >
                Move item...
              </button>
            ) : null}
          </div>
          {showLocationControls ? (
            <div className="record-location-controls">
              <label>
                <span>Owner / Holder</span>
                <select
                  value={formState.targetEntityId}
                  onChange={(event) =>
                    onChange({
                      ...formState,
                      targetEntityId: event.target.value,
                      placement: "default",
                      containerId: "",
                    })
                  }
                >
                  {getSortedEntities(appState.entities).map(
                    (candidateEntity) => (
                      <option
                        key={candidateEntity.id}
                        value={candidateEntity.id}
                      >
                        {candidateEntity.name}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label>
                <span>Location</span>
                <select
                  value={formState.placement}
                  onChange={(event) =>
                    onChange({
                      ...formState,
                      placement: event.target
                        .value as InventoryRecordPlacementKey,
                      containerId: "",
                    })
                  }
                >
                  {placementOptions.map((placementOption) => (
                    <option
                      key={placementOption.value}
                      value={placementOption.value}
                    >
                      {placementOption.label}
                    </option>
                  ))}
                </select>
              </label>
              {showContainerSelect ? (
                <label>
                  <span>Container</span>
                  <select
                    required
                    value={formState.containerId}
                    onChange={(event) =>
                      onChange({
                        ...formState,
                        containerId: event.target.value,
                      })
                    }
                  >
                    <option value="">Select container</option>
                    {containerOptions.map((containerRecord) => (
                      <option
                        key={containerRecord.id}
                        value={containerRecord.id}
                      >
                        {getRecordDisplayName(containerRecord)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>

      <div className="modal-footer split-actions">
        <div>
          {coinActionRecord?.recordType === "coins" ? (
            <div className="record-form-action-group left-actions">
              {onSpendCoins ? (
                <button
                  type="button"
                  onClick={() => onSpendCoins(coinActionRecord)}
                >
                  Spend coins
                </button>
              ) : null}
              {onTransferCoins ? (
                <button
                  type="button"
                  onClick={() => onTransferCoins(coinActionRecord)}
                >
                  Transfer coins
                </button>
              ) : null}
            </div>
          ) : null}
          {onDelete && coinActionRecord?.recordType !== "coins" ? (
            <button className="danger-button" type="button" onClick={onDelete}>
              Delete
            </button>
          ) : null}
        </div>
        <div className="record-form-action-group">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit">
            {formState.mode === "edit" ? "Save record" : "Create record"}
          </button>
        </div>
      </div>
    </form>
  );
}

// ---- Record form utilities ----

export function createEmptyRecordForm(entity: Entity): RecordFormState {
  return {
    mode: "create",
    entityId: entity.id,
    recordType: "equipment",
    targetEntityId: entity.id,
    placement: "default",
    containerId: "",
    name: "",
    description: "",
    pp: "0",
    gp: "0",
    sp: "0",
    cp: "0",
    gpValue: "0",
    damage: "",
    range: "",
    baseArmorClass: "",
    armorBonus: "",
    stackable: false,
    quantity: "1",
    slotsPerItem: "1",
    itemsPerSlot: "1",
    showMovement: false,
    isContainer: false,
    capacitySlots: "0",
    handsRequired: "0",
    isMagic: false,
    isUnidentified: false,
    secretName: "",
    secretDescription: "",
    isLight: false,
    lightDescription: "",
    isLit: false,
    trackUses: false,
    usesCurrent: "0",
    usesMax: "",
    addModifiers: false,
    modifiers: [createEmptyModifierFormRow()],
    notesEnabled: false,
    notes: "",
    addWeaponQualities: false,
    qualities: "",
  };
}

export function createRecordFormFromRecord(record: InventoryRecord): RecordFormState {
  const baseForm = createEmptyRecordForm({
    id: record.entityId,
    name: "",
    entityType: "character",
    active: true,
    sortOrder: 0,
  });
  const slotState = getRecordFormSlotState(record);

  return {
    ...baseForm,
    mode: "edit",
    entityId: record.entityId,
    recordId: record.id,
    recordType: record.recordType,
    targetEntityId: record.entityId,
    placement: getLocationPlacementKey(record.location),
    containerId: "containerId" in record.location ? record.location.containerId : "",
    name: record.recordType === "coins" ? "" : record.name,
    description: record.description ?? "",
    pp: record.recordType === "coins" ? record.coins.pp.toString() : "0",
    gp: record.recordType === "coins" ? record.coins.gp.toString() : "0",
    sp: record.recordType === "coins" ? record.coins.sp.toString() : "0",
    cp: record.recordType === "coins" ? record.coins.cp.toString() : "0",
    gpValue:
      record.recordType === "treasure" ? record.treasure.gpValue.toString() : "0",
    damage: record.recordType === "weapon" ? record.weapon.damage ?? "" : "",
    range: record.recordType === "weapon" ? record.weapon.range ?? "" : "",
    baseArmorClass:
      record.recordType === "armor" && record.armor.baseArmorClass !== undefined
        ? record.armor.baseArmorClass.toString()
        : "",
    armorBonus:
      record.recordType === "armor" && record.armor.armorBonus !== undefined
        ? record.armor.armorBonus.toString()
        : "",
    ...slotState,
    showMovement: isRecordLocationIncomplete(record),
    isContainer: Boolean(record.container),
    capacitySlots: record.container?.capacitySlots.toString() ?? "0",
    handsRequired: getRecordHandsRequired(record).toString() as
      | "0"
      | "1"
      | "2",
    isMagic: record.recordType !== "coins" && record.isMagic === true,
    isUnidentified: record.identification?.identified === false,
    secretName: record.identification?.secretName ?? "",
    secretDescription: record.identification?.secretDescription ?? "",
    isLight: Boolean(record.light),
    lightDescription: record.light?.lightDescription ?? "",
    isLit: record.light?.isLit === true,
    trackUses: Boolean(record.uses),
    usesCurrent: record.uses?.current.toString() ?? "0",
    usesMax: record.uses?.max?.toString() ?? "",
    addModifiers: Boolean(record.modifiers && record.modifiers.length > 0),
    modifiers:
      record.modifiers && record.modifiers.length > 0
        ? record.modifiers.map(createModifierFormRowFromModifier)
        : [createEmptyModifierFormRow()],
    notesEnabled: Boolean(record.notes),
    notes: record.notes ?? "",
    addWeaponQualities:
      record.recordType === "weapon" &&
      Boolean(record.weapon.qualities && record.weapon.qualities.length > 0),
    qualities:
      record.recordType === "weapon" ? record.weapon.qualities?.join(", ") ?? "" : "",
  };
}

function getStandardItemSuggestions(formState: RecordFormState) {
  const query = formState.name.trim();

  if (
    formState.mode !== "create" ||
    formState.recordType === "coins" ||
    formState.recordType === "treasure" ||
    query.length < 2
  ) {
    return [];
  }

  return filterStandardItems(query).slice(0, 8);
}

function formatRecordFormLocationSummary({
  containerOptions,
  formState,
  placementOptions,
  targetEntity,
}: {
  containerOptions: InventoryRecord[];
  formState: RecordFormState;
  placementOptions: Array<{ value: InventoryRecordPlacementKey; label: string }>;
  targetEntity: Entity;
}): string {
  const placementLabel =
    placementOptions.find((option) => option.value === formState.placement)
      ?.label ?? "Default placement";

  if (formState.placement !== "container") {
    return `${targetEntity.name} - ${placementLabel}`;
  }

  const containerRecord = containerOptions.find(
    (record) => record.id === formState.containerId,
  );
  const containerName = containerRecord
    ? getRecordDisplayName(containerRecord)
    : "Select container";

  return `${targetEntity.name} - ${placementLabel} - ${containerName}`;
}

export function applyInventoryRecordInputToFormState(
  formState: RecordFormState,
  input: InventoryRecordFormInput,
): RecordFormState {
  const burden = input.burden ?? { kind: "fixed", slotsPerItem: 1 };
  const isStackable = burden.kind === "stacked";
  const slotsPerItem = burden.kind === "fixed" ? burden.slotsPerItem : 0;
  const itemsPerSlot = burden.kind === "stacked" ? burden.itemsPerSlot : 1;
  const uses = input.uses;
  const handsRequired = (input.handsRequired ?? getDefaultHandsRequired(
    input.recordType,
  )).toString() as "0" | "1" | "2";

  return {
    ...formState,
    recordType: input.recordType,
    name: input.name ?? "",
    description: input.description ?? "",
    gpValue: "0",
    damage: input.recordType === "weapon" ? input.weapon?.damage ?? "" : "",
    range: input.recordType === "weapon" ? input.weapon?.range ?? "" : "",
    baseArmorClass:
      input.recordType === "armor" && input.armor?.baseArmorClass !== undefined
        ? input.armor.baseArmorClass.toString()
        : "",
    armorBonus:
      input.recordType === "armor" && input.armor?.armorBonus !== undefined
        ? input.armor.armorBonus.toString()
        : "",
    stackable: isStackable,
    quantity: (input.quantity ?? 1).toString(),
    slotsPerItem: slotsPerItem.toString(),
    itemsPerSlot: itemsPerSlot.toString(),
    isContainer: Boolean(input.container),
    capacitySlots: (input.container?.capacitySlots ?? 0).toString(),
    handsRequired,
    isMagic: false,
    isUnidentified: false,
    secretName: "",
    secretDescription: "",
    isLight: Boolean(input.light),
    lightDescription: input.light?.lightDescription ?? "",
    isLit: input.light?.isLit === true,
    trackUses: Boolean(uses),
    usesCurrent: (uses?.current ?? 0).toString(),
    usesMax: uses?.max?.toString() ?? "",
    addModifiers: false,
    modifiers: [createEmptyModifierFormRow()],
    notesEnabled: false,
    notes: "",
    addWeaponQualities:
      input.recordType === "weapon" &&
      Boolean(input.weapon?.qualities && input.weapon.qualities.length > 0),
    qualities:
      input.recordType === "weapon"
        ? input.weapon?.qualities?.join(", ") ?? ""
        : "",
  };
}

export function toInventoryRecordFormInput(
  formState: RecordFormState,
): InventoryRecordFormInput {
  const location = {
    entityId: formState.targetEntityId,
    placement: formState.placement,
    ...(formState.containerId ? { containerId: formState.containerId } : {}),
  };
  const sharedInput = {
    recordType: formState.recordType,
    location,
  };

  if (formState.recordType === "coins") {
    return {
      ...sharedInput,
      recordType: "coins",
      coins: {
        pp: parseNumberInput(formState.pp),
        gp: parseNumberInput(formState.gp),
        sp: parseNumberInput(formState.sp),
        cp: parseNumberInput(formState.cp),
      },
    };
  }

  const burden =
    formState.stackable
        ? {
            kind: "stacked" as const,
            itemsPerSlot: parseNumberInput(formState.itemsPerSlot, 1),
          }
        : {
            kind: "fixed" as const,
            slotsPerItem: parseNumberInput(formState.slotsPerItem, 1),
          };
  const handsRequired = Number(formState.handsRequired) as HandsRequired;
  const uses =
    formState.isLight || formState.trackUses
      ? {
          current: parseNumberInput(formState.usesCurrent),
          ...(formState.usesMax
            ? { max: parseNumberInput(formState.usesMax) }
            : {}),
        }
      : undefined;
  const nonCoinSharedInput = {
    ...sharedInput,
    description: formState.description,
    quantity: parseNumberInput(formState.quantity, 1),
    burden,
    handsRequired,
    ...(formState.isLight
      ? {
          light: {
            isLit: formState.isLit,
            lightDescription: formState.lightDescription,
          },
          uses,
        }
      : formState.trackUses
        ? { uses }
        : {}),
    ...(formState.addModifiers
      ? { modifiers: formState.modifiers.map(toModifierInput) }
      : {}),
    ...(formState.notesEnabled ? { notes: formState.notes } : {}),
    ...(formState.isMagic ? { isMagic: true } : {}),
  };
  const container =
    formState.isContainer &&
    formState.recordType !== "treasure"
      ? {
          capacitySlots: parseNumberInput(formState.capacitySlots),
          handsRequired,
        }
      : undefined;
  const identification =
    formState.isUnidentified &&
    formState.recordType !== "treasure"
      ? {
          identified: false,
          secretName: formState.secretName,
          secretDescription: formState.secretDescription,
        }
      : undefined;

  if (formState.recordType === "treasure") {
    return {
      ...nonCoinSharedInput,
      recordType: "treasure",
      name: formState.name,
      gpValue: parseNumberInput(formState.gpValue),
    };
  }

  if (formState.recordType === "weapon") {
    return {
      ...nonCoinSharedInput,
      recordType: "weapon",
      name: formState.name,
      container,
      identification,
      weapon: {
        damage: formState.damage,
        range: formState.range,
        ...(formState.addWeaponQualities
          ? { qualities: parseQualityList(formState.qualities) }
          : {}),
      },
    };
  }

  if (formState.recordType === "armor") {
    return {
      ...nonCoinSharedInput,
      recordType: "armor",
      name: formState.name,
      container,
      identification,
      armor: {
        ...(formState.baseArmorClass
          ? { baseArmorClass: parseNumberInput(formState.baseArmorClass) }
          : {}),
        ...(formState.armorBonus
          ? { armorBonus: parseNumberInput(formState.armorBonus) }
          : {}),
      },
    };
  }

  return {
    ...nonCoinSharedInput,
    recordType: "equipment",
    name: formState.name,
    container,
    identification,
  };
}

export function getDefaultHandsRequired(recordType: InventoryRecordType): HandsRequired {
  return recordType === "weapon" ? 1 : 0;
}

function getContainerOptions({
  editingRecordId,
  entity,
  isContainer,
  records,
}: {
  editingRecordId?: InventoryRecordId;
  entity: Entity;
  isContainer: boolean;
  records: InventoryRecord[];
}) {
  return getUsableContainerRecords({
    editingRecordId,
    entity,
    isContainer,
    records,
  });
}

function getPlacementOptions({
  isContainer,
  recordType,
  records,
  targetEntity,
}: {
  isContainer: boolean;
  recordType: InventoryRecordType;
  records: InventoryRecord[];
  targetEntity: Entity;
}): Array<{ value: InventoryRecordPlacementKey; label: string }> {
  if (recordType === "coins") {
    return isCharacterLikeEntity(targetEntity)
      ? [{ value: "coinPurse", label: "Coin purse" }]
      : [
          { value: "contents", label: "Contents" },
          { value: "container", label: "Container" },
        ];
  }

  if (!isCharacterLikeEntity(targetEntity)) {
    return [
      { value: "contents", label: "Contents" },
      { value: "container", label: "Container" },
    ];
  }

  const options: Array<{ value: InventoryRecordPlacementKey; label: string }> = [
    { value: "equippedLoose", label: "Equipped loose" },
    { value: "leftHand", label: "Left hand" },
    { value: "rightHand", label: "Right hand" },
    { value: "bothHands", label: "Both hands" },
  ];

  if (isContainer) {
    options.push({ value: "stowedRoot", label: "Stowed container" });
  }

  options.push({ value: "container", label: "Inside container" });

  return options;
}

function getRecordFormSlotState(record: InventoryRecord) {
  if (record.recordType === "coins") {
    return {
      stackable: false,
      quantity: "1",
      slotsPerItem: "1",
      itemsPerSlot: "1",
    };
  }

  switch (record.burden.kind) {
    case "none":
      return {
        stackable: false,
        quantity: record.quantity.toString(),
        slotsPerItem: "0",
        itemsPerSlot: "1",
      };
    case "fixed":
      return {
        stackable: false,
        quantity: record.quantity.toString(),
        slotsPerItem: record.burden.slotsPerItem.toString(),
        itemsPerSlot: "1",
      };
    case "stacked":
      return {
        stackable: true,
        quantity: record.quantity.toString(),
        slotsPerItem: "1",
        itemsPerSlot: record.burden.itemsPerSlot.toString(),
      };
  }
}

function createEmptyModifierFormRow(): ModifierFormRow {
  return {
    id: createFormRowId("modifier"),
    target: "armorClass",
    value: "0",
    label: "",
  };
}

function createModifierFormRowFromModifier(modifier: Modifier): ModifierFormRow {
  return {
    id: createFormRowId("modifier"),
    target: modifier.target,
    value: modifier.value.toString(),
    label: modifier.label ?? "",
  };
}

function toModifierInput(modifierRow: ModifierFormRow): Modifier {
  return {
    target: modifierRow.target,
    value: parseNumberInput(modifierRow.value),
    ...(modifierRow.label.trim() ? { label: modifierRow.label } : {}),
  };
}

function parseQualityList(qualities: string): string[] {
  return qualities
    .split(",")
    .map((quality) => quality.trim())
    .filter((quality) => quality.length > 0);
}

function isRecordLocationIncomplete(record: InventoryRecord): boolean {
  return "containerId" in record.location && record.location.containerId.length === 0;
}

function parseNumberInput(value: string, fallback = 0) {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

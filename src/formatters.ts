import {
  getCoinCount,
  getCoinGpValue,
  getDirectChildRecords,
} from "./model/calculations";
import {
  DEFAULT_AUDIT_ACTOR_LABEL,
  getAuditEventTypeLabel,
} from "./model/auditLog";
import {
  getContainerContents,
  getInventorySections,
  getRecordById,
} from "./model/inventoryDisplay";
import {
  formatCoinDenominations as formatCoinDenominationsValue,
  getInventoryRowDisplay,
  type InventoryRowStatus,
} from "./model/inventoryRowDisplay";
import type { IconTone, ItemStatusIconName, ItemTypeIconName } from "./components/InventoryIcons";
import type { AuditLogEntry, CharacterAlignment, CharacterData, InventoryRecord, InventoryRecordId } from "./model/types";
import type {
  PartyHandDetail,
  PartyHandDisplay,
  PartyLitSource,
  PartySpellLine,
} from "./view-types";

// ---- Party display ----

export function formatPartyClassLevel(character: CharacterData): string {
  const className = character.className.trim() || "No class";
  const alignment = formatPartyAlignment(character.alignment);
  const classLabel = alignment ? `${alignment} ${className}` : className;

  if (character.level === null) {
    return classLabel;
  }

  return `${classLabel} ${character.level}`;
}

export function formatPartyAlignment(alignment: CharacterAlignment): string {
  switch (alignment) {
    case "Law":
      return "Lawful";
    case "Neutrality":
      return "Neutral";
    case "Chaos":
      return "Chaotic";
    case "":
      return "";
  }
}

export function formatPartyHp(character: CharacterData): string {
  return `${formatNullablePartyNumber(character.hp.current)}/${formatNullablePartyNumber(
    character.hp.max,
  )}`;
}

export function isPartyMemberHurt(character: CharacterData): boolean {
  return (
    character.hp.current !== null &&
    character.hp.max !== null &&
    character.hp.current < character.hp.max
  );
}

export function formatPartyLanguages(character: CharacterData): string {
  return character.languages.length > 0 ? character.languages.join(", ") : "None";
}

/** Memorized spells grouped by level for the party table, tightest form:
 * counts only when above one, spellbook-only entries omitted. */
export function formatPartySpellLines(
  character: CharacterData,
): PartySpellLine[] {
  const memorizedSpells = character.spells.filter(
    (spell) => spell.memorized > 0,
  );
  const levels = [
    ...new Set(memorizedSpells.map((spell) => spell.level)),
  ].sort((left, right) => left - right);

  return levels.map((level) => ({
    label: `L${level}`,
    text: memorizedSpells
      .filter((spell) => spell.level === level)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((spell) =>
        spell.memorized > 1 ? `${spell.name} ×${spell.memorized}` : spell.name,
      )
      .join(", "),
  }));
}

export function formatPartyHands(
  sections: ReturnType<typeof getInventorySections> & { mode: "characterLike" },
  records: InventoryRecord[],
  includeSecrets = false,
): PartyHandDisplay[] {
  const bothHandsRecord = getRecordById(sections.handRecordIds.bothHands, records);

  if (bothHandsRecord) {
    return [getPartyHandDisplay("Both", bothHandsRecord, records, includeSecrets)];
  }

  return [
    getPartyHandDisplay(
      "L",
      getRecordById(sections.handRecordIds.leftHand, records),
      records,
      includeSecrets,
    ),
    getPartyHandDisplay(
      "R",
      getRecordById(sections.handRecordIds.rightHand, records),
      records,
      includeSecrets,
    ),
  ];
}

function getPartyHandDisplay(
  label: string,
  record: InventoryRecord | undefined,
  records: InventoryRecord[],
  includeSecrets: boolean,
): PartyHandDisplay {
  if (!record) {
    return { label, text: null, statuses: [] };
  }

  const display = getInventoryRowDisplay(record, records);
  const detail = getPartyHandDetail(record, includeSecrets);

  return {
    label,
    text: display.primaryText,
    statuses: display.statusIcons,
    ...(detail ? { detail } : {}),
  };
}

function getPartyHandDetail(
  record: InventoryRecord,
  includeSecrets: boolean,
): PartyHandDetail | undefined {
  const detail: PartyHandDetail = {};

  if (record.recordType === "weapon") {
    const weaponParts = [
      record.weapon.damage,
      record.weapon.range,
      ...(record.weapon.qualities ?? []),
    ].filter((part): part is string => Boolean(part && part.trim()));

    if (weaponParts.length > 0) {
      detail.weapon = weaponParts.join(" · ");
    }
  }

  if (record.recordType !== "coins" && record.uses) {
    detail.uses = formatUses(record.uses);
  }

  if (record.light?.lightDescription?.trim()) {
    detail.light = record.light.lightDescription;
  }

  if (record.description?.trim()) {
    detail.description = record.description;
  }

  if (
    includeSecrets &&
    record.recordType !== "coins" &&
    record.recordType !== "treasure" &&
    record.identification?.identified === false
  ) {
    if (record.identification.secretName?.trim()) {
      detail.secretName = record.identification.secretName;
    }

    if (record.identification.secretDescription?.trim()) {
      detail.secretDescription = record.identification.secretDescription;
    }
  }

  return Object.keys(detail).length > 0 ? detail : undefined;
}

export function formatUses(uses: { current: number; max?: number }): string {
  return uses.max !== undefined
    ? `${uses.current}/${uses.max} uses`
    : `${uses.current} uses`;
}

/** Lit light sources among an entity's records, wherever they are carried. */
export function getPartyLitSources(
  ownedRecords: InventoryRecord[],
): PartyLitSource[] {
  return ownedRecords
    .filter(
      (record) => record.recordType !== "coins" && record.light?.isLit === true,
    )
    .map((record) => ({
      name: getRecordDisplayName(record),
      ...(record.recordType !== "coins" && record.uses
        ? { uses: formatUses(record.uses) }
        : {}),
    }));
}

export function formatNullablePartyNumber(value: number | null): string {
  return value === null ? "—" : value.toString();
}

export function formatSignedNumber(value: number): string {
  return value > 0 ? `+${value}` : value.toString();
}

export function formatMovementFeet(feet: number): string {
  return `${feet}′`;
}

/** Exploration + encounter rate in the shared `120′ (40′)` form. */
export function formatMovementPair(movement: {
  explorationFeet: number;
  encounterFeet: number;
}): string {
  return `${formatMovementFeet(movement.explorationFeet)} (${formatMovementFeet(
    movement.encounterFeet,
  )})`;
}

// ---- Inventory row status / type icons ----

export const INVENTORY_ROW_STATUS_ORDER: InventoryRowStatus[] = [
  "lit",
  "unidentified",
  "activeAc",
  "overCapacity",
];

export function getCollapsedContainerStatusIcons(
  containerRecord: InventoryRecord,
  records: InventoryRecord[],
): InventoryRowStatus[] {
  const descendantStatuses = getContainerDescendantRecords(
    containerRecord,
    records,
  ).flatMap((record) => getInventoryRowDisplay(record, records).statusIcons);

  return getUniqueInventoryRowStatuses(descendantStatuses);
}

export function getContainerDescendantRecords(
  containerRecord: InventoryRecord,
  records: InventoryRecord[],
  visitedContainerIds = new Set<InventoryRecordId>(),
): InventoryRecord[] {
  if (visitedContainerIds.has(containerRecord.id)) {
    return [];
  }

  visitedContainerIds.add(containerRecord.id);

  return getContainerContents(containerRecord, records).flatMap((record) => [
    record,
    ...(record.container
      ? getContainerDescendantRecords(record, records, visitedContainerIds)
      : []),
  ]);
}

export function getUniqueInventoryRowStatuses(
  statuses: InventoryRowStatus[],
): InventoryRowStatus[] {
  const statusSet = new Set(statuses);

  return INVENTORY_ROW_STATUS_ORDER.filter((status) => statusSet.has(status));
}

export function getInventoryRowStatusIcon(
  status: InventoryRowStatus,
): ItemStatusIconName {
  switch (status) {
    case "lit":
      return "lit";
    case "unidentified":
      return "unidentified";
    case "activeAc":
      return "activeAc";
    case "overCapacity":
      return "overCapacity";
  }
}

export function getInventoryRowStatusTone(status: InventoryRowStatus): IconTone {
  switch (status) {
    case "lit":
      return "lit";
    case "unidentified":
      return "unidentified";
    case "activeAc":
      return "active";
    case "overCapacity":
      return "critical";
  }
}

export function getInventoryRowStatusTitle(status: InventoryRowStatus): string {
  switch (status) {
    case "lit":
      return "Light source is lit";
    case "unidentified":
      return "Unidentified item";
    case "activeAc":
      return "Contributes to armor class";
    case "overCapacity":
      return "Container is over capacity";
  }
}

export function getInventoryRowStatusText(status: InventoryRowStatus): string {
  switch (status) {
    case "lit":
      return "lit";
    case "unidentified":
      return "unidentified";
    case "activeAc":
      return "active AC";
    case "overCapacity":
      return "over capacity";
  }
}

export function getInventoryRecordTypeIcon(record: InventoryRecord): ItemTypeIconName {
  if (record.recordType === "coins") {
    return "coins";
  }

  if (record.recordType === "treasure") {
    return "treasure";
  }

  if (record.recordType === "weapon") {
    return "weapon";
  }

  if (record.recordType === "armor") {
    return "armor";
  }

  if (record.container) {
    return "container";
  }

  if (record.light) {
    return "light";
  }

  return "equipment";
}

export function getInventoryRecordTypeIconTone(record: InventoryRecord): IconTone {
  return isMagicInventoryRecord(record) ? "magic" : "muted";
}

export function isMagicInventoryRecord(record: InventoryRecord): boolean {
  return record.recordType !== "coins" && record.isMagic === true;
}

// ---- Record display ----

function formatRecordCount(count: number) {
  return count === 1 ? "1 record" : `${count} records`;
}

export function getRecordDisplayName(record: InventoryRecord) {
  if (record.recordType === "coins") {
    return "Coins";
  }

  return record.name;
}

export function getDeleteConfirmationMessage(
  record: InventoryRecord,
  allRecords: InventoryRecord[] = [],
) {
  if (record.recordType === "coins") {
    if (getCoinCount(record.coins) > 0) {
      return `Confirm delete coin record containing ${formatCoinDenominations(record)} worth ${formatGpValue(
        getCoinGpValue(record.coins),
      )} gp?`;
    }

    return "Confirm delete empty coin record?";
  }

  const displayName = getRecordDisplayName(record);

  if (record.recordType === "treasure") {
    if (record.treasure.gpValue > 0) {
      return `Confirm delete treasure "${displayName}" worth ${formatGpValue(
        record.treasure.gpValue,
      )} gp?`;
    }

    return `Confirm delete treasure "${displayName}" with no recorded gp value?`;
  }

  if (record.container && record.location.kind === "stowedRoot") {
    return `Confirm delete stowed container "${displayName}" with ${formatSlots(
      record.container.capacitySlots,
    )} capacity? This may make stowed inventory invalid.`;
  }

  if (record.container) {
    const childCount = getDirectChildRecords(record.id, allRecords).length;

    if (childCount > 0) {
      return `Confirm delete non-empty container "${displayName}" containing ${formatRecordCount(
        childCount,
      )}? This is blocked until the contents are moved.`;
    }

    return `Confirm delete empty container "${displayName}" with ${formatSlots(
      record.container.capacitySlots,
    )} capacity?`;
  }

  return `Confirm delete "${displayName}"?`;
}

function formatCoinDenominations(record: InventoryRecord) {
  if (record.recordType !== "coins") {
    return "Coins";
  }

  return formatCoinDenominationsValue(record.coins);
}

// ---- Slots / capacity / general ----

export function formatSlots(slots: number) {
  return slots === 1 ? "1 slot" : `${slots} slots`;
}

export function formatCapacity(usedSlots: number, capacitySlots: number | undefined) {
  if (capacitySlots === undefined) {
    return `${formatSlots(usedSlots)} used`;
  }

  return `${usedSlots}/${capacitySlots} slots`;
}

export function formatGpValue(value: number) {
  return Number.isInteger(value)
    ? value.toString()
    : Number(value.toFixed(2)).toString();
}

export function formatWarningState(
  warnings: import("./model/encumbrance").EncumbranceWarning[],
  validationIssues: import("./model/validation").ValidationIssue[],
) {
  const count = warnings.length + validationIssues.length;

  if (count === 0) {
    return "No warnings";
  }

  return count === 1 ? "1 warning" : `${count} warnings`;
}

// ---- Audit display ----

export function getAuditEntryDisplay(entry: AuditLogEntry) {
  const metaLabels = [getAuditEventTypeLabel(entry.eventType)];

  if (entry.actorLabel !== DEFAULT_AUDIT_ACTOR_LABEL) {
    metaLabels.push(entry.actorLabel);
  }

  return {
    summary: entry.summary,
    timestamp: formatAuditTimestamp(entry.createdAt),
    metaLabels,
  };
}

function formatAuditTimestamp(createdAt: string): string {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return createdAt;
  }

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---- Form input formatting ----

export function formatNullableNumberInput(value: number | null): string {
  return value === null ? "" : value.toString();
}

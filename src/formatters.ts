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
import type { PartyAbilityScoreDisplay, PartyHandDisplay } from "./view-types";

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

export function formatPartyAbilityScores(
  character: CharacterData,
): PartyAbilityScoreDisplay[] {
  const scores = character.abilityScores;

  return [
    { label: "S", value: formatNullablePartyNumber(scores.strength) },
    { label: "I", value: formatNullablePartyNumber(scores.intelligence) },
    { label: "W", value: formatNullablePartyNumber(scores.wisdom) },
    { label: "D", value: formatNullablePartyNumber(scores.dexterity) },
    { label: "C", value: formatNullablePartyNumber(scores.constitution) },
    { label: "Ch", value: formatNullablePartyNumber(scores.charisma) },
  ];
}

export function formatPartyHands(
  sections: ReturnType<typeof getInventorySections> & { mode: "characterLike" },
  records: InventoryRecord[],
): PartyHandDisplay[] {
  const bothHandsRecord = getRecordById(sections.handRecordIds.bothHands, records);

  if (bothHandsRecord) {
    return [getPartyHandDisplay("Both", bothHandsRecord, records)];
  }

  return [
    getPartyHandDisplay(
      "L",
      getRecordById(sections.handRecordIds.leftHand, records),
      records,
    ),
    getPartyHandDisplay(
      "R",
      getRecordById(sections.handRecordIds.rightHand, records),
      records,
    ),
  ];
}

function getPartyHandDisplay(
  label: string,
  record: InventoryRecord | undefined,
  records: InventoryRecord[],
): PartyHandDisplay {
  if (!record) {
    return { label, text: null, statuses: [] };
  }

  const display = getInventoryRowDisplay(record, records);

  return { label, text: display.primaryText, statuses: display.statusIcons };
}

export function formatNullablePartyNumber(value: number | null): string {
  return value === null ? "—" : value.toString();
}

export function formatSignedNumber(value: number): string {
  return value > 0 ? `+${value}` : value.toString();
}

export function formatMovementFeet(feet: number): string {
  return `${feet}'`;
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

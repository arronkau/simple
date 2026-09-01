import campaignLibrary from "./arden_vul_campaign.json";
import classReference from "./ose_class_reference.json";
import {
  getAllowedClassDisplayNames,
  isClassAllowed,
} from "./campaign";
import { HANDOUT_ROSTER_SLUGS } from "./handoutRoster.fixtures";
import { getStandardItemBySlug } from "./standardItems";

export const CAMPAIGN_MANUAL_FIXTURES = [
  {
    name: "every campaign catalog slug resolves",
    actual: campaignLibrary.allowedCatalogSlugs.every(
      (slug) => getStandardItemBySlug(slug) !== undefined,
    ),
    expected: true,
  },
  {
    name: "every campaign catalog slug appears exactly once in the handout roster",
    actual: campaignLibrary.allowedCatalogSlugs.every(
      (allowedSlug) =>
        HANDOUT_ROSTER_SLUGS.filter((slug) => slug === allowedSlug).length === 1,
    ),
    expected: true,
  },
  {
    name: "every handout roster slug is campaign-allowed",
    actual: HANDOUT_ROSTER_SLUGS.every((slug) =>
      campaignLibrary.allowedCatalogSlugs.includes(slug),
    ),
    expected: true,
  },
  {
    name: "every campaign class id exists in the class reference",
    actual: campaignLibrary.allowedClassIds.every(
      (classId) =>
        classReference.classes[
          classId as keyof typeof classReference.classes
        ] !== undefined,
    ),
    expected: true,
  },
  {
    name: "campaign class roster resolves display names in id order",
    actual: getAllowedClassDisplayNames(),
    expected: [
      "Acrobat",
      "Barbarian",
      "Cleric",
      "Druid",
      "Dwarf",
      "Elf",
      "Fighter",
      "Imperial Goblin",
      "Half-Elf",
      "Halfling",
      "Illusionist",
      "Magic-User",
      "Paladin",
      "Thief",
    ],
  },
  {
    name: "campaign roster rejects Assassin",
    actual: isClassAllowed("Assassin"),
    expected: false,
  },
];

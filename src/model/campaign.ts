import bundledCampaignLibrary from "./arden_vul_campaign.json";
import classReference from "./ose_class_reference.json";

export type CampaignLibrary = {
  schemaVersion: string;
  campaign: string;
  sourceBasis: string[];
  allowedClassIds: string[];
  allowedCatalogSlugs: string[];
};

type ClassReferenceLibrary = {
  classes: Record<
    string,
    {
      id: string;
      displayName: string;
    }
  >;
};

const DEFAULT_LIBRARY = bundledCampaignLibrary as CampaignLibrary;
const CLASS_REFERENCE = classReference as ClassReferenceLibrary;

export function isCatalogSlugAllowed(
  slug: string,
  library: CampaignLibrary = DEFAULT_LIBRARY,
): boolean {
  return library.allowedCatalogSlugs.includes(slug);
}

export function isClassAllowed(
  classNameOrId: string,
  library: CampaignLibrary = DEFAULT_LIBRARY,
): boolean {
  const normalizedClassName = normalizeClassName(classNameOrId);

  if (!normalizedClassName) {
    return false;
  }

  return library.allowedClassIds.some((classId) => {
    const classEntry = CLASS_REFERENCE.classes[classId];

    return (
      classEntry !== undefined &&
      (normalizeClassName(classEntry.id) === normalizedClassName ||
        normalizeClassName(classEntry.displayName) === normalizedClassName)
    );
  });
}

export function getAllowedClassDisplayNames(
  library: CampaignLibrary = DEFAULT_LIBRARY,
): string[] {
  return library.allowedClassIds.flatMap((classId) => {
    const classEntry = CLASS_REFERENCE.classes[classId];
    return classEntry ? [classEntry.displayName] : [];
  });
}

function normalizeClassName(className: string): string {
  return className.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "");
}

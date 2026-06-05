import type { ReactNode } from "react";

export type ItemTypeIconName =
  | "equipment"
  | "weapon"
  | "armor"
  | "container"
  | "light"
  | "treasure"
  | "coins";

export type ItemStatusIconName =
  | "lit"
  | "unidentified"
  | "activeAc"
  | "overCapacity"
  | "overloaded"
  | "missingStowedContainer"
  | "containerNotHeld";

export type IconTone =
  | "muted"
  | "magic"
  | "lit"
  | "unidentified"
  | "active"
  | "warning"
  | "critical";

type IconProps<TName extends string> = {
  name: TName;
  tone: IconTone;
  title?: string;
};

export function ItemTypeIcon({
  name,
  tone,
  title,
}: IconProps<ItemTypeIconName>) {
  return (
    <BaseInventoryIcon tone={tone} title={title}>
      {getItemTypeIconPaths(name)}
    </BaseInventoryIcon>
  );
}

export function ItemStatusIcon({
  name,
  tone,
  title,
}: IconProps<ItemStatusIconName>) {
  return (
    <BaseInventoryIcon tone={tone} title={title}>
      {getItemStatusIconPaths(name)}
    </BaseInventoryIcon>
  );
}

function BaseInventoryIcon({
  tone,
  title,
  children,
}: {
  tone: IconTone;
  title?: string;
  children: ReactNode;
}) {
  return (
    <svg
      className={`inventory-icon icon-${tone}`}
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

function getItemTypeIconPaths(name: ItemTypeIconName): ReactNode {
  switch (name) {
    case "equipment":
      return (
        <>
          <path d="M12 3 20 7.5v9L12 21 4 16.5v-9L12 3Z" />
          <path d="M12 12 20 7.5" />
          <path d="M12 12v9" />
          <path d="M12 12 4 7.5" />
          <path d="M8 5.25 16 9.75" />
        </>
      );
    case "weapon":
      return (
        <>
          <path d="M14.5 4.5 19.5 2.5 17.5 7.5 8 17 5 14l9.5-9.5Z" />
          <path d="M7 13l4 4" />
          <path d="M4 16l4 4" />
          <path d="M2.5 21.5 6 18" />
        </>
      );
    case "armor":
      return (
        <>
          <path d="M12 3 19 6v5c0 5-3.2 8.6-7 10-3.8-1.4-7-5-7-10V6l7-3Z" />
          <path d="M12 7v10" />
          <path d="M8.5 9.5h7" />
        </>
      );
    case "container":
      return (
        <>
          <path d="M7 8V6a5 5 0 0 1 10 0v2" />
          <path d="M5 8h14l1 13H4L5 8Z" />
          <path d="M9 13h6" />
        </>
      );
    case "light":
      return (
        <>
          <path d="M12 22c4 0 7-2.7 7-6.7 0-2.7-1.5-5.1-4.5-7.3.2 2.4-.6 3.8-1.8 4.6.2-3.4-1.4-6.3-4.4-8.6.4 3.7-3.3 6.2-3.3 11.2C5 19.3 8 22 12 22Z" />
          <path d="M12 22c1.7 0 3-1.2 3-2.9 0-1.4-.8-2.4-2.2-3.4.1 1.2-.3 1.9-.9 2.3.1-1.7-.7-3.1-2.1-4.2.2 1.9-1.8 3.1-1.8 5.3C8 20.8 10.3 22 12 22Z" />
        </>
      );
    case "treasure":
      return (
        <>
          <path d="M12 3 20 9l-8 12L4 9l8-6Z" />
          <path d="M4 9h16" />
          <path d="M8 9l4 12 4-12" />
          <path d="M8 9l4-6 4 6" />
        </>
      );
    case "coins":
      return (
        <>
          <ellipse cx="9" cy="7" rx="5" ry="3" />
          <path d="M4 7v5c0 1.7 2.2 3 5 3s5-1.3 5-3V7" />
          <path d="M14 10c2.9.2 5 1.4 5 3 0 1.7-2.2 3-5 3-.9 0-1.8-.1-2.5-.4" />
          <path d="M9 15v2c0 1.7 2.2 3 5 3s5-1.3 5-3v-4" />
        </>
      );
  }
}

function getItemStatusIconPaths(name: ItemStatusIconName): ReactNode {
  switch (name) {
    case "lit":
      return (
        <>
          <path d="M12 21c3 0 5-2 5-5 0-2-1-4-3-5.8.1 1.6-.4 2.6-1.3 3.2.1-2.4-1-4.6-3.2-6.4.3 2.7-2.5 4.6-2.5 8.7C7 18.9 9 21 12 21Z" />
          <path d="M12 21c1.2 0 2-.8 2-2 0-.9-.5-1.6-1.4-2.3.1.8-.2 1.3-.6 1.6.1-1.1-.5-2.1-1.4-2.9.1 1.3-1.1 2.1-1.1 3.6 0 1.2 1.3 2 2.5 2Z" />
        </>
      );
    case "unidentified":
      return (
        <>
          <path d="M12 2 22 12 12 22 2 12 12 2Z" />
          <path d="M9.5 9a2.7 2.7 0 0 1 5.1 1.3c0 2.2-2.6 2.4-2.6 4.2" />
          <path d="M12 18h.01" />
        </>
      );
    case "activeAc":
      return (
        <>
          <path d="M12 3 19 6v5c0 5-3.2 8.6-7 10-3.8-1.4-7-5-7-10V6l7-3Z" />
          <path d="m9 12 2 2 4-5" />
        </>
      );
    case "overCapacity":
      return (
        <>
          <path d="M4 8h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
          <path d="M8 8V6a4 4 0 0 1 8 0v2" />
          <path d="M12 11v4" />
          <path d="M12 18h.01" />
        </>
      );
    case "overloaded":
      return (
        <>
          <path d="M8 7a4 4 0 0 1 8 0" />
          <path d="M6 7h12l2 14H4L6 7Z" />
          <path d="M12 11v4" />
          <path d="M12 18h.01" />
        </>
      );
    case "missingStowedContainer":
      return (
        <>
          <path d="M7 8V6a5 5 0 0 1 10 0v2" />
          <path d="M6 8h12l1 13H5L6 8Z" />
          <path d="M9 13h6" />
          <path d="M3 3l18 18" />
        </>
      );
    case "containerNotHeld":
      return (
        <>
          <path d="M8 7c0-2 1.5-4 4-4s4 2 4 4" />
          <path d="M6 8h12l2 12H4L6 8Z" />
          <path d="M12 11v4" />
          <path d="M12 18h.01" />
          <path d="M3 3l18 18" />
        </>
      );
  }
}

export type SyncWindowEvent = {
  preventDefault: () => void;
  returnValue?: unknown;
};

export type SyncWindowEventListener = (event: SyncWindowEvent) => void;

export type SyncWindowEventTarget = {
  addEventListener: (type: string, listener: SyncWindowEventListener) => void;
  removeEventListener: (type: string, listener: SyncWindowEventListener) => void;
};

export type SyncWindowListeners = {
  start: () => void;
  stop: () => void;
};

/**
 * Window listeners owned by the sync session:
 *
 * - `beforeunload` warns while updates have not reached the Firestore SDK yet.
 * - `pagehide` is the last chance to hand those updates over (a prompt is not
 *   available there, and the flush is best-effort).
 * - `online` retries immediately instead of waiting for the backoff timer.
 *
 * `start`/`stop` are idempotent and always remove the exact handlers they
 * added, so restarting sync (party switch, sign-in, sign-out) cannot leak them.
 */
export function createSyncWindowListeners({
  onOnline,
  onPageHide,
  shouldBlockUnload,
  target = getDefaultSyncWindowEventTarget(),
}: {
  onOnline: () => void;
  onPageHide: () => void;
  shouldBlockUnload: () => boolean;
  target?: SyncWindowEventTarget | undefined;
}): SyncWindowListeners {
  let started = false;

  const handleBeforeUnload: SyncWindowEventListener = (event) => {
    if (!shouldBlockUnload()) {
      return;
    }

    event.preventDefault();
    // Legacy browsers only show the prompt when returnValue is set.
    event.returnValue = "";
  };
  const handleOnline: SyncWindowEventListener = () => onOnline();
  const handlePageHide: SyncWindowEventListener = () => onPageHide();

  return {
    start: () => {
      if (!target || started) {
        return;
      }

      started = true;
      target.addEventListener("beforeunload", handleBeforeUnload);
      target.addEventListener("online", handleOnline);
      target.addEventListener("pagehide", handlePageHide);
    },
    stop: () => {
      if (!target || !started) {
        return;
      }

      started = false;
      target.removeEventListener("beforeunload", handleBeforeUnload);
      target.removeEventListener("online", handleOnline);
      target.removeEventListener("pagehide", handlePageHide);
    },
  };
}

function getDefaultSyncWindowEventTarget(): SyncWindowEventTarget | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const windowTarget = window;

  return {
    addEventListener: (type, listener) =>
      windowTarget.addEventListener(type, listener as EventListener),
    removeEventListener: (type, listener) =>
      windowTarget.removeEventListener(type, listener as EventListener),
  };
}

import {
  createSyncWindowListeners,
  type SyncWindowEventListener,
} from "./syncWindowListeners";

const listenerEvents = collectListenerEvents();

export const SYNC_WINDOW_LISTENERS_MANUAL_FIXTURES = [
  {
    name: "Sync window listeners warn on unload only while updates are unsent, and unregister every handler",
    actual: listenerEvents,
    expected: [
      "add:beforeunload",
      "add:online",
      "add:pagehide",
      "unload:allowed",
      "unload:blocked",
      "online",
      "pagehide",
      "remove:beforeunload",
      "remove:online",
      "remove:pagehide",
      "leaked:none",
    ],
  },
];

function collectListenerEvents(): string[] {
  const events: string[] = [];
  const registered = new Map<string, SyncWindowEventListener>();
  let blockUnload = false;
  const listeners = createSyncWindowListeners({
    onOnline: () => events.push("online"),
    onPageHide: () => events.push("pagehide"),
    shouldBlockUnload: () => blockUnload,
    target: {
      addEventListener: (type, listener) => {
        events.push(`add:${type}`);
        registered.set(type, listener);
      },
      removeEventListener: (type, listener) => {
        events.push(
          registered.get(type) === listener
            ? `remove:${type}`
            : `remove-mismatch:${type}`,
        );
        registered.delete(type);
      },
    },
  });

  listeners.start();
  // A second start must not register a second set of handlers.
  listeners.start();
  events.push(`unload:${dispatchBeforeUnload(registered)}`);
  blockUnload = true;
  events.push(`unload:${dispatchBeforeUnload(registered)}`);
  registered.get("online")?.({ preventDefault: () => undefined });
  registered.get("pagehide")?.({ preventDefault: () => undefined });
  listeners.stop();
  listeners.stop();
  events.push(`leaked:${registered.size === 0 ? "none" : registered.size}`);

  return events;
}

function dispatchBeforeUnload(
  registered: Map<string, SyncWindowEventListener>,
): string {
  let prevented = false;
  const event = {
    preventDefault: () => {
      prevented = true;
    },
    returnValue: undefined as unknown,
  };
  registered.get("beforeunload")?.(event);

  return prevented && event.returnValue === "" ? "blocked" : "allowed";
}

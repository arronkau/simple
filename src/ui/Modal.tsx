import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
} from "react";

/** The two panel widths the app uses: the standard modal and the compact one. */
export type ModalSize = "regular" | "narrow";

/**
 * Number of mounted modals, so a nested dialog closing does not unlock
 * background scrolling while its parent is still open.
 */
let openModalCount = 0;

/**
 * The single dialog shell. Built on native `<dialog>` opened with
 * `showModal()`, which gives the top layer, Escape via the `cancel` event,
 * focus containment, and focus restore to the opener for free.
 *
 * Escape, the header close button, and a backdrop click all route through
 * `dialog.close()`, so the `close` event is the one path that calls `onClose`.
 */
export function Modal({
  children,
  className,
  dismissible = true,
  initialFocusRef,
  onClose,
  size = "regular",
  subtitle,
  title,
}: {
  children: ReactNode;
  className?: string;
  /** When false, Escape and backdrop clicks do nothing and no close button renders. */
  dismissible?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  size?: ModalSize;
  subtitle?: ReactNode;
  title: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  const backdropPointerDownRef = useRef(false);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
  });

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    function handleCancel(event: Event) {
      // Required dialogs (identity) must not close on Escape.
      if (!dismissibleRef.current) {
        event.preventDefault();
      }
    }

    function handleClose() {
      // A `close` event is queued, not dispatched synchronously, so the one
      // StrictMode's simulated unmount produces lands after the dialog has been
      // reopened by the second mount. A reopened dialog means a stale event.
      if (dialogRef.current?.open) {
        return;
      }

      onCloseRef.current();
    }

    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("close", handleClose);

    // StrictMode mounts effects twice; showModal() throws on an open dialog.
    if (!dialog.open) {
      dialog.showModal();
    }

    openModalCount += 1;
    document.body.classList.add("modal-open");

    initialFocusRef?.current?.focus();

    return () => {
      // Drop the listeners first: unmount-driven close() is not a user close.
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("close", handleClose);

      if (dialog.open) {
        dialog.close();
      }

      openModalCount = Math.max(0, openModalCount - 1);

      if (openModalCount === 0) {
        document.body.classList.remove("modal-open");
      }
    };
    // Mount/unmount only: the open dialog outlives prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function requestClose() {
    dialogRef.current?.close();
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDialogElement>) {
    // A backdrop event targets the dialog element itself; anything inside the
    // panel targets a descendant. Track the press so a drag that starts on a
    // field and ends outside does not count as a backdrop click.
    backdropPointerDownRef.current = event.target === dialogRef.current;
  }

  function handleClick(event: ReactMouseEvent<HTMLDialogElement>) {
    const startedOnBackdrop = backdropPointerDownRef.current;

    backdropPointerDownRef.current = false;

    if (!dismissible || !startedOnBackdrop || event.target !== dialogRef.current) {
      return;
    }

    requestClose();
  }

  const dialogClassName = [
    "app-dialog",
    size === "narrow" ? "app-dialog-narrow" : undefined,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <dialog
      aria-labelledby={titleId}
      className={dialogClassName}
      ref={dialogRef}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
    >
      <div className="modal-panel">
        <div className="modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle}
          </div>
          {dismissible ? (
            <button
              aria-label="Close"
              className="modal-close"
              type="button"
              onClick={requestClose}
            >
              <span aria-hidden="true">×</span>
            </button>
          ) : null}
        </div>
        {children}
      </div>
    </dialog>
  );
}

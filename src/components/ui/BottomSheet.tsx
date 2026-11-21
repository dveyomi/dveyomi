"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { IconButton } from "./IconButton";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Open sheets, oldest first. Only the last (top-most) one handles keys. */
const openStack: object[] = [];

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Use "alertdialog" for confirmations that interrupt the user. */
  role?: "dialog" | "alertdialog";
};

/**
 * A modal panel: a sheet rising from the bottom on phones (under 768px) and a
 * centred dialog above. Escape and the backdrop close it; focus moves in on open,
 * is kept inside while open, and returns to where it was on close. When sheets
 * stack (a ConfirmDialog over a sheet), Escape and Tab apply only to the top one.
 */
export function BottomSheet({ open, onClose, title, children, role = "dialog" }: BottomSheetProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  // Remember what had focus when the sheet opens. This runs during the render
  // that opens it, before any autoFocus inside the sheet can move focus.
  const [wasOpen, setWasOpen] = useState(open);
  const [returnTo, setReturnTo] = useState<HTMLElement | null>(null);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && typeof document !== "undefined") {
      setReturnTo(document.activeElement as HTMLElement | null);
    }
  }

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const node = panel.current;
    // Focus the first control in the body (the close button is last resort),
    // unless something inside already took focus via autoFocus.
    if (!node?.contains(document.activeElement)) {
      const first = node?.querySelector<HTMLElement>(`[data-sheet-body] :is(${FOCUSABLE})`);
      (first ?? node?.querySelector<HTMLElement>(FOCUSABLE) ?? node)?.focus();
    }

    const entry = {};
    openStack.push(entry);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (openStack[openStack.length - 1] !== entry) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      openStack.splice(openStack.indexOf(entry), 1);
      document.body.style.overflow = overflow;
      returnTo?.focus();
    };
  }, [open, returnTo]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div aria-hidden="true" className="absolute inset-0 bg-scrim" onClick={onClose} />
      <div
        ref={panel}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-[90dvh] w-full flex-col rounded-t-md bg-card pb-[env(safe-area-inset-bottom)] shadow-sheet outline-none md:max-w-md md:rounded-md md:pb-0"
      >
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-pill bg-border md:hidden" />
        <div className="flex items-center justify-between gap-4 px-5 pt-3 pb-2 md:pt-5">
          <h2 id={titleId} className="text-title font-semibold text-text">
            {title}
          </h2>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </div>
        <div data-sheet-body className="overflow-y-auto px-5 pt-2 pb-6">{children}</div>
      </div>
    </div>
  );
}

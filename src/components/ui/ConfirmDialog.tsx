"use client";

import { BottomSheet } from "./BottomSheet";
import { Button } from "./Button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** "danger" for destructive actions such as delete. */
  tone?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "primary",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <BottomSheet open={open} onClose={onCancel} title={title} role="alertdialog">
      <p className="text-body text-muted">{body}</p>
      <div className="mt-6 flex flex-col-reverse gap-3 md:flex-row md:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={tone} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </BottomSheet>
  );
}

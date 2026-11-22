"use client";

import { useI18n } from "@/i18n/client";
import { useId, useState, type DragEvent } from "react";
import { buttonClasses } from "./Button";
import { describedBy } from "./field";
import { Icon } from "./Icon";

type FileDropProps = {
  label: string;
  /** File types the picker offers, as the input's accept attribute (e.g. ".csv,text/csv"). */
  accept: string;
  onFile: (file: File) => void;
  hint?: string;
  error?: string | null;
  disabled?: boolean;
};

/**
 * Choose one file: a dashed drop area with a "Choose file" button (the
 * native file input, visually hidden, so keyboards and screen readers use it
 * as usual). A file dropped on the area is handed over the same way.
 */
export function FileDrop({ label, accept, onFile, hint, error, disabled }: FileDropProps) {
  const { m } = useI18n();
  const id = useId();
  const [over, setOver] = useState(false);

  const drop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && !disabled) onFile(file);
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={(e) => {
          // Moving onto the area's own children also fires dragleave; stay highlighted then.
          if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
          setOver(false);
        }}
        onDrop={drop}
        className={`flex flex-col items-center gap-3 rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors ${over ? "border-accent-fg bg-card-raised" : error ? "border-danger-fg" : "border-border-strong"}`}
      >
        <span className="flex size-12 items-center justify-center rounded-pill bg-card-raised text-muted">
          <Icon name="upload" size="lg" />
        </span>
        <p className="text-body text-text">
          <span className="font-semibold">{label}</span>
          <span className="block text-caption text-muted">{m.ui.dropHere}</span>
        </p>
        <label
          className={`${buttonClasses("secondary")} cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-solid has-focus-visible:outline-offset-2 has-focus-visible:outline-accent-fg ${disabled ? "pointer-events-none opacity-40" : ""}`}
        >
          {m.ui.chooseFile}
          <input
            id={id}
            type="file"
            accept={accept}
            disabled={disabled}
            aria-label={label}
            aria-describedby={describedBy(id, hint, error)}
            aria-invalid={error ? true : undefined}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Clear it so choosing the same file again still reports it.
              e.target.value = "";
              if (file) onFile(file);
            }}
          />
        </label>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-caption text-danger-fg">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-caption text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

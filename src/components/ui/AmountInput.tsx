"use client";

import { useId, useState } from "react";
import { parsePence } from "@/lib/calc";
import { borderFor, describedBy, FieldShell } from "./field";

export const AMOUNT_ERROR = "Enter an amount greater than £0.00, e.g. 12.50";

type AmountInputProps = {
  label: string;
  /** Form field name; the submitted value is integer pence. */
  name?: string;
  /** Initial value in pence. */
  defaultPence?: number;
  /** Called on every edit with integer pence, or null while the text is not a valid amount. */
  onValueChange?: (pence: number | null) => void;
  hint?: string;
  /** An error from outside (e.g. the server); shown in place of the local one. */
  error?: string | null;
  required?: boolean;
};

function initialText(pence?: number) {
  return pence === undefined ? "" : (pence / 100).toFixed(2);
}

export function AmountInput({
  label,
  name,
  defaultPence,
  onValueChange,
  hint,
  error,
  required,
}: AmountInputProps) {
  const id = useId();
  const [text, setText] = useState(() => initialText(defaultPence));
  const [touched, setTouched] = useState(false);
  const pence = parsePence(text);
  const localError = touched && text.trim() !== "" && pence === null ? AMOUNT_ERROR : null;
  const shown = error ?? localError;

  return (
    <FieldShell id={id} label={label} hint={hint} error={shown}>
      <div
        className={`flex h-16 items-center gap-1 rounded-sm border bg-card-raised px-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${borderFor(shown)}`}
      >
        <span aria-hidden="true" className="text-title font-semibold text-muted">
          £
        </span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={text}
          required={required}
          aria-invalid={shown ? true : undefined}
          aria-describedby={describedBy(id, hint, shown)}
          onChange={(e) => {
            setText(e.target.value);
            onValueChange?.(parsePence(e.target.value));
          }}
          onBlur={() => setTouched(true)}
          className="w-full min-w-0 bg-transparent text-title font-semibold tabular-nums text-text placeholder:text-muted outline-none"
        />
      </div>
      {name ? <input type="hidden" name={name} value={pence ?? ""} /> : null}
    </FieldShell>
  );
}

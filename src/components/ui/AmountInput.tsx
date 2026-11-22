"use client";

import { useId, useState } from "react";
import { useI18n } from "@/i18n/client";
import type { Format } from "@/i18n/format";
import { CURRENCIES } from "@/lib/locale";
import { amountRequiredError } from "@/lib/validation/common";
import { borderFor, describedBy, FieldShell } from "./field";

export const AMOUNT_ERROR = "Enter an amount greater than £0.00, e.g. 12.50";
export const OPTIONAL_AMOUNT_ERROR = "Enter £0.00 or more, e.g. 12.50";

type AmountInputProps = {
  label: string;
  /** Form field name; the submitted value is integer pence. */
  name?: string;
  /** Initial value in pence (uncontrolled use). */
  defaultPence?: number;
  /** Controlled raw text, e.g. "12.50". Set it to "" to clear the field after saving. */
  value?: string;
  /** Called with the raw text on every edit (pair with `value`). */
  onChange?: (text: string) => void;
  /** Called on every edit with integer pence, or null while the text is not a valid amount. */
  onValueChange?: (pence: number | null) => void;
  hint?: string;
  /** An error from outside (e.g. the server); shown in place of the local one. */
  error?: string | null;
  required?: boolean;
  /** An optional amount: empty or 0 is valid and reads as 0 pence. */
  allowZero?: boolean;
  /** Focus the field when it mounts, e.g. on a screen opened for this one amount. */
  autoFocus?: boolean;
  /** "lg": the figure at display size, for a screen built around this one amount (e.g. Add expense). */
  size?: "md" | "lg";
};

const sizes = {
  md: { box: "h-16", text: "text-title" },
  lg: { box: "h-20", text: "text-display" },
} as const;

function initialText(fmt: Format, pence?: number) {
  return pence === undefined ? "" : fmt.inputText(pence);
}

export function AmountInput({
  label,
  name,
  defaultPence,
  value,
  onChange,
  onValueChange,
  hint,
  error,
  required,
  allowZero = false,
  autoFocus,
  size = "md",
}: AmountInputProps) {
  const i18n = useI18n();
  const { fmt, currency } = i18n;
  const parse = allowZero ? fmt.parseOptional : fmt.parse;
  const id = useId();
  const [ownText, setOwnText] = useState(() => initialText(fmt, defaultPence));
  const text = value ?? ownText;
  const [touched, setTouched] = useState(false);
  const pence = parse(text);
  const localError =
    touched && text.trim() !== "" && pence === null ? (allowZero ? i18n.m.validation.amountOptional[currency] : amountRequiredError(i18n)) : null;
  const shown = error ?? localError;

  return (
    <FieldShell id={id} label={label} hint={hint} error={shown}>
      <div
        className={`flex ${sizes[size].box} items-center gap-1 rounded-sm border bg-card-raised px-4 focus-within:outline-2 focus-within:outline-solid focus-within:outline-offset-2 focus-within:outline-accent-fg ${borderFor(shown)}`}
      >
        <span aria-hidden="true" className={`${sizes[size].text} font-semibold text-muted`}>
          {CURRENCIES[currency].symbol}
        </span>
        <input
          id={id}
          inputMode={currency === "GBP" ? "decimal" : "numeric"}
          autoComplete="off"
          placeholder={currency === "GBP" ? "0.00" : "0"}
          value={text}
          required={required}
          autoFocus={autoFocus}
          aria-invalid={shown ? true : undefined}
          aria-describedby={describedBy(id, hint, shown)}
          onChange={(e) => {
            if (value === undefined) setOwnText(e.target.value);
            onChange?.(e.target.value);
            onValueChange?.(parse(e.target.value));
          }}
          onBlur={() => setTouched(true)}
          className={`w-full min-w-0 bg-transparent ${sizes[size].text} font-semibold tabular-nums text-text placeholder:text-muted outline-none`}
        />
      </div>
      {name ? <input type="hidden" name={name} value={pence ?? ""} /> : null}
    </FieldShell>
  );
}

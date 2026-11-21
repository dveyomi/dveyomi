"use client";

import { useId, type InputHTMLAttributes } from "react";
import { borderFor, controlBox, describedBy, FieldShell } from "./field";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "style" | "className" | "id"> & {
  label: string;
  hint?: string;
  error?: string | null;
};

export function TextField({ label, hint, error, type = "text", ...rest }: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        type={type}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`h-12 ${controlBox} ${borderFor(error)}`}
        {...rest}
      />
    </FieldShell>
  );
}

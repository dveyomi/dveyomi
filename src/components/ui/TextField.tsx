"use client";

import { useId, type ComponentPropsWithRef } from "react";
import { borderFor, controlBox, describedBy, FieldShell } from "./field";

type Shared = { label: string; hint?: string; error?: string | null };

type InputProps = Omit<ComponentPropsWithRef<"input">, "style" | "className" | "id"> & Shared & { multiline?: false };

/** `multiline`: a textarea for longer text (a message), `rows` tall (6 unless given) and resizable in height. */
type TextareaProps = Omit<ComponentPropsWithRef<"textarea">, "style" | "className" | "id"> & Shared & { multiline: true };

export function TextField(props: InputProps | TextareaProps) {
  const id = useId();
  const { label, hint, error } = props;
  const a11y = { id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy(id, hint, error) } as const;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      {props.multiline ? (
        <textarea {...controlProps(props)} rows={props.rows ?? 6} {...a11y} className={`resize-y py-3 ${controlBox} ${borderFor(error)}`} />
      ) : (
        <input {...controlProps(props)} type={props.type ?? "text"} {...a11y} className={`h-12 ${controlBox} ${borderFor(error)}`} />
      )}
    </FieldShell>
  );
}

/** The props meant for the control itself (everything but the field's own). */
function controlProps<P extends Shared & { multiline?: boolean }>(props: P): Omit<P, keyof Shared | "multiline"> {
  const rest: Record<string, unknown> = { ...props };
  for (const key of ["label", "hint", "error", "multiline"]) delete rest[key];
  return rest as Omit<P, keyof Shared | "multiline">;
}

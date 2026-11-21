import type { ReactNode } from "react";

/** Shared label, hint and inline error layout for form controls. */
export function FieldShell({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-caption font-medium text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-caption text-danger">
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

export function describedBy(id: string, hint?: string, error?: string | null) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

export const controlBox =
  "w-full rounded-sm border bg-card-raised px-4 text-body text-text placeholder:text-muted transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent outline-none disabled:opacity-40";

export const borderFor = (error?: string | null) => (error ? "border-danger" : "border-border");

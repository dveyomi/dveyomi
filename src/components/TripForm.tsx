"use client";

import { useI18n } from "@/i18n/client";
import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Button, TextField } from "@/components/ui";
import { MAX_NAME_LENGTH } from "@/lib/validation/common";
import { MAX_PLACE_LENGTH, validateTrip, type TripField } from "@/lib/validation/trip";

export type TripFormValues = { name: string; place: string; startDate: string; endDate: string };
type Result = { error: string; field?: TripField } | void;

type TripFormProps = {
  initial: TripFormValues;
  /** Saves the typed values (the server checks them again); returns a problem, or navigates/refreshes on success. */
  save: (raw: TripFormValues) => Promise<Result>;
  submitLabel: string;
  /** Extra buttons beside Save, e.g. Cancel. */
  secondary?: ReactNode;
  /** Called after a save that returned no problem (the edit sheet closes). */
  onSaved?: () => void;
};

/**
 * A trip's name, place (typed text, e.g. Taipei) and dates (§5.12). Checks the
 * values before sending; a refusal from the server, such as an overlap with
 * another trip, is shown on its field.
 */
export function TripForm({ initial, save, submitLabel, secondary, onSaved }: TripFormProps) {
  const i18n = useI18n();
  const { m } = i18n;
  const t_ = m.trips;
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<{ message: string; field?: TripField } | null>(null);
  const [saving, startSaving] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (error?.field) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [error]);

  const fieldError = (field: TripField) => (error?.field === field ? error.message : null);
  function update(patch: Partial<TripFormValues>, field: TripField) {
    setValues((v) => ({ ...v, ...patch }));
    if (error?.field === field || (error?.field && field.endsWith("Date") && error.field.endsWith("Date"))) setError(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const checked = validateTrip(values, i18n);
    if (!checked.ok) return setError({ message: checked.error, field: checked.field });
    setError(null);
    startSaving(async () => {
      const result = await save(values);
      if (result) setError({ message: result.error, field: result.field });
      else onSaved?.();
    });
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4">
      {error && !error.field ? (
        <p role="alert" className="text-body text-danger-fg">
          {error.message}
        </p>
      ) : null}
      <TextField
        label={t_.name}
        value={values.name}
        onChange={(e) => update({ name: e.target.value }, "name")}
        error={fieldError("name")}
        maxLength={MAX_NAME_LENGTH}
        autoComplete="off"
        placeholder={t_.namePlaceholder}
      />
      <TextField
        label={t_.place}
        value={values.place}
        onChange={(e) => update({ place: e.target.value }, "place")}
        error={fieldError("place")}
        maxLength={MAX_PLACE_LENGTH}
        autoComplete="off"
        placeholder={t_.placePlaceholder}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t_.starts}
          type="date"
          value={values.startDate}
          onChange={(e) => update({ startDate: e.target.value }, "startDate")}
          error={fieldError("startDate")}
          required
        />
        <TextField
          label={t_.ends}
          type="date"
          value={values.endDate}
          onChange={(e) => update({ endDate: e.target.value }, "endDate")}
          min={values.startDate || undefined}
          error={fieldError("endDate")}
          required
        />
      </div>
      <p className="text-caption text-muted">
        {t_.formNote}
      </p>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {secondary}
        <Button variant="primary" type="submit" disabled={saving}>
          {saving ? m.common.saving : submitLabel}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useI18n } from "@/i18n/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createTripAction, deleteTripAction, updateTripAction } from "@/app/(app)/expenses/trips/actions";
import { BottomSheet, Button, ButtonLink, ConfirmDialog, Notice } from "@/components/ui";
import type { Trip } from "@/lib/data/trips";
import { TripForm, type TripFormValues } from "./TripForm";

/** The new trip form: creating opens the trip. */
export function NewTripForm({ initial }: { initial: TripFormValues }) {
  const t_ = useI18n().m.trips;
  return (
    <TripForm
      initial={initial}
      save={createTripAction}
      submitLabel={t_.createTrip}
      secondary={
        <ButtonLink href="/expenses/trips" variant="secondary">
          {t_.cancel}
        </ButtonLink>
      }
    />
  );
}

/** A trip's Edit (a sheet with the trip form) and Delete (after confirming; its expenses stay). */
export function TripEditor({ trip }: { trip: Trip }) {
  const t_ = useI18n().m.trips;
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, startDeleting] = useTransition();

  function confirmDelete() {
    setConfirming(false);
    startDeleting(async () => {
      const result = await deleteTripAction(trip.id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <div role="alert">
          <Notice tone="danger">{error}</Notice>
        </div>
      ) : null}
      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => setEditing(true)} disabled={deleting}>
          {t_.editTrip}
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(true)} disabled={deleting}>
          {deleting ? t_.deleting : t_.deleteTrip}
        </Button>
      </div>

      <BottomSheet open={editing} onClose={() => setEditing(false)} title={t_.editTrip}>
        <TripForm
          key={`${trip.id}-${trip.startDate}-${trip.endDate}-${trip.name}`}
          initial={{ name: trip.name, place: trip.place ?? "", startDate: trip.startDate, endDate: trip.endDate }}
          save={(values) => updateTripAction(trip.id, values)}
          submitLabel={t_.saveTrip}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
          secondary={
            <Button variant="secondary" onClick={() => setEditing(false)}>
              {t_.cancel}
            </Button>
          }
        />
      </BottomSheet>

      <ConfirmDialog
        open={confirming}
        title={t_.deleteTitle(trip.name)}
        body={t_.deleteBody}
        confirmLabel={t_.deleteTrip}
        cancelLabel={t_.keepIt}
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

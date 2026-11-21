"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createTripAction, deleteTripAction, updateTripAction } from "@/app/(app)/expenses/trips/actions";
import { BottomSheet, Button, ButtonLink, ConfirmDialog, Notice } from "@/components/ui";
import type { Trip } from "@/lib/data/trips";
import { TripForm, type TripFormValues } from "./TripForm";

/** The new trip form: creating opens the trip. */
export function NewTripForm({ initial }: { initial: TripFormValues }) {
  return (
    <TripForm
      initial={initial}
      save={createTripAction}
      submitLabel="Create trip"
      secondary={
        <ButtonLink href="/expenses/trips" variant="secondary">
          Cancel
        </ButtonLink>
      }
    />
  );
}

/** A trip's Edit (a sheet with the trip form) and Delete (after confirming; its expenses stay). */
export function TripEditor({ trip }: { trip: Trip }) {
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
          Edit trip
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(true)} disabled={deleting}>
          {deleting ? "Deleting…" : "Delete trip"}
        </Button>
      </div>

      <BottomSheet open={editing} onClose={() => setEditing(false)} title="Edit trip">
        <TripForm
          key={`${trip.id}-${trip.startDate}-${trip.endDate}-${trip.name}`}
          initial={{ name: trip.name, place: trip.place ?? "", startDate: trip.startDate, endDate: trip.endDate }}
          save={(values) => updateTripAction(trip.id, values)}
          submitLabel="Save trip"
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
          secondary={
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          }
        />
      </BottomSheet>

      <ConfirmDialog
        open={confirming}
        title={`Delete “${trip.name}”?`}
        body="The trip goes; its expenses stay in your spending and budget as they are. Expenses you took out of it stay out of trips until you reset them."
        confirmLabel="Delete trip"
        cancelLabel="Keep it"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

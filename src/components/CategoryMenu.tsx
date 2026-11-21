"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteCategoryAction, removeFromBudgetAction, renameCategoryAction } from "@/app/(app)/budget/actions";
import { BottomSheet, Button, ButtonLink, ConfirmDialog, IconButton, TextField } from "@/components/ui";
import { MAX_NAME_LENGTH } from "@/lib/data/onboarding";

type CategoryMenuProps = {
  categoryId: string;
  name: string;
  /** False when the category has expenses or a recurring payment: it can only be removed from the budget. */
  deletable: boolean;
};

type Open = "menu" | "rename" | "delete" | null;

/** The ⋯ menu on a category's detail screen: edit budget, rename, delete (or remove from budget). */
export function CategoryMenu({ categoryId, name, deletable }: CategoryMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startPending] = useTransition();
  const close = () => {
    setError(null);
    setOpen(null);
  };

  function run(action: () => Promise<{ error: string } | undefined>) {
    startPending(async () => {
      const result = await action();
      if (result?.error) return setError(result.error);
      close();
      router.refresh();
    });
  }

  return (
    <>
      <IconButton icon="more" label="More actions" onClick={() => setOpen("menu")} />
      <BottomSheet open={open === "menu"} onClose={close} title={name}>
        <div className="flex flex-col gap-3">
          <ButtonLink href={`/budget/edit?category=${categoryId}`} variant="secondary" icon="edit" fullWidth>
            Edit budget
          </ButtonLink>
          <Button variant="secondary" fullWidth onClick={() => setOpen("rename")}>
            Rename
          </Button>
          <Button variant="secondary" fullWidth onClick={() => setOpen("delete")}>
            Delete category
          </Button>
        </div>
      </BottomSheet>

      <BottomSheet open={open === "rename"} onClose={close} title="Rename category">
        <RenameForm
          name={name}
          error={error}
          pending={pending}
          onSave={(next) => run(() => renameCategoryAction(categoryId, next))}
        />
      </BottomSheet>

      {deletable ? (
        <ConfirmDialog
          open={open === "delete"}
          title={`Delete ${name}?`}
          body={error ?? "It has no expenses, so nothing else changes. This can't be undone."}
          confirmLabel={pending ? "Deleting…" : "Delete"}
          tone="danger"
          onConfirm={() => run(() => deleteCategoryAction(categoryId))}
          onCancel={close}
        />
      ) : (
        <ConfirmDialog
          open={open === "delete"}
          title={`${name} has expenses`}
          body={
            error ??
            "Deleting it would leave its expenses without a category. Remove it from your budget instead: past spending keeps its category, and new spending shows as no budget yet."
          }
          confirmLabel={pending ? "Removing…" : "Remove from budget"}
          onConfirm={() => run(() => removeFromBudgetAction(categoryId))}
          onCancel={close}
        />
      )}
    </>
  );
}

function RenameForm({
  name,
  error,
  pending,
  onSave,
}: {
  name: string;
  error: string | null;
  pending: boolean;
  onSave: (name: string) => void;
}) {
  const [value, setValue] = useState(name);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(value);
      }}
    >
      <TextField
        label="Name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={MAX_NAME_LENGTH}
        autoComplete="off"
        required
        error={error}
      />
      <Button type="submit" variant="primary" fullWidth disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

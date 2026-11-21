"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteCategoryAction, removeFromBudgetAction, renameCategoryAction } from "@/app/(app)/budget/actions";
import { BottomSheet, Button, ButtonLink, ConfirmDialog, IconButton, TextField } from "@/components/ui";
import type { CategoryUse } from "@/lib/data/budgetEdit";
import { MAX_NAME_LENGTH } from "@/lib/validation/common";

type CategoryMenuProps = {
  categoryId: string;
  name: string;
  /** Why it can't be deleted, or null when it can. A category in use can only be removed from the budget. */
  inUse: CategoryUse | null;
  /** Whether it has an allocation this period (so "Remove from budget" means something). */
  inBudget: boolean;
};

const reasons: Record<CategoryUse, string> = {
  expenses: "It has expenses",
  recurring: "It has a recurring payment",
  history: "It's in past budgets",
};

type Open = "menu" | "rename" | "delete" | null;

/** The ⋯ menu on a category's detail screen: edit budget, rename, delete (or remove from budget). */
export function CategoryMenu({ categoryId, name, inUse, inBudget }: CategoryMenuProps) {
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

      {inUse === null ? (
        <ConfirmDialog
          open={open === "delete"}
          title={`Delete ${name}?`}
          body={error ?? "It isn't used anywhere else, so nothing else changes. This can't be undone."}
          confirmLabel={pending ? "Deleting…" : "Delete"}
          tone="danger"
          onConfirm={() => run(() => deleteCategoryAction(categoryId))}
          onCancel={close}
        />
      ) : inBudget ? (
        <ConfirmDialog
          open={open === "delete"}
          title={`${name} is in use`}
          body={
            error ??
            `${reasons[inUse]}, so it can't be deleted. Remove it from your budget instead: past spending keeps its category, and new spending shows as no budget yet.`
          }
          confirmLabel={pending ? "Removing…" : "Remove from budget"}
          onConfirm={() => run(() => removeFromBudgetAction(categoryId))}
          onCancel={close}
        />
      ) : (
        <BottomSheet open={open === "delete"} onClose={close} title={`${name} is in use`} role="alertdialog">
          <p className="text-body text-muted">
            {reasons[inUse]}, so it can&apos;t be deleted: the past keeps its category. It has no budget this
            period, so there&apos;s nothing to remove.
          </p>
          <div className="mt-6 flex md:justify-end">
            <Button variant="secondary" fullWidth onClick={close} className="md:w-auto">
              OK
            </Button>
          </div>
        </BottomSheet>
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

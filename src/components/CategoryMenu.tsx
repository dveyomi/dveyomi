"use client";

import { useI18n } from "@/i18n/client";
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


type Open = "menu" | "rename" | "delete" | null;

/** The ⋯ menu on a category's detail screen: edit budget, rename, delete (or remove from budget). */
export function CategoryMenu({ categoryId, name, inUse, inBudget }: CategoryMenuProps) {
  const { m } = useI18n();
  const c = m.category;
  const reasons: Record<CategoryUse, string> = c.reasons;
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
      <IconButton icon="more" label={c.moreActions} onClick={() => setOpen("menu")} />
      <BottomSheet open={open === "menu"} onClose={close} title={name}>
        <div className="flex flex-col gap-3">
          <ButtonLink href={`/budget/edit?category=${categoryId}`} variant="secondary" icon="edit" fullWidth>
            {c.editBudget}
          </ButtonLink>
          <Button variant="secondary" fullWidth onClick={() => setOpen("rename")}>
            {c.rename}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => setOpen("delete")}>
            {c.deleteCategory}
          </Button>
        </div>
      </BottomSheet>

      <BottomSheet open={open === "rename"} onClose={close} title={c.renameTitle}>
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
          title={c.deleteTitle(name)}
          body={error ?? c.deleteBody}
          confirmLabel={pending ? c.deleting : m.common.delete}
          tone="danger"
          onConfirm={() => run(() => deleteCategoryAction(categoryId))}
          onCancel={close}
        />
      ) : inBudget ? (
        <ConfirmDialog
          open={open === "delete"}
          title={c.inUseTitle(name)}
          body={
            error ??
            c.inUseRemove(reasons[inUse])
          }
          confirmLabel={pending ? c.removing : c.removeFromBudget}
          onConfirm={() => run(() => removeFromBudgetAction(categoryId))}
          onCancel={close}
        />
      ) : (
        <BottomSheet open={open === "delete"} onClose={close} title={c.inUseTitle(name)} role="alertdialog">
          <p className="text-body text-muted">
            {c.inUseNothing(reasons[inUse])}
          </p>
          <div className="mt-6 flex md:justify-end">
            <Button variant="secondary" fullWidth onClick={close} className="md:w-auto">
              {c.ok}
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
  const { m } = useI18n();
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
        label={m.category.name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={MAX_NAME_LENGTH}
        autoComplete="off"
        required
        error={error}
      />
      <Button type="submit" variant="primary" fullWidth disabled={pending}>
        {pending ? m.common.saving : m.common.save}
      </Button>
    </form>
  );
}

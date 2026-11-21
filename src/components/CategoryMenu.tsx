"use client";

import { useState } from "react";
import { BottomSheet, ButtonLink, IconButton } from "@/components/ui";

/** The ⋯ menu on a category's detail screen. */
export function CategoryMenu({ categoryId, name }: { categoryId: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton icon="more" label="More actions" onClick={() => setOpen(true)} />
      <BottomSheet open={open} onClose={() => setOpen(false)} title={name}>
        <ButtonLink href={`/budget/edit?category=${categoryId}`} variant="secondary" icon="edit" fullWidth>
          Edit budget
        </ButtonLink>
      </BottomSheet>
    </>
  );
}

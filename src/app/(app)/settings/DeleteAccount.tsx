"use client";

import { useState, type FormEvent } from "react";
import { BottomSheet, Button, ListRow, Notice, TextField } from "@/components/ui";
import { DELETE_CONFIRMATION } from "@/lib/validation/settings";

/** Success is only the route's own redirect to /login?deleted=1, never some other page (such as sign-in). */
function isDeletedLanding(url: string): boolean {
  const landing = new URL(url, window.location.href);
  return landing.pathname === "/login" && landing.searchParams.get("deleted") === "1";
}

const FAILED = "We couldn't delete your account. Nothing was removed. Check your connection and try again.";

/**
 * "Delete my account" and its confirmation: typing DELETE enables the button,
 * which posts to /api/account/delete. On success the route has signed the
 * user out and redirects to /login?deleted=1; the page follows it.
 */
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (pending) return;
    setOpen(false);
    setTyped("");
    setError(null);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (typed !== DELETE_CONFIRMATION || pending) return;
    setPending(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("confirm", typed);
      const res = await fetch("/api/account/delete", { method: "POST", body });
      if (res.ok && res.redirected && isDeletedLanding(res.url)) {
        window.location.assign(res.url);
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? FAILED);
    } catch {
      setError(FAILED);
    }
    setPending(false);
  }

  return (
    <>
      <ListRow
        icon="trash"
        title="Delete my account"
        subtitle="Remove your account and all your data"
        tone="danger"
        onClick={() => setOpen(true)}
      />
      <BottomSheet open={open} onClose={close} title="Delete your account?" role="alertdialog">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <p className="text-body text-muted">
            This permanently deletes your account and everything in it: budgets, expenses, savings funds, trips and
            recurring payments. It can&apos;t be undone. To keep a copy, export your data first.
          </p>
          <TextField
            label="Type DELETE to confirm"
            name="confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
          {error ? (
            <div role="alert">
              <Notice tone="danger">{error}</Notice>
            </div>
          ) : null}
          <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
            <Button variant="secondary" onClick={close} disabled={pending}>
              Keep my account
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={typed !== DELETE_CONFIRMATION || pending}
              aria-busy={pending}
            >
              {pending ? "Deleting…" : "Delete account"}
            </Button>
          </div>
        </form>
      </BottomSheet>
    </>
  );
}

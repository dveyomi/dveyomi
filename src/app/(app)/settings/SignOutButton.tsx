"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

/** Submit button for the sign-out form; shows a pending state while the action runs. */
export function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending}>
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}

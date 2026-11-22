"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
import { useI18n } from "@/i18n/client";

/** Submit button for the sign-out form; shows a pending state while the action runs. */
export function SignOutButton() {
  const { pending } = useFormStatus();
  const { m } = useI18n();
  return (
    <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending}>
      {pending ? m.settingsPage.signingOut : m.settingsPage.signOut}
    </Button>
  );
}

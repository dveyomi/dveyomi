"use client";

import { useI18n } from "@/i18n/client";
import { signOut } from "./actions";
import { SettingsSection } from "./SettingsSection";
import { SignOutButton } from "./SignOutButton";

/** The Account card: who is signed in, and how to sign out (works without JavaScript). */
export function AccountCard({ email }: { email: string | null }) {
  const { m } = useI18n();
  return (
    <SettingsSection title={m.settingsPage.account}>
      {email && (
        <p className="break-all text-body text-muted">
          {m.settingsPage.signedInAs}
          <span className="text-text">{email}</span>
        </p>
      )}
      <form action={signOut} className="mt-4">
        <SignOutButton />
      </form>
    </SettingsSection>
  );
}

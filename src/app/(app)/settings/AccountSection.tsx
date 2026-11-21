import { getClaims } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { SettingsSection } from "./SettingsSection";
import { SignOutButton } from "./SignOutButton";

/** The Account card: who is signed in, and how to sign out (works without JavaScript). */
export function AccountCard({ email }: { email: string | null }) {
  return (
    <SettingsSection title="Account">
      {email && (
        <p className="break-all text-body text-muted">
          Signed in as <span className="text-text">{email}</span>
        </p>
      )}
      <form action={signOut} className="mt-4">
        <SignOutButton />
      </form>
    </SettingsSection>
  );
}

/** Reads the verified email from the token claims (request-time work, so render inside Suspense). */
export async function AccountSection() {
  const claims = await getClaims();
  const email = typeof claims?.email === "string" ? claims.email : null;
  return <AccountCard email={email} />;
}

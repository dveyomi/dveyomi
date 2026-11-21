import { connection } from "next/server";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { SignOutButton } from "./SignOutButton";

/** The Account card: who is signed in, and how to sign out (works without JavaScript). */
export function AccountCard({ email }: { email: string | null }) {
  return (
    <Card as="section">
      <h2 className="text-body font-semibold text-text">Account</h2>
      {email && (
        <p className="mt-1 break-all text-body text-muted">
          Signed in as <span className="text-text">{email}</span>
        </p>
      )}
      <form action={signOut} className="mt-4">
        <SignOutButton />
      </form>
    </Card>
  );
}

/** Reads the verified email from the token claims (request-time work, so render inside Suspense). */
export async function AccountSection() {
  await connection(); // verifying the token reads the clock
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims.email === "string" ? data.claims.email : null;
  return <AccountCard email={email} />;
}

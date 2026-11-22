import { getClaims } from "@/lib/supabase/server";
import { AccountCard } from "./AccountCard";

export { AccountCard };

/** Reads the verified email from the token claims (request-time work, so render inside Suspense). */
export async function AccountSection() {
  const claims = await getClaims();
  const email = typeof claims?.email === "string" ? claims.email : null;
  return <AccountCard email={email} />;
}

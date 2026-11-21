"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

const FAILED = "Sign-in didn't finish. Please try again.";
const messages: Record<string, string> = {
  signin: FAILED,
  account: "We couldn't load your account, so you've been signed out. Please sign in again.",
};

function SignInBody({ error, onClick, pending }: { error: string | null; onClick?: () => void; pending: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-body text-danger">
          {error}
        </p>
      ) : null}
      <Button variant="primary" size="lg" fullWidth onClick={onClick} disabled={pending || !onClick}>
        {pending ? "Opening Google…" : "Continue with Google"}
      </Button>
      <p className="text-center text-caption text-muted">One sign-in for your budget on every device.</p>
    </div>
  );
}

/** Shown while the search params stream in; same layout, not yet clickable. */
export function GoogleSignInFallback() {
  return <SignInBody error={null} pending={false} />;
}

/** "Continue with Google": starts the OAuth round trip through Supabase. */
export function GoogleSignIn() {
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    const code = searchParams.get("error");
    return code ? (messages[code] ?? FAILED) : null;
  });

  async function signIn() {
    setPending(true);
    setError(null);
    const callback = new URL("/auth/callback", window.location.origin);
    const next = searchParams.get("next");
    if (next) callback.searchParams.set("next", next);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
    // On success the browser is already navigating to Google.
    if (error) {
      setError(FAILED);
      setPending(false);
    }
  }

  return <SignInBody error={error} onClick={signIn} pending={pending} />;
}

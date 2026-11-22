"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { createClient } from "@/lib/supabase/client";

function SignInBody({ error, onClick, pending }: { error: string | null; onClick?: () => void; pending: boolean }) {
  const { m } = useI18n();
  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-body text-danger-fg">
          {error}
        </p>
      ) : null}
      <Button variant="primary" size="lg" fullWidth onClick={onClick} disabled={pending || !onClick}>
        {pending ? m.auth.openingGoogle : m.auth.continueWithGoogle}
      </Button>
      <p className="text-center text-caption text-muted">{m.auth.oneSignIn}</p>
    </div>
  );
}

/** Shown while the search params stream in; same layout, not yet clickable. */
export function GoogleSignInFallback() {
  return <SignInBody error={null} pending={false} />;
}

/** "Continue with Google": starts the OAuth round trip through Supabase. */
export function GoogleSignIn() {
  const { m } = useI18n();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    const code = searchParams.get("error");
    if (!code) return null;
    return code === "account" ? m.auth.accountFailed : m.auth.failed;
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
      setError(m.auth.failed);
      setPending(false);
    }
  }

  return <SignInBody error={error} onClick={signIn} pending={pending} />;
}

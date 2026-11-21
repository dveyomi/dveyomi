import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, Icon } from "@/components/ui";
import { GoogleSignIn, GoogleSignInFallback } from "./GoogleSignIn";

export const metadata: Metadata = { title: "Sign in · Personal Finance OS" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-phone flex-1 flex-col justify-center gap-8 px-4 py-10 md:max-w-md">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-md bg-accent text-accent-ink">
          <Icon name="wallet" size="lg" />
        </span>
        <h1 translate="no" className="text-balance text-display font-semibold text-text">Personal Finance OS</h1>
        <p className="text-body text-muted">Know what is safe to spend, every day.</p>
      </div>
      <Card>
        <Suspense fallback={<GoogleSignInFallback />}>
          <GoogleSignIn />
        </Suspense>
      </Card>
    </main>
  );
}

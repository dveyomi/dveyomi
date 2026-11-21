import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Nav } from "@/components/Nav";
import { TimezoneSync } from "@/components/TimezoneSync";
import { focusRing } from "@/components/ui/focus";
import { getProfile } from "@/lib/supabase/server";

/** Reads the session, so it streams in behind Suspense rather than holding up the shell. */
async function SignedInSync() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return <TimezoneSync profileTimezone={profile.timezone} />;
}

/** Signed-in app shell: bottom tab bar on a phone, left rail from 768px. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className={`sr-only z-40 rounded-pill bg-accent font-semibold text-accent-ink focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:px-5 focus:py-3 ${focusRing}`}
      >
        Skip to content
      </a>
      <Nav />
      <main id="main" className="flex flex-1 flex-col pb-24 md:pb-0 md:pl-60">
        {children}
      </main>
      <Suspense fallback={null}>
        <SignedInSync />
      </Suspense>
    </>
  );
}

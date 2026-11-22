import { Suspense, type ReactNode } from "react";
import { Nav, NavBar } from "@/components/Nav";
import { PageMemory } from "@/components/PageMemory";
import { focusRing } from "@/components/ui/focus";
import { RecurringCatchUp } from "./RecurringCatchUp";
import { SignedInSync } from "./SignedInSync";

/** Signed-in app shell: floating bottom nav on a phone, left rail from 768px. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className={`sr-only z-40 rounded-pill bg-accent font-semibold text-accent-ink focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:px-5 focus:py-3 ${focusRing}`}
      >
        Skip to content
      </a>
      {/* On a route with an unknown dynamic param (/budget/[categoryId]) the pathname is only
          known at request time, so the prerendered shell shows the nav with nothing current. */}
      <Suspense fallback={<NavBar pathname={null} />}>
        <Nav />
      </Suspense>
      <main id="main" className="flex flex-1 flex-col pb-nav-clearance md:pb-0 md:pl-60">
        {children}
      </main>
      {/* Remembers the page for "the page you came from" in a bug report. */}
      <Suspense fallback={null}>
        <PageMemory />
      </Suspense>
      {/* Reads the session, so it streams in rather than holding up the shell. */}
      <Suspense fallback={null}>
        <SignedInSync />
      </Suspense>
      {/* Adds recurring payments due since the last run; never blocks rendering. */}
      <Suspense fallback={null}>
        <RecurringCatchUp />
      </Suspense>
    </>
  );
}

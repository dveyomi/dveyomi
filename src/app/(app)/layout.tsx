import { Suspense, type ReactNode } from "react";
import { Nav } from "@/components/Nav";
import { focusRing } from "@/components/ui/focus";
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
      <Nav />
      <main id="main" className="flex flex-1 flex-col pb-nav-clearance md:pb-0 md:pl-60">
        {children}
      </main>
      {/* Reads the session, so it streams in rather than holding up the shell. */}
      <Suspense fallback={null}>
        <SignedInSync />
      </Suspense>
    </>
  );
}

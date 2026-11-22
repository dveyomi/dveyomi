import { Suspense, type ReactNode } from "react";
import { Nav, NavBar } from "@/components/Nav";
import { PageMemory } from "@/components/PageMemory";
import { SkipLink } from "./SkipLink";
import { ProfilePrefs } from "./ProfilePrefs";
import { RecurringCatchUp } from "./RecurringCatchUp";
import { SignedInSync } from "./SignedInSync";

/** Signed-in app shell: floating bottom nav on a phone, left rail from 768px. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink />
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
      {/* Keeps this device's language and currency cookies in step with the profile. */}
      <Suspense fallback={null}>
        <ProfilePrefs />
      </Suspense>
      {/* Adds recurring payments due since the last run; never blocks rendering. */}
      <Suspense fallback={null}>
        <RecurringCatchUp />
      </Suspense>
    </>
  );
}

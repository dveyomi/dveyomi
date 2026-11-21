import { Suspense, type ReactNode } from "react";
import { SignedInSync } from "@/app/(app)/SignedInSync";

/** A focused flow: no app navigation, only the wizard's own Back and Continue. */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      {/* Checks the session and records the device's time zone, as in the app shell. */}
      <Suspense fallback={null}>
        <SignedInSync />
      </Suspense>
    </>
  );
}

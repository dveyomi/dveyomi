import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountSection } from "./AccountSection";

export const metadata: Metadata = { title: "Settings · Personal Finance OS" };

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-phone flex-col gap-4 px-4 py-6 md:mx-0 md:max-w-none md:p-8">
      <h1 className="text-title font-semibold text-text">Settings</h1>
      <Suspense fallback={null}>
        <AccountSection />
      </Suspense>
      <p className="text-body text-muted">More settings are coming: time zone and budget start day.</p>
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { AccountSection } from "./AccountSection";
import { SavedThemeChooser, ThemeCard } from "./ThemeSection";

export const metadata: Metadata = { title: "Settings · Personal Finance OS" };

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-phone flex-col gap-4 px-4 py-6 md:mx-0 md:max-w-none md:p-8">
      <h1 className="text-title font-semibold text-text">Settings</h1>
      <ThemeCard>
        <Suspense fallback={<Skeleton shape="segments" />}>
          <SavedThemeChooser />
        </Suspense>
      </ThemeCard>
      <Suspense fallback={<Skeleton shape="card" />}>
        <AccountSection />
      </Suspense>
      <p className="text-body text-muted">More settings are coming: time zone and budget start day.</p>
    </div>
  );
}

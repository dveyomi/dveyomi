import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge, ListRow, Skeleton } from "@/components/ui";
import { loadSettings } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";
import { AccountSection } from "./AccountSection";
import { BudgetSection } from "./BudgetSection";
import { DeleteAccount } from "./DeleteAccount";
import { HelpSection } from "./HelpSection";
import { RegionSection } from "./RegionSection";
import { SettingsSection } from "./SettingsSection";
import { SavedThemeChooser, ThemeCard } from "./ThemeSection";

export const metadata: Metadata = { title: "Settings · Personal Finance OS" };

/** Budget and Region read the profile (request-time), so they stream in. */
async function ProfileSections() {
  const today = await getToday(); // request-time first: creating the client reads the clock
  const settings = await loadSettings(await createClient(), today);
  return (
    <>
      <BudgetSection startDay={settings.startDay} nextBudgetStart={settings.nextBudgetStart} />
      <RegionSection
        timezone={settings.timezone}
        zones={Intl.supportedValuesOf("timeZone")}
        language={settings.language}
        currency={settings.currency}
      />
    </>
  );
}

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-phone flex-col gap-4 px-4 py-6 md:mx-0 md:max-w-5xl md:p-8">
      <h1 className="text-title font-semibold text-text">Settings</h1>
      <ThemeCard>
        <Suspense fallback={<Skeleton shape="segments" />}>
          <SavedThemeChooser />
        </Suspense>
      </ThemeCard>
      <Suspense
        fallback={
          <>
            <Skeleton shape="card" />
            <Skeleton shape="card" />
          </>
        }
      >
        <ProfileSections />
      </Suspense>
      <SettingsSection title="Connections">
        <div className="-mx-2">
          <ListRow
            icon="bank"
            title="Connect bank"
            subtitle="Spending added for you"
            trailing={<Badge tone="neutral">Coming later</Badge>}
          />
        </div>
      </SettingsSection>
      <SettingsSection title="Data" description="Your data is yours: bring it in, take a copy, or remove it.">
        <div className="-mx-2">
          <ListRow href="/settings/import" icon="upload" title="Import expenses" subtitle="From your bank's CSV file" />
          <ListRow href="/api/export" download icon="download" title="Export my data" subtitle="Everything, as a JSON file" />
          <DeleteAccount />
        </div>
      </SettingsSection>
      <HelpSection />
      <SettingsSection title="Legal">
        <div className="-mx-2">
          <ListRow href="/privacy" icon="shield" title="Privacy" subtitle="What we store and who can see it" />
        </div>
      </SettingsSection>
      <Suspense fallback={<Skeleton shape="card" />}>
        <AccountSection />
      </Suspense>
    </div>
  );
}

import { getServerI18n } from "@/i18n/server";
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

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getServerI18n();
  return { title: m.shell.pageTitle(m.settingsPage.title) };
}

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

export default async function Page() {
  const { m } = await getServerI18n();
  const sp = m.settingsPage;
  return (
    <div className="mx-auto flex w-full max-w-phone flex-col gap-4 px-4 py-6 md:mx-0 md:max-w-5xl md:p-8">
      <h1 className="text-title font-semibold text-text">{sp.title}</h1>
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
      <SettingsSection title={sp.connections}>
        <div className="-mx-2">
          <ListRow
            icon="bank"
            title={sp.connectBank}
            subtitle={sp.connectBankSubtitle}
            trailing={<Badge tone="neutral">{sp.comingLater}</Badge>}
          />
        </div>
      </SettingsSection>
      <SettingsSection title={sp.data} description={sp.dataDescription}>
        <div className="-mx-2">
          <ListRow href="/settings/import" icon="upload" title={sp.importExpenses} subtitle={sp.importSubtitle} />
          <ListRow href="/api/export" download icon="download" title={sp.export} subtitle={sp.exportSubtitle} />
          <DeleteAccount />
        </div>
      </SettingsSection>
      <HelpSection />
      <SettingsSection title={sp.legal}>
        <div className="-mx-2">
          <ListRow href="/privacy" icon="shield" title={sp.privacy} subtitle={sp.privacySubtitle} />
        </div>
      </SettingsSection>
      <Suspense fallback={<Skeleton shape="card" />}>
        <AccountSection />
      </Suspense>
    </div>
  );
}

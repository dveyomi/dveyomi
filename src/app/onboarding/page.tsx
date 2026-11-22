import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getServerI18n } from "@/i18n/server";
import { hasBudget } from "@/lib/data/onboarding";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";
import { OnboardingWizard } from "./Wizard";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getServerI18n();
  return { title: m.shell.pageTitle(m.onboarding.metaTitle) };
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Onboarding />
    </Suspense>
  );
}

/** Onboarding is only for signed-in users without a budget; anyone with one goes to /budget. */
async function Onboarding() {
  if (!(await getUserId())) redirect("/login?next=/onboarding");
  if (await hasBudget(await createClient())) redirect("/budget");
  return <OnboardingWizard today={await getToday()} />;
}

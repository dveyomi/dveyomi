import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { hasBudget } from "@/lib/data/onboarding";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";
import { OnboardingWizard } from "./Wizard";

export const metadata: Metadata = { title: "Set up your budget · Personal Finance OS" };

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

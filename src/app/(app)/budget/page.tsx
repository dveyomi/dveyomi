import { getServerI18n } from "@/i18n/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { BudgetContent } from "./BudgetContent";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getServerI18n();
  return { title: m.shell.pageTitle(m.budget.title) };
}

export default async function Page({ searchParams }: PageProps<"/budget">) {
  const { m } = await getServerI18n();
  return (
    <div className="mx-auto flex w-full max-w-phone flex-col gap-4 px-4 py-6 md:mx-0 md:max-w-none md:p-8">
      <h1 id="budget-heading" tabIndex={-1} className="text-title font-semibold text-text outline-none">
        {m.budget.title}
      </h1>
      <Suspense fallback={<BudgetSkeleton />}>
        <BudgetContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function BudgetSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Skeleton shape="card" />
        <Skeleton shape="card" />
      </div>
      <div className="flex flex-col gap-4 lg:col-span-3">
        <Skeleton shape="segments" />
        <Skeleton shape="card" />
        <Skeleton shape="card" />
      </div>
    </div>
  );
}

import { getServerI18n } from "@/i18n/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ButtonLink, Skeleton } from "@/components/ui";
import { ExpensesContent } from "./ExpensesContent";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getServerI18n();
  return { title: m.shell.pageTitle(m.overview.title) };
}

export default async function Page({ searchParams }: PageProps<"/expenses">) {
  const { m } = await getServerI18n();
  return (
    <div className="mx-auto flex w-full max-w-phone flex-col gap-4 px-4 py-6 md:mx-0 md:max-w-none md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-title font-semibold text-text">{m.overview.title}</h1>
        <div className="flex gap-2">
          <ButtonLink href="/expenses/trips" variant="secondary" icon="plane" iconOnlyOnPhone>
            {m.trips.title}
          </ButtonLink>
          <ButtonLink href="/expenses/recurring" variant="secondary" icon="repeat" iconOnlyOnPhone>
            {m.overview.recurringLink}
          </ButtonLink>
          <ButtonLink href="/settings/import" variant="secondary" icon="upload" iconOnlyOnPhone>
            {m.overview.importLink}
          </ButtonLink>
        </div>
      </div>
      <Suspense fallback={<ExpensesSkeleton />}>
        <ExpensesContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function ExpensesSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton shape="segments" />
      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Skeleton shape="card" />
          <Skeleton shape="card" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton shape="card" />
          <Skeleton shape="card" />
        </div>
      </div>
    </div>
  );
}

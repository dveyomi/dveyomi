import type { Metadata } from "next";
import { Suspense } from "react";
import { ButtonLink, Skeleton } from "@/components/ui";
import { ExpensesContent } from "./ExpensesContent";

export const metadata: Metadata = { title: "Expenses · Personal Finance OS" };

export default function Page({ searchParams }: PageProps<"/expenses">) {
  return (
    <div className="mx-auto flex w-full max-w-phone flex-col gap-4 px-4 py-6 md:mx-0 md:max-w-none md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-title font-semibold text-text">Expenses</h1>
        <div className="flex gap-2">
          <ButtonLink href="/expenses/trips" variant="secondary" icon="plane" iconOnlyOnPhone>
            Trips
          </ButtonLink>
          <ButtonLink href="/expenses/recurring" variant="secondary" icon="repeat" iconOnlyOnPhone>
            Recurring
          </ButtonLink>
          <ButtonLink href="/settings/import" variant="secondary" icon="upload" iconOnlyOnPhone>
            Import
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

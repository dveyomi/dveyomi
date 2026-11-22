import { getServerI18n } from "@/i18n/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ButtonLink, Skeleton } from "@/components/ui";
import { RecurringContent } from "./RecurringContent";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getServerI18n();
  return { title: m.shell.pageTitle(m.recurring.title) };
}

export default async function Page() {
  const { m } = await getServerI18n();
  return (
    <div className="mx-auto flex w-full max-w-phone flex-col gap-4 px-4 py-6 md:mx-0 md:max-w-none md:p-8">
      <div className="flex flex-col items-start gap-2">
        <ButtonLink href="/expenses" variant="ghost" icon="chevron-left">
          {m.overview.title}
        </ButtonLink>
        <h1 className="text-title font-semibold text-text">{m.recurring.title}</h1>
      </div>
      <Suspense
        fallback={
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3 lg:gap-6">
            <div className="lg:col-span-2">
              <Skeleton shape="card" />
            </div>
            <Skeleton shape="card" />
          </div>
        }
      >
        <RecurringContent />
      </Suspense>
    </div>
  );
}

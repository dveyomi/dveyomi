import { getServerI18n } from "@/i18n/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ButtonLink, Skeleton } from "@/components/ui";
import { ImportContent } from "./ImportContent";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getServerI18n();
  return { title: m.shell.pageTitle(m.importer.title) };
}

export default async function Page() {
  const { m } = await getServerI18n();
  return (
    <div className="mx-auto flex w-full max-w-phone flex-col gap-4 px-4 py-6 md:mx-0 md:max-w-none md:p-8">
      <div className="flex flex-col items-start gap-2">
        <ButtonLink href="/settings" variant="ghost" icon="chevron-left">
          {m.importer.settings}
        </ButtonLink>
        <h1 className="text-title font-semibold text-text">{m.importer.title}</h1>
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
        <ImportContent />
      </Suspense>
    </div>
  );
}

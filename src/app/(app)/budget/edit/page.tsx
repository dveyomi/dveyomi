import { getServerI18n } from "@/i18n/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { EditContent } from "./EditContent";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getServerI18n();
  return { title: m.shell.pageTitle(m.budget.editTitle) };
}

export default function Page({ searchParams }: PageProps<"/budget/edit">) {
  return (
    <div className="mx-auto flex w-full max-w-phone flex-col gap-4 px-4 py-6 md:mx-0 md:max-w-none md:p-8">
      <Suspense
        fallback={
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="flex flex-col gap-4 lg:col-span-3">
              <Skeleton shape="card" />
              <Skeleton shape="segments" />
              <Skeleton shape="card" />
            </div>
            <div className="lg:col-span-2">
              <Skeleton shape="card" />
            </div>
          </div>
        }
      >
        <EditContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

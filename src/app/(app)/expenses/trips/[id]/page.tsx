import { getServerI18n } from "@/i18n/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { TripContent } from "./TripContent";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getServerI18n();
  return { title: m.shell.pageTitle(m.trips.trip) };
}

export default function Page({ params }: PageProps<"/expenses/trips/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-phone flex-col gap-4 px-4 py-6 md:mx-0 md:max-w-none md:p-8">
      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            <Skeleton shape="card" />
            <Skeleton shape="card" />
          </div>
        }
      >
        <TripContent params={params} />
      </Suspense>
    </div>
  );
}

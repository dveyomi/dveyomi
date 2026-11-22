import { getServerI18n } from "@/i18n/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ButtonLink, Card, Skeleton } from "@/components/ui";
import { NewTripContent } from "./NewTripContent";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getServerI18n();
  return { title: m.shell.pageTitle(m.trips.newTrip) };
}

export default async function Page({ searchParams }: PageProps<"/expenses/trips/new">) {
  const { m } = await getServerI18n();
  return (
    <div className="mx-auto flex w-full max-w-phone flex-col gap-4 px-4 py-6 md:mx-0 md:max-w-xl md:p-8">
      <div className="flex flex-col items-start gap-2">
        <ButtonLink href="/expenses/trips" variant="ghost" icon="chevron-left">
          {m.trips.title}
        </ButtonLink>
        <h1 className="text-title font-semibold text-text">{m.trips.newTrip}</h1>
      </div>
      <Card className="md:p-6">
        <Suspense fallback={<Skeleton shape="card" />}>
          <NewTripContent searchParams={searchParams} />
        </Suspense>
      </Card>
    </div>
  );
}

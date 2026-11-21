import type { Metadata } from "next";
import { Suspense } from "react";
import { ButtonLink, Skeleton } from "@/components/ui";
import { ImportContent } from "./ImportContent";

export const metadata: Metadata = { title: "Import expenses · Personal Finance OS" };

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-phone flex-col gap-4 px-4 py-6 md:mx-0 md:max-w-none md:p-8">
      <div className="flex flex-col items-start gap-2">
        <ButtonLink href="/settings" variant="ghost" icon="chevron-left">
          Settings
        </ButtonLink>
        <h1 className="text-title font-semibold text-text">Import expenses</h1>
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

import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { CategoryContent } from "./CategoryContent";

export const metadata: Metadata = { title: "Category · Personal Finance OS" };

export default function Page({ params }: PageProps<"/budget/[categoryId]">) {
  return (
    <div className="mx-auto flex w-full max-w-phone flex-col gap-4 px-4 py-6 md:mx-0 md:max-w-none md:p-8">
      <Suspense
        fallback={
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Skeleton shape="card" />
            </div>
            <div className="flex flex-col gap-4 lg:col-span-3">
              <Skeleton shape="card" />
              <Skeleton shape="card" />
            </div>
          </div>
        }
      >
        <CategoryContent params={params} />
      </Suspense>
    </div>
  );
}

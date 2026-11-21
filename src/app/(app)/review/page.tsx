import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { ReviewContent } from "./ReviewContent";

export const metadata: Metadata = { title: "Review your budget · Personal Finance OS" };

/** The period-end review: a focused screen (no phone nav), with its own way back to the budget. */
export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-phone flex-col gap-6 px-4 py-6 md:max-w-5xl md:p-8">
      <Suspense fallback={<ReviewSkeleton />}>
        <ReviewContent />
      </Suspense>
    </div>
  );
}

function ReviewSkeleton() {
  return (
    <>
      <Skeleton shape="segments" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton shape="card" />
        <Skeleton shape="card" />
      </div>
    </>
  );
}

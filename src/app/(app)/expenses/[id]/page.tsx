import type { Metadata } from "next";
import { Suspense } from "react";
import { ExpenseFormSkeleton } from "../ExpenseFormSkeleton";
import { EditExpenseContent } from "./EditExpenseContent";

export const metadata: Metadata = { title: "Edit expense · Personal Finance OS" };

export default function Page({ params, searchParams }: PageProps<"/expenses/[id]">) {
  return (
    <Suspense fallback={<ExpenseFormSkeleton />}>
      <EditExpenseContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { ExpenseFormSkeleton } from "../ExpenseFormSkeleton";
import { NewExpenseContent } from "./NewExpenseContent";

export const metadata: Metadata = { title: "Add expense · Personal Finance OS" };

export default function Page({ searchParams }: PageProps<"/expenses/new">) {
  return (
    <Suspense fallback={<ExpenseFormSkeleton />}>
      <NewExpenseContent searchParams={searchParams} />
    </Suspense>
  );
}

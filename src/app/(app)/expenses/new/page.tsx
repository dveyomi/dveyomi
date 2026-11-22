import { getServerI18n } from "@/i18n/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ExpenseFormSkeleton } from "../ExpenseFormSkeleton";
import { NewExpenseContent } from "./NewExpenseContent";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getServerI18n();
  return { title: m.shell.pageTitle(m.expenseForm.addTitle) };
}

export default function Page({ searchParams }: PageProps<"/expenses/new">) {
  return (
    <Suspense fallback={<ExpenseFormSkeleton />}>
      <NewExpenseContent searchParams={searchParams} />
    </Suspense>
  );
}

import { getServerI18n } from "@/i18n/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ExpenseFormSkeleton } from "../ExpenseFormSkeleton";
import { EditExpenseContent } from "./EditExpenseContent";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getServerI18n();
  return { title: m.shell.pageTitle(m.expenseForm.editTitle) };
}

export default function Page({ params, searchParams }: PageProps<"/expenses/[id]">) {
  return (
    <Suspense fallback={<ExpenseFormSkeleton />}>
      <EditExpenseContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

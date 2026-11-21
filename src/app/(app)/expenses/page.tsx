import type { Metadata } from "next";
import { Card, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Expenses · Personal Finance OS" };

/** Placeholder until this screen is built. */
export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-phone flex-col gap-4 px-4 py-6 md:mx-0 md:max-w-none md:p-8">
      <h1 className="text-title font-semibold text-text">Expenses</h1>
      <Card>
        <EmptyState icon="wallet" title="No expenses yet" body="Expenses you add will show here, by day and by category." />
      </Card>
    </div>
  );
}

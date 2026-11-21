import type { Metadata } from "next";
import { ButtonLink, Card, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Set new budget · Personal Finance OS" };

/** Placeholder until the budget editor is built. */
export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-phone flex-col gap-4 px-4 py-6 md:mx-0 md:max-w-none md:p-8">
      <h1 className="text-title font-semibold text-text">Set new budget</h1>
      <Card>
        <EmptyState
          icon="edit"
          title="Coming soon"
          body="You'll change your income, savings and allocations here."
          action={
            <ButtonLink href="/budget" variant="secondary" icon="chevron-left">
              Back to budget
            </ButtonLink>
          }
        />
      </Card>
    </div>
  );
}

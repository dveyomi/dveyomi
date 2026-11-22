import { redirect } from "next/navigation";
import { ImportWizard } from "@/components/ImportWizard";
import { RecentImports } from "@/components/RecentImports";
import { ButtonLink, Card, EmptyState } from "@/components/ui";
import { todayIn } from "@/lib/calc";
import { listImports } from "@/lib/data/imports";
import { loadExpenseOptions } from "@/lib/data/transactions";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getTimeZone } from "@/lib/today";

/** The import wizard, with the latest imports (and Undo) beside it on desktop and below it on a phone. */
export async function ImportContent() {
  if (!(await getUserId())) redirect("/login");
  const [supabase, zone] = await Promise.all([createClient(), getTimeZone()]);
  const [options, batches] = await Promise.all([loadExpenseOptions(supabase), listImports(supabase)]);
  const imports = batches.map((b) => ({
    id: b.id,
    filename: b.filename,
    importedOn: todayIn(zone, new Date(b.createdAt)),
    rowCount: b.rowCount,
  }));

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3 lg:gap-6">
      <div className="flex flex-col gap-4 lg:col-span-2">
        {options.categories.length === 0 ? (
          <Card>
            <EmptyState
              icon="pie"
              title="Add a category first"
              body="Imported expenses go into one of your budget categories."
              action={
                <ButtonLink href="/budget" variant="primary">
                  Go to Budget
                </ButtonLink>
              }
            />
          </Card>
        ) : (
          <ImportWizard categories={options.categories} today={todayIn(zone, new Date())} />
        )}
      </div>
      <div className="flex flex-col gap-4">
        <Card as="section" className="flex flex-col gap-2">
          <h2 className="text-caption font-semibold text-muted">Recent imports</h2>
          <RecentImports imports={imports} />
        </Card>
        <Card as="section" className="flex flex-col gap-2">
          <h2 className="text-caption font-semibold text-muted">Good to know</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-body text-text">
            <li>Imported expenses count in your budget exactly like ones you add.</li>
            <li>A row with the same amount as an expense you already have, within 2 days of it, starts unticked.</li>
            <li>Money in, like your salary or refunds, isn&rsquo;t imported.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

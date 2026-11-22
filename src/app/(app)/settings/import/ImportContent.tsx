import { getServerI18n } from "@/i18n/server";
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
  const { m } = await getServerI18n();
  const w = m.importer;
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
              title={w.needCategoryTitle}
              body={w.needCategoryBody}
              action={
                <ButtonLink href="/budget" variant="primary">
                  {w.goToBudget}
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
          <h2 className="text-caption font-semibold text-muted">{w.recent}</h2>
          <RecentImports imports={imports} />
        </Card>
        <Card as="section" className="flex flex-col gap-2">
          <h2 className="text-caption font-semibold text-muted">{w.goodToKnow}</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-body text-text">
            <li>{w.tipBudget}</li>
            <li>{w.tipDuplicates}</li>
            <li>{w.tipMoneyIn}</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

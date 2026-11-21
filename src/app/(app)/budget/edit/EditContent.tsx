import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui";
import { addDays, formatDayMonth } from "@/lib/calc";
import { loadBudgetEditor } from "@/lib/data/budgetEdit";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";
import { BudgetEditor } from "./BudgetEditor";

type EditContentProps = { searchParams: Promise<{ category?: string | string[] }> };

/** Loads the current budget for the editor; a user with no budget yet is sent to onboarding. */
export async function EditContent({ searchParams }: EditContentProps) {
  if (!(await getUserId())) redirect("/login");
  const [supabase, today, { category }] = await Promise.all([createClient(), getToday(), searchParams]);
  const editor = await loadBudgetEditor(supabase, today);
  if (!editor) redirect("/onboarding");
  const { current } = editor;
  const period = { start: current.start_date, end: current.end_date, nextStart: addDays(current.end_date, 1) };

  return (
    <>
      <div className="flex flex-col gap-2">
        <div>
          <ButtonLink href="/budget" variant="ghost" icon="chevron-left">
            Budget
          </ButtonLink>
        </div>
        <h1 className="text-title font-semibold text-text md:text-display">Edit budget</h1>
        <p className="text-body text-muted">
          This period: {formatDayMonth(period.start)} – {formatDayMonth(period.end)}
        </p>
      </div>
      <BudgetEditor
        period={period}
        budget={editor.budget}
        nextBudget={editor.nextBudget}
        nextDiffers={editor.nextDiffers}
        outside={editor.outside}
        focusCategoryId={typeof category === "string" ? category : undefined}
      />
    </>
  );
}

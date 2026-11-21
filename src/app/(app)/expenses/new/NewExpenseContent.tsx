import { redirect } from "next/navigation";
import { ExpenseForm } from "@/components/ExpenseForm";
import { loadExpenseOptions } from "@/lib/data/transactions";
import { listTrips } from "@/lib/data/trips";
import { safeNext } from "@/lib/safeNext";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";
import { newExpenseValues } from "@/lib/validation/expense";
import { saveExpenseAction } from "../actions";

type Params = { category?: string | string[]; date?: string | string[]; returnTo?: string | string[] };

/** Add expense: ?category= preselects a category, ?date= a tapped calendar day, ?returnTo= where to go after. */
export async function NewExpenseContent({ searchParams }: { searchParams: Promise<Params> }) {
  if (!(await getUserId())) redirect("/login");
  const [supabase, today, params] = await Promise.all([createClient(), getToday(), searchParams]);
  const [{ categories, funds }, trips] = await Promise.all([loadExpenseOptions(supabase), listTrips(supabase)]);
  const returnTo = safeNext(typeof params.returnTo === "string" ? params.returnTo : null, "/expenses");

  return (
    <ExpenseForm
      categories={categories}
      funds={funds}
      trips={trips}
      today={today}
      initial={newExpenseValues(params, categories, today)}
      returnTo={returnTo}
      save={saveExpenseAction.bind(null, { returnTo })}
    />
  );
}

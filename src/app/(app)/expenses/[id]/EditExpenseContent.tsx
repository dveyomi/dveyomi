import { notFound, redirect } from "next/navigation";
import { ExpenseForm } from "@/components/ExpenseForm";
import { penceToInputText } from "@/lib/calc";
import { loadExpenseOptions, loadTransaction } from "@/lib/data/transactions";
import { safeNext } from "@/lib/safeNext";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";
import { deleteExpenseAction, saveExpenseAction } from "../actions";
import { confirmOccurrenceAction } from "../recurring/actions";

type EditExpenseContentProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

/** Edit expense: the user's own expense only (another user's or an unknown id is a 404). A recurring payment asks which payments a new amount applies to; an unchecked one can be marked as checked. */
export async function EditExpenseContent({ params, searchParams }: EditExpenseContentProps) {
  if (!(await getUserId())) redirect("/login");
  const [supabase, today, { id }, query] = await Promise.all([createClient(), getToday(), params, searchParams]);
  const [txn, { categories, funds }] = await Promise.all([loadTransaction(supabase, id), loadExpenseOptions(supabase)]);
  if (!txn) notFound();
  const returnTo = safeNext(typeof query.returnTo === "string" ? query.returnTo : null, "/expenses");

  return (
    <ExpenseForm
      categories={categories}
      funds={funds}
      today={today}
      initial={{
        name: txn.name,
        amountText: penceToInputText(txn.amountPence),
        date: txn.date,
        categoryId: txn.categoryId,
        fundId: txn.fundId,
        accountLabel: txn.accountLabel ?? "",
        notes: txn.notes ?? "",
      }}
      returnTo={returnTo}
      save={saveExpenseAction.bind(null, { id: txn.id, returnTo })}
      remove={deleteExpenseAction.bind(null, { id: txn.id, returnTo })}
      recurring={txn.recurringRuleId !== null}
      unchecked={txn.unchecked}
      markChecked={txn.unchecked ? confirmOccurrenceAction.bind(null, txn.id) : undefined}
    />
  );
}

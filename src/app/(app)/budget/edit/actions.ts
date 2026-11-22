"use server";

import { localizeError } from "@/i18n/errors";
import { getServerI18n } from "@/i18n/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BudgetChangedError, NameTakenError, NoBudgetError, SavingsMovedError, saveBudget, validateBudgetEdit } from "@/lib/data/budgetEdit";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";

/**
 * Saves the budget editor, then opens the budget with a confirmation. The
 * input is untrusted: it is validated here, and the periods it changes are
 * worked out from the user's today on the server. `savingsMoved`: "This
 * month" changed savings already moved into funds; the editor offers From
 * next period.
 */
export async function saveBudgetAction(raw: unknown): Promise<{ error: string; savingsMoved?: true }> {
  if (!(await getUserId())) redirect("/login");

  const checked = validateBudgetEdit(raw, await getServerI18n());
  if (!checked.ok) return { error: checked.error };

  try {
    await saveBudget(await createClient(), await getToday(), checked.input);
  } catch (e) {
    if (e instanceof NameTakenError || e instanceof BudgetChangedError) return { error: localizeError(e, await getServerI18n()) };
    if (e instanceof SavingsMovedError) return { error: localizeError(e, await getServerI18n()), savingsMoved: true };
    if (e instanceof NoBudgetError) redirect("/onboarding");
    console.error("saveBudget failed", e);
    return { error: (await getServerI18n()).m.checks.budgetFailed };
  }
  revalidatePath("/budget", "layout");
  redirect("/budget?saved=1");
}

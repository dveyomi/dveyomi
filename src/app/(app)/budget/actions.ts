"use server";

import { localizeError } from "@/i18n/errors";
import { getServerI18n } from "@/i18n/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CategoryInUseError, NameTakenError, deleteCategory, removeFromBudget, renameCategory } from "@/lib/data/budgetEdit";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";
import { checkCategoryName, isId } from "@/lib/validation/budgetEdit";

const NOT_FOUND = async () => ({ error: (await getServerI18n()).m.checks.categoryNotFound });
const FAILED = async () => ({ error: (await getServerI18n()).m.checks.failed });

/** The ⋯ menu's actions on a category. Inputs are untrusted and checked here. */

export async function renameCategoryAction(categoryId: unknown, name: unknown): Promise<{ error: string } | undefined> {
  if (!(await getUserId())) redirect("/login");
  if (!isId(categoryId)) return await NOT_FOUND();
  const checked = checkCategoryName(name);
  if (!checked.ok) return { error: checked.error };
  try {
    await renameCategory(await createClient(), categoryId, checked.value);
  } catch (e) {
    if (e instanceof NameTakenError) return { error: localizeError(e, await getServerI18n()) };
    console.error("renameCategory failed", e);
    return await FAILED();
  }
  revalidatePath("/budget", "layout");
}

/** Deletes a never-used category, then opens the budget. A used one can only be removed from the budget. */
export async function deleteCategoryAction(categoryId: unknown): Promise<{ error: string } | undefined> {
  if (!(await getUserId())) redirect("/login");
  if (!isId(categoryId)) return await NOT_FOUND();
  try {
    await deleteCategory(await createClient(), await getToday(), categoryId);
  } catch (e) {
    if (e instanceof CategoryInUseError) return { error: localizeError(e, await getServerI18n()) };
    console.error("deleteCategory failed", e);
    return await FAILED();
  }
  revalidatePath("/budget", "layout");
  redirect("/budget?deleted=1");
}

/** Drops the category's allocation from the current period onward; its past spending keeps the category. */
export async function removeFromBudgetAction(categoryId: unknown): Promise<{ error: string } | undefined> {
  if (!(await getUserId())) redirect("/login");
  if (!isId(categoryId)) return await NOT_FOUND();
  try {
    await removeFromBudget(await createClient(), await getToday(), categoryId, "this");
  } catch (e) {
    console.error("removeFromBudget failed", e);
    return await FAILED();
  }
  revalidatePath("/budget", "layout");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CategoryInUseError,
  NameTakenError,
  checkCategoryName,
  deleteCategory,
  removeFromBudget,
  renameCategory,
} from "@/lib/data/budgetEdit";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = { error: "That category wasn't found. Reload the page and try again." };
const FAILED = { error: "We couldn't save that. Check your connection and try again." };

/** The ⋯ menu's actions on a category. Inputs are untrusted and checked here. */

export async function renameCategoryAction(categoryId: unknown, name: unknown): Promise<{ error: string } | undefined> {
  if (!(await getUserId())) redirect("/login");
  if (typeof categoryId !== "string" || !UUID.test(categoryId)) return NOT_FOUND;
  const checked = checkCategoryName(name);
  if (!checked.ok) return { error: checked.error };
  try {
    await renameCategory(await createClient(), categoryId, checked.value);
  } catch (e) {
    if (e instanceof NameTakenError) return { error: e.message };
    console.error("renameCategory failed", e);
    return FAILED;
  }
  revalidatePath("/budget", "layout");
}

/** Deletes a never-used category, then opens the budget. A used one can only be removed from the budget. */
export async function deleteCategoryAction(categoryId: unknown): Promise<{ error: string } | undefined> {
  if (!(await getUserId())) redirect("/login");
  if (typeof categoryId !== "string" || !UUID.test(categoryId)) return NOT_FOUND;
  try {
    await deleteCategory(await createClient(), categoryId);
  } catch (e) {
    if (e instanceof CategoryInUseError) return { error: e.message };
    console.error("deleteCategory failed", e);
    return FAILED;
  }
  revalidatePath("/budget", "layout");
  redirect("/budget?deleted=1");
}

/** Drops the category's allocation from the current period onward; its past spending keeps the category. */
export async function removeFromBudgetAction(categoryId: unknown): Promise<{ error: string } | undefined> {
  if (!(await getUserId())) redirect("/login");
  if (typeof categoryId !== "string" || !UUID.test(categoryId)) return NOT_FOUND;
  try {
    await removeFromBudget(await createClient(), await getToday(), categoryId, "this");
  } catch (e) {
    console.error("removeFromBudget failed", e);
    return FAILED;
  }
  revalidatePath("/budget", "layout");
}

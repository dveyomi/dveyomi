import { notFound, redirect } from "next/navigation";
import { CategoryDetail } from "@/components/CategoryDetail";
import { loadCategoryView } from "@/lib/data/category";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";

type CategoryContentProps = { params: Promise<{ categoryId: string }> };

/** A category's detail; 404 for an unknown id or another user's category (RLS hides it). */
export async function CategoryContent({ params }: CategoryContentProps) {
  if (!(await getUserId())) redirect("/login");
  const [supabase, today, { categoryId }] = await Promise.all([createClient(), getToday(), params]);
  const view = await loadCategoryView(supabase, today, categoryId);
  if (!view) notFound();
  if (!view.summary) redirect("/onboarding");
  return (
    <CategoryDetail
      period={view.period}
      category={view.category}
      figure={view.figure}
      daysLeft={view.summary.daysLeft}
      transactions={view.transactions}
      inUse={view.inUse}
    />
  );
}

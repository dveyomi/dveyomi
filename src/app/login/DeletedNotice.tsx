import { Notice } from "@/components/ui";
import { getServerI18n } from "@/i18n/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** After "Delete my account": /login?deleted=1 confirms it. Reads the query, so render inside Suspense. */
export async function DeletedNotice({ searchParams }: { searchParams: SearchParams }) {
  if ((await searchParams).deleted !== "1") return null;
  const { m } = await getServerI18n();
  return (
    <div role="status">
      <Notice tone="neutral">{m.auth.deleted}</Notice>
    </div>
  );
}

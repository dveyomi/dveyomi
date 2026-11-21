import { Notice } from "@/components/ui";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** After "Delete my account": /login?deleted=1 confirms it. Reads the query, so render inside Suspense. */
export async function DeletedNotice({ searchParams }: { searchParams: SearchParams }) {
  if ((await searchParams).deleted !== "1") return null;
  return (
    <div role="status">
      <Notice tone="neutral">Your account and all your data have been deleted.</Notice>
    </div>
  );
}

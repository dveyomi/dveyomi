/**
 * The Data API returns at most PostgREST's max_rows (1,000) rows per request,
 * silently. Any read that can return more goes through allRows.
 */
export const PAGE_SIZE = 1000;

type PageResult<T> = { data: T[] | null; error: unknown; count?: number | null };

/** A query built with its select options (count or not), ready for `.range()`. */
export type PagedQuery<T> = (options: { count?: "exact" }) => {
  range(from: number, to: number): PromiseLike<PageResult<T>>;
};

/**
 * Every row `query` matches, a page at a time. The query must be ordered by
 * columns that make the order unique (end on the primary key), or rows can be
 * skipped or repeated between pages.
 *
 * The first page also asks for the exact count, and pages are read until that
 * many rows have arrived (or a page comes back empty), so a server cap smaller
 * than `pageSize` can't cut the read short. If the count doesn't come back,
 * reading stops at the first page shorter than `pageSize`.
 *
 *   allRows((c) => supabase.from("fund_movements").select("id, amount_pence", c).order("id"))
 */
export async function allRows<T>(query: PagedQuery<T>, pageSize = PAGE_SIZE): Promise<T[]> {
  const first = await query({ count: "exact" }).range(0, pageSize - 1);
  if (first.error) throw first.error;
  const rows = [...(first.data ?? [])];
  const total = first.count ?? null;
  let last = rows.length;
  while (total === null ? last === pageSize : rows.length < total) {
    const next = await query({}).range(rows.length, rows.length + pageSize - 1);
    if (next.error) throw next.error;
    const data = next.data ?? [];
    if (data.length === 0) break;
    rows.push(...data);
    last = data.length;
  }
  return rows;
}

import type { Db } from "./types";

/**
 * Every table that holds a user's rows, each with the columns that order it
 * stably for paging (its primary key). A DB test checks this list against the
 * schema, so a new table cannot be left out of the export.
 */
const TABLE_ORDER = {
  profiles: ["user_id"],
  categories: ["id"],
  budget_periods: ["id"],
  allocations: ["id"],
  funds: ["id"],
  fund_movements: ["id"],
  savings_prompts: ["period_id"],
  leftover_movements: ["id"],
  trips: ["id"],
  recurring_rules: ["id"],
  recurring_prices: ["id"],
  import_batches: ["id"],
  transactions: ["id"],
  recurring_dismissals: ["name_key"],
} as const satisfies Record<string, readonly string[]>;

export type UserTable = keyof typeof TABLE_ORDER;
export const USER_TABLES = Object.keys(TABLE_ORDER) as UserTable[];

/** Rows asked for per request. At most PostgREST's max_rows (1,000); paging doesn't rely on it either way. */
export const EXPORT_PAGE = 1000;

export type UserData = Record<UserTable, Record<string, unknown>[]>;

type Page = { rows: Record<string, unknown>[]; count: number | null };

/** Rows `from`..`to` of a table in primary-key order, with the exact count when asked. */
async function readPage(supabase: Db, table: UserTable, from: number, to: number, withCount: boolean): Promise<Page> {
  let query = supabase.from(table).select("*", withCount ? { count: "exact" } : {});
  for (const column of TABLE_ORDER[table]) query = query.order(column as never);
  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  return { rows: data as Record<string, unknown>[], count };
}

/**
 * All of one table's rows, in primary-key order. The first page also asks for
 * the exact count, and pages are read until that many rows have arrived (or a
 * page comes back empty), so a server cap smaller than `pageSize` can't cut
 * the export short.
 */
async function allRows(supabase: Db, table: UserTable, pageSize: number): Promise<Record<string, unknown>[]> {
  const first = await readPage(supabase, table, 0, pageSize - 1, true);
  const total = first.count ?? 0;
  const rows = [...first.rows];
  while (rows.length < total) {
    const next = await readPage(supabase, table, rows.length, rows.length + pageSize - 1, false);
    if (next.rows.length === 0) break;
    rows.push(...next.rows);
  }
  return rows;
}

/**
 * Every row the signed-in user can read, table by table. Pass the user's own
 * client: RLS limits each table to their rows, so this never uses the
 * service role.
 */
export async function exportUserData(supabase: Db, pageSize = EXPORT_PAGE): Promise<UserData> {
  const tables = await Promise.all(USER_TABLES.map(async (t) => [t, await allRows(supabase, t, pageSize)] as const));
  return Object.fromEntries(tables) as UserData;
}

/**
 * Deletes the auth user; every table's user_id cascades from auth.users, so
 * all their rows go in the same statement. Needs the service-role client.
 */
export async function deleteAccount(admin: Db, userId: string): Promise<void> {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
}

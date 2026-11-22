import { allRows, PAGE_SIZE } from "./paging";
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
  carry_adjustments: ["id"],
  feedback: ["id"],
} as const satisfies Record<string, readonly string[]>;

export type UserTable = keyof typeof TABLE_ORDER;
export const USER_TABLES = Object.keys(TABLE_ORDER) as UserTable[];

/** Rows asked for per request. At most PostgREST's max_rows (1,000); paging doesn't rely on it either way. */
export const EXPORT_PAGE = PAGE_SIZE;

export type UserData = Record<UserTable, Record<string, unknown>[]>;

/** All of one table's rows, in primary-key order. */
function tableRows(supabase: Db, table: UserTable, pageSize: number): Promise<Record<string, unknown>[]> {
  return allRows<Record<string, unknown>>((count) => {
    let query = supabase.from(table).select("*", count);
    for (const column of TABLE_ORDER[table]) query = query.order(column as never);
    return query;
  }, pageSize);
}

/**
 * Every row the signed-in user can read, table by table. Pass the user's own
 * client: RLS limits each table to their rows, so this never uses the
 * service role.
 */
export async function exportUserData(supabase: Db, pageSize = EXPORT_PAGE): Promise<UserData> {
  const tables = await Promise.all(USER_TABLES.map(async (t) => [t, await tableRows(supabase, t, pageSize)] as const));
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

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

/** Rows read per request: PostgREST's max_rows, so a short page means the end. */
export const EXPORT_PAGE = 1000;

export type UserData = Record<UserTable, Record<string, unknown>[]>;

async function allRows(supabase: Db, table: UserTable): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += EXPORT_PAGE) {
    let query = supabase.from(table).select("*");
    for (const column of TABLE_ORDER[table]) query = query.order(column as never);
    const { data, error } = await query.range(from, from + EXPORT_PAGE - 1);
    if (error) throw error;
    rows.push(...(data as Record<string, unknown>[]));
    if (data.length < EXPORT_PAGE) return rows;
  }
}

/**
 * Every row the signed-in user can read, table by table. Pass the user's own
 * client: RLS limits each table to their rows, so this never uses the
 * service role.
 */
export async function exportUserData(supabase: Db): Promise<UserData> {
  const tables = await Promise.all(USER_TABLES.map(async (t) => [t, await allRows(supabase, t)] as const));
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

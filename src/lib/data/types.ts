import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/db/database.types";

/** A Supabase client signed in as the user. RLS scopes every query to them. */
export type Db = SupabaseClient<Database>;

/** A budget_periods row. Dates are `YYYY-MM-DD`; money is integer pence. */
export type PeriodRow = Tables<"budget_periods">;

/** A categories row, with `kind` narrowed to the values its check constraint allows. */
export type CategoryRow = Omit<Tables<"categories">, "kind"> & { kind: "need" | "want" };

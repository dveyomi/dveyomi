import { addDays, periodContaining, type IsoDate } from "@/lib/calc";
import type { Db, PeriodRow } from "./types";

/**
 * The user's budget period containing `today`, creating it if needed.
 *
 * An existing period that contains today is returned as is, whatever the
 * current start day. Otherwise the period is the one containing today for the
 * profile's start day, except that it never starts on or before the latest
 * period's end: after a start-day change, the new period starts the day after
 * the latest one ends, so the change applies from the next period. Missed
 * periods are skipped, not back-filled.
 *
 * The new period copies income, savings and allocations from the latest
 * earlier period and opens a 'waiting' savings prompt when it saves anything
 * (`renew_period`, one transaction). Idempotent, including under concurrent
 * calls. Returns null when the user has no period starting on or before
 * today (never onboarded).
 */
export async function ensureCurrentPeriod(supabase: Db, today: IsoDate): Promise<PeriodRow | null> {
  // Periods never overlap, so the latest one starting on or before today is
  // the one containing it, if any. One read, so a concurrent renewal is seen
  // either as "contains today" or not yet at all.
  const latest = await supabase
    .from("budget_periods")
    .select("*")
    .lte("start_date", today)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest.error) throw latest.error;
  if (!latest.data) return null;
  if (latest.data.end_date >= today) return latest.data;

  const profile = await supabase.from("profiles").select("budget_start_day").single();
  if (profile.error) throw profile.error;

  const computed = periodContaining(today, profile.data.budget_start_day);
  const start = computed.start <= latest.data.end_date ? addDays(latest.data.end_date, 1) : computed.start;

  const renewed = await supabase.rpc("renew_period", { p_start: start, p_end: computed.end });
  if (renewed.error) throw renewed.error;
  return renewed.data?.id ? renewed.data : null;
}

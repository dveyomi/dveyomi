import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, type IsoDate } from "@/lib/calc";
import { parseCurrency, parseLocale, type CurrencyCode, type Locale } from "@/lib/locale";
import { isTimeZone } from "@/lib/timezone";
import { ensureCurrentPeriod } from "./ensurePeriod";
import type { Db } from "./types";

/**
 * Stores the device's zone as the user's home zone, once: only while the
 * profile has never been detected. Afterwards the home zone changes only in
 * Settings; travelling moves "today" through the tz cookie, not this.
 */
export async function adoptDeviceTimezone(
  supabase: SupabaseClient,
  userId: string,
  zone: string,
): Promise<void> {
  if (!isTimeZone(zone)) return;
  const { error } = await supabase
    .from("profiles")
    .update({ timezone: zone, timezone_detected: true })
    .eq("user_id", userId)
    .eq("timezone_detected", false);
  if (error) throw error;
}

export type SettingsView = {
  startDay: number;
  timezone: string;
  language: Locale;
  currency: CurrencyCode;
  /** The day the next budget starts (after the latest one already made), or null with no budget yet. */
  nextBudgetStart: IsoDate | null;
};

/** What Settings shows: the profile's budget and region settings, and when a start-day change would apply. */
export async function loadSettings(supabase: Db, today: IsoDate): Promise<SettingsView> {
  // Renew first, so "next" is counted from the budget the user is really in.
  await ensureCurrentPeriod(supabase, today);
  const [profile, latest] = await Promise.all([
    supabase.from("profiles").select("budget_start_day, timezone, language, currency").single(),
    supabase.from("budget_periods").select("end_date").order("start_date", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (profile.error) throw profile.error;
  if (latest.error) throw latest.error;
  return {
    startDay: profile.data.budget_start_day,
    timezone: profile.data.timezone,
    language: parseLocale(profile.data.language),
    currency: parseCurrency(profile.data.currency),
    nextBudgetStart: latest.data ? addDays(latest.data.end_date, 1) : null,
  };
}

/**
 * Saves the budget start day. The budget the user is in keeps its dates;
 * ensureCurrentPeriod applies the new day from the next one.
 */
export async function setBudgetStartDay(supabase: Db, userId: string, day: number): Promise<void> {
  const { error } = await supabase.from("profiles").update({ budget_start_day: day }).eq("user_id", userId);
  if (error) throw error;
}

/** Saves the home time zone as the user's own choice, so device detection never replaces it. */
export async function setHomeTimezone(supabase: Db, userId: string, zone: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ timezone: zone, timezone_detected: true })
    .eq("user_id", userId);
  if (error) throw error;
}

/** Saves the app's language. */
export async function setLanguage(supabase: Db, userId: string, locale: Locale): Promise<void> {
  const { error } = await supabase.from("profiles").update({ language: locale }).eq("user_id", userId);
  if (error) throw error;
}

/** Saves the currency amounts are written in. Amounts are not converted. */
export async function setCurrency(supabase: Db, userId: string, currency: CurrencyCode): Promise<void> {
  const { error } = await supabase.from("profiles").update({ currency }).eq("user_id", userId);
  if (error) throw error;
}

"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CURRENCY_COOKIE, LOCALE_COOKIE, PREF_COOKIE_OPTIONS } from "@/i18n/cookies";
import { getServerI18n } from "@/i18n/server";
import { setBudgetStartDay, setCurrency, setHomeTimezone, setLanguage } from "@/lib/data/profile";
import { createClient, getUserId } from "@/lib/supabase/server";
import { checkCurrency, checkLocale, checkStartDay, checkTimeZone } from "@/lib/validation/settings";

export type SaveResult = { ok: true } | { error: string };

/** Saves the budget start day; the current budget keeps its dates and the change applies from the next. */
export async function saveStartDay(raw: unknown): Promise<SaveResult> {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const day = checkStartDay(raw);
  if (day === null) return { error: (await getServerI18n()).m.settings.chooseDay };
  try {
    await setBudgetStartDay(await createClient(), userId, day);
  } catch (e) {
    console.error("setBudgetStartDay failed", e);
    return { error: (await getServerI18n()).m.settings.dayFailed };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Saves the home time zone as the user's choice. */
export async function saveHomeTimezone(raw: unknown): Promise<SaveResult> {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const zone = checkTimeZone(raw);
  if (!zone) return { error: (await getServerI18n()).m.settings.chooseZone };
  try {
    await setHomeTimezone(await createClient(), userId, zone);
  } catch (e) {
    console.error("setHomeTimezone failed", e);
    return { error: (await getServerI18n()).m.settings.zoneFailed };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Saves the app's language and remembers it on this device, so every page (and sign-in) uses it. */
export async function saveLanguage(raw: unknown): Promise<SaveResult> {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const locale = checkLocale(raw);
  const { m } = await getServerI18n();
  if (!locale) return { error: m.settings.chooseLanguage };
  try {
    await setLanguage(await createClient(), userId, locale);
  } catch (e) {
    console.error("setLanguage failed", e);
    return { error: m.settings.languageSaveFailed };
  }
  (await cookies()).set(LOCALE_COOKIE, locale, PREF_COOKIE_OPTIONS);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Saves the currency amounts are written in (no conversion) and remembers it on this device. */
export async function saveCurrency(raw: unknown): Promise<SaveResult> {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const currency = checkCurrency(raw);
  const { m } = await getServerI18n();
  if (!currency) return { error: m.settings.chooseCurrency };
  try {
    await setCurrency(await createClient(), userId, currency);
  } catch (e) {
    console.error("setCurrency failed", e);
    return { error: m.settings.currencySaveFailed };
  }
  (await cookies()).set(CURRENCY_COOKIE, currency, PREF_COOKIE_OPTIONS);
  revalidatePath("/", "layout");
  return { ok: true };
}

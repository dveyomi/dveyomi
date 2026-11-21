import { cookies } from "next/headers";
import { connection } from "next/server";
import { todayIn, type IsoDate } from "@/lib/calc";
import { getProfile } from "@/lib/supabase/server";
import { DEFAULT_TIMEZONE, TZ_COOKIE, isTimeZone } from "@/lib/timezone";

type ZoneSources = { tzCookie: string | null | undefined; profileTimezone: string | null | undefined };

/** The user's zone: the device zone from the `tz` cookie, else the profile's, else Europe/London. Invalid zones are skipped. */
export function resolveZone({ tzCookie, profileTimezone }: ZoneSources): string {
  return isTimeZone(tzCookie) ? tzCookie : isTimeZone(profileTimezone) ? profileTimezone : DEFAULT_TIMEZONE;
}

/** Today's calendar date for the user, in resolveZone's zone. */
export function resolveToday({ now, ...sources }: ZoneSources & { now: Date }): IsoDate {
  return todayIn(resolveZone(sources), now);
}

/** The signed-in user's zone (see resolveZone). Reads request data, so call it inside a Suspense boundary. */
export async function getTimeZone(): Promise<string> {
  await connection();
  const tzCookie = (await cookies()).get(TZ_COOKIE)?.value;
  const profileTimezone = isTimeZone(tzCookie) ? null : (await getProfile())?.timezone;
  return resolveZone({ tzCookie, profileTimezone });
}

/** Today's date for the signed-in user. Reads request data, so call it inside a Suspense boundary. */
export async function getToday(): Promise<IsoDate> {
  return todayIn(await getTimeZone(), new Date());
}

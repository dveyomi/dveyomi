/** Name of the cookie TimezoneSync writes with the device's IANA zone. */
export const TZ_COOKIE = "tz";
/** The zone a new profile starts with (the profiles.timezone default). */
export const DEFAULT_TIMEZONE = "Europe/London";

/** True when `zone` is an IANA time zone this runtime knows. */
export function isTimeZone(zone: string | null | undefined): zone is string {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

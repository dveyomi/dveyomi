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

export type ZoneOption = { value: string; label: string };
export type ZoneGroup = { label: string; options: ZoneOption[] };

/**
 * Time zones for a picker, grouped by region ("Europe") with the rest of the
 * name as the label ("New York", "Argentina – Buenos Aires"); zones with no
 * region go under "Other". `current` is always included, so the saved zone
 * shows even if this runtime's list lacks it.
 */
export function timeZoneGroups(zones: readonly string[], current: string): ZoneGroup[] {
  const byRegion = new Map<string, ZoneOption[]>();
  for (const zone of new Set([...zones, current])) {
    const [region, ...rest] = zone.split("/");
    const group = rest.length ? region : "Other";
    const label = (rest.length ? rest.join(" – ") : zone).replaceAll("_", " ");
    byRegion.set(group, [...(byRegion.get(group) ?? []), { value: zone, label }]);
  }
  return [...byRegion.entries()]
    .sort(([a], [b]) => (a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b)))
    .map(([label, options]) => ({ label, options: options.sort((x, y) => x.label.localeCompare(y.label)) }));
}

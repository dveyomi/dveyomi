"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { adoptDeviceTimezone } from "@/app/(app)/actions";
import { DEFAULT_TIMEZONE, TZ_COOKIE } from "@/lib/timezone";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function readCookie(name: string): string | undefined {
  const entry = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : undefined;
}

/**
 * Keeps "today" in the device's time zone: writes the zone to the `tz` cookie
 * that getToday() reads, and on first sign-in saves it to a profile that still
 * has the default zone. Refreshes server data only when something changed, so
 * it settles after one refresh.
 */
export function TimezoneSync({ profileTimezone }: { profileTimezone: string }) {
  const router = useRouter();

  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone) return;
    async function sync() {
      let changed = false;
      if (readCookie(TZ_COOKIE) !== zone) {
        document.cookie = `${TZ_COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
        changed = true;
      }
      if (profileTimezone === DEFAULT_TIMEZONE && zone !== DEFAULT_TIMEZONE) {
        try {
          await adoptDeviceTimezone(zone);
          changed = true;
        } catch {
          // Not critical: the cookie already gives today's date in the right zone.
        }
      }
      if (changed) router.refresh();
    }

    void sync();
  }, [profileTimezone, router]);

  return null;
}

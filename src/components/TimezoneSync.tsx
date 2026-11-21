"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adoptDeviceTimezone, endCurrentTrip } from "@/app/(app)/actions";
import type { IsoDate } from "@/lib/calc";
import { TZ_COOKIE } from "@/lib/timezone";
import type { CurrentTrip } from "@/lib/trips";
import { TripPrompt } from "./TripPrompt";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function readCookie(name: string): string | undefined {
  const entry = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : undefined;
}

type TimezoneSyncProps = {
  homeDetected: boolean;
  /** The profile's home zone. */
  homeZone: string;
  /** Today for the user (in the device's zone once the cookie is set). */
  today: IsoDate;
  /** The trip whose dates include today, if any. */
  currentTrip: CurrentTrip | null;
};

/**
 * Keeps "today" in the device's time zone: writes the zone to the `tz` cookie
 * that getToday() reads. On first sign-in (home zone not yet detected) it also
 * saves the zone as the home zone; after that only Settings changes it.
 * Refreshes server data only when something changed, so it settles after one
 * refresh. Once the home zone is known, a device zone that differs from it
 * brings up the travelling prompt (TripPrompt); only zones are compared.
 */
export function TimezoneSync({ homeDetected, homeZone, today, currentTrip }: TimezoneSyncProps) {
  const router = useRouter();
  const [deviceZone, setDeviceZone] = useState<string | null>(null);

  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone) return;
    async function sync() {
      let changed = false;
      if (readCookie(TZ_COOKIE) !== zone) {
        document.cookie = `${TZ_COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
        changed = true;
      }
      if (!homeDetected) {
        try {
          await adoptDeviceTimezone(zone);
          changed = true;
        } catch {
          // Not critical: the cookie already gives today's date in the right zone.
        }
      }
      if (changed) router.refresh();
      setDeviceZone(zone);
    }

    void sync();
  }, [homeDetected, router]);

  // Wait until the device zone is read and the home zone is known (after first sign-in's refresh).
  if (!deviceZone || !homeDetected) return null;
  return <TripPrompt deviceZone={deviceZone} homeZone={homeZone} today={today} currentTrip={currentTrip} endTrip={endCurrentTrip} />;
}

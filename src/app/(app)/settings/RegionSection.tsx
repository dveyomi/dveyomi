"use client";

import { useMemo } from "react";
import { Select } from "@/components/ui";
import { timeZoneGroups } from "@/lib/timezone";
import { saveHomeTimezone } from "./settingsActions";
import { SettingsSection } from "./SettingsSection";
import { useAutoSave } from "./useAutoSave";

const currencies = [{ value: "GBP", label: "Pound sterling (GBP)" }];

/**
 * Region: the home time zone (saved on change) and the currency (GBP only for
 * now). `zones` comes from the server, so the list matches on both sides.
 */
export function RegionSection({ timezone, zones }: { timezone: string; zones: string[] }) {
  const zone = useAutoSave(timezone, saveHomeTimezone);
  const groups = useMemo(() => timeZoneGroups(zones, timezone), [zones, timezone]);
  return (
    <SettingsSection title="Region" description="Today's date and your budget days follow your home time zone.">
      <div className="flex flex-col gap-5">
        <div>
          <Select
            label="Home time zone"
            options={[]}
            groups={groups}
            value={zone.value}
            onChange={(e) => zone.change(e.target.value)}
            hint="While you travel, today's date follows your device."
            error={zone.error}
          />
          <p role="status" className="mt-1 text-caption text-muted">
            {zone.status}
          </p>
        </div>
        <Select label="Currency" options={currencies} value="GBP" disabled hint="More currencies later." />
      </div>
    </SettingsSection>
  );
}

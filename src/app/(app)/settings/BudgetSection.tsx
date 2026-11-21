"use client";

import { ListRow, Select } from "@/components/ui";
import { formatWeekdayDate, periodContaining, periodStartingOn, startDayLabel, type IsoDate } from "@/lib/calc";
import { saveStartDay } from "./settingsActions";
import { SettingsSection } from "./SettingsSection";
import { useAutoSave } from "./useAutoSave";

const dayOptions = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: startDayLabel(i + 1) }));

/** When a start day applies: from the next budget, which runs short (or long) once if it isn't already on that day. */
function takesEffect(nextBudgetStart: IsoDate, day: number): string {
  const first = `Takes effect from your next budget on ${formatWeekdayDate(nextBudgetStart)}.`;
  if (periodContaining(nextBudgetStart, day).start === nextBudgetStart) return first;
  const next = periodStartingOn(nextBudgetStart, day);
  const each = day === 1 ? "on the first day of the month" : `on the ${startDayLabel(day)}`;
  return `${first} That budget runs to ${formatWeekdayDate(next.end)}, then each one starts ${each}.`;
}

/** Budget settings: the start day (saved on change; the current budget keeps its dates) and recurring payments. */
export function BudgetSection({ startDay, nextBudgetStart }: { startDay: number; nextBudgetStart: IsoDate | null }) {
  const day = useAutoSave(startDay, saveStartDay);
  return (
    <SettingsSection title="Budget" description="Your budget runs monthly from this day.">
      <div>
        <Select
          label="Budget start day"
          options={dayOptions}
          value={String(day.value)}
          onChange={(e) => day.change(Number(e.target.value))}
          hint={nextBudgetStart ? takesEffect(nextBudgetStart, day.value) : undefined}
          error={day.error}
        />
        <p role="status" className="mt-1 text-caption text-muted">
          {day.status}
        </p>
      </div>
      <div className="-mx-2 mt-2">
        <ListRow
          href="/expenses/recurring"
          icon="repeat"
          title="Recurring payments"
          subtitle="Pause, skip, change or cancel bills"
        />
      </div>
    </SettingsSection>
  );
}

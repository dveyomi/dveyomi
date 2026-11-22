"use client";

import { useI18n } from "@/i18n/client";
import type { Format } from "@/i18n/format";
import type { Messages } from "@/i18n/messages";
import { ListRow, Select } from "@/components/ui";
import { periodContaining, periodStartingOn, type IsoDate } from "@/lib/calc";
import { saveStartDay } from "./settingsActions";
import { SettingsSection } from "./SettingsSection";
import { useAutoSave } from "./useAutoSave";


/** When a start day applies: from the next budget, which runs short (or long) once if it isn't already on that day. */
function takesEffect(m: Messages, fmt: Format, nextBudgetStart: IsoDate, day: number): string {
  const first = m.settingsPage.takesEffect(fmt.weekdayDate(nextBudgetStart));
  if (periodContaining(nextBudgetStart, day).start === nextBudgetStart) return first;
  const next = periodStartingOn(nextBudgetStart, day);
  return `${first}${m.settingsPage.thenEach(fmt.weekdayDate(next.end), day)}`;
}

/** Budget settings: the start day (saved on change; the current budget keeps its dates) and recurring payments. */
export function BudgetSection({ startDay, nextBudgetStart }: { startDay: number; nextBudgetStart: IsoDate | null }) {
  const { m, fmt } = useI18n();
  const sp = m.settingsPage;
  const dayOptions = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: m.dates.startDay(i + 1) }));
  const day = useAutoSave(startDay, saveStartDay);
  return (
    <SettingsSection title={sp.budgetTitle} description={sp.budgetDescription}>
      <div>
        <Select
          label={sp.startDay}
          options={dayOptions}
          value={String(day.value)}
          onChange={(e) => day.change(Number(e.target.value))}
          hint={nextBudgetStart ? takesEffect(m, fmt, nextBudgetStart, day.value) : undefined}
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
          title={sp.recurring}
          subtitle={sp.recurringSubtitle}
        />
      </div>
    </SettingsSection>
  );
}

"use client";

import { useI18n } from "@/i18n/client";
import type { Format } from "@/i18n/format";
import type { Messages } from "@/i18n/messages";
import { focusRing } from "@/components/ui/focus";
import { calendarWeeks, type IsoDate, type Period } from "@/lib/calc";


type CalendarProps = {
  /** The month or budget period shown. */
  period: Period;
  today: IsoDate;
  /** Each day's total (fund-paid included), from calc's totalsByDay. */
  dayTotals: Map<IsoDate, number>;
  /** How many expenses each day has, for the spoken label. */
  dayCounts: Map<IsoDate, number>;
  onSelect: (day: IsoDate) => void;
};

function dayLabel(m: Messages, fmt: Format, day: IsoDate, total: number | undefined, count: number): string {
  if (!total && !count) return m.calendar.noExpenses(fmt.weekdayDate(day));
  return m.calendar.spent(fmt.weekdayDate(day), fmt.money(total ?? 0), count);
}

/**
 * The spending calendar (§5.6, Amount mode): a Monday-first grid of rounded
 * day tiles, each with its date and that day's total (blank with none), a
 * ring on today. Tapping a day opens its sheet.
 */
export function Calendar({ period, today, dayTotals, dayCounts, onSelect }: CalendarProps) {
  const { fmt, m } = useI18n();
  const weeks = calendarWeeks(period);
  return (
    <div className="flex flex-col gap-1 md:gap-2">
      <div aria-hidden="true" className="grid grid-cols-7 gap-0.5 md:gap-2">
        {m.calendar.weekdaysShort.map((short, i) => (
          <span key={m.calendar.weekdaysFull[i]} className="text-center text-caption font-semibold text-muted md:text-left md:px-2">
            <span className="md:hidden">{short}</span>
            <span className="hidden md:inline">{m.calendar.weekdaysLong[i]}</span>
          </span>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week.find(Boolean)} className="grid grid-cols-7 gap-0.5 md:gap-2">
          {week.map((day, i) => {
            if (!day) return <span key={`blank-${i}`} aria-hidden="true" />;
            const total = dayTotals.get(day);
            const count = dayCounts.get(day) ?? 0;
            const isToday = day === today;
            const future = day > today;
            return (
              <button
                key={day}
                type="button"
                aria-label={dayLabel(m, fmt, day, total, count)}
                aria-current={isToday ? "date" : undefined}
                onClick={() => onSelect(day)}
                className={`flex min-h-14 min-w-0 flex-col items-center justify-start gap-0.5 rounded-md px-0 py-1.5 transition-colors md:min-h-20 md:items-start md:px-2.5 md:py-2 ${focusRing} ${
                  total ? "bg-accent/20 hover:bg-accent/30" : "bg-bg hover:bg-card-raised"
                } ${isToday ? "ring-2 ring-accent-fg ring-inset" : ""}`}
              >
                <span
                  className={`text-caption font-semibold ${isToday ? "text-accent-fg" : future ? "text-muted" : "text-text"}`}
                >
                  {Number(day.slice(8))}
                </span>
                {total ? (
                  <span className="max-w-full truncate text-caption tracking-tight tabular-nums text-text md:tracking-normal">
                    <span data-amount="phone" className="md:hidden">
                      {fmt.moneyShort(total)}
                    </span>
                    <span className="hidden md:inline">{total < (fmt.currency === "GBP" ? 100_000 : 10_000_000) ? fmt.money(total) : fmt.moneyShort(total)}</span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

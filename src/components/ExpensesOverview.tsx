"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { ButtonLink, Card, EmptyState, Money, RadioSegments, SegmentedTabs, Button } from "@/components/ui";
import {
  formatMonth,
  formatMonthYear,
  formatPeriodRange,
  shiftYearMonth,
  summariseExpenses,
  type ExpenseRange,
  type IsoDate,
  type YearMonth,
} from "@/lib/calc";
import type { ExpensesView } from "@/lib/data/expenses";
import type { Trip } from "@/lib/data/trips";
import { CategoryBreakdown, ComparisonCard, TransactionsPanel } from "./Analytics";
import { Calendar } from "./Calendar";
import { DaySheet } from "./DaySheet";
import { LatestList } from "./TransactionList";
import { TripList } from "./TripList";

export type ExpensesTab = "calendar" | "analytics";

/** How many expenses the "latest" list shows under the calendar. */
const LATEST = 5;
/** How many trips the desktop Trips panel lists. */
const LATEST_TRIPS = 3;

/** The Expenses tab's URL: ?range=period, ?month=YYYY-MM and ?view=analytics, each left out at its default. */
export function expensesHref({ range, month, view }: { range: ExpenseRange; month: YearMonth | null; view: ExpensesTab }) {
  const params = new URLSearchParams();
  if (range === "period") params.set("range", "period");
  if (month) params.set("month", month);
  if (view === "analytics") params.set("view", "analytics");
  const query = params.toString();
  return query ? `/expenses?${query}` : "/expenses";
}

const viewOptions = [
  { value: "calendar" as const, label: "Calendar" },
  { value: "analytics" as const, label: "Analytics" },
];
const rangeOptions = [
  { value: "month" as const, label: "Month" },
  { value: "period" as const, label: "Budget period" },
];

type ExpensesOverviewProps = {
  data: ExpensesView;
  today: IsoDate;
  initialView: ExpensesTab;
  /** The user's trips, latest first: the desktop calendar view lists a few (phones use the header's Trips link). */
  trips?: Trip[];
};

/**
 * The Expenses tab (§5.6): calendar ⇄ analytics for a calendar month (or a
 * budget period). Every total includes fund-paid expenses and comes from
 * calc's summariseExpenses.
 */
export function ExpensesOverview({ data, today, initialView, trips = [] }: ExpensesOverviewProps) {
  const router = useRouter();
  const tripsHeadingId = useId();
  const [view, setView] = useState(initialView);
  const [openDay, setOpenDay] = useState<IsoDate | null>(null);
  const { range, window: win, categories } = data;
  const { current, previous } = win;

  const summary = summariseExpenses(data.transactions, current, previous, today);
  const inWindow = data.transactions.filter((t) => t.date >= current.start && t.date <= current.end);
  const dayCounts = new Map<IsoDate, number>();
  for (const t of inWindow) dayCounts.set(t.date, (dayCounts.get(t.date) ?? 0) + 1);
  const names = new Map(categories.map((c) => [c.id, c.name]));

  const isPeriod = range === "period";
  const title = isPeriod ? formatPeriodRange(current.start, current.end) : formatMonthYear(win.month);
  const unit = isPeriod ? "period" : "month";
  const spentCaption = isPeriod ? "Spent this period" : `Spent in ${formatMonth(win.month)}`;
  const returnTo = expensesHref({ range, month: win.month, view });
  const step = (delta: number) => expensesHref({ range, month: shiftYearMonth(win.month, delta), view });
  const inProgress = today >= current.start && today <= current.end;

  function changeView(next: ExpensesTab) {
    setView(next);
    // Next.js keeps its router in sync with history.replaceState; no server round trip.
    window.history.replaceState(null, "", expensesHref({ range, month: win.month, view: next }));
  }

  const switcher = (
    <div className="flex items-center justify-between gap-2 px-1 md:px-0">
      <ButtonLink href={step(-1)} variant="secondary" icon="chevron-left">
        <span className="sr-only">Previous {unit}</span>
      </ButtonLink>
      <h2 className="min-w-0 truncate text-center text-title font-semibold text-text">{title}</h2>
      <ButtonLink href={step(1)} variant="secondary" icon="chevron-right">
        <span className="sr-only">Next {unit}</span>
      </ButtonLink>
    </div>
  );

  const breakdown = (
    <Card as="section" className="flex flex-col gap-4">
      <h2 className="text-caption font-semibold text-muted">Category breakdown</h2>
      <CategoryBreakdown summary={summary} names={names} caption={spentCaption} />
    </Card>
  );
  const comparisonCard = (
    <ComparisonCard
      comparison={summary.comparison}
      inProgress={inProgress}
      unit={unit}
      upcoming={today < current.start}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="md:w-72">
          <SegmentedTabs label="Expenses view" options={viewOptions} value={view} onChange={changeView} />
        </div>
        <div className="md:w-80">
          <RadioSegments
            label="Show"
            options={rangeOptions}
            value={range}
            onChange={(next) => router.push(expensesHref({ range: next, month: null, view }))}
          />
        </div>
      </div>

      <div role="tabpanel" aria-label={view === "calendar" ? "Calendar" : "Analytics"}>
        {view === "calendar" ? (
          <div className="grid items-start gap-4 lg:grid-cols-3 lg:gap-6">
            <Card as="section" className="flex flex-col gap-4 px-1 md:px-5 lg:col-span-2">
              <div className="flex flex-col gap-1 px-2 md:px-0">
                <span className="text-caption font-semibold text-muted">{spentCaption}</span>
                <Money pence={summary.totalPence} size="display" />
              </div>
              {switcher}
              <Calendar
                period={current}
                today={today}
                dayTotals={summary.byDay}
                dayCounts={dayCounts}
                onSelect={setOpenDay}
              />
              {inWindow.length === 0 ? (
                <EmptyState
                  icon="calendar"
                  title={`No expenses this ${unit}`}
                  body="Tap a day to add one, or use the + button."
                />
              ) : null}
            </Card>
            <div className="flex flex-col gap-4">
              {inWindow.length > 0 ? (
                <Card as="section" className="flex flex-col gap-2 px-2">
                  <div className="flex items-center justify-between gap-3 px-2">
                    <h2 className="text-caption font-semibold text-muted">Latest</h2>
                    <Button variant="ghost" onClick={() => changeView("analytics")}>
                      See all
                    </Button>
                  </div>
                  <LatestList txns={inWindow.slice(0, LATEST)} returnTo={returnTo} />
                </Card>
              ) : null}
              {breakdown}
              {comparisonCard}
              {trips.length > 0 ? (
                <Card as="section" className="hidden flex-col gap-2 px-2 lg:flex">
                  <div role="region" aria-labelledby={tripsHeadingId} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3 px-2">
                      <h2 id={tripsHeadingId} className="text-caption font-semibold text-muted">
                        Trips
                      </h2>
                      <ButtonLink href="/expenses/trips" variant="ghost">
                        All trips
                      </ButtonLink>
                    </div>
                    <TripList trips={trips.slice(0, LATEST_TRIPS)} today={today} label="Latest trips" />
                  </div>
                </Card>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-3 lg:gap-6">
            <div className="flex flex-col gap-4 lg:col-span-2">
              <Card className="flex flex-col gap-4">{switcher}</Card>
              {breakdown}
            </div>
            {comparisonCard}
            <div className="lg:col-span-3">
              <TransactionsPanel
                key={`${range}-${win.month}`}
                txns={inWindow} categories={categories} today={today} returnTo={returnTo} />
            </div>
          </div>
        )}
      </div>

      <DaySheet
        day={openDay}
        txns={openDay ? inWindow.filter((t) => t.date === openDay) : []}
        returnTo={returnTo}
        onClose={() => setOpenDay(null)}
      />
    </div>
  );
}

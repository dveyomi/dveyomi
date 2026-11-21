"use client";

import { useId, useState } from "react";
import { Card, Donut, EmptyState, Money, Select, SeriesSwatch, TextField, type Series } from "@/components/ui";
import { foldCategories, totalsByDay, type Comparison, type ExpensesSummary, type IsoDate } from "@/lib/calc";
import type { ExpenseTxn } from "@/lib/data/expenses";
import { TransactionList } from "./TransactionList";

/** The donut shows this many categories; the rest share one "Other" slice. */
const SLICES = 5;

const seriesFor = (rank: number): Series => (rank < SLICES ? ((rank + 1) as Series) : "other");

type CategoryBreakdownProps = {
  summary: ExpensesSummary;
  names: Map<string, string>;
  /** Under the total in the ring, e.g. "Spent in November". */
  caption: string;
};

/** Donut and category list (§5.6): each category's spend and share, largest first. Colour follows rank in this window. */
export function CategoryBreakdown({ summary, names, caption }: CategoryBreakdownProps) {
  const slices = foldCategories(summary.categories, SLICES, summary.totalPence).map((s, i) => ({
    key: s.categoryId ?? "other",
    label: s.categoryId === null ? "Other" : (names.get(s.categoryId) ?? "Unknown"),
    pence: s.pence,
    percent: s.percent,
    series: s.categoryId === null ? ("other" as const) : seriesFor(i),
  }));

  return (
    <div className="@container">
     <div className="flex flex-col gap-5 @xl:flex-row @xl:items-center @xl:gap-8">
      <div className="@xl:w-56 @xl:shrink-0">
        <Donut label="Spending by category" slices={slices}>
          <Money pence={summary.totalPence} size="title" />
          <span className="text-caption text-muted">{caption}</span>
        </Donut>
      </div>
      {summary.categories.length === 0 ? (
        <p className="text-body text-muted @xl:flex-1">Categories will show here once you add expenses.</p>
      ) : (
        <ul aria-label="Categories" className="flex min-w-0 flex-1 flex-col divide-y divide-border">
          {summary.categories.map((c, i) => (
            <li key={c.categoryId} className="flex items-center gap-3 py-2.5">
              <SeriesSwatch series={seriesFor(i)} />
              <span className="min-w-0 flex-1 truncate text-body text-text">{names.get(c.categoryId) ?? "Unknown"}</span>
              <span className="text-caption text-muted">{c.percent}%</span>
              <span className="text-body text-text">
                <Money pence={c.pence} />
              </span>
            </li>
          ))}
        </ul>
      )}
     </div>
    </div>
  );
}

/** "+12.5%", "-8%"; a rounded -0 reads "0%". */
function percentText(pct: number): string {
  if (pct === 0) return "0%";
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

const tones = { up: "text-danger-fg", down: "text-positive-fg", same: "text-text" } as const;

type ComparisonCardProps = {
  comparison: Comparison | null;
  /** True while today is inside the window: the comparison counts the same elapsed days. */
  inProgress: boolean;
  /** Set while the window is still ahead of today: "This month hasn't started yet" (or "period"). */
  upcoming: "month" | "period" | null;
};

/**
 * Month-on-month comparison (§8): money and percentage difference in neutral
 * words. More spending is drawn in the danger tone, less in the positive tone,
 * the same in plain text. With no previous expenses it says so instead.
 */
export function ComparisonCard({ comparison, inProgress, upcoming }: ComparisonCardProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <Card className="flex flex-col gap-2">
        <h2 id={headingId} className="text-caption font-semibold text-muted">
          Compared with last period
        </h2>
        {upcoming ? (
          <EmptyState
            icon="calendar"
            title={`This ${upcoming} hasn't started yet`}
            body="It will compare with the one before once it begins."
          />
        ) : comparison === null ? (
          <EmptyState
            icon="chart"
            title="No previous period to compare yet"
            body="Once the period before this one has expenses, you'll see how this one compares."
          />
        ) : (
          <>
            {comparison.direction === "same" ? (
              <p className={`text-title font-semibold ${tones.same}`}>Same as last period</p>
            ) : (
              <p className={`text-title font-semibold ${tones[comparison.direction]}`}>
                <Money pence={Math.abs(comparison.diffPence)} tone="neutral" />{" "}
                {comparison.direction === "up" ? "more" : "less"} than last period
              </p>
            )}
            {comparison.pct !== null ? (
              <p className={`text-body font-semibold ${tones[comparison.direction]}`}>{percentText(comparison.pct)}</p>
            ) : null}
            <p className="text-caption text-muted">
              <Money pence={comparison.currentPence} /> against <Money pence={comparison.previousPence} />
              {inProgress ? ", over the same number of days" : ""}
            </p>
          </>
        )}
      </Card>
    </section>
  );
}

type TransactionsPanelProps = {
  /** The window's expenses, newest first. */
  txns: ExpenseTxn[];
  categories: { id: string; name: string }[];
  today: IsoDate;
  returnTo: string;
};

/** The window's expenses grouped by date, with search (by name) and a category filter. */
export function TransactionsPanel({ txns, categories, today, returnTo }: TransactionsPanelProps) {
  const headingId = useId();
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = txns.filter(
    (t) => (!needle || t.name.toLowerCase().includes(needle)) && (!categoryId || t.categoryId === categoryId),
  );

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-title font-semibold text-text">
        Transactions
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        <TextField
          label="Search expenses"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name…"
          autoComplete="off"
        />
        <Select
          label="Category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          options={[{ value: "", label: "All categories" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
        />
      </div>
      <Card className="px-2 py-3">
        {shown.length === 0 ? (
          <EmptyState
            icon="search"
            title={txns.length === 0 ? "No expenses yet" : "No expenses match"}
            body={txns.length === 0 ? "Expenses you add in this period will show here." : "Try another name or category."}
          />
        ) : (
          <TransactionList txns={shown} dayTotals={totalsByDay(shown)} today={today} returnTo={returnTo} />
        )}
      </Card>
    </section>
  );
}

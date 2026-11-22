"use client";

import { useI18n } from "@/i18n/client";
import { useId, useState } from "react";
import { Card, Donut, EmptyState, Money, Select, SeriesSwatch, TextField, type Series } from "@/components/ui";
import { foldCategories, totalsByDay, type Comparison, type ExpensesSummary, type IsoDate } from "@/lib/calc";
import type { ExpenseTxn } from "@/lib/data/expenses";
import { TransactionList } from "./TransactionList";

/** The donut shows this many categories; the rest share one "Other" slice. */
const SLICES = 5;


type CategoryBreakdownProps = {
  /** The Expenses tab's or a trip's figures. */
  summary: Pick<ExpensesSummary, "totalPence" | "categories">;
  names: Map<string, string>;
  /** Under the total in the ring, e.g. "Spent in November". */
  caption: string;
};

/** Donut and category list (§5.6): each category's spend and share, largest first. Colour follows rank in this window. */
export function CategoryBreakdown({ summary, names, caption }: CategoryBreakdownProps) {
  const { m } = useI18n();
  const o = m.overview;
  const nameOf = (id: string) => names.get(id) ?? o.unknown;
  const folded = summary.categories.slice(SLICES).map((c) => nameOf(c.categoryId));
  const slices = foldCategories(summary.categories, SLICES, summary.totalPence).map((s, i) => ({
    key: s.categoryId ?? "other",
    label: s.categoryId === null ? o.other : nameOf(s.categoryId),
    pence: s.pence,
    percent: s.percent,
    series: s.categoryId === null ? ("other" as const) : ((i + 1) as Series),
  }));

  return (
    <div className="@container">
      <div className="flex flex-col gap-5 @xl:flex-row @xl:items-center @xl:gap-8">
        <div className="@xl:w-56 @xl:shrink-0">
          <Donut label={o.byCategory} slices={slices}>
            <Money pence={summary.totalPence} size="title" />
            <span className="text-caption text-muted">{caption}</span>
          </Donut>
        </div>
        {slices.length === 0 ? (
          <p className="text-body text-muted @xl:flex-1">{o.noCategories}</p>
        ) : (
          <ul aria-label={o.categories} className="flex min-w-0 flex-1 flex-col divide-y divide-border">
            {slices.map((s) => (
              <li key={s.key} className="flex items-center gap-3 py-2.5">
                <SeriesSwatch series={s.series} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body text-text">{s.label}</span>
                  {s.series === "other" ? (
                    <span className="truncate text-caption text-muted">{folded.join(", ")}</span>
                  ) : null}
                </span>
                <span className="text-caption text-muted">{s.percent}%</span>
                <span className="text-body text-text">
                  <Money pence={s.pence} />
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
  /** Calendar months compare with "last month", budget periods with "last period". */
  unit: "month" | "period";
  /** The window is still ahead of today: "This month hasn't started yet". */
  upcoming: boolean;
};

/**
 * Month-on-month comparison (§8): money and percentage difference in neutral
 * words. More spending is drawn in the danger tone, less in the positive tone,
 * the same in plain text. With no previous expenses it says so instead.
 */
export function ComparisonCard({ comparison, inProgress, unit, upcoming }: ComparisonCardProps) {
  const { m, fmt } = useI18n();
  const o = m.overview;
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <Card className="flex flex-col gap-2">
        <h2 id={headingId} className="text-caption font-semibold text-muted">
          {o.comparedWith[unit]}
        </h2>
        {upcoming ? (
          <EmptyState
            icon="calendar"
            title={o.notStarted[unit]}
            body={o.notStartedBody}
          />
        ) : comparison === null ? (
          <EmptyState
            icon="chart"
            title={o.noPrevious[unit]}
            body={o.noPreviousBody[unit]}
          />
        ) : (
          <>
            {comparison.direction === "same" ? (
              <p className={`text-title font-semibold ${tones.same}`}>{o.same[unit]}</p>
            ) : (
              <p className={`text-title font-semibold ${tones[comparison.direction]}`}>
                {(comparison.direction === "up" ? o.more : o.less)[unit](fmt.money(Math.abs(comparison.diffPence)))}
              </p>
            )}
            {comparison.pct !== null ? (
              <p className={`text-body font-semibold ${tones[comparison.direction]}`}>{percentText(comparison.pct)}</p>
            ) : null}
            <p className="text-caption text-muted">
              {o.against(fmt.money(comparison.currentPence), fmt.money(comparison.previousPence), inProgress)}
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
  const { m } = useI18n();
  const o = m.overview;
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
        {o.transactions}
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        <TextField
          label={o.search}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={o.searchPlaceholder}
          autoComplete="off"
        />
        <Select
          label={o.category}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          options={[{ value: "", label: o.allCategories }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
        />
      </div>
      <Card className="px-2 py-3">
        {shown.length === 0 ? (
          <EmptyState
            icon="search"
            title={txns.length === 0 ? o.noExpensesTitle : o.noMatchTitle}
            body={txns.length === 0 ? o.noExpensesBody : o.noMatchBody}
          />
        ) : (
          <TransactionList txns={shown} dayTotals={totalsByDay(shown)} today={today} returnTo={returnTo} />
        )}
      </Card>
    </section>
  );
}

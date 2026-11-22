"use client";

import { useI18n } from "@/i18n/client";
import { useState, type FormEvent } from "react";
import { Button, Card, Money, Notice, RadioCards, Select, TextField, type RadioCardOption } from "@/components/ui";
import type { LeftoverSource, Period } from "@/lib/calc";
import { validateLeftoverChoice, type LeftoverChoice } from "@/lib/validation/review";


type LeftoverBreakdownProps = {
  monthLabel: string;
  period: Period;
  breakdown: { totalPence: number; sources: LeftoverSource[] };
  /** How far the whole period went over; 0 when it didn't. */
  overspendPence?: number;
};

/** What was left over when the period ended and where it came from (calc order), or how far it went over. */
export function LeftoverBreakdown({ monthLabel, period, breakdown, overspendPence = 0 }: LeftoverBreakdownProps) {
  const { m, fmt } = useI18n();
  const r = m.review;
  const range = <p className="text-caption text-muted">{fmt.periodRange(period.start, period.end)}</p>;
  if (overspendPence > 0) {
    return (
      <Card as="section" className="flex flex-col gap-1">
        <h2 className="text-body font-semibold text-muted">{r.wentOver(monthLabel)}</h2>
        <span className="text-danger-fg">
          <Money pence={overspendPence} size="display" tone="neutral" />
        </span>
        {range}
      </Card>
    );
  }
  if (breakdown.totalPence === 0) {
    return (
      <Card as="section" className="flex flex-col gap-2">
        <h2 className="text-title font-semibold text-text">{r.nothingLeftTitle}</h2>
        {range}
        <p className="text-body text-muted">{r.nothingLeftBody(monthLabel)}</p>
      </Card>
    );
  }
  return (
    <Card as="section" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-body font-semibold text-muted">{r.leftOverFrom(monthLabel)}</h2>
        <Money pence={breakdown.totalPence} size="display" tone="neutral" />
        {range}
      </div>
      <ul aria-label={r.cameFrom} className="flex flex-col divide-y divide-border border-t border-border">
        {breakdown.sources.map((s) => (
          <li key={s.kind} className="flex items-center justify-between gap-3 py-3 text-body text-text">
            <span>{r.sources[s.kind]}</span>
            <Money pence={s.amountPence} tone="neutral" />
          </li>
        ))}
      </ul>
    </Card>
  );
}

type Destination = LeftoverChoice["destination"];
const NEW_FUND = "new";

type LeftoverPromptProps = {
  monthLabel: string;
  /** The current budget's month, where a carried leftover goes, e.g. "November". */
  currentLabel: string;
  /** The whole leftover; 0 offers only Done. */
  totalPence: number;
  funds: { id: string; name: string }[];
  /** Records the review (the server works out the amount). Resolves with an error to show, or redirects. */
  record: (choice: LeftoverChoice | null) => Promise<{ error?: string }>;
};

/**
 * Where the whole leftover goes (spec §5.9): a fund, the next budget, or kept
 * unassigned (both stay spendable, §5.5). With nothing left over, only Done.
 */
export function LeftoverPrompt({ monthLabel, currentLabel, totalPence, funds, record }: LeftoverPromptProps) {
  const i18n = useI18n();
  const { fmt, m } = i18n;
  const r = m.review;
  const [destination, setDestination] = useState<Destination | null>(null);
  const [fundId, setFundId] = useState(funds[0]?.id ?? NEW_FUND);
  const [newFundName, setNewFundName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const options: RadioCardOption<Destination>[] = [
    { value: "fund", title: r.toFundTitle, description: r.toFundBody },
    { value: "next_period", title: r.toNextTitle, description: r.toNextBody(currentLabel, monthLabel) },
    { value: "unassigned", title: r.keepTitle, description: r.keepBody },
  ];

  async function submit(e: FormEvent) {
    e.preventDefault();
    let choice: LeftoverChoice | null = null;
    if (totalPence > 0) {
      const raw =
        destination === "fund"
          ? fundId === NEW_FUND
            ? { destination, newFundName }
            : { destination, fundId }
          : { destination };
      const checked = validateLeftoverChoice(raw, i18n);
      if (!checked.ok) {
        setError(checked.error);
        return;
      }
      choice = checked.choice;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await record(choice);
      if (result?.error) setError(result.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="section" className="flex flex-col gap-4">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {totalPence > 0 ? (
          <>
            <h2 id="leftover-choice" className="text-title font-semibold text-text">
              {r.whereShouldGo(fmt.money(totalPence))}
            </h2>
            <p className="text-caption text-muted">{r.oneDestination}</p>
            <RadioCards
              label={r.whereShouldGo(fmt.money(totalPence))}
              options={options}
              value={destination}
              onChange={(v) => {
                setDestination(v);
                setError(null);
              }}
            />
            {destination === "fund" ? (
              <div className="flex flex-col gap-4">
                <Select
                  label={r.fund}
                  value={fundId}
                  onChange={(e) => setFundId(e.target.value)}
                  options={[...funds.map((f) => ({ value: f.id, label: f.name })), { value: NEW_FUND, label: r.newFundOption }]}
                />
                {fundId === NEW_FUND ? (
                  <TextField label={r.newFundName} value={newFundName} maxLength={50} onChange={(e) => setNewFundName(e.target.value)} />
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-body text-muted">{r.markReviewed(monthLabel)}</p>
        )}

        {error ? (
          <div role="alert">
            <Notice tone="danger">{error}</Notice>
          </div>
        ) : null}

        <Button type="submit" variant="primary" size="lg" fullWidth disabled={busy}>
          {busy ? m.common.saving : totalPence > 0 ? r.confirm : r.done}
        </Button>
      </form>
    </Card>
  );
}

type OverspendSource = "next_period" | "fund";

type OverspendPromptProps = {
  monthLabel: string;
  /** The current budget's month, which takes the overspend by default, e.g. "November". */
  currentLabel: string;
  overspendPence: number;
  funds: { id: string; name: string }[];
  /** Records the review (the server works out the amount). Resolves with an error to show, or redirects. */
  record: (choice: LeftoverChoice) => Promise<{ error?: string }>;
};

/**
 * Where a whole overspend comes from (spec §5.9, David 2026-11-22): this
 * month's spending money (the default) or a savings fund. Category budgets
 * never carry; only the period's whole figure does.
 */
export function OverspendPrompt({ monthLabel, currentLabel, overspendPence, funds, record }: OverspendPromptProps) {
  const { fmt, m } = useI18n();
  const r = m.review;
  const [source, setSource] = useState<OverspendSource>("next_period");
  const [fundId, setFundId] = useState(funds[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const question = r.whereFrom;

  const options: RadioCardOption<OverspendSource>[] = [
    {
      value: "next_period",
      title: r.takeFromNext(currentLabel),
      description: r.takeFromNextBody(currentLabel, fmt.money(overspendPence)),
    },
    ...(funds.length > 0
      ? [{ value: "fund" as const, title: r.coverFromFund, description: r.coverFromFundBody }]
      : []),
  ];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await record(source === "fund" ? { destination: "fund", fundId } : { destination: "next_period" });
      if (result?.error) setError(result.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="section" className="flex flex-col gap-4">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <h2 className="text-title font-semibold text-text">
          {r.wentOverBy(monthLabel, fmt.money(overspendPence))} {question}
        </h2>
        <p className="text-caption text-muted">{r.oneSource}</p>
        <RadioCards
          label={question}
          options={options}
          value={source}
          onChange={(v) => {
            setSource(v);
            setError(null);
          }}
        />
        {source === "fund" ? (
          <Select label={r.fund} value={fundId} onChange={(e) => setFundId(e.target.value)} options={funds.map((f) => ({ value: f.id, label: f.name }))} />
        ) : null}
        {error ? (
          <div role="alert">
            <Notice tone="danger">{error}</Notice>
          </div>
        ) : null}
        <Button type="submit" variant="primary" size="lg" fullWidth disabled={busy}>
          {busy ? m.common.saving : r.confirm}
        </Button>
      </form>
    </Card>
  );
}

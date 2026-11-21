"use client";

import { useState, type FormEvent } from "react";
import { Button, Card, Money, Notice, RadioCards, Select, TextField, type RadioCardOption } from "@/components/ui";
import { formatGBP, formatPeriodRange, type LeftoverSource, type Period } from "@/lib/calc";
import { validateLeftoverChoice, type LeftoverChoice } from "@/lib/validation/review";

const sourceLabels: Record<LeftoverSource["kind"], string> = {
  previously_unassigned: "Previously unassigned",
  freed_by_pause: "Freed by paused payments",
  unspent_categories: "Unspent in categories",
};

type LeftoverBreakdownProps = {
  monthLabel: string;
  period: Period;
  breakdown: { totalPence: number; sources: LeftoverSource[] };
};

/** What was left over when the period ended, and where it came from (calc order). */
export function LeftoverBreakdown({ monthLabel, period, breakdown }: LeftoverBreakdownProps) {
  const range = <p className="text-caption text-muted">{formatPeriodRange(period.start, period.end)}</p>;
  if (breakdown.totalPence === 0) {
    return (
      <Card as="section" className="flex flex-col gap-2">
        <h2 className="text-title font-semibold text-text">Nothing left over</h2>
        {range}
        <p className="text-body text-muted">You used all of your {monthLabel} spending money, so there&apos;s nothing to move.</p>
      </Card>
    );
  }
  return (
    <Card as="section" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-body font-semibold text-muted">Left over from {monthLabel}</h2>
        <Money pence={breakdown.totalPence} size="display" tone="neutral" />
        {range}
      </div>
      <ul aria-label="Where it came from" className="flex flex-col divide-y divide-border border-t border-border">
        {breakdown.sources.map((s) => (
          <li key={s.kind} className="flex items-center justify-between gap-3 py-3 text-body text-text">
            <span>{sourceLabels[s.kind]}</span>
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
  const [destination, setDestination] = useState<Destination | null>(null);
  const [fundId, setFundId] = useState(funds[0]?.id ?? NEW_FUND);
  const [newFundName, setNewFundName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const options: RadioCardOption<Destination>[] = [
    { value: "fund", title: "Move to a fund", description: "Add it to your savings. It leaves your spending money." },
    {
      value: "next_period",
      title: "Add to next budget",
      description: `Add it to your ${currentLabel} budget, shown as carried from ${monthLabel}.`,
    },
    { value: "unassigned", title: "Keep unassigned", description: "It stays spendable, but you'll be nudged to give it a job." },
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
      const checked = validateLeftoverChoice(raw);
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
              Where should {formatGBP(totalPence)} go?
            </h2>
            <p className="text-caption text-muted">The whole amount goes to one place.</p>
            <RadioCards
              label={`Where should ${formatGBP(totalPence)} go?`}
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
                  label="Fund"
                  value={fundId}
                  onChange={(e) => setFundId(e.target.value)}
                  options={[...funds.map((f) => ({ value: f.id, label: f.name })), { value: NEW_FUND, label: "New fund…" }]}
                />
                {fundId === NEW_FUND ? (
                  <TextField label="New fund name" value={newFundName} maxLength={50} onChange={(e) => setNewFundName(e.target.value)} />
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-body text-muted">Mark {monthLabel} as reviewed.</p>
        )}

        {error ? (
          <div role="alert">
            <Notice tone="danger">{error}</Notice>
          </div>
        ) : null}

        <Button type="submit" variant="primary" size="lg" fullWidth disabled={busy}>
          {busy ? "Saving…" : totalPence > 0 ? "Confirm" : "Done"}
        </Button>
      </form>
    </Card>
  );
}

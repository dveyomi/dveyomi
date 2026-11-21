"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  cancelAction,
  changeAmountAction,
  pauseAction,
  resumeAction,
  skipNextAction,
} from "@/app/(app)/expenses/recurring/actions";
import {
  AmountInput,
  Badge,
  BottomSheet,
  Button,
  ButtonLink,
  Card,
  ConfirmDialog,
  EmptyState,
  ListRow,
  Money,
  Notice,
  TextField,
} from "@/components/ui";
import {
  addDays,
  formatDayMonth,
  formatDayMonthYear,
  formatGBP,
  formatRelativeDay,
  formatWeekdayDate,
  freedByPause,
  parsePence,
  type IsoDate,
  type Period,
  type RecurringStatus,
} from "@/lib/calc";
import type { RecurringItem } from "@/lib/data/recurring";
import { isIsoDate } from "@/lib/validation/expense";
import { FREQUENCY_LABELS } from "./RepeatFields";

type RecurringListProps = {
  rules: RecurringItem[];
  /** The budget period containing today: what pausing frees is counted in it. */
  period: Period;
  today: IsoDate;
};

type Mode = "menu" | "pause" | "amount";

/** "23 Nov", or "1 Jan 2027" in another year. */
const shortDate = (d: IsoDate, today: IsoDate) =>
  d.slice(0, 4) === today.slice(0, 4) ? formatDayMonth(d) : formatDayMonthYear(d);

/** The status as a badge; `compact` (list rows) says just "Paused", the row's second line saying when it resumes. */
function StatusBadgeFor({ status, today, compact = false }: { status: RecurringStatus; today: IsoDate; compact?: boolean }) {
  if (status.kind === "paused") {
    return <Badge tone="warning">{compact ? "Paused" : `Paused until ${shortDate(status.until, today)}`}</Badge>;
  }
  if (status.kind === "ends") {
    return <Badge tone="neutral">{status.on < today ? "Ended" : "Ends"} {shortDate(status.on, today)}</Badge>;
  }
  return <Badge tone="positive">Active</Badge>;
}

/**
 * The recurring payments list (§5.8): each payment with its category, amount
 * today, how often, the next date it will be added and its status. Tapping
 * one opens its actions: Pause until a date (showing what that frees in this
 * budget period, with no question asked), Skip next, Resume, Change amount
 * from a date, and Cancel (after confirming; past payments stay).
 */
export function RecurringList({ rules, period, today }: RecurringListProps) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("menu");
  const [pauseUntil, setPauseUntil] = useState<IsoDate>(period.nextStart);
  const [amountText, setAmountText] = useState("");
  const [amountFrom, setAmountFrom] = useState<IsoDate>(today);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, startBusy] = useTransition();
  const open = rules.find((r) => r.id === openId) ?? null;
  const tomorrow = addDays(today, 1);

  function show(rule: RecurringItem) {
    setOpenId(rule.id);
    setMode("menu");
    setError(null);
    setPauseUntil(period.nextStart);
    setAmountText("");
    setAmountFrom(rule.nextDue ?? today);
  }

  function close() {
    setOpenId(null);
    setError(null);
  }

  function act(done: string, run: () => Promise<{ error?: string }>) {
    setError(null);
    startBusy(async () => {
      try {
        const result = await run();
        if (result.error) return setError(result.error);
      } catch {
        return setError("We couldn't save that. Check your connection and try again.");
      }
      setStatus(done);
      setOpenId(null);
      router.refresh();
    });
  }

  if (rules.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="repeat"
          title="No recurring payments yet"
          body="Switch on Repeat when you add an expense, e.g. a subscription or rent, and it’s added for you each time it's due."
          action={
            <ButtonLink href="/expenses/new?returnTo=%2Fexpenses%2Frecurring" variant="primary" icon="plus">
              Add expense
            </ButtonLink>
          }
        />
      </Card>
    );
  }

  const freed =
    open && isIsoDate(pauseUntil) && pauseUntil > today
      ? freedByPause(open.rule, open.prices, pauseUntil, period, today)
      : null;
  const amountPence = parsePence(amountText);
  const ended = open?.status.kind === "ends";

  return (
    <>
      <p role="status" className="sr-only">
        {status}
      </p>
      <Card as="section" className="flex flex-col gap-2 px-2 md:px-4">
        <ul aria-label="Recurring payments" className="flex flex-col divide-y divide-border">
          {rules.map((r) => (
            <li key={r.id}>
              <ListRow
                icon="repeat"
                onClick={() => show(r)}
                title={r.name}
                subtitle={
                  <>
                    <span className="block truncate">
                      {r.categoryName} · {FREQUENCY_LABELS[r.frequency]}
                    </span>
                    <span className="block truncate">
                      {r.status.kind === "paused"
                        ? `Resumes ${shortDate(r.status.until, today)}`
                        : r.nextDue
                          ? `Next ${shortDate(r.nextDue, today)}`
                          : "No more payments"}
                    </span>
                  </>
                }
                trailing={
                  <span className="flex flex-col items-end gap-1">
                    <Money pence={r.currentPence} />
                    <StatusBadgeFor status={r.status} today={today} compact />
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      </Card>

      <BottomSheet open={open !== null} onClose={close} title={open?.name ?? ""}>
        {open ? (
          <div className="flex flex-col gap-5">
            {error ? (
              <div role="alert">
                <Notice tone="danger">{error}</Notice>
              </div>
            ) : null}

            {mode === "menu" ? (
              <>
                <div className="flex flex-col gap-1">
                  <Money pence={open.currentPence} size="display" />
                  <span className="text-body text-muted">
                    {open.categoryName} · {FREQUENCY_LABELS[open.frequency]}
                  </span>
                  <span className="text-body text-text">
                    {open.nextDue ? `Next payment ${formatWeekdayDate(open.nextDue)}` : "No more payments"}
                  </span>
                  <span className="mt-1">
                    <StatusBadgeFor status={open.status} today={today} />
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  {open.status.kind === "paused" ? (
                    <Button variant="primary" fullWidth disabled={busy} onClick={() => act(`${open.name} resumed`, () => resumeAction(open.id))}>
                      Resume
                    </Button>
                  ) : null}
                  {!ended && open.status.kind !== "paused" ? (
                    <Button variant="secondary" fullWidth disabled={busy} onClick={() => setMode("pause")}>
                      Pause
                    </Button>
                  ) : null}
                  {!ended && open.nextDue ? (
                    <Button
                      variant="secondary"
                      fullWidth
                      disabled={busy}
                      onClick={() => act(`Skipped ${open.name} on ${shortDate(open.nextDue!, today)}`, () => skipNextAction(open.id))}
                    >
                      Skip next payment ({shortDate(open.nextDue, today)})
                    </Button>
                  ) : null}
                  {!ended ? (
                    <Button variant="secondary" fullWidth disabled={busy} onClick={() => setMode("amount")}>
                      Change amount
                    </Button>
                  ) : null}
                  {!ended ? (
                    <Button variant="danger" fullWidth disabled={busy} onClick={() => setConfirmingCancel(true)}>
                      Cancel recurring payment
                    </Button>
                  ) : (
                    <p className="text-body text-muted">Cancelled. Payments already added stay in your expenses.</p>
                  )}
                </div>
              </>
            ) : null}

            {mode === "pause" ? (
              <>
                <TextField
                  label="Pause until"
                  type="date"
                  value={pauseUntil}
                  min={tomorrow}
                  onChange={(e) => setPauseUntil(e.target.value)}
                  autoFocus
                  hint={
                    isIsoDate(pauseUntil) && pauseUntil > today
                      ? `Payments start again ${formatRelativeDay(pauseUntil, today)}.`
                      : "Payments start again on this day."
                  }
                  required
                />
                {freed !== null ? (
                  <p className="text-title font-semibold text-text">Frees {formatGBP(freed)} this period</p>
                ) : (
                  <p className="text-body text-muted">Choose a date after today.</p>
                )}
                <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
                  <Button variant="secondary" onClick={() => setMode("menu")}>
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    disabled={busy || freed === null}
                    onClick={() => act(`${open.name} paused`, () => pauseAction(open.id, pauseUntil))}
                  >
                    {busy ? "Pausing…" : "Pause payments"}
                  </Button>
                </div>
              </>
            ) : null}

            {mode === "amount" ? (
              <>
                <AmountInput label="New amount" value={amountText} onChange={setAmountText} autoFocus />
                <TextField
                  label="From"
                  type="date"
                  value={amountFrom}
                  onChange={(e) => setAmountFrom(e.target.value)}
                  hint="Payments on and after this date use the new amount. Ones you've checked keep theirs."
                  required
                />
                <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
                  <Button variant="secondary" onClick={() => setMode("menu")}>
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    disabled={busy || amountPence === null || amountPence < 1 || !isIsoDate(amountFrom)}
                    onClick={() =>
                      act(`${open.name} amount changed`, () => changeAmountAction(open.id, amountFrom, amountPence))
                    }
                  >
                    {busy ? "Saving…" : "Save amount"}
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </BottomSheet>

      <ConfirmDialog
        open={confirmingCancel && open !== null}
        title={`Cancel ${open?.name ?? ""}?`}
        body="No more payments will be added after today. Payments already added stay in your expenses."
        confirmLabel="Cancel payment"
        cancelLabel="Keep it"
        tone="danger"
        onConfirm={() => {
          setConfirmingCancel(false);
          if (open) act(`${open.name} cancelled`, () => cancelAction(open.id));
        }}
        onCancel={() => setConfirmingCancel(false)}
      />
    </>
  );
}

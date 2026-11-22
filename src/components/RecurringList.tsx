"use client";

import { useI18n } from "@/i18n/client";
import type { Format } from "@/i18n/format";
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
  freedByPause,
  type IsoDate,
  type Period,
  type RecurringStatus,
} from "@/lib/calc";
import type { RecurringItem } from "@/lib/data/recurring";
import { isIsoDate } from "@/lib/validation/expense";

type RecurringListProps = {
  rules: RecurringItem[];
  /** The budget period containing today: what pausing frees is counted in it. */
  period: Period;
  today: IsoDate;
};

type Mode = "menu" | "pause" | "amount";

/** "23 Nov", or "1 Jan 2027" in another year. */
const shortDate = (fmt: Format, d: IsoDate, today: IsoDate) =>
  d.slice(0, 4) === today.slice(0, 4) ? fmt.dayMonth(d) : fmt.dayMonthYear(d);

/** The status as a badge; `compact` (list rows) says just "Paused", the row's second line saying when it resumes. */
function StatusBadgeFor({ status, today, compact = false }: { status: RecurringStatus; today: IsoDate; compact?: boolean }) {
  const { m, fmt } = useI18n();
  const r = m.recurring;
  if (status.kind === "paused") {
    return <Badge tone="warning">{compact ? r.paused : r.pausedUntil(shortDate(fmt, status.until, today))}</Badge>;
  }
  if (status.kind === "ends") {
    const on = shortDate(fmt, status.on, today);
    return <Badge tone="neutral">{status.on < today ? r.ended(on) : r.ends(on)}</Badge>;
  }
  return <Badge tone="positive">{r.active}</Badge>;
}

/**
 * The recurring payments list (§5.8): each payment with its category, amount
 * today, how often, the next date it will be added and its status. Tapping
 * one opens its actions: Pause until a date (showing what that frees in this
 * budget period, with no question asked), Skip next, Resume, Change amount
 * from a date, and Cancel (after confirming; past payments stay).
 */
export function RecurringList({ rules, period, today }: RecurringListProps) {
  const { m, fmt } = useI18n();
  const rc = m.recurring;
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("menu");
  const [pauseUntil, setPauseUntil] = useState<IsoDate>(period.nextStart);
  const [amountText, setAmountText] = useState("");
  const [amountFrom, setAmountFrom] = useState<IsoDate>(today);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** A refusal that belongs to one field of the Change amount step. */
  const [fieldError, setFieldError] = useState<{ field: "amount" | "from"; message: string } | null>(null);
  const [status, setStatus] = useState("");
  const [busy, startBusy] = useTransition();
  const open = rules.find((r) => r.id === openId) ?? null;
  const tomorrow = addDays(today, 1);

  function show(rule: RecurringItem) {
    setOpenId(rule.id);
    setMode("menu");
    setError(null);
    setFieldError(null);
    setPauseUntil(period.nextStart);
    setAmountText("");
    setAmountFrom(rule.nextDue && rule.nextDue > today ? rule.nextDue : today);
  }

  function close() {
    setOpenId(null);
    setError(null);
  }

  function act(done: string, run: () => Promise<{ error?: string; field?: "amount" | "from" }>) {
    setError(null);
    setFieldError(null);
    startBusy(async () => {
      try {
        const result = await run();
        if (result.error && result.field) return setFieldError({ field: result.field, message: result.error });
        if (result.error) return setError(result.error);
      } catch {
        return setError(rc.failed);
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
          title={rc.emptyTitle}
          body={rc.emptyBody}
          action={
            <ButtonLink href="/expenses/new?returnTo=%2Fexpenses%2Frecurring" variant="primary" icon="plus">
              {rc.addExpense}
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
  const amountPence = fmt.parse(amountText);
  const ended = open?.status.kind === "ends";

  return (
    <>
      <p role="status" className="sr-only">
        {status}
      </p>
      <Card as="section" className="flex flex-col gap-2 px-2 md:px-4">
        <ul aria-label={rc.list} className="flex flex-col divide-y divide-border">
          {rules.map((r) => (
            <li key={r.id}>
              <ListRow
                icon="repeat"
                onClick={() => show(r)}
                title={r.name}
                subtitle={
                  <>
                    <span className="block truncate">
                      {r.categoryName} · {m.repeat.frequency[r.frequency]}
                    </span>
                    <span className="block truncate">
                      {r.status.kind === "paused"
                        ? rc.resumes(shortDate(fmt, r.status.until, today))
                        : r.nextDue
                          ? rc.next(shortDate(fmt, r.nextDue, today))
                          : rc.noMore}
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
                    {open.categoryName} · {m.repeat.frequency[open.frequency]}
                  </span>
                  <span className="text-body text-text">
                    {open.nextDue ? rc.nextPayment(fmt.weekdayDate(open.nextDue)) : rc.noMore}
                  </span>
                  <span className="mt-1">
                    <StatusBadgeFor status={open.status} today={today} />
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  {open.status.kind === "paused" ? (
                    <Button variant="primary" fullWidth disabled={busy} onClick={() => act(rc.resumed(open.name), () => resumeAction(open.id))}>
                      {rc.resume}
                    </Button>
                  ) : null}
                  {!ended && open.status.kind !== "paused" ? (
                    <Button variant="secondary" fullWidth disabled={busy} onClick={() => setMode("pause")}>
                      {rc.pause}
                    </Button>
                  ) : null}
                  {!ended && open.nextDue ? (
                    <Button
                      variant="secondary"
                      fullWidth
                      disabled={busy}
                      onClick={() => act(rc.skipped(open.name, shortDate(fmt, open.nextDue!, today)), () => skipNextAction(open.id))}
                    >
                      {rc.skipNext(shortDate(fmt, open.nextDue, today))}
                    </Button>
                  ) : null}
                  {!ended ? (
                    <Button variant="secondary" fullWidth disabled={busy} onClick={() => setMode("amount")}>
                      {rc.changeAmount}
                    </Button>
                  ) : null}
                  {!ended ? (
                    <Button variant="danger" fullWidth disabled={busy} onClick={() => setConfirmingCancel(true)}>
                      {rc.cancelRecurring}
                    </Button>
                  ) : (
                    <p className="text-body text-muted">{rc.cancelled}</p>
                  )}
                </div>
              </>
            ) : null}

            {mode === "pause" ? (
              <>
                <TextField
                  label={rc.pauseUntil}
                  type="date"
                  value={pauseUntil}
                  min={tomorrow}
                  onChange={(e) => setPauseUntil(e.target.value)}
                  autoFocus
                  hint={
                    isIsoDate(pauseUntil) && pauseUntil > today
                      ? rc.startAgain(fmt.relativeDay(pauseUntil, today))
                      : rc.startAgainDay
                  }
                  required
                />
                {freed !== null ? (
                  <p className="text-title font-semibold text-text">{rc.frees(fmt.money(freed))}</p>
                ) : (
                  <p className="text-body text-muted">{rc.chooseAfterToday}</p>
                )}
                <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
                  <Button variant="secondary" onClick={() => setMode("menu")}>
                    {rc.back}
                  </Button>
                  <Button
                    variant="primary"
                    disabled={busy || freed === null}
                    onClick={() => act(rc.pausedDone(open.name), () => pauseAction(open.id, pauseUntil))}
                  >
                    {busy ? rc.pausing : rc.pausePayments}
                  </Button>
                </div>
              </>
            ) : null}

            {mode === "amount" ? (
              <>
                <AmountInput
                  label={rc.newAmount}
                  value={amountText}
                  onChange={(text) => {
                    setAmountText(text);
                    if (fieldError?.field === "amount") setFieldError(null);
                  }}
                  error={fieldError?.field === "amount" ? fieldError.message : null}
                  autoFocus
                />
                <TextField
                  label={rc.from}
                  type="date"
                  value={amountFrom}
                  min={today}
                  error={fieldError?.field === "from" ? fieldError.message : null}
                  onChange={(e) => {
                    setAmountFrom(e.target.value);
                    if (fieldError?.field === "from") setFieldError(null);
                  }}
                  hint={rc.fromHint}
                  required
                />
                <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
                  <Button variant="secondary" onClick={() => setMode("menu")}>
                    {rc.back}
                  </Button>
                  <Button
                    variant="primary"
                    disabled={busy || amountPence === null || amountPence < 1 || !isIsoDate(amountFrom)}
                    onClick={() =>
                      act(rc.amountChanged(open.name), () => changeAmountAction(open.id, amountFrom, amountPence))
                    }
                  >
                    {busy ? m.common.saving : rc.saveAmount}
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </BottomSheet>

      <ConfirmDialog
        open={confirmingCancel && open !== null}
        title={rc.cancelTitle(open?.name ?? "")}
        body={rc.cancelBody}
        confirmLabel={rc.cancelPayment}
        cancelLabel={rc.keepIt}
        tone="danger"
        onConfirm={() => {
          setConfirmingCancel(false);
          if (open) act(rc.cancelledDone(open.name), () => cancelAction(open.id));
        }}
        onCancel={() => setConfirmingCancel(false)}
      />
    </>
  );
}

"use client";

import { useI18n } from "@/i18n/client";
import type { Format } from "@/i18n/format";
import type { Messages } from "@/i18n/messages";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { FundEditSheet, FundMoveSheet, FundMovementSheet } from "@/components/FundForms";
import { FundHistory } from "@/components/FundHistory";
import { MoveSavingsSheet } from "@/components/MoveSavingsSheet";
import { Button, Card, EmptyState, Icon, IconButton, Money, ProgressBar } from "@/components/ui";
import { type IsoDate } from "@/lib/calc";
import type { FundView, SavingView, WaitingPrompt } from "@/lib/data/funds";

type SavingTabProps = { view: SavingView; today: IsoDate };

/** Which sheet is open, and for what. */
type Open =
  | { sheet: "move"; prompt: WaitingPrompt }
  | { sheet: "history"; fundId: string }
  | { sheet: "movement"; fundId: string; kind: "contribution" | "withdrawal" }
  | { sheet: "transfer"; fundId: string }
  | { sheet: "edit"; fundId: string | null }
  | null;

/**
 * The Budget tab's Saving view (§5.4, §5.7): savings still waiting to be moved
 * this period (and any earlier period never confirmed), then every fund with
 * its balance, progress to target and history. Every figure comes from the
 * data layer (calc); the split difference while editing comes from calc too.
 */
export function SavingTab({ view, today }: SavingTabProps) {
  const { m } = useI18n();
  const sv = m.saving;
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  const [status, setStatus] = useState("");
  const statusRef = useRef<HTMLParagraphElement>(null);
  // After a sheet closes on success its opener may be gone (a moved prompt): keep focus on the confirmation.
  useEffect(() => {
    if (status) statusRef.current?.focus();
  }, [status]);
  const fundById = new Map(view.funds.map((f) => [f.id, f]));

  function done(message: string) {
    setOpen(null);
    setStatus(message);
    router.refresh();
  }

  const current = open && "fundId" in open && open.fundId ? (fundById.get(open.fundId) ?? null) : null;

  return (
    <>
      <div role="status">
        {status ? (
          <p ref={statusRef} tabIndex={-1} className="mb-4 text-body font-semibold text-positive-fg outline-none">
            {status}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-6">
        {view.waiting.length > 0 ? (
          <section aria-label={sv.waitingSection} className="flex flex-col gap-3">
            {view.waiting.map((p) => (
              <WaitingCard key={p.periodId} prompt={p} onMove={() => setOpen({ sheet: "move", prompt: p })} />
            ))}
          </section>
        ) : null}

        <section aria-labelledby="funds-heading" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="funds-heading" className="text-caption font-semibold tracking-wide text-muted uppercase">
              {sv.funds}
            </h2>
            {view.funds.length > 0 ? (
              <Button variant="secondary" onClick={() => setOpen({ sheet: "edit", fundId: null })}>
                <Icon name="plus" size="sm" />
                {sv.newFund}
              </Button>
            ) : null}
          </div>
          {view.funds.length === 0 ? (
            <Card>
              <EmptyState
                icon="savings"
                title={sv.noFundsTitle}
                body={sv.noFundsBody}
                action={
                  <Button variant="primary" onClick={() => setOpen({ sheet: "edit", fundId: null })}>
                    {sv.newFund}
                  </Button>
                }
              />
            </Card>
          ) : (
            <ul className="grid gap-3 2xl:grid-cols-2">
              {view.funds.map((f) => (
                <li key={f.id}>
                  <FundCard
                    fund={f}
                    onHistory={() => setOpen({ sheet: "history", fundId: f.id })}
                    onAdd={() => setOpen({ sheet: "movement", fundId: f.id, kind: "contribution" })}
                    onWithdraw={() => setOpen({ sheet: "movement", fundId: f.id, kind: "withdrawal" })}
                    onMove={view.funds.length > 1 ? () => setOpen({ sheet: "transfer", fundId: f.id }) : null}
                    onEdit={() => setOpen({ sheet: "edit", fundId: f.id })}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {open?.sheet === "move" ? (
          <MoveSavingsSheet
            prompt={open.prompt}
            funds={view.funds}
            onClose={() => setOpen(null)}
            onDone={() => done(sv.moved)}
          />
        ) : null}
        {open?.sheet === "history" ? <FundHistory fund={current} today={today} onClose={() => setOpen(null)} /> : null}
        {open?.sheet === "movement" && current ? (
          <FundMovementSheet fund={current} kind={open.kind} today={today} onClose={() => setOpen(null)} onDone={done} />
        ) : null}
        {open?.sheet === "transfer" && current ? (
          <FundMoveSheet
            fund={current}
            others={view.funds.filter((f) => f.id !== current.id)}
            today={today}
            onClose={() => setOpen(null)}
            onDone={done}
          />
        ) : null}
        {open?.sheet === "edit" ? <FundEditSheet fund={current} onClose={() => setOpen(null)} onDone={done} /> : null}
      </div>
    </>
  );
}

function WaitingCard({ prompt, onMove }: { prompt: WaitingPrompt; onMove: () => void }) {
  const { m, fmt } = useI18n();
  return (
    <Card className="flex flex-col gap-4 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-accent/15 text-accent-fg"
        >
          <Icon name="savings" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-title font-semibold text-text">
            {m.saving.waiting(fmt.money(prompt.savingsPence))}
          </p>
          <p className="text-caption text-muted">
            {m.saving.waitingBody(fmt.periodRange(prompt.start, prompt.end))}
          </p>
        </div>
      </div>
      <div className="md:shrink-0">
        <Button variant="primary" fullWidth onClick={onMove}>
          {m.saving.moveYourSavings}
        </Button>
      </div>
    </Card>
  );
}

/** "23% of £1,000.00 · by 31 Jul 2027", "No target · by 31 Jul 2027" or "No target". */
function targetLine(m: Messages, fmt: Format, f: FundView): string {
  const target = f.targetPence !== null && f.progressPercent !== null ? m.saving.target(f.progressPercent, fmt.money(f.targetPence)) : m.saving.noTarget;
  return f.targetDate ? m.saving.by(target, fmt.dayMonthYear(f.targetDate)) : target;
}

type FundCardProps = {
  fund: FundView;
  onHistory: () => void;
  onAdd: () => void;
  onWithdraw: () => void;
  /** Null when there's no other fund to move money to. */
  onMove: (() => void) | null;
  onEdit: () => void;
};

function FundCard({ fund, onHistory, onAdd, onWithdraw, onMove, onEdit }: FundCardProps) {
  const { fmt, m } = useI18n();
  const sv = m.saving;
  const headingId = useId();
  return (
    <article aria-labelledby={headingId} className="h-full">
      <Card className="flex h-full flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-card-raised text-text">
            <Icon name="savings" />
          </span>
          <h3 id={headingId} className="truncate text-body font-semibold text-text">
            {fund.name}
          </h3>
        </div>
        <Button variant="ghost" aria-label={sv.historyOf(fund.name)} onClick={onHistory}>
          {sv.history}
          <Icon name="chevron-right" size="sm" />
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-display font-semibold tracking-tight text-text">
          <Money pence={fund.balancePence} />
        </span>
        {fund.progressPercent !== null ? (
          <ProgressBar percent={fund.progressPercent} state="normal" label={sv.progress(fund.name)} />
        ) : null}
        <span className="text-caption text-muted">{targetLine(m, fmt, fund)}</span>
      </div>

      <div className="mt-auto grid grid-cols-[1fr_1fr_auto] items-center gap-2">
        <Button variant="secondary" onClick={onAdd}>
          {sv.addMoney}
        </Button>
        <Button variant="secondary" onClick={onWithdraw} disabled={fund.balancePence <= 0}>
          {sv.withdraw}
        </Button>
        <IconButton icon="edit" label={sv.edit(fund.name)} onClick={onEdit} />
        {onMove ? (
          <Button variant="secondary" onClick={onMove} disabled={fund.balancePence <= 0} className="col-span-2">
            {sv.move}
          </Button>
        ) : null}
      </div>
      </Card>
    </article>
  );
}

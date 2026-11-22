"use client";

import { useI18n } from "@/i18n/client";
import type { Format } from "@/i18n/format";
import type { Messages } from "@/i18n/messages";
import { BottomSheet, Icon, Money } from "@/components/ui";
import { type IsoDate } from "@/lib/calc";
import type { FundHistoryItem, FundView } from "@/lib/data/funds";

type FundHistoryProps = {
  fund: FundView | null;
  today: IsoDate;
  onClose: () => void;
};

/** "Thu 12 Nov", with the year when it isn't this year's. */
function entryDate(fmt: Format, d: IsoDate, today: IsoDate): string {
  const short = fmt.shortDate(d);
  return d.slice(0, 4) === today.slice(0, 4) ? short : `${short} ${d.slice(0, 4)}`;
}

function subtitle(m: Messages, fmt: Format, e: FundHistoryItem, today: IsoDate): string {
  const date = entryDate(fmt, e.date, today);
  if (e.label === "expense") return m.saving.paidFromFund(date);
  return e.note ? `${date} · ${e.note}` : date;
}

function Row({ title, sub, direction, pence }: { title: string; sub?: string; direction: "in" | "out"; pence: number }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span
        aria-hidden="true"
        className={`flex size-10 shrink-0 items-center justify-center rounded-pill bg-card-raised ${direction === "in" ? "text-positive-fg" : "text-muted"}`}
      >
        <Icon name={direction === "in" ? "arrow-down" : "arrow-up"} size="sm" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body text-text">{title}</span>
        {sub ? <span className="truncate text-caption text-muted">{sub}</span> : null}
      </span>
      <span className={`shrink-0 text-body font-semibold ${direction === "in" ? "text-positive-fg" : "text-text"}`}>
        {direction === "in" ? "+" : "−"}
        <Money pence={pence} tone="neutral" />
      </span>
    </li>
  );
}

/**
 * A fund's money in and out, newest first (§5.7): contributions (from the
 * savings prompt or added by hand), withdrawals, spending paid from the fund,
 * and what was already saved when it was set up. A bottom sheet on a phone,
 * a dialog on desktop.
 */
export function FundHistory({ fund, today, onClose }: FundHistoryProps) {
  const { m, fmt } = useI18n();
  if (!fund) return null;
  const empty = fund.history.length === 0 && fund.openingPence === 0;
  return (
    <BottomSheet open onClose={onClose} title={fund.name}>
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-body text-muted">{m.saving.balance}</span>
          <span className="text-title font-semibold text-text">
            <Money pence={fund.balancePence} />
          </span>
        </div>
        <h3 className="text-caption font-semibold tracking-wide text-muted uppercase">{m.saving.moneyInOut}</h3>
        {empty ? (
          <p className="py-4 text-center text-body text-muted">{m.saving.noMoney}</p>
        ) : (
          <ul aria-label={m.saving.historyOf(fund.name)} className="flex flex-col divide-y divide-border">
            {fund.history.map((e) => (
              <Row key={`${e.label}-${e.refId}`} title={e.label === "expense" ? e.title : e.label === "contribution" ? m.saving.added : m.saving.withdrawn} sub={subtitle(m, fmt, e, today)} direction={e.direction} pence={e.amountPence} />
            ))}
            {fund.openingPence > 0 ? (
              <Row title={m.saving.alreadyAtStart} direction="in" pence={fund.openingPence} />
            ) : null}
          </ul>
        )}
      </div>
    </BottomSheet>
  );
}

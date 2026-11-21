import { BottomSheet, Icon, Money } from "@/components/ui";
import { formatShortDate, type IsoDate } from "@/lib/calc";
import type { FundHistoryItem, FundView } from "@/lib/data/funds";

type FundHistoryProps = {
  fund: FundView | null;
  today: IsoDate;
  onClose: () => void;
};

/** "Thu 12 Nov", with the year when it isn't this year's. */
function entryDate(d: IsoDate, today: IsoDate): string {
  const short = formatShortDate(d);
  return d.slice(0, 4) === today.slice(0, 4) ? short : `${short} ${d.slice(0, 4)}`;
}

function subtitle(e: FundHistoryItem, today: IsoDate): string {
  const date = entryDate(e.date, today);
  if (e.label === "expense") return `${date} · Paid from this fund`;
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
  if (!fund) return null;
  const empty = fund.history.length === 0 && fund.openingPence === 0;
  return (
    <BottomSheet open onClose={onClose} title={fund.name}>
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-body text-muted">Balance</span>
          <span className="text-title font-semibold text-text">
            <Money pence={fund.balancePence} />
          </span>
        </div>
        <h3 className="text-caption font-semibold tracking-wide text-muted uppercase">Money in and out</h3>
        {empty ? (
          <p className="py-4 text-center text-body text-muted">No money in or out yet</p>
        ) : (
          <ul aria-label={`${fund.name} history`} className="flex flex-col divide-y divide-border">
            {fund.history.map((e) => (
              <Row key={`${e.label}-${e.refId}`} title={e.title} sub={subtitle(e, today)} direction={e.direction} pence={e.amountPence} />
            ))}
            {fund.openingPence > 0 ? (
              <Row title="Already saved at the start" direction="in" pence={fund.openingPence} />
            ) : null}
          </ul>
        )}
      </div>
    </BottomSheet>
  );
}

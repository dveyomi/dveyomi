import { Badge, ListRow, Money } from "@/components/ui";
import { formatRelativeDay, type IsoDate } from "@/lib/calc";
import type { ExpenseTxn } from "@/lib/data/expenses";

/** The edit form for an expense, coming back to `returnTo` afterwards. */
export function editHref(id: string, returnTo: string): string {
  return `/expenses/${id}?returnTo=${encodeURIComponent(returnTo)}`;
}

/** "Groceries", or "Travel · from Holiday" when it was paid from a fund (§5.7). */
export function expenseSubtitle(t: ExpenseTxn): string {
  return t.fundName ? `${t.categoryName} · from ${t.fundName}` : t.categoryName;
}

/** One expense as a row that opens its edit form; auto-added recurring ones carry an "unchecked" marker. */
export function ExpenseRow({ txn, returnTo }: { txn: ExpenseTxn; returnTo: string }) {
  return (
    <ListRow
      href={editHref(txn.id, returnTo)}
      title={txn.name}
      subtitle={
        <>
          <span>{expenseSubtitle(txn)}</span>
          {txn.unchecked ? (
            <>
              {" "}
              <Badge tone="warning">unchecked</Badge>
            </>
          ) : null}
        </>
      }
      trailing={<Money pence={txn.amountPence} />}
    />
  );
}

/** The newest few expenses (the phone's "latest" list under the calendar; a panel on desktop). */
export function LatestList({ txns, returnTo }: { txns: ExpenseTxn[]; returnTo: string }) {
  return (
    <ul aria-label="Latest expenses" className="flex flex-col divide-y divide-border">
      {txns.map((t) => (
        <li key={t.id}>
          <ExpenseRow txn={t} returnTo={returnTo} />
        </li>
      ))}
    </ul>
  );
}

type TransactionListProps = {
  /** Newest first. */
  txns: ExpenseTxn[];
  /** Each date's total, from calc's totalsByDay. */
  dayTotals: Map<IsoDate, number>;
  today: IsoDate;
  returnTo: string;
};

/** Expenses grouped by date, newest first, each date with its total. */
export function TransactionList({ txns, dayTotals, today, returnTo }: TransactionListProps) {
  const groups: { date: IsoDate; txns: ExpenseTxn[] }[] = [];
  for (const t of txns) {
    const last = groups.at(-1);
    if (last?.date === t.date) last.txns.push(t);
    else groups.push({ date: t.date, txns: [t] });
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => {
        const label = formatRelativeDay(g.date, today);
        return (
          <div key={g.date} role="group" aria-label={label} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 px-2">
              <h3 className="text-caption font-semibold text-muted">{label}</h3>
              <span className="text-caption text-muted">
                <Money pence={dayTotals.get(g.date) ?? 0} />
              </span>
            </div>
            <ul className="flex flex-col divide-y divide-border">
              {g.txns.map((t) => (
                <li key={t.id}>
                  <ExpenseRow txn={t} returnTo={returnTo} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

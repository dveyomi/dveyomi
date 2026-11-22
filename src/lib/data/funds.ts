import {
  fundBalance,
  fundHistory,
  fundProgressPercent,
  type FundEntry,
  type FundMovement,
  type IsoDate,
  type Txn,
} from "@/lib/calc";
import type { FundDetails, FundMovementInput, SplitInputLine, WithdrawDestination } from "@/lib/validation/funds";
import { ensureCurrentPeriod } from "./ensurePeriod";
import { allRows } from "./paging";
import type { Db } from "./types";

/** One line of a fund's history: the calc entry plus what the row shows. */
export type FundHistoryItem = FundEntry & {
  /** "Added", "Withdrawn", or the expense's name. */
  title: string;
  note: string | null;
};

export type FundView = {
  id: string;
  name: string;
  /** What was already saved when the fund was set up. */
  openingPence: number;
  /** Opening + contributions − withdrawals − spending paid from it; may be below zero. */
  balancePence: number;
  targetPence: number | null;
  targetDate: IsoDate | null;
  /** Whole percent of the target saved; null without a target. */
  progressPercent: number | null;
  /** Newest first; fund-paid expenses are money out. */
  history: FundHistoryItem[];
};

/** An amount for one existing fund. */
export type SplitLine = { fundId: string; amountPence: number };

/** A period's savings still waiting to be moved into funds. */
export type WaitingPrompt = {
  periodId: string;
  start: IsoDate;
  end: IsoDate;
  /** The period's savings now (save_budget may have changed it since the prompt was made). */
  savingsPence: number;
  /** What "Move your savings" starts from; it may not add up to `savingsPence`. */
  prefill: SplitLine[];
  /** last_period: the latest confirmed split; setup: the split chosen at onboarding; none: nothing to go on. */
  prefillFrom: "last_period" | "setup" | "none";
};

export type SavingView = { funds: FundView[]; waiting: WaitingPrompt[] };

/** A line of a confirmed split: an existing fund, or a new one created in the same confirm. */
export type ConfirmLine = SplitInputLine;
export type FundInput = FundDetails;
export type MovementInput = FundMovementInput;

/** The savings were already moved (or the period has nothing waiting). */
export class SavingsAlreadyMovedError extends Error {
  constructor() {
    super("These savings have already been moved.");
    this.name = "SavingsAlreadyMovedError";
  }
}

/** The split doesn't add up to the period's savings (they may have changed since the page loaded). */
export class SplitTotalError extends Error {
  constructor() {
    super("The amounts must add up to the savings for this period. Reload to see the latest figure.");
    this.name = "SplitTotalError";
  }
}

export class FundNotFoundError extends Error {
  constructor() {
    super("That fund wasn't found. Reload the page and try again.");
    this.name = "FundNotFoundError";
  }
}

/** Fund names are unique, ignoring case. */
export class FundNameTakenError extends Error {
  constructor(name?: string) {
    super(name ? `You already have a fund called ${name}.` : "You already have a fund with that name.");
    this.name = "FundNameTakenError";
  }
}

/** A withdrawal would take the fund below zero. */
export class InsufficientFundsError extends Error {
  constructor(readonly balancePence: number) {
    super("You can't withdraw more than the fund holds.");
    this.name = "InsufficientFundsError";
  }
}

/** A move between funds named the same fund twice. */
export class SameFundError extends Error {
  constructor() {
    super("Choose a different fund to move the money to.");
    this.name = "SameFundError";
  }
}

const isUniqueViolation = (e: { code?: string } | null) => e?.code === "23505";

/** A stored split ({fund_id: amount_pence}) as lines for the funds that still exist. */
function splitLines(split: unknown, fundIds: Set<string>): SplitLine[] {
  if (typeof split !== "object" || split === null || Array.isArray(split)) return [];
  return Object.entries(split as Record<string, unknown>)
    .filter((e): e is [string, number] => fundIds.has(e[0]) && Number.isSafeInteger(e[1]) && (e[1] as number) > 0)
    .map(([fundId, amountPence]) => ({ fundId, amountPence }));
}

/**
 * What the Saving tab shows: every fund (by name) with its balance, progress
 * and history, all from calc; and every savings prompt still waiting, oldest
 * first, for periods started by `today` (a "From next period" edit can create
 * next period's prompt early). Each is pre-filled with the most recent
 * confirmed split of an earlier period, else its own split (from onboarding).
 */
export async function loadSavingView(supabase: Db, today: IsoDate): Promise<SavingView> {
  const [fundsRes, movementRows, txnRows, promptsRes] = await Promise.all([
    supabase.from("funds").select("id, name, opening_pence, target_pence, target_date").order("name"),
    allRows((count) => supabase.from("fund_movements").select("id, fund_id, date, kind, amount_pence, note", count).order("id")),
    allRows((count) =>
      supabase.from("transactions").select("id, name, amount_pence, date, category_id, fund_id", count).not("fund_id", "is", null).order("id"),
    ),
    supabase.from("savings_prompts").select("period_id, status, split, budget_periods(start_date, end_date, savings_pence)"),
  ]);
  for (const r of [fundsRes, promptsRes]) if (r.error) throw r.error;

  const movementsBy = Map.groupBy(movementRows, (m) => m.fund_id);
  const txnsBy = Map.groupBy(txnRows, (t) => t.fund_id!);

  const funds: FundView[] = fundsRes.data!.map((f) => {
    const rows = movementsBy.get(f.id) ?? [];
    const spent = txnsBy.get(f.id) ?? [];
    const movements: FundMovement[] = rows.map((m) => ({
      id: m.id,
      date: m.date,
      kind: m.kind as FundMovement["kind"],
      amountPence: m.amount_pence,
    }));
    const txns: Txn[] = spent.map((t) => ({
      id: t.id,
      amountPence: t.amount_pence,
      date: t.date,
      categoryId: t.category_id,
      fundId: t.fund_id,
    }));
    const noteOf = new Map(rows.map((m) => [m.id, m.note]));
    const nameOf = new Map(spent.map((t) => [t.id, t.name]));
    const balancePence = fundBalance(f.opening_pence, movements, txns);
    return {
      id: f.id,
      name: f.name,
      openingPence: f.opening_pence,
      balancePence,
      targetPence: f.target_pence,
      targetDate: f.target_date,
      progressPercent: fundProgressPercent(balancePence, f.target_pence),
      history: fundHistory(movements, txns).map((e) => ({
        ...e,
        title: e.label === "expense" ? nameOf.get(e.refId)! : e.label === "contribution" ? "Added" : "Withdrawn",
        note: e.label === "expense" ? null : (noteOf.get(e.refId) ?? null),
      })),
    };
  });

  const fundIds = new Set(funds.map((f) => f.id));
  const prompts = promptsRes
    .data!.flatMap((p) => (p.budget_periods ? [{ ...p, period: p.budget_periods }] : []))
    .toSorted((a, b) => (a.period.start_date < b.period.start_date ? -1 : 1));
  const confirmed = prompts.filter((p) => p.status === "confirmed");

  const waiting: WaitingPrompt[] = prompts
    .filter((p) => p.status === "waiting" && p.period.start_date <= today)
    .map((p) => {
      const last = confirmed.findLast((c) => c.period.start_date < p.period.start_date);
      const fromLast = last ? splitLines(last.split, fundIds) : [];
      const own = splitLines(p.split, fundIds);
      const [prefill, prefillFrom] =
        last && fromLast.length > 0
          ? [fromLast, "last_period" as const]
          : own.length > 0
            ? [own, "setup" as const]
            : [[], "none" as const];
      return {
        periodId: p.period_id,
        start: p.period.start_date,
        end: p.period.end_date,
        savingsPence: p.period.savings_pence,
        prefill,
        prefillFrom,
      };
    });

  return { funds, waiting };
}

/**
 * Moves a period's waiting savings into funds in one transaction
 * (`confirm_savings_split`): one contribution per fund given more than £0,
 * dated `today` (the user's, from the server), any new funds created first,
 * and the prompt marked confirmed. Throws SplitTotalError when the total
 * isn't the period's current savings, SavingsAlreadyMovedError when there is
 * nothing waiting (e.g. a second confirm), FundNotFoundError for a fund that
 * isn't the user's, and FundNameTakenError for a new fund's taken name.
 */
export async function confirmSavingsSplit(
  supabase: Db,
  periodId: string,
  split: ConfirmLine[],
  today: IsoDate,
): Promise<void> {
  const { error } = await supabase.rpc("confirm_savings_split", {
    p_period_id: periodId,
    p_date: today,
    p_split: split.map((line) =>
      "fundId" in line
        ? { fund_id: line.fundId, amount_pence: line.amountPence }
        : { new_name: line.newFund.name, new_target_pence: line.newFund.targetPence, amount_pence: line.amountPence },
    ),
  });
  if (!error) return;
  if (error.code === "PT409" || error.code === "P0002") throw new SavingsAlreadyMovedError();
  if (error.code === "PT422") throw new SplitTotalError();
  if (error.code === "PT404") throw new FundNotFoundError();
  if (isUniqueViolation(error)) throw new FundNameTakenError();
  throw error;
}

const fundRow = (input: FundInput) => ({
  name: input.name,
  target_pence: input.targetPence,
  target_date: input.targetDate,
});

/** Creates a fund with nothing in it yet. Throws FundNameTakenError when the name is taken, ignoring case. */
export async function createFund(supabase: Db, input: FundInput): Promise<string> {
  const { data, error } = await supabase.from("funds").insert(fundRow(input)).select("id").single();
  if (isUniqueViolation(error)) throw new FundNameTakenError(input.name);
  if (error) throw error;
  return data.id;
}

/** Changes a fund's name, target and target date (its money is untouched). */
export async function updateFund(supabase: Db, fundId: string, input: FundInput): Promise<void> {
  const { data, error } = await supabase.from("funds").update(fundRow(input)).eq("id", fundId).select("id");
  if (isUniqueViolation(error)) throw new FundNameTakenError(input.name);
  if (error) throw error;
  if (data.length === 0) throw new FundNotFoundError();
}

/** A fund's balance now, from calc, or null when the user has no such fund. */
async function balanceOf(supabase: Db, fundId: string): Promise<number | null> {
  const [fund, movements, txns] = await Promise.all([
    supabase.from("funds").select("opening_pence").eq("id", fundId).maybeSingle(),
    allRows((count) => supabase.from("fund_movements").select("id, date, kind, amount_pence", count).eq("fund_id", fundId).order("id")),
    allRows((count) =>
      supabase.from("transactions").select("id, amount_pence, date, category_id, fund_id", count).eq("fund_id", fundId).order("id"),
    ),
  ]);
  if (fund.error) throw fund.error;
  if (!fund.data) return null;
  return fundBalance(
    fund.data.opening_pence,
    movements.map((m) => ({ id: m.id, date: m.date, kind: m.kind as FundMovement["kind"], amountPence: m.amount_pence })),
    txns.map((t) => ({ id: t.id, amountPence: t.amount_pence, date: t.date, categoryId: t.category_id, fundId: t.fund_id })),
  );
}

/**
 * Records money added to or taken out of a fund outside the savings prompt.
 * It is fund-only bookkeeping: no budget figure changes. A withdrawal goes
 * through withdrawFromFund ("out"), so its balance check is atomic. Throws
 * InsufficientFundsError for a withdrawal larger than the balance, and
 * FundNotFoundError when the user has no such fund.
 */
export async function addFundMovement(supabase: Db, fundId: string, input: MovementInput): Promise<void> {
  if (input.kind === "withdrawal") return withdrawFromFund(supabase, input.date, fundId, input, "out");
  if ((await balanceOf(supabase, fundId)) === null) throw new FundNotFoundError();
  const { error } = await supabase.from("fund_movements").insert({
    fund_id: fundId,
    date: input.date,
    kind: input.kind,
    amount_pence: input.amountPence,
    note: input.note,
  });
  if (error) throw error;
}

export type { WithdrawDestination } from "@/lib/validation/funds";

/** A withdrawal refused for the balance: the fund's balance now, for the message. */
async function insufficient(supabase: Db, fundId: string): Promise<InsufficientFundsError> {
  return new InsufficientFundsError(Math.max(0, (await balanceOf(supabase, fundId)) ?? 0));
}

/**
 * Takes money out of a fund in one transaction (`withdraw_from_fund`), with
 * the balance checked there. "spending" also adds it to the current period's
 * spending money (its unassigned carry, with a from_fund adjustment the
 * Budget tab lists) and notes "Moved to <Month> spending" on the withdrawal;
 * "out" changes only the fund. Throws InsufficientFundsError for more than
 * the fund holds and FundNotFoundError for a fund that isn't the user's.
 */
export async function withdrawFromFund(
  supabase: Db,
  today: IsoDate,
  fundId: string,
  input: MovementInput,
  destination: WithdrawDestination,
): Promise<void> {
  const period = destination === "spending" ? await ensureCurrentPeriod(supabase, today) : null;
  if (destination === "spending" && !period) throw new Error("withdrawFromFund: no budget to add the money to");
  const { error } = await supabase.rpc("withdraw_from_fund", {
    p_fund_id: fundId,
    p_date: input.date,
    p_amount_pence: input.amountPence,
    ...(input.note ? { p_note: input.note } : {}),
    ...(period ? { p_to_period_id: period.id } : {}),
  });
  if (!error) return;
  if (error.code === "PT404") throw new FundNotFoundError();
  if (error.code === "PT422") throw await insufficient(supabase, fundId);
  throw error;
}

/**
 * Moves money from one fund to another in one transaction
 * (`move_between_funds`): a withdrawal noted "To <fund>" and a contribution
 * noted "From <fund>", same date. The budget is untouched. Throws
 * SameFundError, InsufficientFundsError (more than the first fund holds) and
 * FundNotFoundError (either fund isn't the user's).
 */
export async function moveBetweenFunds(
  supabase: Db,
  fromId: string,
  toId: string,
  input: Pick<MovementInput, "amountPence" | "date" | "note">,
): Promise<void> {
  if (fromId === toId) throw new SameFundError();
  const { error } = await supabase.rpc("move_between_funds", {
    p_from_id: fromId,
    p_to_id: toId,
    p_date: input.date,
    p_amount_pence: input.amountPence,
    ...(input.note ? { p_note: input.note } : {}),
  });
  if (!error) return;
  if (error.code === "PT404") throw new FundNotFoundError();
  if (error.code === "PT422") throw await insufficient(supabase, fromId);
  throw error;
}

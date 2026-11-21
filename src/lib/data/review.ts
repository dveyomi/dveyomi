import {
  addDays,
  categoriesOverTwiceInThree,
  formatMonth,
  freedInPeriod,
  leftoverBreakdown,
  suggestedBudget,
  type Frequency,
  type IsoDate,
  type LeftoverSource,
  type Period,
  type PlannedAllocation,
} from "@/lib/calc";
import type { LeftoverChoice } from "@/lib/validation/review";
import { loadPeriodSummary, summariseRow } from "./budget";
import { editTarget } from "./budgetEdit";
import { ensureCurrentPeriod } from "./ensurePeriod";
import { FundNameTakenError, FundNotFoundError } from "./funds";
import type { CategoryRow, Db, PeriodRow } from "./types";

export { dismissUnassignedNudge } from "./budgetEdit";
export type { LeftoverChoice } from "@/lib/validation/review";

/** A category that went over budget in the reviewed period. */
export type Overspend = { categoryId: string; name: string; overPence: number };

/** A category over budget in two of the last three ended periods, with a budget to raise it to. */
export type RaiseSuggestion = {
  categoryId: string;
  name: string;
  kind: CategoryRow["kind"];
  /** Its allocation in the current period (0 when it has none). */
  currentPence: number;
  /** suggestedBudget of its spending in those periods. */
  suggestedPence: number;
};

/** The current period's figures, for showing what a raise does to the total (allocationTotals). */
export type CurrentFigures = {
  incomePence: number;
  savingsPence: number;
  allocations: (PlannedAllocation & { categoryId: string })[];
};

export type Review = {
  periodId: string;
  period: Period;
  /** The month the period starts in, e.g. "October". */
  monthLabel: string;
  /** The leftover (one whole amount) and where it came from, in calc order. */
  breakdown: { totalPence: number; sources: LeftoverSource[] };
  overspent: Overspend[];
  suggestions: RaiseSuggestion[];
  current: CurrentFigures;
  funds: { id: string; name: string }[];
  /** Ended periods still to review after this one. */
  laterCount: number;
  /** The budgets a raise changes: the current one, and the next when it is already planned. */
  raiseApplies: { currentLabel: string; nextLabel: string | null };
};

export type ReviewStatus = {
  /** The ended period waiting for review (the oldest), if any. */
  pending: { periodId: string; monthLabel: string } | null;
  /** Leftovers carried into the current period, oldest period first. */
  carried: { fromLabel: string; amountPence: number }[];
  /** "Give every pound a job": the amount kept unassigned into this period, until dismissed or the budget is edited. */
  nudgePence: number | null;
};

/** The period was reviewed already (a second record changes nothing). */
export class AlreadyReviewedError extends Error {
  constructor() {
    super("This budget has already been reviewed.");
    this.name = "AlreadyReviewedError";
  }
}

/** The period hasn't ended yet. */
export class PeriodNotEndedError extends Error {
  constructor() {
    super("This budget hasn't ended yet.");
    this.name = "PeriodNotEndedError";
  }
}

/** The period (or the current one to carry into) isn't the user's. */
export class ReviewNotFoundError extends Error {
  constructor() {
    super("That budget wasn't found. Reload the page and try again.");
    this.name = "ReviewNotFoundError";
  }
}

/** The leftover changed between working it out and recording it (an expense was added meanwhile). */
export class LeftoverChangedError extends Error {
  constructor() {
    super("Your leftover changed while you were reviewing. Reload to see the latest figure.");
    this.name = "LeftoverChangedError";
  }
}

const monthOf = (start: IsoDate) => formatMonth(start.slice(0, 7));

/** What the period's paused and skipped recurring payments (not fund-paid) kept out of its spending. */
async function freedByPauses(supabase: Db, period: Period): Promise<number> {
  const [rulesRes, paidRes] = await Promise.all([
    supabase
      .from("recurring_rules")
      .select("id, frequency, anchor_date, end_date, paused_until, skipped_dates, recurring_prices(effective_from, amount_pence)")
      .is("fund_id", null),
    supabase
      .from("transactions")
      .select("recurring_rule_id, date")
      .not("recurring_rule_id", "is", null)
      .gte("date", period.start)
      .lte("date", period.end),
  ]);
  if (rulesRes.error) throw rulesRes.error;
  if (paidRes.error) throw paidRes.error;
  const paid = Map.groupBy(paidRes.data, (t) => t.recurring_rule_id!);
  return rulesRes.data
    .filter((r) => r.recurring_prices.length > 0)
    .reduce(
      (sum, r) =>
        sum +
        freedInPeriod(
          {
            frequency: r.frequency as Frequency,
            anchorDate: r.anchor_date,
            endDate: r.end_date,
            pausedUntil: r.paused_until,
            skippedDates: r.skipped_dates,
          },
          r.recurring_prices.map((p) => ({ effectiveFrom: p.effective_from, amountPence: p.amount_pence })),
          period,
          (paid.get(r.id) ?? []).map((t) => t.date),
        ),
      0,
    );
}

/**
 * The period-end review: the oldest ended period (end before `today`) not yet
 * reviewed, or null when there is none. Its leftover broken down
 * (leftoverBreakdown, with that period's carry and what its paused or skipped
 * recurring payments freed), its overspent categories, and raise suggestions
 * for categories over budget in two of the last three ended periods up to it
 * (categoriesOverTwiceInThree, suggestedBudget), left out once the current
 * allocation is already that much. Renews the current period first.
 */
export async function loadReview(supabase: Db, today: IsoDate): Promise<Review | null> {
  const current = await ensureCurrentPeriod(supabase, today);
  if (!current) return null;

  const periodsRes = await supabase.from("budget_periods").select("*").lt("end_date", today).order("start_date");
  if (periodsRes.error) throw periodsRes.error;
  const ended = periodsRes.data;
  const target = ended.find((p) => p.reviewed_at === null);
  if (!target) return null;

  const [categoriesRes, allocationsRes, fundsRes, nextRes] = await Promise.all([
    supabase.from("categories").select("id, name, kind"),
    supabase.from("allocations").select("category_id, amount_pence").eq("period_id", current.id),
    supabase.from("funds").select("id, name").order("name"),
    supabase.from("budget_periods").select("start_date").eq("start_date", addDays(current.end_date, 1)).maybeSingle(),
  ]);
  for (const r of [categoriesRes, allocationsRes, fundsRes, nextRes]) if (r.error) throw r.error;
  const categories = categoriesRes.data!.map((c) => ({ ...c, kind: c.kind as CategoryRow["kind"] }));
  const byId = new Map(categories.map((c) => [c.id, c]));

  const recent: PeriodRow[] = ended.filter((p) => p.start_date <= target.start_date).slice(-3);
  const summaries = await Promise.all(recent.map((p) => summariseRow(supabase, p, categories, p.end_date)));
  const { period, summary } = summaries.at(-1)!;
  const freed = await freedByPauses(supabase, period);

  const budgeted = summaries.map((s) => s.summary.categories.filter((c) => !c.noBudget));
  const currentAllocations = allocationsRes.data!.flatMap((a) => {
    const c = byId.get(a.category_id);
    return c ? [{ categoryId: c.id, kind: c.kind, amountPence: a.amount_pence }] : [];
  });
  const allocatedNow = new Map(currentAllocations.map((a) => [a.categoryId, a.amountPence]));

  const suggestions: RaiseSuggestion[] = categoriesOverTwiceInThree(budgeted).flatMap((id) => {
    const c = byId.get(id);
    if (!c) return [];
    const spends = budgeted.flatMap((figures) => figures.filter((f) => f.categoryId === id).map((f) => f.spentPence));
    const suggestedPence = suggestedBudget(spends);
    const currentPence = allocatedNow.get(id) ?? 0;
    return currentPence >= suggestedPence ? [] : [{ categoryId: id, name: c.name, kind: c.kind, currentPence, suggestedPence }];
  });

  return {
    periodId: target.id,
    period,
    monthLabel: monthOf(target.start_date),
    breakdown: leftoverBreakdown(summary, target.unassigned_carry_pence, freed),
    overspent: budgeted
      .at(-1)!
      .filter((f) => f.overPence > 0)
      .map((f) => ({ categoryId: f.categoryId, name: byId.get(f.categoryId)?.name ?? "", overPence: f.overPence }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    suggestions,
    current: { incomePence: current.income_pence, savingsPence: current.savings_pence, allocations: currentAllocations },
    funds: fundsRes.data!,
    laterCount: ended.filter((p) => p.reviewed_at === null && p.start_date > target.start_date).length,
    raiseApplies: {
      currentLabel: monthOf(current.start_date),
      nextLabel: nextRes.data ? monthOf(nextRes.data.start_date) : null,
    },
  };
}

/**
 * What the Budget tab shows about reviews: the ended period waiting for one,
 * the leftovers carried into the current period (the latest period starting
 * by `today`), and the unassigned nudge while it stands.
 */
export async function loadReviewStatus(supabase: Db, today: IsoDate): Promise<ReviewStatus> {
  const [pendingRes, currentRes] = await Promise.all([
    supabase
      .from("budget_periods")
      .select("id, start_date")
      .lt("end_date", today)
      .is("reviewed_at", null)
      .order("start_date")
      .limit(1)
      .maybeSingle(),
    supabase.from("budget_periods").select("id").lte("start_date", today).order("start_date", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (pendingRes.error) throw pendingRes.error;
  if (currentRes.error) throw currentRes.error;
  const pending = pendingRes.data ? { periodId: pendingRes.data.id, monthLabel: monthOf(pendingRes.data.start_date) } : null;
  if (!currentRes.data) return { pending, carried: [], nudgePence: null };

  const movesRes = await supabase
    .from("leftover_movements")
    .select("period_id, destination, amount_pence, nudge_dismissed_at")
    .eq("carried_to_period_id", currentRes.data.id);
  if (movesRes.error) throw movesRes.error;
  const moves = movesRes.data;
  if (moves.length === 0) return { pending, carried: [], nudgePence: null };

  const fromRes = await supabase
    .from("budget_periods")
    .select("id, start_date")
    .in(
      "id",
      moves.map((m) => m.period_id),
    );
  if (fromRes.error) throw fromRes.error;
  const startOf = new Map(fromRes.data.map((p) => [p.id, p.start_date]));
  const carried = moves
    .toSorted((a, b) => (startOf.get(a.period_id)! < startOf.get(b.period_id)! ? -1 : 1))
    .map((m) => ({ fromLabel: monthOf(startOf.get(m.period_id)!), amountPence: m.amount_pence }));
  const nudging = moves.filter((m) => m.destination === "unassigned" && m.nudge_dismissed_at === null);
  return {
    pending,
    carried,
    nudgePence: nudging.length > 0 ? nudging.reduce((sum, m) => sum + m.amount_pence, 0) : null,
  };
}

/**
 * Records the review of an ended period in one transaction (`record_leftover`):
 * the leftover, worked out here from the stored figures (never taken from the
 * browser), goes whole to the choice: a fund contribution dated `today`, or
 * the current period's unassigned carry ("next_period" or "unassigned"). With
 * nothing left over, `choice` is ignored and the period is only marked
 * reviewed. Throws AlreadyReviewedError, PeriodNotEndedError,
 * ReviewNotFoundError, LeftoverChangedError, FundNotFoundError or
 * FundNameTakenError, recording nothing.
 */
export async function recordLeftover(
  supabase: Db,
  today: IsoDate,
  periodId: string,
  choice: LeftoverChoice | null,
): Promise<void> {
  // A carry needs the current period to exist.
  await ensureCurrentPeriod(supabase, today);

  let stored;
  try {
    stored = await loadPeriodSummary(supabase, periodId, today);
  } catch (e) {
    if ((e as { code?: string }).code === "PGRST116") throw new ReviewNotFoundError();
    throw e;
  }
  const { totalPence } = leftoverBreakdown(stored.summary, stored.row.unassigned_carry_pence, 0);
  if (totalPence > 0 && choice === null) throw new Error("recordLeftover: choose where the leftover goes");
  const to = totalPence > 0 ? choice : null;

  const { error } = await supabase.rpc("record_leftover", {
    p_period_id: periodId,
    p_today: today,
    p_amount_pence: totalPence,
    ...(to ? { p_destination: to.destination } : {}),
    ...(to && "fundId" in to ? { p_fund_id: to.fundId } : {}),
    ...(to && "newFundName" in to ? { p_new_fund_name: to.newFundName } : {}),
  });
  if (!error) return;
  if (error.code === "PT409") throw new AlreadyReviewedError();
  if (error.code === "PT425") throw new PeriodNotEndedError();
  if (error.code === "P0002") throw new ReviewNotFoundError();
  if (error.code === "PT422") throw new LeftoverChangedError();
  if (error.code === "PT404") throw new FundNotFoundError();
  if (error.code === "23505") {
    // A new fund's name taken; otherwise the one-per-period key: reviewed meanwhile (another tab).
    if (to && "newFundName" in to) throw new FundNameTakenError(to.newFundName);
    throw new AlreadyReviewedError();
  }
  throw error;
}

/**
 * Applies a raise suggestion in one transaction (`raise_allocation`): the
 * category's allocation becomes `amountPence` in the current period and, when
 * the next period is already planned, in that one too. Every other figure of
 * both stays as it is, so a pending "From next period" budget is kept. A
 * category outside the budget is added back. Throws NoBudgetError without a
 * budget, RaiseRefusedError for an amount out of range or a category that
 * isn't the user's.
 */
export async function raiseBudget(supabase: Db, today: IsoDate, categoryId: string, amountPence: number): Promise<void> {
  const { periodId, nextEnd } = await editTarget(supabase, today);
  const { error } = await supabase.rpc("raise_allocation", {
    p_period_id: periodId,
    p_next_end: nextEnd,
    p_category_id: categoryId,
    p_amount_pence: amountPence,
  });
  if (error?.code === "22023" || error?.code === "P0002" || error?.code === "23503") throw new RaiseRefusedError();
  if (error) throw error;
}

/** The raise couldn't be applied (the category is gone, or the amount is out of range). */
export class RaiseRefusedError extends Error {
  constructor() {
    super("That budget couldn't be raised. Reload the page and try again.");
    this.name = "RaiseRefusedError";
  }
}

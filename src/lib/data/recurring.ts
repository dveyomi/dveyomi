import {
  addDays,
  amountOn,
  currentAmount,
  detectRecurring,
  dueOccurrences,
  nameKey,
  nextDue,
  periodContaining,
  recurringStatus,
  todayIn,
  withPriceChange,
  type Frequency,
  type IsoDate,
  type Period,
  type Price,
  type RecurringStatus,
  type Rule,
} from "@/lib/calc";
import type { Db } from "./types";

/**
 * Recurring payments (§5.8). Schedules, prices, amounts and detection come
 * from src/lib/calc; this module reads and writes the rows. Writes that touch
 * more than one row go through the 0007 RPCs, so they are all or nothing.
 */

/** A recurring payment as the list shows it. */
export type RecurringItem = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  fundId: string | null;
  frequency: Frequency;
  rule: Rule;
  prices: Price[];
  /** The price today (or the first price, for one that starts later). */
  currentPence: number;
  /** The next payment still to be added, or null once it has ended. */
  nextDue: IsoDate | null;
  status: RecurringStatus;
};

export type RecurringView = {
  /** The budget period containing today: what "Frees £X this period" counts. */
  period: Period;
  rules: RecurringItem[];
};

/** A hit from detection, as the Expenses tab offers it. */
export type DetectionSuggestion = { name: string; nameKey: string; frequency: Frequency };

/** The recurring payment isn't one of the user's (or has been deleted). */
export class RuleNotFoundError extends Error {
  constructor() {
    super("This recurring payment no longer exists. Reload and try again.");
    this.name = "RuleNotFoundError";
  }
}

/** The payment changed meanwhile (another tab or the hourly job). */
export class RecurringChangedError extends Error {
  constructor() {
    super("This recurring payment changed in the meantime. Reload and try again.");
    this.name = "RecurringChangedError";
  }
}

/** How many days of manual expenses detection looks back over. */
export const DETECTION_DAYS = 120;

type RuleRow = {
  id: string;
  name: string;
  category_id: string;
  fund_id: string | null;
  frequency: string;
  anchor_date: string;
  end_date: string | null;
  paused_until: string | null;
  skipped_dates: string[];
  generated_through: string | null;
  recurring_prices: { effective_from: string; amount_pence: number }[];
};

const RULE_COLUMNS =
  "id, name, category_id, fund_id, frequency, anchor_date, end_date, paused_until, skipped_dates, generated_through, recurring_prices(effective_from, amount_pence)";

const toRule = (r: RuleRow): Rule => ({
  frequency: r.frequency as Frequency,
  anchorDate: r.anchor_date,
  endDate: r.end_date,
  pausedUntil: r.paused_until,
  skippedDates: r.skipped_dates,
});

const toPrices = (r: RuleRow): Price[] =>
  r.recurring_prices.map((p) => ({ effectiveFrom: p.effective_from, amountPence: p.amount_pence }));

/** The first day not yet generated: the day after generated_through, or the anchor. */
const firstUngenerated = (r: Pick<RuleRow, "anchor_date" | "generated_through">): IsoDate =>
  r.generated_through ? addDays(r.generated_through, 1) : r.anchor_date;

/** The first day a payment could still be added: today, or later if today's is already in. */
const upcomingFrom = (r: Pick<RuleRow, "anchor_date" | "generated_through">, today: IsoDate): IsoDate => {
  const next = firstUngenerated(r);
  return next > today ? next : today;
};

async function loadRule(supabase: Db, id: string): Promise<RuleRow> {
  const { data, error } = await supabase.from("recurring_rules").select(RULE_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new RuleNotFoundError();
  return data as RuleRow;
}

async function updateRule(
  supabase: Db,
  id: string,
  patch: { paused_until?: IsoDate | null; end_date?: IsoDate; skipped_dates?: IsoDate[] },
): Promise<void> {
  const { data, error } = await supabase.from("recurring_rules").update(patch).eq("id", id).select("id");
  if (error) throw error;
  if (data.length === 0) throw new RuleNotFoundError();
}

/**
 * Adds every payment due from each of the user's rules, from where it last
 * left off (its anchor at first) up to the user's local today in `timezone`
 * at `now`. Paused, skipped and post-end dates are left out; amounts come
 * from the price history via amountOn. Payments are added unchecked, source
 * 'recurring', and `on conflict do nothing` means none is added twice, even
 * when two runs overlap. Returns how many were added.
 *
 * `supabase` is the user's own client (RLS) or the service role (the hourly
 * job); either way only `userId`'s rules and rows are touched.
 */
export async function generateDue(supabase: Db, userId: string, timezone: string, now: Date): Promise<number> {
  const today = todayIn(timezone, now);
  const { data, error } = await supabase
    .from("recurring_rules")
    .select(RULE_COLUMNS)
    .eq("user_id", userId)
    .or(`generated_through.is.null,generated_through.lt.${today}`);
  if (error) throw error;
  const rules = data as RuleRow[];
  if (rules.length === 0) return 0;

  const inserts = rules.flatMap((r) => {
    const prices = toPrices(r);
    return dueOccurrences(toRule(r), firstUngenerated(r), today)
      .filter((date) => prices.some((p) => p.effectiveFrom <= date))
      .map((date) => ({
        user_id: userId,
        recurring_rule_id: r.id,
        name: r.name,
        category_id: r.category_id,
        fund_id: r.fund_id,
        date,
        amount_pence: amountOn(prices, date),
        unchecked: true,
        source: "recurring",
      }));
  });

  let added = 0;
  if (inserts.length > 0) {
    const { data: rows, error: insertError } = await supabase
      .from("transactions")
      .upsert(inserts, { onConflict: "user_id,recurring_rule_id,date", ignoreDuplicates: true })
      .select("id");
    if (insertError) throw insertError;
    added = rows.length;
  }

  // Only rules whose anchor has been reached count as generated through today.
  const reached = rules.filter((r) => r.anchor_date <= today).map((r) => r.id);
  if (reached.length > 0) {
    const { error: markError } = await supabase
      .from("recurring_rules")
      .update({ generated_through: today })
      .eq("user_id", userId)
      .in("id", reached)
      .or(`generated_through.is.null,generated_through.lt.${today}`);
    if (markError) throw markError;
  }
  return added;
}

export type NewRule = {
  name: string;
  categoryId: string;
  fundId: string | null;
  frequency: Frequency;
  anchorDate: IsoDate;
  amountPence: number;
  /** Past expenses (no rule yet) to link as its first, checked payments; the anchor is the latest. */
  linkTxnIds?: string[];
};

/** Creates a rule and its first price (and links past payments), all at once. Returns its id. */
export async function createRule(supabase: Db, input: NewRule): Promise<string> {
  const { data, error } = await supabase.rpc("create_recurring_rule", {
    p_name: input.name,
    p_category_id: input.categoryId,
    p_frequency: input.frequency,
    p_anchor_date: input.anchorDate,
    p_amount_pence: input.amountPence,
    ...(input.fundId ? { p_fund_id: input.fundId } : {}),
    p_link_ids: input.linkTxnIds ?? [],
  });
  if (error?.code === "PT409") throw new RecurringChangedError();
  if (error) throw error;
  return data;
}

/** Pauses a rule: nothing is added before `until`; payments start again that day. */
export async function pauseRule(supabase: Db, id: string, until: IsoDate): Promise<void> {
  await updateRule(supabase, id, { paused_until: until });
}

/** Ends a pause now. Payments the pause passed over stay skipped. */
export async function resumeRule(supabase: Db, id: string): Promise<void> {
  await updateRule(supabase, id, { paused_until: null });
}

/** Skips the next payment not yet added (from `today`). Returns that date, or null if none is left. */
export async function skipNext(supabase: Db, id: string, today: IsoDate): Promise<IsoDate | null> {
  const row = await loadRule(supabase, id);
  const date = nextDue(toRule(row), upcomingFrom(row, today));
  if (date === null) return null;
  await updateRule(supabase, id, { skipped_dates: [...row.skipped_dates, date] });
  return date;
}

/** Stops a rule after `endDate` (inclusive). Payments already added stay. */
export async function cancelRule(supabase: Db, id: string, endDate: IsoDate): Promise<void> {
  const row = await loadRule(supabase, id);
  // A rule that hasn't started yet ends on its anchor, the earliest allowed.
  await updateRule(supabase, id, { end_date: endDate < row.anchor_date ? row.anchor_date : endDate });
}

/**
 * Changes a rule's price from `from` on (withPriceChange), and moves every
 * payment already added on or after `from` that is still unchecked to its
 * new amount (amountOn), plus `alsoTxnId` (the payment being edited) even if
 * checked. Earlier payments keep their amounts. All in one RPC.
 */
async function applyPrice(supabase: Db, row: RuleRow, from: IsoDate, amountPence: number, alsoTxnId?: string) {
  const prices = withPriceChange(toPrices(row), from, amountPence);
  const { data, error } = await supabase
    .from("transactions")
    .select("id, date, unchecked")
    .eq("recurring_rule_id", row.id)
    .gte("date", from);
  if (error) throw error;
  const updates = data
    .filter((t) => t.unchecked || t.id === alsoTxnId)
    .map((t) => ({ id: t.id, amount_pence: amountOn(prices, t.date) }));
  const { error: rpcError } = await supabase.rpc("apply_recurring_price", {
    p_rule_id: row.id,
    p_from: from,
    p_amount_pence: amountPence,
    p_updates: updates,
  });
  if (rpcError?.code === "P0002") throw new RuleNotFoundError();
  if (rpcError?.code === "PT409") throw new RecurringChangedError();
  if (rpcError) throw rpcError;
}

/** "Change amount" on the list: the rule costs `amountPence` from `from` on. */
export async function changePrice(supabase: Db, ruleId: string, from: IsoDate, amountPence: number): Promise<void> {
  await applyPrice(supabase, await loadRule(supabase, ruleId), from, amountPence);
}

/** The expense isn't one of the user's recurring payments. */
export class NotRecurringError extends Error {
  constructor() {
    super("This expense isn't a recurring payment any more. Reload and try again.");
    this.name = "NotRecurringError";
  }
}

/**
 * Changes a recurring payment's amount. "this": only that payment. "this_and_future":
 * that payment, the rule's price from its date, and later payments still unchecked.
 */
export async function editOccurrence(
  supabase: Db,
  txnId: string,
  scope: "this" | "this_and_future",
  amountPence: number,
): Promise<void> {
  const { data: txn, error } = await supabase
    .from("transactions")
    .select("id, date, recurring_rule_id")
    .eq("id", txnId)
    .maybeSingle();
  if (error) throw error;
  if (!txn?.recurring_rule_id) throw new NotRecurringError();
  if (scope === "this") {
    const { error: updateError } = await supabase.from("transactions").update({ amount_pence: amountPence }).eq("id", txnId);
    if (updateError) throw updateError;
    return;
  }
  await applyPrice(supabase, await loadRule(supabase, txn.recurring_rule_id), txn.date, amountPence, txnId);
}

/** Marks an auto-added payment as checked. */
export async function confirmOccurrence(supabase: Db, txnId: string): Promise<void> {
  const { data, error } = await supabase.from("transactions").update({ unchecked: false }).eq("id", txnId).select("id");
  if (error) throw error;
  if (data.length === 0) throw new NotRecurringError();
}

/** The user's recurring payments for the list, soonest first; ended ones last. */
export async function loadRecurringView(supabase: Db, today: IsoDate): Promise<RecurringView> {
  const [profile, rulesRes, categoriesRes] = await Promise.all([
    supabase.from("profiles").select("budget_start_day").single(),
    supabase.from("recurring_rules").select(RULE_COLUMNS).order("name"),
    supabase.from("categories").select("id, name"),
  ]);
  if (profile.error) throw profile.error;
  if (rulesRes.error) throw rulesRes.error;
  if (categoriesRes.error) throw categoriesRes.error;
  const names = new Map(categoriesRes.data.map((c) => [c.id, c.name]));

  const rules = (rulesRes.data as RuleRow[]).map((r): RecurringItem => {
    const rule = toRule(r);
    const prices = toPrices(r);
    return {
      id: r.id,
      name: r.name,
      categoryId: r.category_id,
      categoryName: names.get(r.category_id) ?? "",
      fundId: r.fund_id,
      frequency: rule.frequency,
      rule,
      prices,
      currentPence: currentAmount(prices, today),
      nextDue: nextDue(rule, upcomingFrom(r, today)),
      status: recurringStatus(rule, today),
    };
  });
  const order = (r: RecurringItem) => r.nextDue ?? "9999-12-31";
  rules.sort((a, b) => (order(a) < order(b) ? -1 : order(a) > order(b) ? 1 : a.name.localeCompare(b.name)));
  return { period: periodContaining(today, profile.data.budget_start_day), rules };
}

type DetectionTxn = { id: string; name: string; date: IsoDate; amount_pence: number; category_id: string; fund_id: string | null };

/** Detection over the last DETECTION_DAYS of manual expenses with no rule, less dismissed names and names of existing rules. */
async function detect(supabase: Db, today: IsoDate) {
  const [txns, dismissals, rules] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, name, date, amount_pence, category_id, fund_id")
      .is("recurring_rule_id", null)
      .eq("source", "manual")
      .gte("date", addDays(today, -DETECTION_DAYS))
      .lte("date", today)
      .order("date")
      .limit(1000),
    supabase.from("recurring_dismissals").select("name_key"),
    supabase.from("recurring_rules").select("name"),
  ]);
  if (txns.error) throw txns.error;
  if (dismissals.error) throw dismissals.error;
  if (rules.error) throw rules.error;
  const known = new Set([
    ...dismissals.data.map((d) => d.name_key),
    ...rules.data.map((r) => nameKey(r.name)),
  ]);
  return detectRecurring(txns.data as DetectionTxn[]).filter((hit) => !known.has(hit.nameKey));
}

/** Payments that look recurring and the user hasn't answered yet, for the Expenses tab's cards. */
export async function loadDetections(supabase: Db, today: IsoDate): Promise<DetectionSuggestion[]> {
  return (await detect(supabase, today)).map(({ name, nameKey, frequency }) => ({ name, nameKey, frequency }));
}

/**
 * "Yes, repeat it": a rule anchored on the latest payment, with its amount,
 * category and fund, linking the three payments found. Detection runs again
 * here, so only a current suggestion can be accepted. Returns the rule's id.
 */
export async function acceptDetection(supabase: Db, key: string, today: IsoDate): Promise<string> {
  const hit = (await detect(supabase, today)).find((h) => h.nameKey === key);
  if (!hit) throw new RecurringChangedError();
  const latest = hit.payments[hit.payments.length - 1];
  return createRule(supabase, {
    name: hit.name.slice(0, 50),
    categoryId: latest.category_id,
    fundId: latest.fund_id,
    frequency: hit.frequency,
    anchorDate: latest.date,
    amountPence: latest.amount_pence,
    linkTxnIds: hit.payments.map((p) => p.id),
  });
}

/** "No": this name is never suggested again. */
export async function dismissDetection(supabase: Db, key: string): Promise<void> {
  const { error } = await supabase
    .from("recurring_dismissals")
    .upsert({ name_key: key }, { onConflict: "user_id,name_key", ignoreDuplicates: true });
  if (error) throw error;
}

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BudgetSummary, Period } from "@/lib/calc";
import type { SavingView } from "@/lib/data/funds";
import type { CurrentFigures, RaiseSuggestion } from "@/lib/data/review";

const reviewActions = vi.hoisted(() => ({ dismissNudgeAction: vi.fn() }));
vi.mock("@/app/(app)/review/actions", () => reviewActions);
vi.mock("@/app/(app)/budget/actions", () => ({ renameCategoryAction: vi.fn(), deleteCategoryAction: vi.fn(), removeFromBudgetAction: vi.fn() }));
vi.mock("@/app/(app)/budget/fundActions", () => ({ confirmSavingsAction: vi.fn(), saveFundAction: vi.fn(), addFundMovementAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import { BudgetOverview } from "./BudgetOverview";
import { LeftoverBreakdown, LeftoverPrompt } from "./LeftoverPrompt";
import { OverspendReview } from "./OverspendReview";

const october: Period = { start: "2026-10-01", end: "2026-10-31", nextStart: "2026-11-01" };

beforeEach(() => vi.clearAllMocks());

describe("LeftoverBreakdown", () => {
  it("shows the total and the reasons in the Task 8 order: previously unassigned, freed by pauses, unspent categories", () => {
    render(
      <LeftoverBreakdown
        monthLabel="October"
        period={october}
        breakdown={{
          totalPence: 112000,
          sources: [
            { kind: "previously_unassigned", amountPence: 10000 },
            { kind: "freed_by_pause", amountPence: 1500 },
            { kind: "unspent_categories", amountPence: 100500 },
          ],
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: /left over from october/i })).toBeInTheDocument();
    expect(screen.getByText("£1,120.00")).toBeInTheDocument();
    const rows = within(screen.getByRole("list", { name: "Where it came from" })).getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual([
      "Previously unassigned£100.00",
      "Freed by paused payments£15.00",
      "Unspent in categories£1,005.00",
    ]);
  });

  it("with nothing left over says so, with no £0 breakdown", () => {
    render(<LeftoverBreakdown monthLabel="October" period={october} breakdown={{ totalPence: 0, sources: [] }} />);
    expect(screen.getByRole("heading", { name: "Nothing left over" })).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});

describe("LeftoverPrompt", () => {
  const funds = [{ id: "6f1c2e2a-3b4d-4e5f-8a9b-0c1d2e3f4a5b", name: "Holiday" }];

  it("offers the three destinations for the whole amount, and records keep unassigned", async () => {
    const record = vi.fn().mockResolvedValue({});
    render(<LeftoverPrompt monthLabel="October" currentLabel="November" totalPence={25000} funds={funds} record={record} />);
    expect(screen.getByRole("radiogroup", { name: /where should £250.00 go/i })).toBeInTheDocument();
    for (const name of ["Move to a fund", "Add to next budget", "Keep unassigned"]) {
      expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("radio", { name: "Add to next budget" })).toHaveAccessibleDescription(
      "Add it to your November budget, shown as carried from October.",
    );
    expect(screen.getByRole("radio", { name: "Keep unassigned" })).toHaveAccessibleDescription(
      "It stays spendable, but you'll be nudged to give it a job.",
    );
    fireEvent.click(screen.getByRole("radio", { name: "Keep unassigned" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(record).toHaveBeenCalledWith({ destination: "unassigned" }));
  });

  it("asks for a choice before confirming", async () => {
    const record = vi.fn();
    render(<LeftoverPrompt monthLabel="October" currentLabel="November" totalPence={25000} funds={funds} record={record} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose where your leftover goes.");
    expect(record).not.toHaveBeenCalled();
  });

  it("moves to a chosen fund, or a new one by name", async () => {
    const record = vi.fn().mockResolvedValue({});
    render(<LeftoverPrompt monthLabel="October" currentLabel="November" totalPence={25000} funds={funds} record={record} />);
    fireEvent.click(screen.getByRole("radio", { name: "Move to a fund" }));
    const select = screen.getByRole("combobox", { name: "Fund" });
    fireEvent.change(select, { target: { value: funds[0].id } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(record).toHaveBeenCalledWith({ destination: "fund", fundId: funds[0].id }));

    fireEvent.change(select, { target: { value: "new" } });
    fireEvent.change(screen.getByRole("textbox", { name: "New fund name" }), { target: { value: "Rainy day" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(record).toHaveBeenLastCalledWith({ destination: "fund", newFundName: "Rainy day" }));
  });

  it("shows the server's error", async () => {
    const record = vi.fn().mockResolvedValue({ error: "This budget has already been reviewed." });
    render(<LeftoverPrompt monthLabel="October" currentLabel="November" totalPence={25000} funds={[]} record={record} />);
    fireEvent.click(screen.getByRole("radio", { name: "Add to next budget" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This budget has already been reviewed.");
  });

  it("with nothing left over offers only Done, which records the review", async () => {
    const record = vi.fn().mockResolvedValue({});
    render(<LeftoverPrompt monthLabel="October" currentLabel="November" totalPence={0} funds={funds} record={record} />);
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(record).toHaveBeenCalledWith(null));
  });
});

describe("OverspendReview", () => {
  const current: CurrentFigures = {
    incomePence: 300000,
    savingsPence: 50000,
    allocations: [
      { categoryId: "food", kind: "need", amountPence: 40000 },
      { categoryId: "rent", kind: "need", amountPence: 200000 },
    ],
  };
  const nov = { currentLabel: "November", nextLabel: null };
  const groceries: RaiseSuggestion = { categoryId: "food", name: "Groceries", kind: "need", currentPence: 40000, suggestedPence: 42100 };

  it("lists overspent categories with the amount over, and says overspending isn't carried forward", () => {
    render(
      <OverspendReview
        monthLabel="October"
        raiseApplies={nov}
        overspent={[{ categoryId: "food", name: "Groceries", overPence: 3000 }]}
        suggestions={[]}
        current={current}
        apply={vi.fn()}
      />,
    );
    const list = screen.getByRole("list", { name: "Over budget in October" });
    expect(within(list).getByText("Groceries")).toBeInTheDocument();
    expect(within(list).getByText("£30.00")).toBeInTheDocument();
    expect(screen.getByText("Overspending isn't carried forward.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /raise/i })).not.toBeInTheDocument();
  });

  it("says when nothing went over", () => {
    render(<OverspendReview monthLabel="October" raiseApplies={nov} overspent={[]} suggestions={[]} current={current} apply={vi.fn()} />);
    expect(screen.getByText("Nothing went over budget in October.")).toBeInTheDocument();
  });

  it("suggests a raise with an editable amount pre-filled, and shows its effect on the total", () => {
    render(<OverspendReview monthLabel="October" raiseApplies={nov} overspent={[]} suggestions={[groceries]} current={current} apply={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: "New Groceries budget" });
    expect(input).toHaveValue("421.00");
    // Pool £2,500, allocated £2,400: £100 unallocated, £79 after the raise.
    expect(screen.getByText(/unallocated/i).closest("p")).toHaveTextContent("Unallocated money: £100.00 → £79.00");
    fireEvent.change(input, { target: { value: "550" } });
    expect(screen.getByText(/over-allocated/i).closest("p")).toHaveTextContent("Your budget would be over-allocated by £50.00");
  });

  it("says which budgets the raise applies to: the current one, and the planned next one when there is one", () => {
    const { rerender } = render(
      <OverspendReview monthLabel="October" raiseApplies={nov} overspent={[]} suggestions={[groceries]} current={current} apply={vi.fn()} />,
    );
    expect(screen.getByText("Applies to your November budget and the ones after it.")).toBeInTheDocument();
    rerender(
      <OverspendReview
        monthLabel="October"
        raiseApplies={{ currentLabel: "November", nextLabel: "December" }}
        overspent={[]}
        suggestions={[groceries]}
        current={current}
        apply={vi.fn()}
      />,
    );
    expect(screen.getByText("Applies to November and your planned December budget.")).toBeInTheDocument();
  });

  it("applies the edited amount and confirms it", async () => {
    const apply = vi.fn().mockResolvedValue({});
    render(<OverspendReview monthLabel="October" raiseApplies={nov} overspent={[]} suggestions={[groceries]} current={current} apply={apply} />);
    fireEvent.change(screen.getByRole("textbox", { name: "New Groceries budget" }), { target: { value: "430" } });
    fireEvent.click(screen.getByRole("button", { name: "Raise Groceries to £430.00" }));
    await waitFor(() => expect(apply).toHaveBeenCalledWith("food", 43000));
    expect(await screen.findByText("Groceries is now £430.00 from this budget on.")).toBeInTheDocument();
  });

  it("keeps the confirmation when the refreshed page no longer suggests the raise", async () => {
    const apply = vi.fn().mockResolvedValue({});
    const props = { monthLabel: "October", raiseApplies: nov, overspent: [], current, apply };
    const { rerender } = render(<OverspendReview {...props} suggestions={[groceries]} />);
    fireEvent.click(screen.getByRole("button", { name: "Raise Groceries to £421.00" }));
    await screen.findByText("Groceries is now £421.00 from this budget on.");
    rerender(<OverspendReview {...props} suggestions={[]} />);
    expect(screen.getByText("Groceries is now £421.00 from this budget on.")).toBeInTheDocument();
  });
});

describe("BudgetOverview review states", () => {
  const period: Period = { start: "2026-11-01", end: "2026-11-30", nextStart: "2026-12-01" };
  const noSaving: SavingView = { funds: [], waiting: [] };
  const summary: BudgetSummary = {
    poolPence: 250000,
    spentPence: 0,
    leftToSpendPence: 275000,
    needsLeftPence: 0,
    unallocatedPence: 250000,
    overAllocatedPence: 0,
    daysLeft: 10,
    safeToSpendPerDayPence: 27500,
    categories: [],
    status: "on_track",
  };
  const base = { period, summary, categories: [], saving: noSaving, today: "2026-11-21", tab: "spending" as const };

  it("links to the review while an ended period waits for one", () => {
    render(<BudgetOverview {...base} review={{ pending: { periodId: "p", monthLabel: "October" }, carried: [], nudgePence: null }} />);
    expect(screen.getByText("Your October budget has ended.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review it" })).toHaveAttribute("href", "/review");
  });

  it("labels money carried in, and nudges to give unassigned money a job until dismissed", async () => {
    reviewActions.dismissNudgeAction.mockResolvedValue(undefined);
    render(
      <>
        <h1 id="budget-heading" tabIndex={-1}>
          Budget
        </h1>
        <BudgetOverview
          {...base}
          review={{ pending: null, carried: [{ fromLabel: "October", amountPence: 25000 }], nudgePence: 25000 }}
        />
      </>,
    );
    expect(screen.getByText(/carried from October/).closest("p")).toHaveTextContent("Includes £250.00 carried from October");
    const nudge = screen.getByRole("region", { name: "Give every pound a job" });
    expect(within(nudge).getByRole("link", { name: "Edit budget" })).toHaveAttribute("href", "/budget/edit");
    expect(within(nudge).getByRole("link", { name: "Add to a fund" })).toHaveAttribute("href", "/budget?tab=saving");
    fireEvent.click(within(nudge).getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(reviewActions.dismissNudgeAction).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("region", { name: "Give every pound a job" })).not.toBeInTheDocument());
    // Focus moves to the Budget heading, not the page body.
    expect(screen.getByRole("heading", { name: "Budget", level: 1 })).toHaveFocus();
  });

  it("shows no review notice, carry line or nudge when there is nothing to say", () => {
    render(<BudgetOverview {...base} review={{ pending: null, carried: [], nudgePence: null }} />);
    expect(screen.queryByText(/has ended/)).not.toBeInTheDocument();
    expect(screen.queryByText(/carried from/)).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Give every pound a job" })).not.toBeInTheDocument();
  });
});

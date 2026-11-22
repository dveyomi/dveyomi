import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BudgetSummary, CategoryFigure, Period } from "@/lib/calc";
import type { SavingView } from "@/lib/data/funds";
import type { CategoryRow } from "@/lib/data/types";
const actions = vi.hoisted(() => ({
  renameCategoryAction: vi.fn(),
  deleteCategoryAction: vi.fn(),
  removeFromBudgetAction: vi.fn(),
}));
vi.mock("@/app/(app)/budget/actions", () => actions);
vi.mock("@/app/(app)/budget/fundActions", () => ({ confirmSavingsAction: vi.fn(), saveFundAction: vi.fn(), addFundMovementAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import { BudgetOverview } from "./BudgetOverview";
import { CategoryDetail } from "./CategoryDetail";

const period: Period = { start: "2026-11-01", end: "2026-11-30", nextStart: "2026-12-01" };
const noSaving: SavingView = { funds: [], waiting: [] };

function category(id: string, name: string, kind: "need" | "want"): CategoryRow {
  return { id, name, kind, icon: null, colour: null, user_id: "u1" };
}
const categories = [
  category("rent", "Rent", "need"),
  category("food", "Groceries", "need"),
  category("fun", "Going out", "want"),
  category("gifts", "Gifts", "want"),
];

function fig(over: Partial<CategoryFigure> & Pick<CategoryFigure, "categoryId">): CategoryFigure {
  return { kind: "want", allocatedPence: 0, spentPence: 0, leftPence: 0, overPence: 0, noBudget: false, ...over };
}

function summary(over: Partial<BudgetSummary> = {}): BudgetSummary {
  return {
    poolPence: 250000,
    spentPence: 0,
    leftToSpendPence: 250000,
    needsLeftPence: 150000,
    unallocatedPence: 0,
    overAllocatedPence: 0,
    daysLeft: 10,
    safeToSpendPerDayPence: 10000,
    categories: [
      fig({ categoryId: "rent", kind: "need", allocatedPence: 150000, leftPence: 150000 }),
      fig({ categoryId: "fun", kind: "want", allocatedPence: 100000, leftPence: 100000 }),
    ],
    status: "on_track",
    ...over,
  };
}

/** The element whose own text (across child elements) is exactly `text`. */
function byText(text: string): HTMLElement {
  return screen.getByText((_, el) => {
    if (!el || el.textContent !== text) return false;
    return ![...el.children].some((child) => child.textContent === text);
  });
}

function cardFor(name: string): HTMLElement {
  return screen.getByRole("link", { name: new RegExp(`^${name}`) });
}

describe("BudgetOverview", () => {
  it("without a budget shows only the set-up empty state: no £0 and no On Track", () => {
    const { container } = render(<BudgetOverview period={period} summary={null} categories={categories} saving={noSaving} today="2026-11-21" tab="spending" />);
    expect(screen.getByRole("heading", { name: "Set up your budget" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /set up your budget/i })).toHaveAttribute("href", "/onboarding");
    expect(container.textContent).not.toMatch(/£0/);
    expect(container.textContent).not.toMatch(/On Track/i);
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });

  it("with no expenses shows the full pool as Left to spend and On Track", () => {
    render(<BudgetOverview period={period} summary={summary()} categories={categories} saving={noSaving} today="2026-11-21" tab="spending" />);
    const gauge = screen.getByRole("meter", { name: /left to spend/i });
    expect(within(gauge).getByText("£2,500.00")).toBeInTheDocument();
    expect(gauge).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("On Track")).toBeInTheDocument();
    expect(byText("£1,500.00 left of £1,500.00")).toBeInTheDocument();
  });

  it("shows the period dates, the next budget date and a Set new budget link", () => {
    render(<BudgetOverview period={period} summary={summary()} categories={categories} saving={noSaving} today="2026-11-21" tab="spending" />);
    expect(screen.getByText("1 Nov – 30 Nov")).toBeInTheDocument();
    expect(byText("Next budgetTue 1 Dec")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set new budget" })).toHaveAttribute("href", "/budget/edit");
  });

  it("confirms a saved budget or a deleted category after returning from the editor", () => {
    const { rerender } = render(
      <BudgetOverview period={period} summary={summary()} categories={categories} saving={noSaving} today="2026-11-21" tab="spending" notice="saved" />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Budget saved.");
    rerender(<BudgetOverview period={period} summary={summary()} categories={categories} saving={noSaving} today="2026-11-21" tab="spending" notice="deleted" />);
    expect(screen.getByRole("status")).toHaveTextContent("Category deleted.");
    rerender(<BudgetOverview period={period} summary={summary()} categories={categories} saving={noSaving} today="2026-11-21" tab="spending" />);
    expect(screen.queryByText(/saved|deleted/)).not.toBeInTheDocument();
  });

  it("clears ?saved from the address once shown, keeping other parameters", () => {
    window.history.replaceState(null, "", "/budget?saved=1&tab=saving");
    render(<BudgetOverview period={period} summary={summary()} categories={categories} saving={noSaving} today="2026-11-21" tab="saving" notice="saved" />);
    expect(window.location.search).toBe("?tab=saving");
    // The Saving tab has its own (empty) status line too.
    expect(screen.getByText("Budget saved.").closest('[role="status"]')).not.toBeNull();
    window.history.replaceState(null, "", "/");
  });

  it("shows the reference safe to spend per day in the gauge", () => {
    const ref = summary({
      poolPence: 600000,
      spentPence: 169822,
      leftToSpendPence: 430178,
      needsLeftPence: 0,
      daysLeft: 5,
      safeToSpendPerDayPence: 86036,
      categories: [],
    });
    render(<BudgetOverview period={period} summary={ref} categories={categories} saving={noSaving} today="2026-11-21" tab="spending" />);
    const gauge = screen.getByRole("meter", { name: /left to spend/i });
    expect(within(gauge).getByText("£4,301.78")).toBeInTheDocument();
    expect(within(gauge).getByText("5 days left")).toBeInTheDocument();
    // The gauge card: safe to spend per day sits under the arc.
    const card = screen.getByRole("region", { name: "This period" });
    expect(byText("Safe to spend per day£860.36")).toBeInTheDocument();
    expect(within(card).getByText("£860.36")).toBeInTheDocument();
  });

  it("explains the safe to spend formula behind the info button", () => {
    render(<BudgetOverview period={period} summary={summary()} categories={categories} saving={noSaving} today="2026-11-21" tab="spending" />);
    fireEvent.click(screen.getByRole("button", { name: /how safe to spend/i }));
    const sheet = screen.getByRole("dialog", { name: "Safe to spend per day" });
    expect(sheet).toHaveTextContent("(total left − Needs left) ÷ days left, counting today");
    expect(sheet).toHaveTextContent(/unspent Needs stay reserved/i);
  });

  it("shows an overspent need as £X over in red with a red, full bar", () => {
    const s = summary({
      spentPence: 170000,
      leftToSpendPence: 80000,
      needsLeftPence: 0,
      categories: [
        fig({ categoryId: "rent", kind: "need", allocatedPence: 150000, spentPence: 170000, leftPence: -20000, overPence: 20000 }),
        fig({ categoryId: "fun", kind: "want", allocatedPence: 100000, leftPence: 100000 }),
      ],
    });
    render(<BudgetOverview period={period} summary={s} categories={categories} saving={noSaving} today="2026-11-21" tab="spending" />);
    const card = cardFor("Rent");
    const over = within(card).getByText((_, el) => el?.textContent === "£200.00 over" && el.tagName === "P");
    expect(over).toHaveClass("text-danger-fg");
    const bar = within(card).getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    expect(bar).toHaveAttribute("aria-valuetext", "Over budget");
  });

  it("shows spending with no allocation as no budget yet", () => {
    const s = summary({
      categories: [
        ...summary().categories,
        fig({ categoryId: "gifts", kind: null, noBudget: true, spentPence: 2500, leftPence: -2500, overPence: 2500 }),
      ],
    });
    render(<BudgetOverview period={period} summary={s} categories={categories} saving={noSaving} today="2026-11-21" tab="spending" />);
    const card = cardFor("Gifts");
    expect(within(card).getByText(/no budget yet/i)).toBeInTheDocument();
    expect(within(card).queryByText(/over/)).not.toBeInTheDocument();
    expect(card.textContent).toContain("£25.00 spent");
  });

  it("over-allocated: red state, Over budget by £X, and every card keeps its true figure", () => {
    const s = summary({
      poolPence: 250000,
      spentPence: 255000,
      leftToSpendPence: -5000,
      needsLeftPence: 499500,
      overAllocatedPence: 400000,
      safeToSpendPerDayPence: -50450,
      status: "out_of_budget",
      categories: [
        fig({ categoryId: "rent", kind: "need", allocatedPence: 500000, spentPence: 500, leftPence: 499500 }),
        fig({ categoryId: "fun", kind: "want", allocatedPence: 150000, spentPence: 254500, leftPence: -104500, overPence: 104500 }),
      ],
    });
    const { container } = render(<BudgetOverview period={period} summary={s} categories={categories} saving={noSaving} today="2026-11-21" tab="spending" />);
    expect(byText("Over budget by £50.00")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: /left to spend/i })).toHaveAttribute(
      "aria-valuetext",
      "Over budget by £50.00",
    );
    const notice = byText("Your allocations are £4,000.00 more than your spending money.");
    expect(notice.closest("[data-tone='danger']")).not.toBeNull();
    expect(byText("£4,995.00 left of £5,000.00")).toBeInTheDocument();
    expect(container.textContent).not.toContain("£0.00 left");
    expect(screen.getByText("Out of Budget")).toBeInTheDocument();
  });

  it("shows £0.00 a day when safe to spend is below zero, with the gauge over budget and Out of Budget", () => {
    const s = summary({
      spentPence: 255000,
      leftToSpendPence: -5000,
      needsLeftPence: 150000,
      safeToSpendPerDayPence: -15500,
      status: "out_of_budget",
    });
    render(<BudgetOverview period={period} summary={s} categories={categories} saving={noSaving} today="2026-11-21" tab="spending" />);
    expect(byText("Safe to spend per day£0.00")).toBeInTheDocument();
    expect(screen.queryByText("-£155.00")).not.toBeInTheDocument();
    expect(byText("Over budget by £50.00")).toBeInTheDocument();
    expect(screen.getByText("Out of Budget")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /how safe to spend/i }));
    const sheet = screen.getByRole("dialog", { name: "Safe to spend per day" });
    expect(sheet).toHaveTextContent(/Needs left is more than your total left, so nothing is safe to spend: it shows £0.00 a day/);
  });

  it("shows £0.00 a day even while money is left, when Needs left is more than it", () => {
    const s = summary({ leftToSpendPence: 100000, needsLeftPence: 150000, safeToSpendPerDayPence: -5000, status: "out_of_budget" });
    render(<BudgetOverview period={period} summary={s} categories={categories} saving={noSaving} today="2026-11-21" tab="spending" />);
    expect(byText("Safe to spend per day£0.00")).toBeInTheDocument();
    expect(screen.getByText("Out of Budget")).toBeInTheDocument();
  });

  it("doesn't explain £0.00 a day while safe to spend is positive", () => {
    render(<BudgetOverview period={period} summary={summary()} categories={categories} saving={noSaving} today="2026-11-21" tab="spending" />);
    fireEvent.click(screen.getByRole("button", { name: /how safe to spend/i }));
    expect(screen.getByRole("dialog", { name: "Safe to spend per day" })).not.toHaveTextContent(/nothing is safe to spend/);
  });

  it("lists later changes to this period's money under the gauge", () => {
    render(
      <BudgetOverview
        period={period}
        summary={summary()}
        categories={categories}
        saving={noSaving}
        today="2026-11-21"
        tab="spending"
        review={{
          pending: null,
          carried: [],
          nudgePence: null,
          adjustments: [
            { kind: "late_change", label: "Adjustment for October", amountPence: -4000 },
            { kind: "from_fund", label: "from Emergency fund", amountPence: 10000 },
          ],
        }}
      />,
    );
    const card = screen.getByRole("region", { name: "This period" });
    expect(within(card).getByText("Adjustment for October: −£40.00")).toBeInTheDocument();
    expect(within(card).getByText("+£100.00 from Emergency fund")).toBeInTheDocument();
  });

  it("links each allocation card to its category detail", () => {
    render(<BudgetOverview period={period} summary={summary()} categories={categories} saving={noSaving} today="2026-11-21" tab="spending" />);
    expect(cardFor("Rent")).toHaveAttribute("href", "/budget/rent");
    expect(cardFor("Going out")).toHaveAttribute("href", "/budget/fun");
  });

  it("opens the Saving tab with the funds and the savings waiting to be moved", () => {
    const saving: SavingView = {
      funds: [],
      waiting: [{ periodId: "nov", start: "2026-11-01", end: "2026-11-30", savingsPence: 30000, prefill: [], prefillFrom: "none" }],
    };
    render(<BudgetOverview period={period} summary={summary()} categories={categories} saving={saving} today="2026-11-21" tab="saving" />);
    expect(screen.getByRole("tab", { name: "Saving" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("waiting to be moved", { exact: false }).textContent).toBe("£300.00 waiting to be moved");
    expect(screen.getByRole("heading", { name: "No funds yet" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Rent/ })).not.toBeInTheDocument();
  });

  it("switches tabs and records the tab in the URL", () => {
    render(<BudgetOverview period={period} summary={summary()} categories={categories} saving={noSaving} today="2026-11-21" tab="spending" />);
    fireEvent.click(screen.getByRole("tab", { name: "Saving" }));
    expect(screen.getByRole("heading", { name: "No funds yet" })).toBeInTheDocument();
    expect(window.location.search).toBe("?tab=saving");
    fireEvent.click(screen.getByRole("tab", { name: "Spending" }));
    expect(window.location.search).toBe("");
  });
});

const travel = category("travel", "Travel", "want");
const travelFigure = fig({ categoryId: "travel", kind: "want", allocatedPence: 500000, spentPence: 10000, leftPence: 490000 });
const txns = [
  { id: "t3", name: "Train", amountPence: 4000, date: "2026-11-20", fundName: null },
  { id: "t2", name: "Flights", amountPence: 30000, date: "2026-11-12", fundName: "Holiday" },
  { id: "t1", name: "Taxi", amountPence: 6000, date: "2026-11-03", fundName: null },
];

describe("CategoryDetail", () => {
  beforeEach(() => Object.values(actions).forEach((a) => a.mockReset()));

  it("shows Budget, Spent, Next budget, percent left, £X left and days left", () => {
    render(<CategoryDetail inUse={null} period={period} category={travel} figure={travelFigure} daysLeft={4} transactions={txns} />);
    expect(screen.getByRole("heading", { name: "Travel" })).toBeInTheDocument();
    expect(screen.getByText("1 Nov – 30 Nov")).toBeInTheDocument();
    expect(byText("Budget£5,000.00")).toBeInTheDocument();
    expect(byText("Spent£100.00")).toBeInTheDocument();
    expect(byText("Next budgetTue 1 Dec")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: /travel/i });
    expect(bar).toHaveAttribute("aria-valuenow", "98");
    expect(screen.getByText("98% left")).toBeInTheDocument();
    expect(byText("£4,900.00 left")).toBeInTheDocument();
    expect(screen.getByText("4 days left")).toBeInTheDocument();
  });

  it("lists the expenses in the given order, tagging fund-paid ones", () => {
    render(<CategoryDetail inUse={null} period={period} category={travel} figure={travelFigure} daysLeft={4} transactions={txns} />);
    const list = screen.getByRole("list", { name: /expenses/i });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining("Train"),
      expect.stringContaining("Flights"),
      expect.stringContaining("Taxi"),
    ]);
    expect(items[1]).toHaveTextContent("from Holiday");
    expect(items[1]).toHaveTextContent("Thu 12 Nov");
    expect(items[0]).not.toHaveTextContent("from");
  });

  it("logs an expense with the category chosen", () => {
    render(<CategoryDetail inUse={null} period={period} category={travel} figure={travelFigure} daysLeft={4} transactions={txns} />);
    expect(screen.getByRole("link", { name: /log expense/i })).toHaveAttribute("href", "/expenses/new?category=travel&returnTo=/budget/travel");
  });

  it("offers Edit budget in the ⋯ menu", () => {
    render(<CategoryDetail inUse={null} period={period} category={travel} figure={travelFigure} daysLeft={4} transactions={txns} />);
    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    const menu = screen.getByRole("dialog", { name: "Travel" });
    expect(within(menu).getByRole("link", { name: "Edit budget" })).toHaveAttribute("href", "/budget/edit?category=travel");
  });

  it("offers Rename in the ⋯ menu: a sheet with the name, saved through the server", async () => {
    actions.renameCategoryAction.mockResolvedValue(undefined);
    render(<CategoryDetail inUse={null} period={period} category={travel} figure={travelFigure} daysLeft={4} transactions={txns} />);
    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Travel" })).getByRole("button", { name: "Rename" }));
    const sheet = screen.getByRole("dialog", { name: "Rename category" });
    const field = within(sheet).getByLabelText("Name");
    expect(field).toHaveValue("Travel");
    expect(field).toHaveAttribute("maxLength", "50");
    fireEvent.change(field, { target: { value: "Trains" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(actions.renameCategoryAction).toHaveBeenCalledWith("travel", "Trains"));
  });

  it("shows the server's rename error in the sheet", async () => {
    actions.renameCategoryAction.mockResolvedValue({ error: "You already have a category called Rent." });
    render(<CategoryDetail inUse={null} period={period} category={travel} figure={travelFigure} daysLeft={4} transactions={txns} />);
    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Rent" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("You already have a category called Rent.")).toBeInTheDocument();
  });

  it("Delete asks first, then deletes a category that was never used", async () => {
    actions.deleteCategoryAction.mockResolvedValue(undefined);
    render(<CategoryDetail inUse={null} period={period} category={travel} figure={travelFigure} daysLeft={4} transactions={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    fireEvent.click(screen.getByRole("button", { name: "Delete category" }));
    const dialog = screen.getByRole("alertdialog", { name: "Delete Travel?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(actions.deleteCategoryAction).toHaveBeenCalledWith("travel"));
  });

  it("Delete on a category with expenses explains why and offers Remove from budget instead", async () => {
    actions.removeFromBudgetAction.mockResolvedValue(undefined);
    render(<CategoryDetail inUse="expenses" period={period} category={travel} figure={travelFigure} daysLeft={4} transactions={txns} />);
    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    fireEvent.click(screen.getByRole("button", { name: "Delete category" }));
    const dialog = screen.getByRole("alertdialog", { name: "Travel is in use" });
    expect(dialog).toHaveTextContent(/it has expenses/i);
    expect(dialog).toHaveTextContent(/past spending keeps its category/i);
    expect(within(dialog).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove from budget" }));
    await waitFor(() => expect(actions.removeFromBudgetAction).toHaveBeenCalledWith("travel"));
    expect(actions.deleteCategoryAction).not.toHaveBeenCalled();
  });

  it.each([
    ["recurring", /a recurring payment/i],
    ["history", /past budgets/i],
  ] as const)("names the reason (%s) and, with no budget now, offers no Remove from budget", (inUse, reason) => {
    render(<CategoryDetail inUse={inUse} period={period} category={travel} figure={null} daysLeft={4} transactions={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    fireEvent.click(screen.getByRole("button", { name: "Delete category" }));
    const dialog = screen.getByRole("alertdialog", { name: "Travel is in use" });
    expect(dialog).toHaveTextContent(reason);
    expect(within(dialog).queryByRole("button", { name: "Remove from budget" })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "OK" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("shows an overspent category as £X over in red with a red, full bar", () => {
    const over = fig({ categoryId: "travel", allocatedPence: 10000, spentPence: 20000, leftPence: -10000, overPence: 10000 });
    render(<CategoryDetail inUse={null} period={period} category={travel} figure={over} daysLeft={4} transactions={txns} />);
    expect(byText("£100.00 over")).toHaveClass("text-danger-fg");
    const bar = screen.getByRole("progressbar", { name: /travel/i });
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    expect(bar).toHaveAttribute("aria-valuetext", "Over budget");
    expect(screen.queryByText(/% left/)).not.toBeInTheDocument();
  });

  it("shows no budget yet for a category without an allocation", () => {
    render(<CategoryDetail inUse={null} period={period} category={travel} figure={null} daysLeft={4} transactions={[]} />);
    expect(screen.getByText(/no budget yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText(/expenses in this category this period will show here/i)).toBeInTheDocument();
  });

  it("shows one day left in the singular", () => {
    render(<CategoryDetail inUse={null} period={period} category={travel} figure={travelFigure} daysLeft={1} transactions={[]} />);
    expect(screen.getByText("1 day left")).toBeInTheDocument();
  });
});

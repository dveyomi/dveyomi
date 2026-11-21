import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExpenseTxn, ExpensesView } from "@/lib/data/expenses";

const actions = vi.hoisted(() => ({ removeExpenseAction: vi.fn() }));
vi.mock("@/app/(app)/expenses/actions", () => actions);
const recurringActions = vi.hoisted(() => ({ confirmOccurrenceAction: vi.fn() }));
vi.mock("@/app/(app)/expenses/recurring/actions", () => recurringActions);
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { ExpensesOverview } from "./ExpensesOverview";

const TODAY = "2026-11-21";
const categories = [
  { id: "food", name: "Groceries", kind: "need" as const },
  { id: "music", name: "Music", kind: "want" as const },
  { id: "travel", name: "Travel", kind: "want" as const },
];
const catName = Object.fromEntries(categories.map((c) => [c.id, c]));

function txn(
  id: string,
  name: string,
  amountPence: number,
  date: string,
  categoryId: string,
  extra: Partial<ExpenseTxn> = {},
): ExpenseTxn {
  return {
    id,
    name,
    amountPence,
    date,
    categoryId,
    categoryName: catName[categoryId].name,
    categoryKind: catName[categoryId].kind,
    fundId: null,
    fundName: null,
    unchecked: false,
    ...extra,
  };
}

const NOVEMBER = {
  month: "2026-11",
  current: { start: "2026-11-01", end: "2026-11-30", nextStart: "2026-12-01" },
  previous: { start: "2026-10-01", end: "2026-10-31", nextStart: "2026-11-01" },
};

const PERIOD_WINDOW = {
  month: "2026-10",
  current: { start: "2026-10-25", end: "2026-11-24", nextStart: "2026-11-25" },
  previous: { start: "2026-09-25", end: "2026-10-24", nextStart: "2026-10-25" },
};

const standard = [
  txn("t3", "Spotify", 1199, "2026-11-10", "music", { unchecked: true }),
  txn("t1", "Tesco", 1250, "2026-11-03", "food"),
  txn("t2", "Taxi", 500, "2026-11-03", "travel", { fundId: "holiday", fundName: "Holiday" }),
  txn("t0", "October shop", 1000, "2026-10-05", "food"),
];

function view(transactions: ExpenseTxn[], over: Partial<ExpensesView> = {}): ExpensesView {
  return { range: "month", window: NOVEMBER, transactions, categories, ...over };
}

function renderOverview(transactions = standard, opts: { initialView?: "calendar" | "analytics"; over?: Partial<ExpensesView> } = {}) {
  return render(
    <ExpensesOverview data={view(transactions, opts.over)} today={TODAY} initialView={opts.initialView ?? "calendar"} />,
  );
}

const dayCell = (label: RegExp) => screen.getByRole("button", { name: label });
/** The element whose whole text is exactly `text` (text split across child elements included). */
const byText = (text: string) => (_: string, el: Element | null) =>
  el?.textContent === text && ![...el.children].some((child) => child.textContent === text);
const comparison = (unit = "month") => screen.getByRole("region", { name: `Compared with last ${unit}` });

beforeEach(() => {
  actions.removeExpenseAction.mockReset();
  router.push.mockReset();
  router.refresh.mockReset();
  window.history.replaceState(null, "", "/expenses");
});

describe("Calendar", () => {
  it("shows a day's total in its cell: 1250 + 500 reads £17.50", () => {
    renderOverview();
    const cell = dayCell(/^Tuesday 3 November/);
    // The phone label itself (the desktop one sits beside it, hidden under 768px).
    expect(cell.querySelector("[data-amount='phone']")).toHaveTextContent(/^£17\.50$/);
    expect(cell).toHaveAccessibleName("Tuesday 3 November: £17.50 spent, 2 expenses");
  });

  it("counts a fund-paid expense in the day total and in the category chart", () => {
    renderOverview([txn("t2", "Taxi", 500, "2026-11-03", "travel", { fundId: "h", fundName: "Holiday" })]);
    expect(dayCell(/^Tuesday 3 November/)).toHaveTextContent("£5.00");
    const chart = screen.getAllByRole("table", { name: "Spending by category" })[0];
    expect(within(chart).getByRole("row", { name: /Travel/ })).toHaveTextContent("Travel£5.00100%");
  });

  it("leaves a day with no expenses blank and marks today", () => {
    renderOverview();
    const empty = dayCell(/^Wednesday 4 November/);
    expect(empty).toHaveAccessibleName("Wednesday 4 November: no expenses");
    expect(empty).not.toHaveTextContent("£");
    expect(dayCell(/^Saturday 21 November/)).toHaveAttribute("aria-current", "date");
  });

  it("shows the window total and month arrows that keep the range", () => {
    renderOverview();
    expect(screen.getByRole("heading", { name: "November 2026" })).toBeInTheDocument();
    expect(screen.getAllByText("£29.49").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Previous month" })).toHaveAttribute("href", "/expenses?month=2026-10");
    expect(screen.getByRole("link", { name: "Next month" })).toHaveAttribute("href", "/expenses?month=2026-12");
  });

  it("in budget-period range, names the period and steps by period", () => {
    renderOverview(standard, {
      over: {
        range: "period",
        window: {
          month: "2026-10",
          current: { start: "2026-10-25", end: "2026-11-24", nextStart: "2026-11-25" },
          previous: { start: "2026-09-25", end: "2026-10-24", nextStart: "2026-10-25" },
        },
      },
    });
    expect(screen.getByRole("heading", { name: "25 Oct – 24 Nov" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous period" })).toHaveAttribute(
      "href",
      "/expenses?range=period&month=2026-09",
    );
  });

  it("switching to budget periods navigates to the current period", () => {
    renderOverview();
    fireEvent.click(screen.getByRole("radio", { name: "Budget period" }));
    expect(router.push).toHaveBeenCalledWith("/expenses?range=period");
  });

  it("with no expenses this month still renders the calendar, with an empty state under it", () => {
    renderOverview([txn("t0", "October shop", 1000, "2026-10-05", "food")]);
    expect(dayCell(/^Sunday 1 November/)).toBeInTheDocument();
    expect(screen.getByText("No expenses this month")).toBeInTheDocument();
  });

  it("lists the latest expenses under the calendar, newest first", () => {
    renderOverview();
    const latest = screen.getByRole("list", { name: "Latest expenses" });
    expect(within(latest).getAllByRole("listitem").map((li) => within(li).getAllByRole("link")[0].textContent)).toEqual([
      expect.stringContaining("Spotify"),
      expect.stringContaining("Tesco"),
      expect.stringContaining("Taxi"),
    ]);
  });
});

describe("Day sheet", () => {
  function openDay() {
    renderOverview();
    fireEvent.click(dayCell(/^Tuesday 3 November/));
    return screen.getByRole("dialog", { name: "Tuesday 3 November" });
  }

  it('lists the day\'s expenses; a fund-paid one reads "Travel · from Holiday"', () => {
    const sheet = openDay();
    expect(within(sheet).getByText("Travel · from Holiday")).toBeInTheDocument();
    expect(within(sheet).getByText("Groceries")).toBeInTheDocument();
    expect(within(sheet).getByText("£17.50")).toBeInTheDocument();
  });

  it("adds an expense on that day and edits one, returning to this view", () => {
    const sheet = openDay();
    expect(within(sheet).getByRole("link", { name: "Add expense" })).toHaveAttribute(
      "href",
      "/expenses/new?date=2026-11-03&returnTo=%2Fexpenses%3Fmonth%3D2026-11",
    );
    expect(within(sheet).getByRole("link", { name: /Taxi/ })).toHaveAttribute(
      "href",
      "/expenses/t2?returnTo=%2Fexpenses%3Fmonth%3D2026-11",
    );
  });

  it("deletes after confirming, through the server action", async () => {
    actions.removeExpenseAction.mockResolvedValue({});
    const sheet = openDay();
    fireEvent.click(within(sheet).getByRole("button", { name: "Delete Taxi" }));
    const confirm = screen.getByRole("alertdialog", { name: "Delete this expense?" });
    await act(async () => {
      fireEvent.click(within(confirm).getByRole("button", { name: "Delete" }));
    });
    expect(actions.removeExpenseAction).toHaveBeenCalledWith("t2");
    expect(router.refresh).toHaveBeenCalled();
    expect(within(sheet).getByRole("status")).toHaveTextContent("Taxi deleted");
  });

  it("shows the action's error and keeps the expense", async () => {
    actions.removeExpenseAction.mockResolvedValue({ error: "This expense no longer exists." });
    const sheet = openDay();
    fireEvent.click(within(sheet).getByRole("button", { name: "Delete Taxi" }));
    await act(async () => {
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    });
    expect(within(screen.getByRole("dialog", { name: "Tuesday 3 November" })).getByRole("alert")).toHaveTextContent(
      "This expense no longer exists.",
    );
  });

  it("a failed connection shows an error and lets the user try again", async () => {
    actions.removeExpenseAction.mockRejectedValue(new Error("Failed to fetch"));
    const sheet = openDay();
    fireEvent.click(within(sheet).getByRole("button", { name: "Delete Taxi" }));
    await act(async () => {
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    });
    expect(within(sheet).getByRole("alert")).toHaveTextContent("We couldn't delete this expense");
    fireEvent.click(within(sheet).getByRole("button", { name: "Delete Taxi" }));
    expect(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("after a delete, focus moves to the next row's delete button", async () => {
    actions.removeExpenseAction.mockResolvedValue({});
    const sheet = openDay();
    fireEvent.click(within(sheet).getByRole("button", { name: "Delete Tesco" }));
    await act(async () => {
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    });
    expect(within(sheet).queryByRole("button", { name: "Delete Tesco" })).toBeNull();
    expect(within(sheet).getByRole("button", { name: "Delete Taxi" })).toHaveFocus();
  });

  it("after deleting the last row, focus moves to the previous row's delete button", async () => {
    actions.removeExpenseAction.mockResolvedValue({});
    const sheet = openDay();
    fireEvent.click(within(sheet).getByRole("button", { name: "Delete Taxi" }));
    await act(async () => {
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    });
    expect(within(sheet).getByRole("button", { name: "Delete Tesco" })).toHaveFocus();
  });

  it("after deleting a day's only expense, focus moves to Add expense", async () => {
    actions.removeExpenseAction.mockResolvedValue({});
    renderOverview();
    fireEvent.click(dayCell(/^Tuesday 10 November/));
    const sheet = screen.getByRole("dialog", { name: "Tuesday 10 November" });
    fireEvent.click(within(sheet).getByRole("button", { name: "Delete Spotify" }));
    await act(async () => {
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    });
    expect(within(sheet).getByRole("link", { name: "Add expense" })).toHaveFocus();
  });

  it('marks an auto-added recurring expense "unchecked"', () => {
    renderOverview();
    fireEvent.click(dayCell(/^Tuesday 10 November/));
    const sheet = screen.getByRole("dialog", { name: "Tuesday 10 November" });
    expect(within(sheet).getByText("unchecked")).toBeInTheDocument();
  });

  it('"Mark as checked" on an unchecked expense confirms it and refreshes', async () => {
    recurringActions.confirmOccurrenceAction.mockReset().mockResolvedValue({});
    router.refresh.mockReset();
    renderOverview();
    fireEvent.click(dayCell(/^Tuesday 10 November/));
    const sheet = screen.getByRole("dialog", { name: "Tuesday 10 November" });
    await act(async () => {
      fireEvent.click(within(sheet).getByRole("button", { name: "Mark Spotify as checked" }));
    });
    expect(recurringActions.confirmOccurrenceAction).toHaveBeenCalledWith("t3");
    expect(router.refresh).toHaveBeenCalled();
    expect(within(sheet).queryByText("unchecked")).not.toBeInTheDocument();
  });

  it("an empty day offers to add one", () => {
    renderOverview();
    fireEvent.click(dayCell(/^Wednesday 4 November/));
    const sheet = screen.getByRole("dialog", { name: "Wednesday 4 November" });
    expect(within(sheet).getByText("No expenses on this day")).toBeInTheDocument();
    expect(within(sheet).getByRole("link", { name: "Add expense" })).toBeInTheDocument();
  });
});

describe("Analytics", () => {
  it("toggling to analytics shows the chart and the list, and records the view in the URL", () => {
    renderOverview();
    fireEvent.click(screen.getByRole("tab", { name: "Analytics" }));
    expect(screen.getByRole("searchbox", { name: "Search expenses" })).toBeInTheDocument();
    expect(window.location.search).toBe("?month=2026-11&view=analytics");
  });

  it("lists categories largest first with amount and share", () => {
    renderOverview(standard, { initialView: "analytics" });
    const list = screen.getByRole("list", { name: "Categories" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Groceries42%£12.50",
      "Music41%£11.99",
      "Travel17%£5.00",
    ]);
  });

  it("folds the categories past the fifth into one Other row, matching the donut", () => {
    const many = ["food", "music", "travel"].map((c, i) => txn(`m${i}`, c, 9000 - i * 1000, "2026-11-02", c));
    const extra = [
      { id: "c4", name: "Gifts", kind: "want" as const },
      { id: "c5", name: "Bills", kind: "need" as const },
      { id: "c6", name: "Books", kind: "want" as const },
      { id: "c7", name: "Pets", kind: "want" as const },
    ];
    const txns = [
      ...many,
      ...extra.map((c, i) => ({ ...txn(`e${i}`, c.name, 500 - i * 100, "2026-11-02", "food"), categoryId: c.id, categoryName: c.name })),
    ];
    renderOverview(txns, { initialView: "analytics", over: { categories: [...categories, ...extra] } });
    const rows = within(screen.getByRole("list", { name: "Categories" })).getAllByRole("listitem");
    expect(rows).toHaveLength(6);
    const other = rows[5];
    expect(other).toHaveTextContent(/^Other/);
    expect(other).toHaveTextContent("Books, Pets");
    expect(other).toHaveTextContent("£5.00");
    const chart = screen.getAllByRole("table", { name: "Spending by category" })[0];
    expect(within(chart).getByRole("row", { name: /Other/ })).toHaveTextContent("Other£5.00");
  });

  it("clears the search and filter when the month changes", () => {
    const { rerender } = renderOverview(standard, { initialView: "analytics" });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search expenses" }), { target: { value: "spot" } });
    rerender(
      <ExpensesOverview
        data={view(standard, { window: { month: "2026-10", current: NOVEMBER.previous, previous: { start: "2026-09-01", end: "2026-09-30", nextStart: "2026-10-01" } } })}
        today={TODAY}
        initialView="analytics"
      />,
    );
    expect(screen.getByRole("searchbox", { name: "Search expenses" })).toHaveValue("");
  });

  it("groups the transaction list by date, newest first, with the day total", () => {
    renderOverview(standard, { initialView: "analytics" });
    const groups = screen.getAllByRole("group");
    expect(groups.map((g) => g.getAttribute("aria-label"))).toEqual(["Tuesday 10 November", "Tuesday 3 November"]);
    expect(within(groups[1]).getByText("£17.50")).toBeInTheDocument();
  });

  it('search "spot" filters the list to Spotify', () => {
    renderOverview(standard, { initialView: "analytics" });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search expenses" }), { target: { value: "spot" } });
    const list = screen.getByRole("region", { name: "Transactions" });
    expect(within(list).getAllByRole("link").map((a) => a.textContent)).toEqual([expect.stringContaining("Spotify")]);
  });

  it("the category filter narrows the list", () => {
    renderOverview(standard, { initialView: "analytics" });
    fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: "travel" } });
    const list = screen.getByRole("region", { name: "Transactions" });
    expect(within(list).getAllByRole("link").map((a) => a.textContent)).toEqual([expect.stringContaining("Taxi")]);
  });

  it("says so when nothing matches", () => {
    renderOverview(standard, { initialView: "analytics" });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search expenses" }), { target: { value: "zzz" } });
    expect(screen.getByText("No expenses match")).toBeInTheDocument();
  });
});

describe("Comparison", () => {
  it("with no previous expenses shows an empty state and no percentage", () => {
    renderOverview(standard.filter((t) => t.date >= "2026-11-01"));
    expect(within(comparison()).getByText("No previous month to compare yet")).toBeInTheDocument();
    expect(comparison()).not.toHaveTextContent("%");
  });

  it("more spending: money and percent difference, in the danger tone", () => {
    renderOverview([txn("a", "A", 22000, "2026-11-02", "food"), txn("b", "B", 10000, "2026-10-02", "food")]);
    const line = within(comparison()).getByText(byText("£120.00 more than last month"));
    expect(line).toHaveClass("text-danger-fg");
    expect(comparison()).toHaveTextContent("+120%");
  });

  it("less spending: in the positive tone, and -0% reads 0%", () => {
    renderOverview([txn("a", "A", 10000, "2026-11-02", "food"), txn("b", "B", 10003, "2026-10-02", "food")]);
    const line = within(comparison()).getByText(byText("£0.03 less than last month"));
    expect(line).toHaveClass("text-positive-fg");
    expect(comparison()).toHaveTextContent("0%");
    expect(comparison()).not.toHaveTextContent("-0%");
  });

  it("a month that hasn't started compares nothing yet", () => {
    renderOverview([txn("b", "B", 10000, "2026-11-02", "food")], {
      over: {
        window: {
          month: "2026-12",
          current: { start: "2026-12-01", end: "2026-12-31", nextStart: "2027-01-01" },
          previous: NOVEMBER.current,
        },
      },
    });
    expect(within(comparison()).getByText("This month hasn't started yet")).toBeInTheDocument();
    expect(comparison()).not.toHaveTextContent("%");
  });

  it("in budget-period range keeps the period wording, and with no previous expenses shows its empty state", () => {
    renderOverview([txn("a", "A", 22000, "2026-11-02", "food")], { over: { range: "period", window: PERIOD_WINDOW } });
    expect(within(comparison("period")).getByText("No previous period to compare yet")).toBeInTheDocument();
    expect(comparison("period")).not.toHaveTextContent("%");
  });

  it("in budget-period range: £120.00 more than last period", () => {
    renderOverview([txn("a", "A", 22000, "2026-10-26", "food"), txn("b", "B", 10000, "2026-09-26", "food")], {
      over: { range: "period", window: PERIOD_WINDOW },
    });
    expect(within(comparison("period")).getByText(byText("£120.00 more than last period"))).toHaveClass("text-danger-fg");
  });

  it("the same: neutral", () => {
    renderOverview([txn("a", "A", 10000, "2026-11-02", "food"), txn("b", "B", 10000, "2026-10-02", "food")]);
    const line = within(comparison()).getByText("Same as last month");
    expect(line).not.toHaveClass("text-danger-fg");
    expect(line).not.toHaveClass("text-positive-fg");
  });
});

describe("Trips panel", () => {
  const taiwan = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Taiwan", place: "Taipei", startDate: "2026-12-01", endDate: "2026-12-15" };

  it("lists the latest trips with a link to all of them", () => {
    render(<ExpensesOverview data={view(standard)} today={TODAY} initialView="calendar" trips={[taiwan]} />);
    const panel = screen.getByRole("region", { name: "Trips" });
    expect(within(panel).getByRole("link", { name: /Taiwan/ })).toHaveAttribute("href", `/expenses/trips/${taiwan.id}`);
    expect(within(panel).getByRole("link", { name: "All trips" })).toHaveAttribute("href", "/expenses/trips");
  });

  it("is left out with no trips", () => {
    renderOverview();
    expect(screen.queryByRole("region", { name: "Trips" })).not.toBeInTheDocument();
  });
});

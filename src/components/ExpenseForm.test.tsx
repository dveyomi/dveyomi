import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { newExpenseValues } from "@/lib/validation/expense";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { ExpenseForm } from "./ExpenseForm";

const RENT = "11111111-1111-4111-8111-111111111111";
const GROCERIES = "22222222-2222-4222-8222-222222222222";
const GIFTS = "33333333-3333-4333-8333-333333333333";
const HOLIDAY = "44444444-4444-4444-8444-444444444444";
const categories = [
  { id: GIFTS, name: "Gifts", kind: "want" as const },
  { id: GROCERIES, name: "Groceries", kind: "need" as const },
  { id: RENT, name: "Rent", kind: "need" as const },
];
const TODAY = "2026-11-21";
const save = vi.fn();
const remove = vi.fn();

function renderNew(params: { category?: string; date?: string } = {}, funds: { id: string; name: string }[] = []) {
  return render(
    <ExpenseForm
      categories={categories}
      funds={funds}
      today={TODAY}
      initial={newExpenseValues(params, categories, TODAY)}
      returnTo="/budget"
      save={save}
    />,
  );
}

const amount = () => screen.getByLabelText("Amount");
const submit = async () => {
  await act(async () => {
    fireEvent.click(screen.getAllByRole("button", { name: "Save expense" })[0]);
  });
};
function fill(values: { amount?: string; name?: string; category?: string }) {
  if (values.amount !== undefined) fireEvent.change(amount(), { target: { value: values.amount } });
  if (values.name !== undefined) fireEvent.change(screen.getByLabelText("Name"), { target: { value: values.name } });
  if (values.category !== undefined) fireEvent.change(screen.getByLabelText("Category"), { target: { value: values.category } });
}

beforeEach(() => {
  save.mockReset().mockResolvedValue(undefined);
  remove.mockReset().mockResolvedValue(undefined);
  push.mockReset();
});

describe("ExpenseForm", () => {
  it.each(["0", "12.555", ""])('rejects the amount "%s" with an inline message and does not save', async (text) => {
    renderNew({ category: RENT });
    fill({ amount: text, name: "Tesco" });
    await submit();
    expect(amount()).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter an amount greater than £0.00, e.g. 12.50");
    expect(save).not.toHaveBeenCalled();
  });

  it('saves "£12.50" as 1250 pence with the name, category and date', async () => {
    renderNew({ category: GROCERIES });
    fill({ amount: "£12.50", name: " Tesco " });
    await submit();
    expect(save).toHaveBeenCalledWith({
      name: " Tesco ",
      amountPence: 1250,
      date: TODAY,
      category: { id: GROCERIES },
      fundId: null,
      accountLabel: "",
      notes: "",
    });
  });

  it("?category=<id> preselects the category; an unknown one leaves it to choose", () => {
    const { unmount } = renderNew({ category: RENT });
    expect(screen.getByLabelText("Category")).toHaveValue(RENT);
    unmount();
    renderNew({ category: "not-mine" });
    expect(screen.getByLabelText("Category")).toHaveValue("");
  });

  it("groups categories into Needs and Wants", () => {
    renderNew();
    const groups = screen.getByLabelText("Category").querySelectorAll("optgroup");
    expect([...groups].map((g) => [g.label, g.textContent])).toEqual([
      ["Needs", "GroceriesRent"],
      ["Wants", "Gifts"],
    ]);
  });

  it("asks for a category before saving", async () => {
    renderNew();
    fill({ amount: "5", name: "Tesco" });
    await submit();
    expect(screen.getByLabelText("Category")).toHaveAttribute("aria-invalid", "true");
    expect(save).not.toHaveBeenCalled();
  });

  it('hides "Paid from fund" when the user has no funds', () => {
    renderNew();
    expect(screen.queryByLabelText("Paid from fund")).toBeNull();
  });

  it('shows "Paid from fund" with None by default and the helper text when there are funds, and saves the fund', async () => {
    renderNew({ category: RENT }, [{ id: HOLIDAY, name: "Holiday" }]);
    const fund = screen.getByLabelText("Paid from fund");
    expect(fund).toHaveValue("");
    expect(within(fund).getByRole("option", { name: "None" })).toBeInTheDocument();
    expect(screen.getByText("Pay with money you saved in a fund. It won't count toward your budget.")).toBeInTheDocument();
    fireEvent.change(fund, { target: { value: HOLIDAY } });
    fill({ amount: "300", name: "Flights" });
    await submit();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ fundId: HOLIDAY, category: { id: RENT } }));
  });

  it('defaults the date to today, shows "Today", and "Tomorrow" when it applies', () => {
    renderNew();
    const date = screen.getByLabelText("Date");
    expect(date).toHaveValue(TODAY);
    expect(screen.getByText("Today")).toBeInTheDocument();
    fireEvent.change(date, { target: { value: "2026-11-22" } });
    expect(screen.getByText("Tomorrow")).toBeInTheDocument();
  });

  it("starts on a tapped calendar date from ?date=, and on today when it isn't a real date", () => {
    const { unmount } = renderNew({ date: "2026-11-03" });
    expect(screen.getByLabelText("Date")).toHaveValue("2026-11-03");
    expect(screen.getByText("Tuesday 3 November")).toBeInTheDocument();
    unmount();
    renderNew({ date: "2026-02-30" });
    expect(screen.getByLabelText("Date")).toHaveValue(TODAY);
  });

  it('"New category" reveals its name and Need/Want, and saves them with the expense', async () => {
    renderNew();
    expect(screen.queryByLabelText("Category name")).toBeNull();
    fill({ amount: "20", name: "Birthday", category: "new" });
    fireEvent.change(screen.getByLabelText("Category name"), { target: { value: "Presents" } });
    fireEvent.click(screen.getByRole("radio", { name: "Want" }));
    await submit();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ category: { name: "Presents", kind: "want" } }));
  });

  it("shows a server error on its field", async () => {
    save.mockResolvedValue({ error: "You already have a category called Gifts.", field: "newCategory" });
    renderNew();
    fill({ amount: "20", name: "Birthday", category: "new" });
    fireEvent.change(screen.getByLabelText("Category name"), { target: { value: "gifts" } });
    await submit();
    expect(screen.getByLabelText("Category name")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("You already have a category called Gifts.");
  });

  it("announces a failure that belongs to no field above the form", async () => {
    save.mockResolvedValue({ error: "We couldn't save this expense. Check your connection and try again." });
    renderNew({ category: RENT });
    fill({ amount: "5", name: "Tesco" });
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't save this expense.");
  });

  it("refuses a date more than a year ahead inline, without saving", async () => {
    renderNew({ category: RENT });
    fill({ amount: "5", name: "Tesco" });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2028-01-01" } });
    await submit();
    expect(screen.getByLabelText("Date")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a date within the last 10 years or the next 12 months.");
    expect(save).not.toHaveBeenCalled();
  });

  it("limits the date picker to the allowed range", () => {
    renderNew();
    expect(screen.getByLabelText("Date")).toHaveAttribute("min", "2016-11-21");
    expect(screen.getByLabelText("Date")).toHaveAttribute("max", "2027-11-21");
  });

  it("close goes back to where the form was opened from", () => {
    renderNew();
    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);
    expect(push).toHaveBeenCalledWith("/budget");
  });

  it("has no Delete Expense button when adding", () => {
    renderNew();
    expect(screen.queryByRole("button", { name: "Delete Expense" })).toBeNull();
  });
});

describe("ExpenseForm editing", () => {
  const initial = {
    name: "Tesco",
    amountText: "25.00",
    date: "2026-11-04",
    categoryId: GROCERIES,
    fundId: null,
    accountLabel: "Monzo",
    notes: "",
  };

  function renderEdit() {
    render(
      <ExpenseForm
        categories={categories}
        funds={[]}
        today={TODAY}
        initial={initial}
        returnTo="/expenses"
        save={save}
        remove={remove}
      />,
    );
  }

  it("starts from the expense and saves the changes", async () => {
    renderEdit();
    expect(screen.getByRole("heading", { name: "Edit expense" })).toBeInTheDocument();
    expect(amount()).toHaveValue("25.00");
    expect(screen.getByLabelText("Account (optional)")).toHaveValue("Monzo");
    fill({ amount: "30" });
    await submit();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: "Tesco", amountPence: 3000, date: "2026-11-04", accountLabel: "Monzo" }));
  });

  it('shows "Deleting…" on Delete while deleting, leaving the Save label alone', async () => {
    remove.mockReturnValue(new Promise(() => {}));
    renderEdit();
    fireEvent.click(screen.getByRole("button", { name: "Delete Expense" }));
    await act(async () => {
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    });
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Save expense" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Saving…" })).toBeNull();
  });

  it("deletes only after confirming", async () => {
    renderEdit();
    fireEvent.click(screen.getByRole("button", { name: "Delete Expense" }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep it" }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete Expense" }));
    await act(async () => {
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    });
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

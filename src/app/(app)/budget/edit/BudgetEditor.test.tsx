import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { saveBudgetAction } = vi.hoisted(() => ({ saveBudgetAction: vi.fn() }));
vi.mock("./actions", () => ({ saveBudgetAction }));

import { BudgetEditor } from "./BudgetEditor";

const period = { start: "2026-11-01", end: "2026-11-30", nextStart: "2026-12-01" };
const categories = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Rent", kind: "need" as const, amountPence: 150000 },
  { id: "22222222-2222-4222-8222-222222222222", name: "Groceries", kind: "need" as const, amountPence: 40000 },
  { id: "33333333-3333-4333-8333-333333333333", name: "Eating out", kind: "want" as const, amountPence: 20000 },
];

const budget = { incomePence: 300000, savingsPence: 50000, categories };
const nextBudget = {
  incomePence: 320000,
  savingsPence: 50000,
  categories: [{ ...categories[0], amountPence: 160000 }, categories[1], categories[2]],
};
const GIFTS = { id: "44444444-4444-4444-8444-444444444444", name: "Gifts", kind: "want" as const };

function renderEditor(props: Partial<Parameters<typeof BudgetEditor>[0]> = {}) {
  return render(
    <BudgetEditor period={period} budget={budget} nextBudget={null} nextDiffers={false} outside={[GIFTS]} {...props} />,
  );
}

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

describe("BudgetEditor", () => {
  beforeEach(() => saveBudgetAction.mockReset());

  it("starts from the current budget, with live figures from it", () => {
    renderEditor();
    expect(screen.getByLabelText("Monthly income")).toHaveValue("3000.00");
    expect(screen.getByLabelText("Pay yourself first")).toHaveValue("500.00");
    expect(screen.getByLabelText("Rent")).toHaveValue("1500.00");
    expect(screen.getByText("To spend each month").nextElementSibling).toHaveTextContent("£2,500.00");
    expect(screen.getByText("£400.00 left to allocate")).toBeInTheDocument();
  });

  it("shows how far allocations are over in red as they change, and Save stays enabled", () => {
    renderEditor();
    type("Rent", "2000");
    expect(screen.getByText("£100.00 over")).toHaveClass("text-danger-fg");
    expect(screen.getByRole("button", { name: "Save budget" })).toBeEnabled();
  });

  it("raising income moves the figure back under", () => {
    renderEditor();
    type("Rent", "2000");
    type("Monthly income", "3200");
    expect(screen.getByText("£100.00 left to allocate")).toBeInTheDocument();
  });

  it("keeps Needs and Wants on separate tabs", () => {
    renderEditor();
    expect(screen.queryByLabelText("Eating out")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Wants" }));
    expect(screen.getByLabelText("Eating out")).toHaveValue("200.00");
  });

  it("asks when the changes start: from this period by default, or from the next", () => {
    renderEditor();
    const scope = screen.getByRole("radiogroup", { name: "When the changes start" });
    expect(within(scope).getByRole("radio", { name: "From this period" })).toBeChecked();
    expect(screen.getByText(/past periods stay as they were/i)).toBeInTheDocument();
    fireEvent.click(within(scope).getByRole("radio", { name: "From next period" }));
    expect(within(scope).getByRole("radio", { name: "From next period" })).toBeChecked();
    expect(screen.getByText(/starts on Tue 1 Dec/i)).toBeInTheDocument();
  });

  it("saves the whole budget in pence with the chosen scope, including added and removed categories", async () => {
    saveBudgetAction.mockResolvedValue(undefined);
    renderEditor();
    type("Rent", "1550");
    click("Remove Groceries");
    type("Category name", "Gym");
    type("Amount", "30");
    click("Add category");
    fireEvent.click(screen.getByRole("radio", { name: "From next period" }));
    click("Save budget");

    await waitFor(() => expect(saveBudgetAction).toHaveBeenCalledTimes(1));
    expect(saveBudgetAction.mock.calls[0][0]).toEqual({
      incomePence: 300000,
      savingsPence: 50000,
      scope: "next",
      categories: [
        { id: categories[0].id, name: "Rent", kind: "need", amountPence: 155000 },
        { id: categories[1].id, name: "Groceries", kind: "need", amountPence: 40000, removed: true },
        { id: categories[2].id, name: "Eating out", kind: "want", amountPence: 20000 },
        { name: "Gym", kind: "need", amountPence: 3000 },
      ],
    });
  });

  it("savings already moved: explains, and switches to From next period keeping the figures typed", async () => {
    saveBudgetAction.mockResolvedValue({
      error: "This month's savings are already moved, so change them from next month.",
      savingsMoved: true,
    });
    renderEditor({ nextBudget });
    type("Pay yourself first", "600");
    click("Save budget");
    expect(await screen.findByText("This month's savings are already moved, so change them from next month.")).toBeInTheDocument();
    click("Change them from next period");
    expect(screen.getByRole("radio", { name: "From next period" })).toBeChecked();
    expect(screen.getByLabelText("Pay yourself first")).toHaveValue("600");
    expect(screen.queryByText(/already moved/)).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    click("Save budget");
    await waitFor(() => expect(saveBudgetAction).toHaveBeenCalledTimes(2));
    expect(saveBudgetAction.mock.calls[1][0]).toMatchObject({ scope: "next", savingsPence: 60000 });
  });

  it("renames a category from its edit sheet; its kind can't change there", async () => {
    saveBudgetAction.mockResolvedValue(undefined);
    renderEditor();
    click("Edit Groceries");
    const sheet = screen.getByRole("dialog", { name: "Rename category" });
    expect(within(sheet).queryByRole("radiogroup")).not.toBeInTheDocument();
    fireEvent.change(within(sheet).getByLabelText("Name"), { target: { value: "Food shop" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Done" }));
    expect(screen.getByLabelText("Food shop")).toHaveValue("400.00");

    click("Save budget");
    await waitFor(() => expect(saveBudgetAction).toHaveBeenCalled());
    expect(saveBudgetAction.mock.calls[0][0].categories[1]).toEqual({
      id: categories[1].id,
      name: "Food shop",
      kind: "need",
      amountPence: 40000,
    });
  });

  it("adding the name of a category outside the budget brings it back with its own kind", async () => {
    saveBudgetAction.mockResolvedValue(undefined);
    renderEditor();
    type("Category name", "gifts");
    type("Amount", "25");
    click("Add category");
    fireEvent.click(screen.getByRole("tab", { name: "Wants" }));
    expect(screen.getByLabelText("Gifts")).toHaveValue("25");
    click("Save budget");
    await waitFor(() => expect(saveBudgetAction).toHaveBeenCalled());
    expect(saveBudgetAction.mock.calls[0][0].categories[3]).toEqual({ id: GIFTS.id, name: "Gifts", kind: "want", amountPence: 2500 });
  });

  it("refuses renaming to another category's name, ignoring case", () => {
    renderEditor();
    click("Edit Groceries");
    const sheet = screen.getByRole("dialog", { name: "Rename category" });
    fireEvent.change(within(sheet).getByLabelText("Name"), { target: { value: "rent" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Done" }));
    expect(within(sheet).getByRole("alert")).toHaveTextContent("You already have a category called Rent.");
  });

  it("with ?category, opens that category's tab and focuses its amount", () => {
    renderEditor({ focusCategoryId: categories[2].id });
    expect(screen.getByRole("tab", { name: "Wants" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Eating out")).toHaveFocus();
  });

  it("with ?category for a category outside the budget, adds it at £0 with its amount focused", () => {
    renderEditor({ focusCategoryId: GIFTS.id });
    expect(screen.getByRole("tab", { name: "Wants" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Gifts")).toHaveValue("0.00");
    expect(screen.getByLabelText("Gifts")).toHaveFocus();
  });

  it("with a next period already set up, From next period shows that period's own figures", () => {
    renderEditor({ nextBudget, nextDiffers: true });
    expect(screen.getByLabelText("Rent")).toHaveValue("1500.00");
    fireEvent.click(screen.getByRole("radio", { name: "From next period" }));
    expect(screen.getByLabelText("Monthly income")).toHaveValue("3200.00");
    expect(screen.getByLabelText("Rent")).toHaveValue("1600.00");
    fireEvent.click(screen.getByRole("radio", { name: "From this period" }));
    expect(screen.getByLabelText("Rent")).toHaveValue("1500.00");
  });

  it("switching scope with unsaved changes asks first, and keeps them on Cancel", () => {
    renderEditor({ nextBudget, nextDiffers: true });
    type("Rent", "1700");
    fireEvent.click(screen.getByRole("radio", { name: "From next period" }));
    const dialog = screen.getByRole("alertdialog", { name: "Discard your changes?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("radio", { name: "From this period" })).toBeChecked();
    expect(screen.getByLabelText("Rent")).toHaveValue("1700");

    fireEvent.click(screen.getByRole("radio", { name: "From next period" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard and switch" }));
    expect(screen.getByRole("radio", { name: "From next period" })).toBeChecked();
    expect(screen.getByLabelText("Rent")).toHaveValue("1600.00");
  });

  it("warns before saving from this period over a next period with different figures", () => {
    const { rerender } = renderEditor({ nextBudget, nextDiffers: true });
    expect(screen.getByText("Your budget from Tue 1 Dec is different. Saving here replaces it with these figures.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "From next period" }));
    expect(screen.queryByText(/is different/)).not.toBeInTheDocument();
    rerender(<BudgetEditor period={period} budget={budget} nextBudget={budget} nextDiffers={false} outside={[]} />);
    fireEvent.click(screen.getByRole("radio", { name: "From this period" }));
    expect(screen.queryByText(/is different/)).not.toBeInTheDocument();
  });

  it("an amount that isn't a number stops the save with a message", () => {
    renderEditor();
    type("Rent", "abc");
    click("Save budget");
    expect(saveBudgetAction).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert").some((a) => /Rent/.test(a.textContent ?? ""))).toBe(true);
  });

  it("shows the server's error", async () => {
    saveBudgetAction.mockResolvedValue({ error: "Another category already has that name." });
    renderEditor();
    click("Save budget");
    expect(await screen.findByText("Another category already has that name.")).toBeInTheDocument();
  });

  it("Cancel goes back to the budget without saving", () => {
    renderEditor();
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/budget");
  });
});

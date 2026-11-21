import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { completeOnboardingAction } = vi.hoisted(() => ({ completeOnboardingAction: vi.fn() }));
vi.mock("./actions", () => ({ completeOnboardingAction }));

import { OnboardingWizard } from "./Wizard";

const TODAY = "2026-11-21";

type Scope = Pick<typeof screen, "getByLabelText">;

function type(label: string, value: string, scope: Scope = screen) {
  fireEvent.change(scope.getByLabelText(label), { target: { value } });
}
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

function finishIncome(income = "6000", startDay = "25") {
  fireEvent.change(screen.getByLabelText("Starting on"), { target: { value: startDay } });
  type("Monthly income", income);
  click("Continue");
}

function addCategory(name: string, amount: string) {
  type("Category name", name);
  type("Amount", amount);
  click("Add category");
}

describe("OnboardingWizard: the basics", () => {
  beforeEach(() => completeOnboardingAction.mockReset());

  it("shows the period as Monthly and a live 'budget next on' line for the chosen start day", () => {
    render(<OnboardingWizard today={TODAY} />);
    expect(screen.getByText("Monthly")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Starting on"), { target: { value: "25" } });
    expect(screen.getByText("so budget next on Wednesday 25 November")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Starting on"), { target: { value: "1" } });
    expect(screen.getByText("so budget next on Tuesday 1 December")).toBeInTheDocument();
  });

  it("labels day 1 'First day of the month' and other days as ordinals", () => {
    render(<OnboardingWizard today={TODAY} />);
    const select = screen.getByLabelText("Starting on");
    expect(within(select).getByRole("option", { name: "First day of the month" })).toHaveValue("1");
    expect(within(select).getByRole("option", { name: "25th" })).toHaveValue("25");
    expect(within(select).getByRole("option", { name: "22nd" })).toHaveValue("22");
    expect(within(select).getByRole("option", { name: "31st" })).toHaveValue("31");
  });

  it("an income of 0 keeps the step from advancing", () => {
    render(<OnboardingWizard today={TODAY} />);
    finishIncome("0");
    expect(screen.getByRole("heading", { name: "Start with the basics" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/income/i);
  });
});

describe("OnboardingWizard: spending budget", () => {
  it("shows how far allocations are over in red, and Continue stays enabled", () => {
    render(<OnboardingWizard today={TODAY} />);
    finishIncome("1000");
    expect(screen.getByRole("heading", { name: "Your spending budget" })).toBeInTheDocument();
    addCategory("Rent", "1200");
    const over = screen.getByText("£200.00 over");
    expect(over).toHaveClass("text-danger-fg");
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    click("Continue");
    expect(screen.getByRole("heading", { name: "Savings" })).toBeInTheDocument();
  });

  it("says the amount to spend is before savings until savings are entered", () => {
    render(<OnboardingWizard today={TODAY} />);
    finishIncome("1000");
    expect(screen.getByText("Before savings")).toBeInTheDocument();
  });

  it("keeps Needs and Wants on separate tabs", () => {
    render(<OnboardingWizard today={TODAY} />);
    finishIncome();
    addCategory("Rent", "1200");
    fireEvent.click(screen.getByRole("tab", { name: "Wants" }));
    expect(screen.queryByText("Rent")).not.toBeInTheDocument();
    addCategory("Eating out", "200");
    expect(screen.getByText("Eating out")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Needs" }));
    expect(screen.getByText("Rent")).toBeInTheDocument();
  });

  it("refuses a category name already used on either tab, ignoring case", () => {
    render(<OnboardingWizard today={TODAY} />);
    finishIncome();
    addCategory("Rent", "1200");
    fireEvent.click(screen.getByRole("tab", { name: "Wants" }));
    addCategory("rent", "10");
    expect(screen.getByRole("alert")).toHaveTextContent(/already/i);
    expect(screen.queryByText("rent")).not.toBeInTheDocument();
  });

  it("needs at least one category to continue", () => {
    render(<OnboardingWizard today={TODAY} />);
    finishIncome();
    click("Continue");
    expect(screen.getByRole("heading", { name: "Your spending budget" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/at least one category/i);
  });

  it("Back returns to the previous step with its answers kept", () => {
    render(<OnboardingWizard today={TODAY} />);
    finishIncome("6000");
    click("Back");
    expect(screen.getByLabelText("Monthly income")).toHaveValue("6000");
  });
});

describe("OnboardingWizard: savings and going live", () => {
  beforeEach(() => completeOnboardingAction.mockReset().mockResolvedValue(undefined));

  function toSavings() {
    render(<OnboardingWizard today={TODAY} />);
    finishIncome("6000", "25");
    addCategory("Rent", "1500");
    fireEvent.click(screen.getByRole("tab", { name: "Wants" }));
    addCategory("Eating out", "200");
    click("Continue");
  }

  it("with savings, fund amounts must add up to the savings total to continue", () => {
    toSavings();
    type("Pay yourself first", "500");
    click("Add a fund");
    const fund = within(screen.getByRole("group", { name: "Fund 1" }));
    type("Fund name", "Holiday", fund);
    type("Each month", "300", fund);
    expect(screen.getByText("£200.00 still to split")).toBeInTheDocument();
    click("Continue");
    expect(screen.getByRole("heading", { name: "Savings" })).toBeInTheDocument();
    type("Each month", "500", fund);
    click("Continue");
    expect(screen.getByRole("heading", { name: "You're live" })).toBeInTheDocument();
  });

  it("skipping savings needs no fund", () => {
    toSavings();
    click("Continue");
    expect(screen.getByRole("heading", { name: "You're live" })).toBeInTheDocument();
  });

  it("confirming sends the whole setup, in pence, to the server", async () => {
    toSavings();
    type("Pay yourself first", "500");
    click("Add a fund");
    const fund = within(screen.getByRole("group", { name: "Fund 1" }));
    type("Fund name", "Holiday", fund);
    type("Each month", "500", fund);
    fireEvent.click(fund.getByRole("switch", { name: "Already saved" }));
    type("Amount already saved", "200", fund);
    click("Continue");

    const summary = screen.getByRole("heading", { name: "You're live" }).closest("section")!;
    expect(within(summary).getByText("£6,000.00")).toBeInTheDocument();
    click("Go to my budget");

    expect(completeOnboardingAction).toHaveBeenCalledWith({
      incomePence: 600000,
      startDay: 25,
      savingsPence: 50000,
      categories: [
        { name: "Rent", kind: "need", amountPence: 150000 },
        { name: "Eating out", kind: "want", amountPence: 20000 },
      ],
      funds: [{ name: "Holiday", amountPence: 50000, alreadySavedPence: 20000 }],
    });
  });

  it("typing 0 in 'Pay yourself first' counts as skipping savings", () => {
    toSavings();
    type("Pay yourself first", "0");
    click("Continue");
    expect(screen.getByRole("heading", { name: "You're live" })).toBeInTheDocument();
    click("Go to my budget");
    expect(completeOnboardingAction).toHaveBeenCalledWith(expect.objectContaining({ savingsPence: 0, funds: [] }));
  });

  it("a fund with no monthly amount can hold only money already saved, next to one that saves", () => {
    toSavings();
    type("Pay yourself first", "500");
    click("Add a fund");
    const holiday = within(screen.getByRole("group", { name: "Fund 1" }));
    type("Fund name", "Holiday", holiday);
    type("Each month", "500", holiday);
    click("Add a fund");
    const pot = within(screen.getByRole("group", { name: "Fund 2" }));
    type("Fund name", "Old pot", pot);
    fireEvent.click(pot.getByRole("switch", { name: "Already saved" }));
    type("Amount already saved", "300", pot);
    click("Continue");
    expect(screen.getByRole("heading", { name: "You're live" })).toBeInTheDocument();
    click("Go to my budget");
    expect(completeOnboardingAction).toHaveBeenCalledWith(
      expect.objectContaining({
        savingsPence: 50000,
        funds: [
          { name: "Holiday", amountPence: 50000, alreadySavedPence: 0 },
          { name: "Old pot", amountPence: 0, alreadySavedPence: 30000 },
        ],
      }),
    );
  });

  it("shows the server's error and stays on the last step", async () => {
    completeOnboardingAction.mockResolvedValue({ error: "Something went wrong. Try again." });
    toSavings();
    click("Continue");
    click("Go to my budget");
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Try again.");
    expect(screen.getByRole("heading", { name: "You're live" })).toBeInTheDocument();
  });
});

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { completeOnboardingAction, saveLanguage, saveCurrency } = vi.hoisted(() => ({
  completeOnboardingAction: vi.fn(),
  saveLanguage: vi.fn(async () => ({ ok: true })),
  saveCurrency: vi.fn(async () => ({ ok: true })),
}));
vi.mock("./actions", () => ({ completeOnboardingAction }));
vi.mock("@/app/(app)/settings/settingsActions", () => ({ saveLanguage, saveCurrency }));

import { OnboardingWizard } from "./Wizard";

const TODAY = "2026-11-21";

type Scope = Pick<typeof screen, "getByLabelText">;

function type(label: string, value: string, scope: Scope = screen) {
  fireEvent.change(scope.getByLabelText(label), { target: { value } });
}
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

/** Opens the wizard and passes the welcome screen, as most tests start at step 1. */
function renderWizard() {
  render(<OnboardingWizard today={TODAY} />);
  click("Start setting up");
}

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

describe("OnboardingWizard: welcome", () => {
  beforeEach(() => {
    saveLanguage.mockClear();
    saveCurrency.mockClear();
  });

  it("opens on a welcome screen asking for the language, then the currency", () => {
    render(<OnboardingWizard today={TODAY} />);
    expect(screen.getByRole("heading", { name: "Welcome" })).toBeInTheDocument();
    const language = screen.getByLabelText("Language · 語言");
    expect(within(language).getByRole("option", { name: "繁體中文（台灣）" })).toHaveValue("zh-TW");
    const currency = screen.getByLabelText("Currency");
    expect(language.compareDocumentPosition(currency) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText(/Step 1 of 4/)).not.toBeInTheDocument();
  });

  it("saves a language or currency as soon as it is chosen", async () => {
    render(<OnboardingWizard today={TODAY} />);
    await act(async () => fireEvent.change(screen.getByLabelText("Language · 語言"), { target: { value: "zh-TW" } }));
    expect(saveLanguage).toHaveBeenCalledWith("zh-TW");
    await act(async () => fireEvent.change(screen.getByLabelText("Currency"), { target: { value: "TWD" } }));
    expect(saveCurrency).toHaveBeenCalledWith("TWD");
  });

  it("Start setting up saves both current choices and opens step 1 of 4", async () => {
    render(<OnboardingWizard today={TODAY} />);
    await act(async () => click("Start setting up"));
    expect(saveLanguage).toHaveBeenCalledWith("en-GB");
    expect(saveCurrency).toHaveBeenCalledWith("GBP");
    expect(screen.getByRole("heading", { name: "Start with the basics" })).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
  });

  it("Back on step 1 returns to the welcome screen and keeps what was typed", () => {
    renderWizard();
    type("Monthly income", "2500");
    click("Back");
    expect(screen.getByRole("heading", { name: "Welcome" })).toBeInTheDocument();
    click("Start setting up");
    expect(screen.getByLabelText("Monthly income")).toHaveValue("2500");
  });

  it("shows the error when a choice can't be saved", async () => {
    saveLanguage.mockResolvedValueOnce({ error: "We couldn't save your language." } as never);
    render(<OnboardingWizard today={TODAY} />);
    await act(async () => fireEvent.change(screen.getByLabelText("Language · 語言"), { target: { value: "zh-TW" } }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("We couldn't save your language."));
  });
});

describe("OnboardingWizard: the basics", () => {
  beforeEach(() => completeOnboardingAction.mockReset());

  it("shows the period as Monthly and a live 'budget next on' line for the chosen start day", () => {
    renderWizard();
    expect(screen.getByText("Monthly")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Starting on"), { target: { value: "25" } });
    expect(screen.getByText("so budget next on Wednesday 25 November")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Starting on"), { target: { value: "1" } });
    expect(screen.getByText("so budget next on Tuesday 1 December")).toBeInTheDocument();
  });

  it("labels day 1 'First day of the month' and other days as ordinals", () => {
    renderWizard();
    const select = screen.getByLabelText("Starting on");
    expect(within(select).getByRole("option", { name: "First day of the month" })).toHaveValue("1");
    expect(within(select).getByRole("option", { name: "25th" })).toHaveValue("25");
    expect(within(select).getByRole("option", { name: "22nd" })).toHaveValue("22");
    expect(within(select).getByRole("option", { name: "31st" })).toHaveValue("31");
  });

  it("an income of 0 keeps the step from advancing", () => {
    renderWizard();
    finishIncome("0");
    expect(screen.getByRole("heading", { name: "Start with the basics" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/income/i);
  });
});

describe("OnboardingWizard: spending budget", () => {
  it("shows how far allocations are over in red, and Continue stays enabled", () => {
    renderWizard();
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
    renderWizard();
    finishIncome("1000");
    expect(screen.getByText("Before savings")).toBeInTheDocument();
  });

  it("keeps Needs and Wants on separate tabs", () => {
    renderWizard();
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
    renderWizard();
    finishIncome();
    addCategory("Rent", "1200");
    fireEvent.click(screen.getByRole("tab", { name: "Wants" }));
    addCategory("rent", "10");
    expect(screen.getByRole("alert")).toHaveTextContent(/already/i);
    expect(screen.queryByText("rent")).not.toBeInTheDocument();
  });

  it("needs at least one category to continue", () => {
    renderWizard();
    finishIncome();
    click("Continue");
    expect(screen.getByRole("heading", { name: "Your spending budget" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/at least one category/i);
  });

  it("Back returns to the previous step with its answers kept", () => {
    renderWizard();
    finishIncome("6000");
    click("Back");
    expect(screen.getByLabelText("Monthly income")).toHaveValue("6000");
  });
});

describe("OnboardingWizard: savings and going live", () => {
  beforeEach(() => completeOnboardingAction.mockReset().mockResolvedValue(undefined));

  function toSavings() {
    renderWizard();
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

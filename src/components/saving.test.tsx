import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FundView, SavingView, WaitingPrompt } from "@/lib/data/funds";

const actions = vi.hoisted(() => ({
  confirmSavingsAction: vi.fn(),
  saveFundAction: vi.fn(),
  addFundMovementAction: vi.fn(),
  withdrawFromFundAction: vi.fn(),
  moveBetweenFundsAction: vi.fn(),
}));
vi.mock("@/app/(app)/budget/fundActions", () => actions);
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { SavingTab } from "./SavingTab";

const TODAY = "2026-11-21";

function fund(over: Partial<FundView> = {}): FundView {
  return {
    id: "holiday",
    name: "Holiday",
    openingPence: 10000,
    balancePence: 23000,
    targetPence: 100000,
    targetDate: "2027-07-31",
    progressPercent: 23,
    history: [],
    ...over,
  };
}

const holiday = fund({
  history: [
    { date: "2026-11-12", direction: "out", amountPence: 12000, label: "expense", refId: "t1", title: "Flights", note: null },
    { date: "2026-11-02", direction: "out", amountPence: 5000, label: "withdrawal", refId: "m2", title: "Withdrawn", note: null },
    { date: "2026-10-05", direction: "in", amountPence: 30000, label: "contribution", refId: "m1", title: "Added", note: "Birthday money" },
  ],
});
const emergency = fund({
  id: "emergency",
  name: "Emergency",
  openingPence: 50000,
  balancePence: 50000,
  targetPence: null,
  targetDate: null,
  progressPercent: null,
});

const prompt: WaitingPrompt = {
  periodId: "nov",
  start: "2026-11-01",
  end: "2026-11-30",
  savingsPence: 30000,
  prefill: [
    { fundId: "holiday", amountPence: 20000 },
    { fundId: "emergency", amountPence: 5000 },
  ],
  prefillFrom: "last_period",
};

function renderTab(view: Partial<SavingView> = {}) {
  return render(<SavingTab view={{ funds: [emergency, holiday], waiting: [prompt], ...view }} today={TODAY} />);
}

beforeEach(() => {
  for (const f of Object.values(actions)) f.mockReset().mockResolvedValue({});
  router.refresh.mockReset();
});

function openMove() {
  fireEvent.click(screen.getByRole("button", { name: "Move your savings" }));
  return screen.getByRole("dialog", { name: "Move your savings" });
}

describe("SavingTab: waiting savings", () => {
  it('shows a waiting prompt as "£300.00 waiting to be moved"', () => {
    renderTab();
    expect(screen.getByText("waiting to be moved", { exact: false }).textContent).toBe("£300.00 waiting to be moved");
    expect(screen.getByText(/1 Nov – 30 Nov/)).toBeInTheDocument();
  });

  it("lists every waiting period, oldest first, each with its own action", () => {
    renderTab({ waiting: [{ ...prompt, periodId: "oct", start: "2026-10-01", end: "2026-10-31", savingsPence: 10000 }, prompt] });
    const texts = screen.getAllByText("waiting to be moved", { exact: false }).map((n) => n.textContent);
    expect(texts).toEqual(["£100.00 waiting to be moved", "£300.00 waiting to be moved"]);
    expect(screen.getAllByRole("button", { name: "Move your savings" })).toHaveLength(2);
  });

  it("shows nothing waiting when every period's savings were moved", () => {
    renderTab({ waiting: [] });
    expect(screen.queryByText(/waiting to be moved/)).not.toBeInTheDocument();
  });
});

describe("MoveSavingsSheet", () => {
  it("pre-fills last period's split and shows what is left to place, with Confirm disabled", () => {
    renderTab();
    const sheet = openMove();
    expect(within(sheet).getByLabelText("Holiday")).toHaveValue("200.00");
    expect(within(sheet).getByLabelText("Emergency")).toHaveValue("50.00");
    expect(within(sheet).getByText("Pre-filled with last period's split.")).toBeInTheDocument();
    expect(within(sheet).getByRole("status")).toHaveTextContent("£50.00 left to place");
    expect(within(sheet).getByRole("button", { name: "Confirm" })).toBeDisabled();
    expect(within(sheet).getByRole("button", { name: "Confirm" })).toHaveAccessibleDescription("£50.00 left to place");
  });

  it("shows how much over when the amounts are more than the savings", () => {
    renderTab();
    const sheet = openMove();
    fireEvent.change(within(sheet).getByLabelText("Emergency"), { target: { value: "150" } });
    expect(within(sheet).getByRole("status")).toHaveTextContent("£50.00 over");
    expect(within(sheet).getByRole("button", { name: "Confirm" })).toBeDisabled();
  });

  it("confirms an edited split that adds up, then closes and refreshes", async () => {
    renderTab();
    const sheet = openMove();
    fireEvent.change(within(sheet).getByLabelText("Emergency"), { target: { value: "100" } });
    expect(within(sheet).getByRole("status")).toHaveTextContent("All £300.00 placed");
    await act(async () => fireEvent.click(within(sheet).getByRole("button", { name: "Confirm" })));
    expect(actions.confirmSavingsAction).toHaveBeenCalledWith("nov", [
      { fundId: "emergency", amountPence: 10000 },
      { fundId: "holiday", amountPence: 20000 },
    ]);
    expect(router.refresh).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Savings moved into your funds")).toHaveFocus();
  });

  it("sends part of the savings to a new fund created in the same confirm", async () => {
    renderTab();
    const sheet = openMove();
    fireEvent.click(within(sheet).getByRole("button", { name: "Send to a new fund" }));
    fireEvent.change(within(sheet).getByLabelText("New fund name"), { target: { value: "New car" } });
    fireEvent.change(within(sheet).getByLabelText("Target (optional)"), { target: { value: "5000" } });
    fireEvent.change(within(sheet).getByLabelText("Amount for the new fund"), { target: { value: "50" } });
    await act(async () => fireEvent.click(within(sheet).getByRole("button", { name: "Confirm" })));
    expect(actions.confirmSavingsAction).toHaveBeenCalledWith("nov", [
      { fundId: "emergency", amountPence: 5000 },
      { fundId: "holiday", amountPence: 20000 },
      { newFund: { name: "New car", targetPence: 500000 }, amountPence: 5000 },
    ]);
  });

  it("keeps Confirm disabled while a new fund has no name", () => {
    renderTab();
    const sheet = openMove();
    fireEvent.click(within(sheet).getByRole("button", { name: "Send to a new fund" }));
    fireEvent.change(within(sheet).getByLabelText("Amount for the new fund"), { target: { value: "50" } });
    expect(within(sheet).getByRole("button", { name: "Confirm" })).toBeDisabled();
    fireEvent.click(within(sheet).getByRole("button", { name: "Remove the new fund" }));
    expect(within(sheet).queryByLabelText("New fund name")).not.toBeInTheDocument();
  });

  it("shows the server's refusal and stays open", async () => {
    actions.confirmSavingsAction.mockResolvedValue({ error: "These savings have already been moved." });
    renderTab();
    const sheet = openMove();
    fireEvent.change(within(sheet).getByLabelText("Emergency"), { target: { value: "100" } });
    await act(async () => fireEvent.click(within(sheet).getByRole("button", { name: "Confirm" })));
    expect(within(sheet).getByRole("alert")).toHaveTextContent("These savings have already been moved.");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("starts empty with a new-fund line when there are no funds yet", () => {
    renderTab({ funds: [], waiting: [{ ...prompt, prefill: [], prefillFrom: "none" }] });
    const sheet = openMove();
    expect(within(sheet).getByLabelText("New fund name")).toBeInTheDocument();
    expect(within(sheet).getByRole("status")).toHaveTextContent("£300.00 left to place");
  });
});

describe("SavingTab: funds", () => {
  it("shows each fund's balance, and progress to its target and date", () => {
    renderTab();
    const card = screen.getByRole("article", { name: "Holiday" });
    expect(within(card).getByText("£230.00")).toBeInTheDocument();
    expect(within(card).getByText("23% of £1,000.00 · by 31 Jul 2027")).toBeInTheDocument();
    expect(within(card).getByRole("progressbar", { name: "Holiday progress" })).toHaveAttribute("aria-valuenow", "23");
  });

  it("shows no bar for a fund without a target, just the balance", () => {
    renderTab();
    const card = screen.getByRole("article", { name: "Emergency" });
    expect(within(card).getByText("£500.00")).toBeInTheDocument();
    expect(within(card).queryByRole("progressbar")).not.toBeInTheDocument();
    expect(within(card).getByText("No target")).toBeInTheDocument();
  });

  it("shows a balance below zero in the danger colour, never clamped", () => {
    renderTab({ funds: [fund({ balancePence: -4000, progressPercent: 0 })] });
    const balance = within(screen.getByRole("article", { name: "Holiday" })).getByText("-£40.00");
    expect(balance).toHaveClass("text-danger-fg");
  });

  it("offers to create the first fund when there are none", () => {
    renderTab({ funds: [], waiting: [] });
    expect(screen.getByText("No funds yet")).toBeInTheDocument();
  });

  it("opens a fund's history: each movement with its date, and a fund-paid expense as money out", () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: /Holiday history/ }));
    const sheet = screen.getByRole("dialog", { name: "Holiday" });
    const rows = within(sheet).getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual([
      "FlightsThu 12 Nov · Paid from this fund−£120.00",
      "WithdrawnMon 2 Nov−£50.00",
      "AddedMon 5 Oct · Birthday money+£300.00",
      "Already saved at the start+£100.00",
    ]);
  });

  it("adds money to a fund, dated today unless changed", async () => {
    renderTab();
    const card = screen.getByRole("article", { name: "Holiday" });
    fireEvent.click(within(card).getByRole("button", { name: "Add money" }));
    const sheet = screen.getByRole("dialog", { name: "Add money to Holiday" });
    expect(within(sheet).getByLabelText("Date")).toHaveValue(TODAY);
    fireEvent.change(within(sheet).getByLabelText("Amount"), { target: { value: "25" } });
    fireEvent.change(within(sheet).getByLabelText("Note (optional)"), { target: { value: "Gift" } });
    await act(async () => fireEvent.click(within(sheet).getByRole("button", { name: "Add money" })));
    expect(actions.addFundMovementAction).toHaveBeenCalledWith("holiday", {
      kind: "contribution",
      amountPence: 2500,
      date: TODAY,
      note: "Gift",
    });
    expect(router.refresh).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a refused withdrawal on its field", async () => {
    actions.withdrawFromFundAction.mockResolvedValue({ error: "You can't withdraw more than the fund holds (£230.00).", field: "amount" });
    renderTab();
    fireEvent.click(within(screen.getByRole("article", { name: "Holiday" })).getByRole("button", { name: "Withdraw" }));
    const sheet = screen.getByRole("dialog", { name: "Withdraw from Holiday" });
    fireEvent.change(within(sheet).getByLabelText("Amount"), { target: { value: "500" } });
    await act(async () => fireEvent.click(within(sheet).getByRole("button", { name: "Withdraw" })));
    expect(within(sheet).getByText("You can't withdraw more than the fund holds (£230.00).")).toBeInTheDocument();
    expect(actions.withdrawFromFundAction).toHaveBeenCalledWith("holiday", expect.objectContaining({ amountPence: 50000 }));
  });

  it("withdraws into this month's spending money by default", async () => {
    renderTab();
    fireEvent.click(within(screen.getByRole("article", { name: "Holiday" })).getByRole("button", { name: "Withdraw" }));
    const sheet = screen.getByRole("dialog", { name: "Withdraw from Holiday" });
    const choice = within(sheet).getByRole("radiogroup", { name: "Where the money goes" });
    expect(within(choice).getByRole("radio", { name: "Add to this month's spending money" })).toBeChecked();
    expect(within(choice).getByRole("radio", { name: "Just take it out" })).not.toBeChecked();
    fireEvent.change(within(sheet).getByLabelText("Amount"), { target: { value: "100" } });
    await act(async () => fireEvent.click(within(sheet).getByRole("button", { name: "Withdraw" })));
    expect(actions.withdrawFromFundAction).toHaveBeenCalledWith("holiday", {
      amountPence: 10000,
      date: TODAY,
      note: "",
      destination: "spending",
    });
    expect(screen.getByText("£100.00 from Holiday added to this month's spending money")).toBeInTheDocument();
  });

  it("can just take money out of a fund", async () => {
    renderTab();
    fireEvent.click(within(screen.getByRole("article", { name: "Holiday" })).getByRole("button", { name: "Withdraw" }));
    const sheet = screen.getByRole("dialog", { name: "Withdraw from Holiday" });
    fireEvent.click(within(sheet).getByRole("radio", { name: "Just take it out" }));
    expect(sheet).toHaveTextContent("Your budget doesn't change.");
    fireEvent.change(within(sheet).getByLabelText("Amount"), { target: { value: "20" } });
    await act(async () => fireEvent.click(within(sheet).getByRole("button", { name: "Withdraw" })));
    expect(actions.withdrawFromFundAction).toHaveBeenCalledWith("holiday", expect.objectContaining({ amountPence: 2000, destination: "out" }));
    expect(screen.getByText("Withdrawn from Holiday")).toBeInTheDocument();
  });

  it("moves money to another fund", async () => {
    renderTab();
    fireEvent.click(within(screen.getByRole("article", { name: "Holiday" })).getByRole("button", { name: "Move" }));
    const sheet = screen.getByRole("dialog", { name: "Move money from Holiday" });
    expect(sheet).toHaveTextContent("Holiday holds £230.00");
    const to = within(sheet).getByLabelText("To");
    expect([...(to as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(["Emergency"]);
    expect(to).toHaveValue("emergency");
    fireEvent.change(within(sheet).getByLabelText("Amount"), { target: { value: "50" } });
    await act(async () => fireEvent.click(within(sheet).getByRole("button", { name: "Move money" })));
    expect(actions.moveBetweenFundsAction).toHaveBeenCalledWith("holiday", "emergency", { amountPence: 5000, date: TODAY, note: "" });
    expect(screen.getByText("£50.00 moved from Holiday to Emergency")).toBeInTheDocument();
  });

  it("shows a refused move on its field", async () => {
    actions.moveBetweenFundsAction.mockResolvedValue({ error: "You can't move more than Holiday holds (£230.00).", field: "amount" });
    renderTab();
    fireEvent.click(within(screen.getByRole("article", { name: "Holiday" })).getByRole("button", { name: "Move" }));
    const sheet = screen.getByRole("dialog", { name: "Move money from Holiday" });
    fireEvent.change(within(sheet).getByLabelText("Amount"), { target: { value: "500" } });
    await act(async () => fireEvent.click(within(sheet).getByRole("button", { name: "Move money" })));
    expect(within(sheet).getByText("You can't move more than Holiday holds (£230.00).")).toBeInTheDocument();
  });

  it("offers Move only with another fund to move to, and money to move", () => {
    renderTab({ funds: [holiday] });
    expect(within(screen.getByRole("article", { name: "Holiday" })).queryByRole("button", { name: "Move" })).not.toBeInTheDocument();
    cleanup();
    renderTab({ funds: [emergency, fund({ balancePence: 0, progressPercent: 0 })] });
    expect(within(screen.getByRole("article", { name: "Holiday" })).getByRole("button", { name: "Move" })).toBeDisabled();
  });

  it("disables Withdraw on an empty fund", () => {
    renderTab({ funds: [fund({ balancePence: 0, progressPercent: 0 })] });
    expect(within(screen.getByRole("article", { name: "Holiday" })).getByRole("button", { name: "Withdraw" })).toBeDisabled();
  });

  it("edits a fund's name, target and target date", async () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Edit Holiday" }));
    const sheet = screen.getByRole("dialog", { name: "Edit fund" });
    expect(within(sheet).getByLabelText("Name")).toHaveValue("Holiday");
    expect(within(sheet).getByLabelText("Target (optional)")).toHaveValue("1000.00");
    expect(within(sheet).getByLabelText("Target date (optional)")).toHaveValue("2027-07-31");
    fireEvent.change(within(sheet).getByLabelText("Name"), { target: { value: "Summer" } });
    fireEvent.change(within(sheet).getByLabelText("Target date (optional)"), { target: { value: "" } });
    await act(async () => fireEvent.click(within(sheet).getByRole("button", { name: "Save" })));
    expect(actions.saveFundAction).toHaveBeenCalledWith("holiday", { name: "Summer", targetPence: 100000, targetDate: "" });
  });

  it("creates a new fund", async () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "New fund" }));
    const sheet = screen.getByRole("dialog", { name: "New fund" });
    fireEvent.change(within(sheet).getByLabelText("Name"), { target: { value: "Car" } });
    await act(async () => fireEvent.click(within(sheet).getByRole("button", { name: "Save" })));
    expect(actions.saveFundAction).toHaveBeenCalledWith(null, { name: "Car", targetPence: 0, targetDate: "" });
  });
});

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RecurringItem } from "@/lib/data/recurring";
import { newExpenseValues } from "@/lib/validation/expense";

const actions = vi.hoisted(() => ({
  pauseAction: vi.fn(),
  resumeAction: vi.fn(),
  skipNextAction: vi.fn(),
  cancelAction: vi.fn(),
  changeAmountAction: vi.fn(),
  acceptDetectionAction: vi.fn(),
  dismissDetectionAction: vi.fn(),
  confirmOccurrenceAction: vi.fn(),
}));
vi.mock("@/app/(app)/expenses/recurring/actions", () => actions);
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { EditRecurringPrompt } from "./EditRecurringPrompt";
import { ExpenseForm } from "./ExpenseForm";
import { RecurringList } from "./RecurringList";
import { RecurringSuggestions } from "./RecurringSuggestions";
import { RepeatFields } from "./RepeatFields";

const TODAY = "2026-11-21";
const PERIOD = { start: "2026-11-01", end: "2026-11-30", nextStart: "2026-12-01" };
const MUSIC = "11111111-1111-4111-8111-111111111111";

function item(over: Partial<RecurringItem> = {}): RecurringItem {
  return {
    id: "rule-1",
    name: "Spotify",
    categoryId: MUSIC,
    categoryName: "Music",
    fundId: null,
    frequency: "weekly",
    rule: { frequency: "weekly", anchorDate: "2026-11-02", endDate: null, pausedUntil: null, skippedDates: [] },
    prices: [{ effectiveFrom: "2026-11-02", amountPence: 1199 }],
    currentPence: 1199,
    nextDue: "2026-11-23",
    status: { kind: "active" },
    ...over,
  };
}

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset().mockResolvedValue({});
  router.push.mockReset();
  router.refresh.mockReset();
});

describe("EditRecurringPrompt", () => {
  it('offers exactly "Just this payment" and "This and future payments"', () => {
    const onChoose = vi.fn();
    render(<EditRecurringPrompt open name="Spotify" onChoose={onChoose} onCancel={() => {}} />);
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Just this payment" }));
    expect(onChoose).toHaveBeenLastCalledWith("this");
    fireEvent.click(within(dialog).getByRole("button", { name: "This and future payments" }));
    expect(onChoose).toHaveBeenLastCalledWith("this_and_future");
  });
});

describe("RepeatFields", () => {
  it("is off by default; switching it on shows the five frequencies, monthly first chosen", () => {
    const onChange = vi.fn();
    const { rerender } = render(<RepeatFields value={null} onChange={onChange} />);
    expect(screen.getByRole("switch", { name: "Repeat" })).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByLabelText("How often")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "Repeat" }));
    expect(onChange).toHaveBeenLastCalledWith("monthly");
    rerender(<RepeatFields value="monthly" onChange={onChange} />);
    const select = screen.getByLabelText("How often");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Weekly",
      "Every 2 weeks",
      "Monthly",
      "Every 3 months",
      "Yearly",
    ]);
    fireEvent.change(select, { target: { value: "weekly" } });
    expect(onChange).toHaveBeenLastCalledWith("weekly");
  });
});

describe("ExpenseForm and recurring payments", () => {
  const categories = [{ id: MUSIC, name: "Music", kind: "want" as const }];
  const save = vi.fn();
  beforeEach(() => save.mockReset().mockResolvedValue(undefined));
  const submit = async () => {
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Save expense" })[0]);
    });
  };

  it("saves a new expense with Repeat on as the first payment of a monthly rule", async () => {
    render(
      <ExpenseForm categories={categories} funds={[]} today={TODAY}
        initial={newExpenseValues({ category: MUSIC }, categories, TODAY)} returnTo="/expenses" save={save} />,
    );
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "11.99" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Spotify" } });
    fireEvent.click(screen.getByRole("switch", { name: "Repeat" }));
    await submit();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: "Spotify", amountPence: 1199, repeat: "monthly" }));
  });

  const editing = {
    name: "Spotify", amountText: "11.99", date: "2026-11-15", categoryId: MUSIC, fundId: null, accountLabel: "", notes: "",
  };
  function renderRecurring(extra: { unchecked?: boolean; markChecked?: () => Promise<{ error?: string }> } = {}) {
    render(
      <ExpenseForm categories={categories} funds={[]} today={TODAY} initial={editing} returnTo="/expenses"
        save={save} remove={vi.fn()} recurring {...extra} />,
    );
  }

  it("has no Repeat toggle when editing", () => {
    renderRecurring();
    expect(screen.queryByRole("switch", { name: "Repeat" })).not.toBeInTheDocument();
  });

  it("asks which payments a changed amount applies to, then saves with that choice", async () => {
    renderRecurring();
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "12.99" } });
    await submit();
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "This and future payments" }));
    });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ amountPence: 1299, amountScope: "this_and_future" }));
  });

  it("doesn't ask when only other fields change", async () => {
    renderRecurring();
    fireEvent.change(screen.getByLabelText("Notes (optional)"), { target: { value: "family plan" } });
    await submit();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(save).toHaveBeenCalledWith(expect.not.objectContaining({ amountScope: expect.anything() }));
  });

  it('offers "Mark as checked" on an unchecked payment', async () => {
    const markChecked = vi.fn().mockResolvedValue({});
    renderRecurring({ unchecked: true, markChecked });
    expect(screen.getByText(/Added automatically/)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mark as checked" }));
    });
    expect(markChecked).toHaveBeenCalled();
    expect(router.refresh).toHaveBeenCalled();
  });
});

describe("RecurringList", () => {
  const open = (name = "Spotify") => fireEvent.click(screen.getByRole("button", { name: new RegExp(name) }));

  it("lists each payment with its category, amount, how often, next date and status", () => {
    render(
      <RecurringList
        today={TODAY}
        period={PERIOD}
        rules={[
          item(),
          item({ id: "rule-2", name: "Gym", status: { kind: "paused", until: "2027-01-01" }, nextDue: "2027-01-04" }),
          item({ id: "rule-3", name: "Paper", status: { kind: "ends", on: "2026-11-30" }, nextDue: "2026-11-23" }),
        ]}
      />,
    );
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Spotify");
    expect(rows[0]).toHaveTextContent("Music · Weekly");
    expect(rows[0]).toHaveTextContent("£11.99");
    expect(rows[0]).toHaveTextContent("Next 23 Nov");
    expect(rows[0]).toHaveTextContent("Active");
    expect(rows[1]).toHaveTextContent("Paused");
    expect(rows[1]).toHaveTextContent("Resumes 1 Jan 2027");
    expect(rows[2]).toHaveTextContent("Ends 30 Nov");
  });

  it('pausing shows "Frees £X this period" and pauses without asking anything', async () => {
    render(<RecurringList today={TODAY} period={PERIOD} rules={[item()]} />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    // Weekly at £11.99: 23 and 30 Nov are still to come this period; by default the pause runs to the next period.
    expect(screen.getByText("Frees £23.98 this period")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Pause until"), { target: { value: "2026-11-30" } });
    expect(screen.getByText("Frees £11.99 this period")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Pause until"), { target: { value: "2026-11-23" } });
    expect(screen.getByText("Frees £0.00 this period")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Pause until"), { target: { value: "2027-02-01" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Pause payments" }));
    });
    expect(actions.pauseAction).toHaveBeenCalledWith("rule-1", "2027-02-01");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("the sheet says when a paused payment resumes", () => {
    render(<RecurringList today={TODAY} period={PERIOD} rules={[item({ status: { kind: "paused", until: "2027-01-01" } })]} />);
    open();
    expect(within(screen.getByRole("dialog")).getByText("Paused until 1 Jan 2027")).toBeInTheDocument();
  });

  it("Skip next and Resume act at once", async () => {
    render(
      <RecurringList today={TODAY} period={PERIOD}
        rules={[item(), item({ id: "rule-2", name: "Gym", status: { kind: "paused", until: "2027-01-01" } })]} />,
    );
    open();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Skip next payment (23 Nov)" }));
    });
    expect(actions.skipNextAction).toHaveBeenCalledWith("rule-1");
    open("Gym");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    });
    expect(actions.resumeAction).toHaveBeenCalledWith("rule-2");
  });

  it("Change amount takes an amount and the date it applies from", async () => {
    render(<RecurringList today={TODAY} period={PERIOD} rules={[item()]} />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Change amount" }));
    fireEvent.change(screen.getByLabelText("New amount"), { target: { value: "12.99" } });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-12-01" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save amount" }));
    });
    expect(actions.changeAmountAction).toHaveBeenCalledWith("rule-1", "2026-12-01", 1299);
  });

  it("Cancel asks first, then ends it today", async () => {
    render(<RecurringList today={TODAY} period={PERIOD} rules={[item()]} />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Cancel recurring payment" }));
    const dialog = screen.getByRole("alertdialog", { name: "Cancel Spotify?" });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel payment" }));
    });
    expect(actions.cancelAction).toHaveBeenCalledWith("rule-1");
  });

  it("shows what to do when there are none", () => {
    render(<RecurringList today={TODAY} period={PERIOD} rules={[]} />);
    expect(screen.getByText("No recurring payments yet")).toBeInTheDocument();
  });
});

describe("RecurringSuggestions", () => {
  it('asks "Is Gym a recurring payment?" with Yes and No', async () => {
    render(<RecurringSuggestions suggestions={[{ name: "Gym", nameKey: "gym", frequency: "monthly" }]} />);
    expect(screen.getByRole("heading", { name: "Is Gym a recurring payment?" })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "No" }));
    });
    expect(actions.dismissDetectionAction).toHaveBeenCalledWith("gym");
    expect(screen.queryByText("Is Gym a recurring payment?")).not.toBeInTheDocument();
  });

  it('"Yes, repeat it" makes it recurring', async () => {
    render(<RecurringSuggestions suggestions={[{ name: "Gym", nameKey: "gym", frequency: "monthly" }]} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, repeat it" }));
    });
    expect(actions.acceptDetectionAction).toHaveBeenCalledWith("gym");
    expect(router.refresh).toHaveBeenCalled();
  });
});

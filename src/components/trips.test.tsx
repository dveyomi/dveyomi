import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TripTxn } from "@/lib/data/trips";
import { newExpenseValues } from "@/lib/validation/expense";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { ExpenseForm } from "./ExpenseForm";
import { TripForm } from "./TripForm";
import { TripPrompt } from "./TripPrompt";
import { TripSummary } from "./TripSummary";

const TODAY = "2026-12-03";
const TAIWAN = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Taiwan", place: "Taipei", startDate: "2026-12-01", endDate: "2026-12-15" };
const KYOTO = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Kyoto", place: "Kyoto", startDate: "2027-03-01", endDate: "2027-03-05" };

function txn(id: string, name: string, amountPence: number, date: string, extra: Partial<TripTxn> = {}): TripTxn {
  return {
    id, name, amountPence, date, categoryId: "food", categoryName: "Food", categoryKind: "need",
    fundId: null, fundName: null, unchecked: false, tripOverride: false, ...extra,
  };
}

beforeEach(() => {
  router.push.mockReset();
  router.refresh.mockReset();
  window.localStorage.clear();
});

describe("TripPrompt", () => {
  const endTrip = vi.fn<(id: string) => Promise<{ error?: string }>>(async () => ({}));
  beforeEach(() => endTrip.mockClear());

  it("asks 'Are you travelling? Start a trip?' when the device zone differs from the home zone, linking to a pre-filled new trip", () => {
    render(<TripPrompt deviceZone="Asia/Taipei" homeZone="Europe/London" today={TODAY} currentTrip={null} endTrip={endTrip} />);
    const card = screen.getByRole("region", { name: "Are you travelling?" });
    expect(card).toHaveTextContent("Start a trip?");
    expect(within(card).getByRole("link", { name: "Start a trip" })).toHaveAttribute(
      "href",
      "/expenses/trips/new?place=Taipei&start=2026-12-03&end=2026-12-16",
    );
  });

  it("asks nothing when the device zone equals the home zone", () => {
    render(<TripPrompt deviceZone="Europe/London" homeZone="Europe/London" today={TODAY} currentTrip={null} endTrip={endTrip} />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("once dismissed, stays dismissed for that zone on this device", () => {
    const { unmount } = render(
      <TripPrompt deviceZone="Asia/Taipei" homeZone="Europe/London" today={TODAY} currentTrip={null} endTrip={endTrip} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    unmount();
    render(<TripPrompt deviceZone="Asia/Taipei" homeZone="Europe/London" today={TODAY} currentTrip={null} endTrip={endTrip} />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("still works when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<TripPrompt deviceZone="Asia/Taipei" homeZone="Europe/London" today={TODAY} currentTrip={null} endTrip={endTrip} />);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it("back home during a trip, asks to end it and ends it today", async () => {
    render(
      <TripPrompt
        deviceZone="Europe/London"
        homeZone="Europe/London"
        today={TODAY}
        currentTrip={{ id: TAIWAN.id, name: "Taiwan", end: TAIWAN.endDate }}
        endTrip={endTrip}
      />,
    );
    const card = screen.getByRole("region", { name: "Back home?" });
    expect(card).toHaveTextContent("End your trip “Taiwan” today?");
    await act(async () => {
      fireEvent.click(within(card).getByRole("button", { name: "End trip" }));
    });
    expect(endTrip).toHaveBeenCalledWith(TAIWAN.id);
    expect(router.refresh).toHaveBeenCalled();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
});

describe("TripSummary", () => {
  const remove = vi.fn(async () => ({}));
  const reset = vi.fn(async () => ({}));
  const txns = [
    txn("t2", "Hotel", 60000, "2026-12-10", { categoryId: "travel", categoryName: "Travel", fundId: "f", fundName: "Holiday" }),
    txn("t1", "Night market", 1250, "2026-12-03"),
    txn("t0", "Flights", 90000, "2026-11-28", { categoryId: "travel", categoryName: "Travel", tripOverride: true }),
  ];
  const removed = [txn("r1", "Tesco Express", 400, "2026-12-04", { tripOverride: true })];
  const categories = [{ id: "food", name: "Food" }, { id: "travel", name: "Travel" }];
  const view = () =>
    render(<TripSummary trip={TAIWAN} txns={txns} removed={removed} categories={categories} today={TODAY} removeFromTrip={remove} resetToAutomatic={reset} />);

  beforeEach(() => {
    remove.mockClear();
    reset.mockClear();
  });

  it("shows the total (fund-paid included), each category and each day, in GBP", () => {
    view();
    expect(screen.getByRole("region", { name: "Total" })).toHaveTextContent("£1,512.50");
    const cats = screen.getByRole("list", { name: "Categories" });
    expect(within(cats).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Travel99%£1,500.00", "Food1%£12.50"]);
    const days = screen.getByRole("list", { name: "Spending per day" });
    // 15 trip days plus 28 Nov (added by hand).
    expect(within(days).getAllByRole("listitem")).toHaveLength(16);
    expect(within(days).getAllByRole("listitem")[0]).toHaveTextContent("Sat 28 Nov£900.00");
    expect(within(days).getAllByRole("listitem")[10]).toHaveTextContent("Thu 10 Dec£600.00");
  });

  it("lists the expenses, tagging fund-paid ones and those added by hand", () => {
    view();
    const list = screen.getByRole("region", { name: "Expenses" });
    expect(within(list).getByRole("link", { name: /Hotel/ })).toHaveTextContent("Travel · from Holiday");
    expect(within(list).getByRole("link", { name: /Flights/ })).toHaveTextContent("added by hand");
  });

  it("an automatic expense can be taken out of the trip", async () => {
    view();
    fireEvent.click(screen.getByRole("button", { name: "Trip options for Night market" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Take out of this trip" }));
    });
    expect(remove).toHaveBeenCalledWith("t1");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("an expense added by hand can be reset to automatic", async () => {
    view();
    fireEvent.click(screen.getByRole("button", { name: "Trip options for Flights" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reset to automatic" }));
    });
    expect(reset).toHaveBeenCalledWith("t0");
  });

  it("lists expenses taken out, each with Add back", async () => {
    view();
    const section = screen.getByRole("region", { name: "Taken out of this trip" });
    await act(async () => {
      fireEvent.click(within(section).getByRole("button", { name: "Add back Tesco Express" }));
    });
    expect(reset).toHaveBeenCalledWith("r1");
  });

  it("shows an error when a change fails", async () => {
    remove.mockResolvedValueOnce({ error: "We couldn't change this expense's trip." } as never);
    view();
    fireEvent.click(screen.getByRole("button", { name: "Trip options for Night market" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Take out of this trip" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't change this expense's trip.");
  });
});

describe("TripForm", () => {
  it("checks the dates before saving and sends the typed values", async () => {
    const save = vi.fn(async () => undefined);
    render(<TripForm initial={{ name: "", place: "Taipei", startDate: "2026-12-01", endDate: "2026-12-14" }} save={save} submitLabel="Create trip" />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Taiwan" } });
    fireEvent.change(screen.getByLabelText("Ends"), { target: { value: "2026-11-30" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create trip" }));
    });
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Ends")).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(screen.getByLabelText("Ends"), { target: { value: "2026-12-15" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create trip" }));
    });
    expect(save).toHaveBeenCalledWith({ name: "Taiwan", place: "Taipei", startDate: "2026-12-01", endDate: "2026-12-15" });
  });

  it("shows a refusal from the server (an overlap) on the dates", async () => {
    const save = vi.fn(async () => ({ error: "These dates overlap your trip “Taiwan” (1–15 Dec 2026). Trips can't overlap.", field: "startDate" as const }));
    render(<TripForm initial={{ name: "Japan", place: "", startDate: "2026-12-10", endDate: "2026-12-14" }} save={save} submitLabel="Create trip" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create trip" }));
    });
    expect(screen.getByLabelText("Starts")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/overlap your trip “Taiwan”/)).toBeInTheDocument();
  });
});

describe("ExpenseForm Trip row", () => {
  const categories = [{ id: "11111111-1111-4111-8111-111111111111", name: "Food", kind: "need" as const }];
  const save = vi.fn(async () => undefined);
  beforeEach(() => save.mockClear());

  function renderForm(trips: (typeof TAIWAN)[], initialTrip?: string) {
    const initial = { ...newExpenseValues({ category: categories[0].id, date: "2026-12-03" }, categories, TODAY), ...(initialTrip ? { trip: initialTrip } : {}) };
    return render(
      <ExpenseForm categories={categories} funds={[]} trips={trips} today={TODAY} initial={initial} returnTo="/expenses" save={save} />,
    );
  }

  it("offers Automatic (naming the trip the date falls in), each trip and Not in a trip", () => {
    renderForm([TAIWAN, KYOTO]);
    const select = screen.getByLabelText("Trip");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Automatic (Taiwan)",
      "Taiwan",
      "Kyoto",
      "Not in a trip",
    ]);
    expect(select).toHaveValue("auto");
  });

  it("saves the chosen trip with the expense", async () => {
    renderForm([TAIWAN, KYOTO]);
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Taxi" } });
    fireEvent.change(screen.getByLabelText("Trip"), { target: { value: KYOTO.id } });
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Save expense" })[0]);
    });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ trip: KYOTO.id }));
  });

  it("starts from the stored choice when editing", () => {
    renderForm([TAIWAN], "none");
    expect(screen.getByLabelText("Trip")).toHaveValue("none");
  });

  it("has no Trip row without trips, and sends no trip choice", async () => {
    renderForm([]);
    expect(screen.queryByLabelText("Trip")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Taxi" } });
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Save expense" })[0]);
    });
    expect(save).toHaveBeenCalledWith(expect.not.objectContaining({ trip: expect.anything() }));
  });
});

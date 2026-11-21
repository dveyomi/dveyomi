import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { saveStartDay, saveHomeTimezone } = vi.hoisted(() => ({ saveStartDay: vi.fn(), saveHomeTimezone: vi.fn() }));
vi.mock("./settingsActions", () => ({ saveStartDay, saveHomeTimezone }));

import { BudgetSection } from "./BudgetSection";
import { DeleteAccount } from "./DeleteAccount";
import { RegionSection } from "./RegionSection";

beforeEach(() => {
  saveStartDay.mockReset().mockResolvedValue({ ok: true });
  saveHomeTimezone.mockReset().mockResolvedValue({ ok: true });
});

describe("BudgetSection", () => {
  it("shows the saved start day and when a change takes effect", () => {
    render(<BudgetSection startDay={1} nextBudgetStart="2026-12-01" />);
    expect(screen.getByRole("heading", { name: "Budget" })).toBeInTheDocument();
    const select = screen.getByLabelText("Budget start day");
    expect(select).toHaveValue("1");
    expect(within(select).getByRole("option", { name: "First day of the month" })).toHaveValue("1");
    expect(screen.getByText("Takes effect from your next budget on Tuesday 1 December.")).toBeInTheDocument();
  });

  it("saves a new day and explains the shorter budget in between", async () => {
    render(<BudgetSection startDay={1} nextBudgetStart="2026-12-01" />);
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Budget start day"), { target: { value: "15" } });
    });
    expect(saveStartDay).toHaveBeenCalledWith(15);
    expect(screen.getByLabelText("Budget start day")).toHaveValue("15");
    expect(
      screen.getByText(
        "Takes effect from your next budget on Tuesday 1 December. That budget runs to Monday 14 December, then each one starts on the 15th.",
      ),
    ).toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
  });

  it("puts the saved day back and shows the error when saving fails", async () => {
    saveStartDay.mockResolvedValue({ error: "We couldn't save your start day. Check your connection and try again." });
    render(<BudgetSection startDay={1} nextBudgetStart="2026-12-01" />);
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Budget start day"), { target: { value: "15" } });
    });
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't save your start day.");
    expect(screen.getByLabelText("Budget start day")).toHaveValue("1");
  });

  it("before a budget exists, says the day applies when the budget is set up", () => {
    render(<BudgetSection startDay={1} nextBudgetStart={null} />);
    expect(screen.queryByText(/Takes effect/)).not.toBeInTheDocument();
  });

  it("links to recurring payments", () => {
    render(<BudgetSection startDay={1} nextBudgetStart="2026-12-01" />);
    expect(screen.getByRole("link", { name: /Recurring payments/ })).toHaveAttribute("href", "/expenses/recurring");
  });
});

describe("saving quickly in a row", () => {
  it("a failed save goes back to the last value confirmed saved, not the one before the change (A→B→C, B saved, C failed)", async () => {
    let resolveB!: (r: { ok: true }) => void;
    let resolveC!: (r: { error: string }) => void;
    saveStartDay
      .mockImplementationOnce(() => new Promise((r) => (resolveB = r)))
      .mockImplementationOnce(() => new Promise((r) => (resolveC = r)));
    render(<BudgetSection startDay={1} nextBudgetStart="2026-12-01" />);
    const select = screen.getByLabelText("Budget start day");
    await act(async () => {
      fireEvent.change(select, { target: { value: "10" } });
    });
    await act(async () => {
      fireEvent.change(select, { target: { value: "20" } });
    });
    await act(async () => resolveB({ ok: true }));
    await act(async () => resolveC({ error: "We couldn't save your start day. Check your connection and try again." }));
    expect(screen.getByLabelText("Budget start day")).toHaveValue("10");
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't save your start day.");
  });
});

describe("saving quickly in a row, earlier save fails", () => {
  it("an older failed save doesn't undo a newer one that succeeds (A→B→C, B failed, C saved)", async () => {
    let resolveB!: (r: { error: string }) => void;
    let resolveC!: (r: { ok: true }) => void;
    saveStartDay
      .mockImplementationOnce(() => new Promise((r) => (resolveB = r)))
      .mockImplementationOnce(() => new Promise((r) => (resolveC = r)));
    render(<BudgetSection startDay={1} nextBudgetStart="2026-12-01" />);
    const select = screen.getByLabelText("Budget start day");
    await act(async () => {
      fireEvent.change(select, { target: { value: "10" } });
    });
    await act(async () => {
      fireEvent.change(select, { target: { value: "20" } });
    });
    await act(async () => resolveB({ error: "We couldn't save your start day. Check your connection and try again." }));
    await act(async () => resolveC({ ok: true }));
    expect(screen.getByLabelText("Budget start day")).toHaveValue("20");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("RegionSection", () => {
  const zones = ["Europe/London", "America/New_York", "Asia/Tokyo"];

  it("shows the home time zone and GBP as the only currency", () => {
    render(<RegionSection timezone="Europe/London" zones={zones} />);
    expect(screen.getByRole("heading", { name: "Region" })).toBeInTheDocument();
    expect(screen.getByLabelText("Home time zone")).toHaveValue("Europe/London");
    const currency = screen.getByLabelText("Currency");
    expect(within(currency).getAllByRole("option").map((o) => o.textContent)).toEqual(["Pound sterling (GBP)"]);
    expect(currency).toHaveAccessibleDescription("More currencies later.");
  });

  it("saves a new zone", async () => {
    render(<RegionSection timezone="Europe/London" zones={zones} />);
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Home time zone"), { target: { value: "Asia/Tokyo" } });
    });
    expect(saveHomeTimezone).toHaveBeenCalledWith("Asia/Tokyo");
    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
  });
});

describe("DeleteAccount", () => {
  const assign = vi.fn();
  beforeEach(() => {
    assign.mockReset();
    vi.stubGlobal("location", { ...window.location, assign });
  });
  afterEach(() => vi.unstubAllGlobals());

  function open() {
    render(<DeleteAccount />);
    fireEvent.click(screen.getByRole("button", { name: /Delete my account/ }));
    return screen.getByRole("alertdialog", { name: "Delete your account?" });
  }

  it("asks for DELETE before the delete button works", () => {
    const dialog = open();
    expect(within(dialog).getByText(/can't be undone/)).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Delete account" });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Type DELETE to confirm"), { target: { value: "delete" } });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Type DELETE to confirm"), { target: { value: "DELETE" } });
    expect(confirm).toBeEnabled();
  });

  it("posts the confirmation and follows the redirect to the login page", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, redirected: true, url: "http://localhost/login?deleted=1" });
    vi.stubGlobal("fetch", fetchMock);
    const dialog = open();
    fireEvent.change(within(dialog).getByLabelText("Type DELETE to confirm"), { target: { value: "DELETE" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete account" }));
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/account/delete");
    expect(init.method).toBe("POST");
    expect((init.body as FormData).get("confirm")).toBe("DELETE");
    await waitFor(() => expect(assign).toHaveBeenCalledWith("http://localhost/login?deleted=1"));
  });

  it("treats a redirect anywhere but /login?deleted=1 as a failure (e.g. a signed-out session sent to sign in)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, redirected: true, url: "http://localhost/login?next=%2Fapi%2Faccount%2Fdelete", json: async () => null }),
    );
    const dialog = open();
    fireEvent.change(within(dialog).getByLabelText("Type DELETE to confirm"), { target: { value: "DELETE" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete account" }));
    });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("We couldn't delete your account");
    expect(assign).not.toHaveBeenCalled();
  });

  it("shows the server's error and keeps the dialog open when the delete fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        redirected: false,
        json: async () => ({ error: "We couldn't delete your account. Nothing was removed. Try again in a moment." }),
      }),
    );
    const dialog = open();
    fireEvent.change(within(dialog).getByLabelText("Type DELETE to confirm"), { target: { value: "DELETE" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete account" }));
    });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Nothing was removed");
    expect(assign).not.toHaveBeenCalled();
  });

  it("Keep my account closes the dialog", () => {
    const dialog = open();
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep my account" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

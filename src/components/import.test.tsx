import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  findDuplicatesAction: vi.fn(),
  importAction: vi.fn(),
  undoImportAction: vi.fn(),
}));
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("@/app/(app)/settings/import/actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { ImportWizard } from "./ImportWizard";
import { RecentImports } from "./RecentImports";

const GROCERIES = "11111111-1111-4111-8111-111111111111";
const EATING_OUT = "22222222-2222-4222-8222-222222222222";
const categories = [
  { id: GROCERIES, name: "Groceries", kind: "need" as const },
  { id: EATING_OUT, name: "Eating out", kind: "want" as const },
];

/** A UK bank export: negative = money out, DD/MM/YYYY, a credit, a duplicate of a recorded Tesco, one bad date. */
const BANK = [
  "Date,Description,Amount,Balance",
  "05/11/2026,TESCO STORES 2041,-12.50,1000.00",
  "06/11/2026,PRET A MANGER,-4.99,995.01",
  "07/11/2026,SALARY ACME LTD,2500.00,3495.01",
  "32/11/2026,COSTA,-3.10,3491.91",
  '08/11/2026,"WAGAMAMA, LONDON",-23.40,3468.51',
].join("\r\n");

const csv = (text: string, name = "statement.csv") => new File([text], name, { type: "text/csv" });

async function upload(file: File) {
  const input = screen.getByLabelText("Bank statement (CSV or Excel)");
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
}

async function toPreview() {
  render(<ImportWizard categories={categories} today="2026-11-21" />);
  await upload(csv(BANK));
  await screen.findByRole("heading", { name: "Match the columns" });
  fireEvent.change(screen.getByLabelText("Category"), { target: { value: GROCERIES } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
  });
  await screen.findByRole("heading", { name: "Check and import" });
}

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset();
  router.refresh.mockReset();
  actions.findDuplicatesAction.mockResolvedValue({ duplicates: [0] });
  actions.importAction.mockResolvedValue({ batchId: "b1", inserted: 2 });
});

describe("ImportWizard", () => {
  it("guesses the header, columns and date format from the file", async () => {
    render(<ImportWizard categories={categories} today="2026-11-21" />);
    await upload(csv(BANK));
    expect(await screen.findByRole("heading", { name: "Match the columns" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "First row is a header" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Date column")).toHaveDisplayValue(/Date/);
    expect(screen.getByLabelText("Amount column")).toHaveDisplayValue(/Amount/);
    expect(screen.getByLabelText("Name column")).toHaveDisplayValue(/Description/);
    expect(screen.getByLabelText("Date format")).toHaveDisplayValue("DD/MM/YYYY");
    expect(screen.getByRole("radio", { name: "Negative numbers" })).toBeChecked();
  });

  it("needs a category before the preview", async () => {
    render(<ImportWizard categories={categories} today="2026-11-21" />);
    await upload(csv(BANK));
    await screen.findByRole("heading", { name: "Match the columns" });
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(await screen.findByText("Choose a category for these expenses.")).toBeInTheDocument();
    expect(actions.findDuplicatesAction).not.toHaveBeenCalled();
  });

  it("previews every row: duplicates unticked and labelled, errors listed with row numbers, credits noted", async () => {
    await toPreview();
    expect(actions.findDuplicatesAction).toHaveBeenCalledWith([
      { row: 2, date: "2026-11-05", amountPence: 1250, name: "TESCO STORES 2041" },
      { row: 3, date: "2026-11-06", amountPence: 499, name: "PRET A MANGER" },
      { row: 6, date: "2026-11-08", amountPence: 2340, name: "WAGAMAMA, LONDON" },
    ]);
    expect(screen.getByText("2 to import · 1 duplicate skipped · 1 error")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /TESCO STORES 2041/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /PRET A MANGER/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /WAGAMAMA, LONDON/ })).toBeChecked();
    expect(screen.getByText("Looks like a duplicate")).toBeInTheDocument();
    expect(screen.getByText(/Row 5: Date “32\/11\/2026” isn’t a real DD\/MM\/YYYY date/)).toBeInTheDocument();
    expect(screen.getByText(/Credits aren’t imported/)).toHaveTextContent("1 row of money in");
    expect(screen.getByRole("button", { name: "Import 2 expenses" })).toBeEnabled();
  });

  it("saves nothing until Import is pressed, then sends only the ticked rows", async () => {
    await toPreview();
    fireEvent.click(screen.getByRole("checkbox", { name: /PRET A MANGER/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /TESCO STORES 2041/ }));
    expect(actions.importAction).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Import 2 expenses" }));
    });
    expect(actions.importAction).toHaveBeenCalledTimes(1);
    expect(actions.importAction).toHaveBeenCalledWith({
      filename: "statement.csv",
      categoryId: GROCERIES,
      rows: [
        { row: 2, date: "2026-11-05", amountPence: 1250, name: "TESCO STORES 2041" },
        { row: 6, date: "2026-11-08", amountPence: 2340, name: "WAGAMAMA, LONDON" },
      ],
    });
    expect(await screen.findByRole("heading", { name: "Imported 2 expenses" })).toBeInTheDocument();
  });

  it("sends a row's own category when it was changed", async () => {
    await toPreview();
    fireEvent.click(screen.getByRole("button", { name: "Category for WAGAMAMA, LONDON: Groceries. Change" }));
    const sheet = await screen.findByRole("dialog");
    fireEvent.change(within(sheet).getByLabelText("Category"), { target: { value: EATING_OUT } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Done" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Import 2 expenses" }));
    });
    expect(actions.importAction.mock.calls[0][0].rows).toContainEqual({
      row: 6,
      date: "2026-11-08",
      amountPence: 2340,
      name: "WAGAMAMA, LONDON",
      categoryId: EATING_OUT,
    });
  });

  it("offers nothing to import when every row is already recorded (re-importing the same file)", async () => {
    actions.findDuplicatesAction.mockResolvedValue({ duplicates: [0, 1, 2] });
    await toPreview();
    expect(screen.getByText("0 to import · 3 duplicates skipped · 1 error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import 0 expenses" })).toBeDisabled();
    expect(actions.importAction).not.toHaveBeenCalled();
  });

  it("keeps the preview and shows the error when the import fails", async () => {
    actions.importAction.mockResolvedValue({ error: "We couldn't import these expenses. Nothing was saved." });
    await toPreview();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Import 2 expenses" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Nothing was saved");
    expect(screen.getByRole("heading", { name: "Check and import" })).toBeInTheDocument();
  });

  it("refuses a file over 2 MB and a file with no rows", async () => {
    render(<ImportWizard categories={categories} today="2026-11-21" />);
    await upload(csv("x".repeat(2 * 1024 * 1024 + 1)));
    expect(await screen.findByRole("alert")).toHaveTextContent("over 2 MB");
    await upload(csv("Date,Description,Amount\n"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("no rows to import"));
  });

  it("refuses a file that isn't a CSV", async () => {
    render(<ImportWizard categories={categories} today="2026-11-21" />);
    await upload(new File(["x"], "statement.pdf", { type: "application/pdf" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a .csv or .xlsx file");
  });

  it("reads positive numbers as spending when chosen", async () => {
    actions.findDuplicatesAction.mockResolvedValue({ duplicates: [] });
    render(<ImportWizard categories={categories} today="2026-11-21" />);
    await upload(csv(BANK));
    await screen.findByRole("heading", { name: "Match the columns" });
    fireEvent.click(screen.getByRole("radio", { name: "Positive numbers" }));
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: GROCERIES } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    });
    await screen.findByRole("heading", { name: "Check and import" });
    expect(screen.getByRole("checkbox", { name: /SALARY ACME LTD/ })).toBeChecked();
    expect(screen.queryByRole("checkbox", { name: /PRET/ })).toBeNull();
  });
});

describe("RecentImports", () => {
  const imports = [{ id: "b1", filename: "november.csv", importedOn: "2026-11-21", rowCount: 42 }];

  it("lists imports and undoes one only after confirming", async () => {
    actions.undoImportAction.mockResolvedValue({ removed: 42 });
    render(<RecentImports imports={imports} />);
    expect(screen.getByText("november.csv")).toBeInTheDocument();
    expect(screen.getByText("21 Nov 2026 · 42 expenses")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo import of november.csv" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(actions.undoImportAction).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Undo import" }));
    });
    expect(actions.undoImportAction).toHaveBeenCalledWith("b1");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("says when there are none", () => {
    render(<RecentImports imports={[]} />);
    expect(screen.getByText("No imports yet")).toBeInTheDocument();
  });
});

describe("ImportWizard focus", () => {
  it("moves focus to each new step's heading", async () => {
    actions.findDuplicatesAction.mockResolvedValue({ duplicates: [] });
    await toPreview();
    expect(screen.getByRole("heading", { name: "Check and import" })).toHaveFocus();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Import \d+ expenses$/ }));
    });
    expect(await screen.findByRole("heading", { name: /^Imported/ })).toHaveFocus();
  });
});

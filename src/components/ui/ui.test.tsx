import { fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  AmountInput,
  BottomSheet,
  Button,
  Money,
  ProgressBar,
  StatusBadge,
} from "@/components/ui";

describe("ProgressBar", () => {
  it("renders full width with the danger fill when over, whatever the percent", () => {
    render(<ProgressBar percent={40} state="over" label="Groceries" />);
    const fill = screen.getByRole("progressbar").firstElementChild as HTMLElement;
    expect(fill.style.width).toBe("100%");
    expect(fill).toHaveClass("bg-danger");
  });

  it("renders the clamped percent with the accent fill when normal", () => {
    render(<ProgressBar percent={140} state="normal" label="Groceries" />);
    const bar = screen.getByRole("progressbar");
    const fill = bar.firstElementChild as HTMLElement;
    expect(fill.style.width).toBe("100%");
    expect(fill).toHaveClass("bg-accent");
    expect(fill).not.toHaveClass("bg-danger");
    expect(bar).toHaveAttribute("aria-valuenow", "100");
  });
});

describe("Money", () => {
  it("shows a negative amount in danger when tone is auto", () => {
    render(<Money pence={-10000} />);
    const el = screen.getByText("-£100.00");
    expect(el).toHaveClass("text-danger");
    expect(el).toHaveClass("tabular-nums");
  });

  it("does not colour a negative amount when tone is neutral", () => {
    render(<Money pence={-10000} tone="neutral" />);
    expect(screen.getByText("-£100.00")).not.toHaveClass("text-danger");
  });
});

describe("Button", () => {
  it("renders distinct classes for danger and primary", () => {
    render(
      <>
        <Button variant="primary">Save</Button>
        <Button variant="danger">Delete</Button>
      </>,
    );
    const primary = screen.getByRole("button", { name: "Save" }).className;
    const danger = screen.getByRole("button", { name: "Delete" }).className;
    expect(primary).not.toBe(danger);
    expect(primary).toContain("bg-accent");
    expect(danger).toContain("bg-danger");
  });
});

describe("AmountInput", () => {
  it('rejects "0" with an inline message', () => {
    const onValueChange = vi.fn();
    render(<AmountInput label="Amount" onValueChange={onValueChange} />);
    const input = screen.getByLabelText("Amount");
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);
    expect(screen.getByRole("alert")).toHaveTextContent(/greater than £0/i);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(onValueChange).toHaveBeenLastCalledWith(null);
  });

  it("accepts a valid amount and reports pence", () => {
    const onValueChange = vi.fn();
    render(<AmountInput label="Amount" onValueChange={onValueChange} />);
    const input = screen.getByLabelText("Amount");
    fireEvent.change(input, { target: { value: "12.50" } });
    fireEvent.blur(input);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onValueChange).toHaveBeenLastCalledWith(1250);
  });
});

describe("BottomSheet", () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        <BottomSheet open={open} onClose={() => setOpen(false)} title="Add expense">
          <p>Sheet body</p>
        </BottomSheet>
      </>
    );
  }

  it("renders its children as a modal dialog and closes on Escape", () => {
    // StrictMode re-runs effects, as `next dev` does; focus must still return.
    render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    );
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Add expense" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Sheet body")).toBeInTheDocument();
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });
});

describe("BottomSheet focus", () => {
  it("returns focus to the opener even when a child autofocuses", () => {
    function Opener() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          <BottomSheet open={open} onClose={() => setOpen(false)} title="Add expense">
            <input aria-label="Amount" autoFocus />
          </BottomSheet>
        </>
      );
    }
    render(
      <StrictMode>
        <Opener />
      </StrictMode>,
    );
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByLabelText("Amount")).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(opener).toHaveFocus();
  });
});

describe("StatusBadge", () => {
  it.each([
    ["on_track", "On Track"],
    ["spending_fast", "Spending Fast"],
    ["out_of_budget", "Out of Budget"],
  ] as const)("maps %s to %s", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

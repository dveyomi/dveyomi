import { fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  AmountInput,
  BottomSheet,
  Button,
  Chip,
  ConfirmDialog,
  Gauge,
  Money,
  ProgressBar,
  RadioSegments,
  Skeleton,
  SegmentedTabs,
  StatusBadge,
  Toggle,
} from "@/components/ui";

/** 44px minimum tap target: Tailwind h-11 / min-h-11 / size-11 (11 × --space-1 = 44px). */
const TAP_44 = /(?:^|\s)(?:min-h-11|h-11|size-11|min-h-12|h-12|h-14)(?:\s|$)/;

describe("ProgressBar", () => {
  it("renders full width with the danger fill when over, whatever the percent", () => {
    render(<ProgressBar percent={40} state="over" label="Groceries" />);
    const fill = screen.getByRole("progressbar").firstElementChild as HTMLElement;
    expect(fill.style.width).toBe("100%");
    expect(fill).toHaveClass("bg-danger-fg");
  });

  it("renders the clamped percent with the accent fill when normal", () => {
    render(<ProgressBar percent={140} state="normal" label="Groceries" />);
    const bar = screen.getByRole("progressbar");
    const fill = bar.firstElementChild as HTMLElement;
    expect(fill.style.width).toBe("100%");
    expect(fill).toHaveClass("bg-accent-fg");
    expect(fill).not.toHaveClass("bg-danger-fg");
    expect(bar).toHaveAttribute("aria-valuenow", "100");
  });
});

describe("over state is announced", () => {
  it("ProgressBar over has aria-valuetext", () => {
    render(<ProgressBar percent={40} state="over" label="Groceries" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "Over budget");
  });

  it("Gauge over has aria-valuetext", () => {
    render(<Gauge percent={40} state="over" label="Budget used" />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", "Over budget");
  });
});

describe("tap targets", () => {
  it("Chip is at least 44px tall", () => {
    render(<Chip label="Groceries" />);
    expect(screen.getByRole("button", { name: "Groceries" }).className).toMatch(TAP_44);
  });

  it("every SegmentedTabs tab is at least 44px tall", () => {
    render(
      <SegmentedTabs
        label="Period"
        value="month"
        onChange={() => {}}
        options={[
          { value: "week", label: "Week" },
          { value: "month", label: "Month" },
        ]}
      />,
    );
    for (const tab of screen.getAllByRole("tab")) expect(tab.className).toMatch(TAP_44);
  });

  it("Toggle's whole row is the 44px target, toggles from its label and links the description", () => {
    const onChange = vi.fn();
    render(
      <Toggle label="Paid from a fund" description="Counts in expenses" checked={false} onChange={onChange} />,
    );
    const toggle = screen.getByRole("switch", { name: "Paid from a fund" });
    expect(toggle).toHaveAccessibleDescription("Counts in expenses");
    const row = screen.getByText("Paid from a fund").closest("label");
    expect(row).not.toBeNull();
    expect(row!.className).toMatch(TAP_44);
    fireEvent.click(screen.getByText("Paid from a fund"));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("Money", () => {
  it("shows a negative amount in danger when tone is auto", () => {
    render(<Money pence={-10000} />);
    const el = screen.getByText("-£100.00");
    expect(el).toHaveClass("text-danger-fg");
    expect(el).toHaveClass("tabular-nums");
  });

  it("does not colour a negative amount when tone is neutral", () => {
    render(<Money pence={-10000} tone="neutral" />);
    expect(screen.getByText("-£100.00")).not.toHaveClass("text-danger-fg");
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

describe("AmountInput allowZero", () => {
  it("accepts 0 (and empty) without an error and reports 0 pence", () => {
    const onValueChange = vi.fn();
    render(<AmountInput label="Saved each month" allowZero name="saved" onValueChange={onValueChange} />);
    const input = screen.getByLabelText("Saved each month");
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onValueChange).toHaveBeenLastCalledWith(0);
    expect(document.querySelector('input[name="saved"]')).toHaveValue("0");
    fireEvent.change(input, { target: { value: "x" } });
    expect(screen.getByRole("alert")).toHaveTextContent(/0\.00 or more/i);
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

describe("AmountInput controlled", () => {
  it("follows value/onChange so a form can clear it, and still shows the inline error", () => {
    function Form() {
      const [text, setText] = useState("");
      return (
        <>
          <AmountInput label="Amount" value={text} onChange={setText} />
          <button onClick={() => setText("")}>Clear</button>
        </>
      );
    }
    render(<Form />);
    const input = screen.getByLabelText("Amount");
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);
    expect(input).toHaveValue("0");
    expect(screen.getByRole("alert")).toHaveTextContent(/greater than £0/i);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(input).toHaveValue("");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("stacked dialogs", () => {
  it("Escape closes only the top-most dialog (ConfirmDialog over a BottomSheet)", () => {
    function Stack() {
      const [sheet, setSheet] = useState(true);
      const [confirm, setConfirm] = useState(true);
      return (
        <>
          <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Edit transaction">
            <p>Sheet body</p>
          </BottomSheet>
          <ConfirmDialog
            open={confirm}
            title="Delete transaction?"
            body="This cannot be undone."
            confirmLabel="Delete"
            tone="danger"
            onConfirm={() => setConfirm(false)}
            onCancel={() => setConfirm(false)}
          />
        </>
      );
    }
    render(
      <StrictMode>
        <Stack />
      </StrictMode>,
    );
    expect(screen.getByRole("alertdialog", { name: "Delete transaction?" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("dialog", { name: "Edit transaction" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
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

describe("RadioSegments", () => {
  const options = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "Match device" },
  ] as const;

  function Controlled({ onChange = () => {} }: { onChange?: (v: string) => void }) {
    const [value, setValue] = useState<string>("light");
    return (
      <RadioSegments
        label="Theme"
        options={[...options]}
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange(v);
        }}
      />
    );
  }

  it("is a labelled radiogroup with the current option checked", () => {
    render(<Controlled />);
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "false");
  });

  it("selects on click", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Match device" }));
    expect(onChange).toHaveBeenCalledWith("system");
    expect(screen.getByRole("radio", { name: "Match device" })).toHaveAttribute("aria-checked", "true");
  });

  it("has one tab stop, and arrow keys move and select (wrapping)", () => {
    render(<Controlled />);
    const [light, dark, system] = screen.getAllByRole("radio");
    expect(light).toHaveAttribute("tabindex", "0");
    expect(dark).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(light, { key: "ArrowRight" });
    expect(dark).toHaveAttribute("aria-checked", "true");
    expect(dark).toHaveFocus();
    fireEvent.keyDown(dark, { key: "ArrowDown" });
    expect(system).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(system, { key: "ArrowRight" });
    expect(light).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(light, { key: "ArrowUp" });
    expect(system).toHaveAttribute("aria-checked", "true");
  });

  it("Home and End select the first and last option", () => {
    render(<Controlled />);
    const [light, , system] = screen.getAllByRole("radio");
    fireEvent.keyDown(light, { key: "End" });
    expect(system).toHaveAttribute("aria-checked", "true");
    expect(system).toHaveFocus();
    fireEvent.keyDown(system, { key: "Home" });
    expect(light).toHaveAttribute("aria-checked", "true");
    expect(light).toHaveFocus();
  });

  it("marks the checked option with an accent-fg edge, not the fill alone", () => {
    render(<Controlled />);
    expect(screen.getByRole("radio", { name: "Light" })).toHaveClass("border-accent-fg");
    expect(screen.getByRole("radio", { name: "Dark" })).not.toHaveClass("border-accent-fg");
  });

  it("every option is at least 44px tall", () => {
    render(<Controlled />);
    for (const radio of screen.getAllByRole("radio")) expect(radio.className).toMatch(TAP_44);
  });
});

describe("Toggle checked edge", () => {
  it("draws an accent-fg edge round the checked track (lime alone is too faint on white)", () => {
    const { rerender } = render(<Toggle label="Fund" checked onChange={() => {}} />);
    expect(screen.getByRole("switch")).toHaveClass("ring-accent-fg");
    rerender(<Toggle label="Fund" checked={false} onChange={() => {}} />);
    expect(screen.getByRole("switch")).not.toHaveClass("ring-accent-fg");
  });
});

describe("Skeleton", () => {
  it("is hidden from assistive tech and sized by shape", () => {
    const { container } = render(
      <>
        <Skeleton shape="segments" />
        <Skeleton shape="card" />
      </>,
    );
    const [segments, card] = Array.from(container.children);
    for (const el of [segments, card]) expect(el).toHaveAttribute("aria-hidden", "true");
    expect(segments.className).not.toBe(card.className);
  });
});

import { createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  AmountInput,
  BottomSheet,
  Button,
  ButtonLink,
  Checkbox,
  Chip,
  ConfirmDialog,
  FileDrop,
  Donut,
  SeriesSwatch,
  Gauge,
  IconButton,
  ListRow,
  Money,
  Notice,
  ProgressBar,
  RadioCards,
  RadioSegments,
  Select,
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

  it("Gauge announces its figure through valueText, since a meter's children are presentational", () => {
    render(<Gauge percent={40} state="normal" label="Left to spend" valueText="£400.00 left" />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", "£400.00 left");
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

describe("ButtonLink", () => {
  it("is a link styled like the matching Button, with a 44px tap target", () => {
    render(
      <>
        <Button variant="secondary">Edit</Button>
        <ButtonLink href="/budget/edit" variant="secondary" icon="edit">
          Set new budget
        </ButtonLink>
      </>,
    );
    const link = screen.getByRole("link", { name: "Set new budget" });
    expect(link).toHaveAttribute("href", "/budget/edit");
    expect(link.className).toMatch(TAP_44);
    for (const c of screen.getByRole("button", { name: "Edit" }).className.split(/\s+/).filter(Boolean)) {
      expect(link).toHaveClass(c);
    }
    expect(link.querySelector("svg")).not.toBeNull();
  });

  it("can collapse to a square icon on phones while keeping its name for screen readers", () => {
    render(
      <ButtonLink href="/expenses/trips" variant="secondary" icon="plane" iconOnlyOnPhone>
        Trips
      </ButtonLink>,
    );
    const link = screen.getByRole("link", { name: "Trips" });
    expect(link).toHaveClass("max-sm:size-11", "max-sm:px-0");
    expect(link.className).toMatch(TAP_44);
    expect(screen.getByText("Trips")).toHaveClass("max-sm:sr-only");
  });
});

describe("Notice", () => {
  it("uses the tone's tint with its text-safe foreground and an icon", () => {
    render(<Notice tone="danger">Allocations are over</Notice>);
    const notice = screen.getByText("Allocations are over").closest("[data-tone]") as HTMLElement;
    expect(notice).toHaveAttribute("data-tone", "danger");
    expect(notice).toHaveClass("bg-danger/15", "text-danger-fg");
    expect(notice.querySelector("svg")).not.toBeNull();
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

describe("AmountInput autoFocus", () => {
  it("takes focus when it mounts, for a screen opened on one amount", () => {
    render(
      <>
        <AmountInput label="Rent" value="" onChange={() => {}} />
        <AmountInput label="Eating out" value="" onChange={() => {}} autoFocus />
      </>,
    );
    expect(screen.getByLabelText("Eating out")).toHaveFocus();
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

describe("RadioCards", () => {
  const options = [
    { value: "fund", title: "Move to a fund", description: "Add it to your savings." },
    { value: "next", title: "Add to next budget", description: "Spend it this month." },
  ];

  function Controlled({ onChange = () => {} }: { onChange?: (v: string) => void }) {
    const [value, setValue] = useState<string | null>(null);
    return (
      <RadioCards
        label="Where it goes"
        options={options}
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange(v);
        }}
      />
    );
  }

  it("is a labelled group of native radios, named by title and described by the description, none checked at first", () => {
    render(<Controlled />);
    expect(screen.getByRole("radiogroup", { name: "Where it goes" })).toBeInTheDocument();
    const fund = screen.getByRole("radio", { name: "Move to a fund" });
    expect(fund).toHaveAccessibleDescription("Add it to your savings.");
    expect(fund).not.toBeChecked();
  });

  it("selects on click and reports the value", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Add to next budget" }));
    expect(onChange).toHaveBeenCalledWith("next");
    expect(screen.getByRole("radio", { name: "Add to next budget" })).toBeChecked();
  });

  it("marks the checked card with an accent-fg edge, and every card is at least 44px tall", () => {
    render(<Controlled />);
    fireEvent.click(screen.getByRole("radio", { name: "Move to a fund" }));
    const cards = screen.getAllByRole("radio").map((r) => r.closest("label")!);
    expect(cards[0]).toHaveClass("border-accent-fg");
    expect(cards[1]).not.toHaveClass("border-accent-fg");
    for (const card of cards) expect(card.className).toMatch(TAP_44);
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

describe("Select groups", () => {
  it("renders options under labelled groups, after any ungrouped ones", () => {
    render(
      <Select
        label="Category"
        value="rent"
        onChange={() => {}}
        groups={[
          { label: "Needs", options: [{ value: "rent", label: "Rent" }] },
          { label: "Wants", options: [{ value: "gifts", label: "Gifts" }] },
        ]}
        options={[{ value: "new", label: "New category" }]}
      />,
    );
    const select = screen.getByLabelText("Category");
    const groups = select.querySelectorAll("optgroup");
    expect([...groups].map((g) => g.label)).toEqual(["Needs", "Wants"]);
    expect(groups[0]).toHaveTextContent("Rent");
    expect(groups[1]).toHaveTextContent("Gifts");
    expect(select).toHaveValue("rent");
    expect(select.lastElementChild).toHaveTextContent("New category");
  });

  it("leaves out an empty group", () => {
    render(<Select label="Category" options={[]} groups={[{ label: "Needs", options: [] }]} />);
    expect(screen.getByLabelText("Category").querySelector("optgroup")).toBeNull();
  });
});

describe("AmountInput size", () => {
  it("lg shows the figure at display size for a screen built around one amount", () => {
    render(<AmountInput label="Amount" size="lg" value="" onChange={() => {}} />);
    expect(screen.getByLabelText("Amount")).toHaveClass("text-display");
  });

  it("defaults to title size", () => {
    render(<AmountInput label="Amount" value="" onChange={() => {}} />);
    expect(screen.getByLabelText("Amount")).toHaveClass("text-title");
  });
});

describe("IconButton variant", () => {
  it("primary uses the accent fill with ink, keeping the 44px target", () => {
    render(<IconButton icon="check" label="Save" variant="primary" />);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveClass("bg-accent", "text-accent-ink");
    expect(button.className).toMatch(TAP_44);
  });

  it("defaults to the neutral raised style", () => {
    render(<IconButton icon="close" label="Close" />);
    expect(screen.getByRole("button", { name: "Close" })).toHaveClass("bg-card-raised", "text-text");
  });
});

describe("Donut", () => {
  const slices = [
    { key: "travel", label: "Travel", pence: 3500, percent: 74, series: 1 as const },
    { key: "food", label: "Groceries", pence: 1250, percent: 26, series: 2 as const },
  ];

  it("draws one token-coloured arc per slice, hidden from assistive tech", () => {
    const { container } = render(<Donut label="Spending by category" slices={slices} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    const arcs = svg.querySelectorAll("[data-slice]");
    expect(arcs).toHaveLength(2);
    expect(arcs[0].getAttribute("class")).toContain("stroke-chart-1");
    expect(arcs[1].getAttribute("class")).toContain("stroke-chart-2");
  });

  it("gives a table alternative with each slice's name, amount and share", () => {
    render(<Donut label="Spending by category" slices={slices} />);
    const table = screen.getByRole("table", { name: "Spending by category" });
    const rows = within(table).getAllByRole("row").map((r) => r.textContent);
    expect(rows).toEqual(["CategoryAmountShare", "Travel£35.0074%", "Groceries£12.5026%"]);
  });

  it("shows only the track with nothing to draw, and the centre content", () => {
    const { container } = render(
      <Donut label="Spending by category" slices={[]}>
        <span>£0.00</span>
      </Donut>,
    );
    expect(container.querySelectorAll("[data-slice]")).toHaveLength(0);
    expect(screen.getByText("£0.00")).toBeInTheDocument();
  });

  it("an Other slice uses the neutral series colour", () => {
    const { container } = render(
      <Donut label="x" slices={[{ key: "other", label: "Other", pence: 100, percent: 100, series: "other" }]} />,
    );
    expect(container.querySelector("[data-slice]")!.getAttribute("class")).toContain("stroke-chart-other");
  });

  it("SeriesSwatch marks a legend row with the slice's colour, hidden from assistive tech", () => {
    const { container } = render(<SeriesSwatch series={3} />);
    expect(container.firstChild).toHaveClass("bg-chart-3");
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Checkbox", () => {
  function Controlled({ initial = false }: { initial?: boolean }) {
    const [checked, setChecked] = useState(initial);
    return (
      <Checkbox checked={checked} onChange={setChecked}>
        Tesco
      </Checkbox>
    );
  }

  it("is a native checkbox named by its content, with a 44px row as the tap target", () => {
    render(<Controlled />);
    const box = screen.getByRole("checkbox", { name: "Tesco" });
    expect(box).not.toBeChecked();
    expect(box.closest("label")!.className).toMatch(TAP_44);
    fireEvent.click(screen.getByText("Tesco"));
    expect(box).toBeChecked();
  });

  it("can start ticked", () => {
    render(<Controlled initial />);
    expect(screen.getByRole("checkbox", { name: "Tesco" })).toBeChecked();
  });
});

describe("FileDrop", () => {
  const file = () => new File(["a,b"], "bank.csv", { type: "text/csv" });

  it("is a labelled file input that hands over the chosen file", () => {
    const onFile = vi.fn();
    render(<FileDrop label="Bank statement" hint="A .csv file" accept=".csv" onFile={onFile} />);
    const input = screen.getByLabelText("Bank statement");
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("accept", ".csv");
    expect(input).toHaveAccessibleDescription("A .csv file");
    const chosen = file();
    fireEvent.change(input, { target: { files: [chosen] } });
    expect(onFile).toHaveBeenCalledWith(chosen);
  });

  it("takes a dropped file too", () => {
    const onFile = vi.fn();
    render(<FileDrop label="Bank statement" accept=".csv" onFile={onFile} />);
    const dropped = file();
    fireEvent.drop(screen.getByText(/drop/i).closest("div")!, { dataTransfer: { files: [dropped] } });
    expect(onFile).toHaveBeenCalledWith(dropped);
  });

  it("keeps the drag highlight while the pointer moves over the area's own children", () => {
    render(<FileDrop label="Bank statement" accept=".csv" onFile={() => {}} />);
    const area = screen.getByText(/drop/i).closest("div")!;
    const child = screen.getByText("Choose file");
    fireEvent.dragOver(area);
    expect(area.className).toContain("bg-card-raised");
    // jsdom's drag events don't carry relatedTarget, so set it on the event.
    const leave = (relatedTarget: Element) => {
      const event = createEvent.dragLeave(area);
      Object.defineProperty(event, "relatedTarget", { value: relatedTarget });
      fireEvent(area, event);
    };
    leave(child);
    expect(area.className).toContain("border-accent-fg");
    leave(document.body);
    expect(area.className).not.toContain("border-accent-fg");
  });

  it("shows an error instead of the hint", () => {
    render(<FileDrop label="Bank statement" hint="A .csv file" accept=".csv" error="Too big" onFile={() => {}} />);
    expect(screen.getByLabelText("Bank statement")).toHaveAccessibleDescription("Too big");
    expect(screen.getByRole("alert")).toHaveTextContent("Too big");
  });
});

describe("ListRow download", () => {
  it("is a plain link with the download attribute, not a client-side navigation", () => {
    render(<ListRow icon="download" title="Export my data" download href="/api/export" />);
    const link = screen.getByRole("link", { name: /Export my data/ });
    expect(link).toHaveAttribute("href", "/api/export");
    expect(link).toHaveAttribute("download");
  });
});

describe("ListRow tone", () => {
  it("colours a danger row's title with the text-safe danger token", () => {
    render(<ListRow icon="trash" title="Delete my account" tone="danger" onClick={() => {}} />);
    const title = screen.getByText("Delete my account");
    expect(title.className).toContain("text-danger-fg");
  });
});

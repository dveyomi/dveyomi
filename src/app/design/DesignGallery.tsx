"use client";

import { useState, type ReactNode } from "react";
import {
  AmountInput,
  Badge,
  BottomSheet,
  Button,
  ButtonLink,
  Card,
  Chip,
  ConfirmDialog,
  EmptyState,
  Gauge,
  Icon,
  IconButton,
  iconNames,
  ListRow,
  Money,
  Notice,
  ProgressBar,
  RadioSegments,
  SegmentedTabs,
  Select,
  Skeleton,
  StatusBadge,
  TextField,
  Toggle,
} from "@/components/ui";

const colours = [
  ["--bg", "bg-bg"],
  ["--card", "bg-card"],
  ["--card-raised", "bg-card-raised"],
  ["--border", "bg-border"],
  ["--text", "bg-text"],
  ["--muted", "bg-muted"],
  ["--accent", "bg-accent"],
  ["--accent-ink", "bg-accent-ink"],
  ["--accent-fg", "bg-accent-fg"],
  ["--danger", "bg-danger"],
  ["--danger-fg", "bg-danger-fg"],
  ["--warning", "bg-warning"],
  ["--warning-fg", "bg-warning-fg"],
  ["--positive", "bg-positive"],
  ["--positive-fg", "bg-positive-fg"],
  ["--border-strong", "bg-border-strong"],
] as const;

const typeScale = [
  ["--text-display", "text-display font-semibold", "£4,301.78"],
  ["--text-title", "text-title font-semibold", "Safe to spend today"],
  ["--text-body", "text-body", "Groceries, 12 transactions"],
  ["--text-caption", "text-caption text-muted", "Updated 2 minutes ago"],
] as const;

const spacing = [
  ["--space-1", "w-1"],
  ["--space-2", "w-2"],
  ["--space-3", "w-3"],
  ["--space-4", "w-4"],
  ["--space-5", "w-5"],
  ["--space-6", "w-6"],
  ["--space-7", "w-7"],
  ["--space-8", "w-8"],
] as const;

const radii = [
  ["--radius-sm", "rounded-sm"],
  ["--radius-md", "rounded-md"],
  ["--radius-pill", "rounded-pill"],
] as const;

const bars: { label: string; percent: number; state: "normal" | "over" }[] = [
  { label: "Empty", percent: 0, state: "normal" },
  { label: "Normal 45%", percent: 45, state: "normal" },
  { label: "Full 100%", percent: 100, state: "normal" },
  { label: "Over (percent 30)", percent: 30, state: "over" },
];

const categories = [
  { value: "groceries", label: "Groceries" },
  { value: "eating-out", label: "Eating out" },
  { value: "transport", label: "Transport" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-8">
      <h2 className="text-title font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Renders the same content at phone width and at desktop width, side by side on large screens. */
function Widths({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6 xl:flex-row">
      <div className="flex w-full max-w-phone shrink-0 flex-col gap-2">
        <span className="text-caption text-muted">Phone · 390</span>
        <div className="@container flex flex-col gap-4">{children}</div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-caption text-muted">Desktop</span>
        <div className="@container flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <span className="text-caption text-muted">{children}</span>;
}

/** `themeSwitch`: the Light / Dark / Match device control, so every component can be checked in both themes. */
export function DesignGallery({ themeSwitch }: { themeSwitch: ReactNode }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");
  const [toggle, setToggle] = useState(true);
  const [chip, setChip] = useState("groceries");
  const [repeat, setRepeat] = useState<"weekly" | "monthly" | "yearly">("monthly");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-display font-semibold tracking-tight">Design system</h1>
        <p className="text-body text-muted">
          Every token and component. Change a value in src/design/tokens.css; change a
          component&apos;s look in its file under src/components/ui.
        </p>
        <div className="mt-2 flex max-w-phone flex-col gap-2">
          <Label>Theme (the same control as Settings)</Label>
          {themeSwitch}
        </div>
      </header>

      <Section title="Colour">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {colours.map(([token, swatch]) => (
            <div key={token} className="flex flex-col gap-2">
              <div className={`h-16 rounded-md border border-border ${swatch}`} />
              <Label>{token}</Label>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type">
        {typeScale.map(([token, cls, sample]) => (
          <div key={token} className="flex flex-col gap-1">
            <span className={`tabular-nums ${cls}`}>{sample}</span>
            <Label>{token}</Label>
          </div>
        ))}
      </Section>

      <Section title="Spacing, radii, elevation">
        <div className="flex flex-wrap items-end gap-4">
          {spacing.map(([token, w]) => (
            <div key={token} className="flex flex-col items-center gap-2">
              <div className={`h-8 rounded-sm bg-accent ${w}`} />
              <Label>{token}</Label>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-4">
          {radii.map(([token, r]) => (
            <div key={token} className="flex flex-col items-center gap-2">
              <div className={`size-16 border border-border bg-card-raised ${r}`} />
              <Label>{token}</Label>
            </div>
          ))}
          <div className="flex flex-col items-center gap-2">
            <div className="size-16 rounded-md bg-card shadow-sheet" />
            <Label>--shadow-sheet</Label>
          </div>
        </div>
      </Section>

      <Section title="Icon">
        <div className="flex flex-wrap gap-4">
          {iconNames.map((name) => (
            <div key={name} className="flex w-20 flex-col items-center gap-2 text-text">
              <Icon name={name} size="lg" />
              <Label>{name}</Label>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Button, ButtonLink and IconButton">
        <Widths>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" size="lg">
              Large
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
            <IconButton icon="plus" label="Add" />
            <IconButton icon="edit" label="Edit" />
            <IconButton icon="close" label="Close" disabled />
            <IconButton icon="check" label="Save" variant="primary" />
          </div>
          <Button variant="primary" size="lg" fullWidth>
            Full width
          </Button>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/design" variant="secondary" icon="edit">
              Link as button
            </ButtonLink>
            <ButtonLink href="/design" variant="ghost" icon="chevron-left">
              Back
            </ButtonLink>
          </div>
        </Widths>
      </Section>

      <Section title="Money, Notice, Badge, StatusBadge, Chip">
        <Widths>
          <div className="flex flex-wrap items-baseline gap-4">
            <Money pence={430178} size="display" />
            <Money pence={86036} size="title" />
            <Money pence={-10000} />
            <Money pence={-10000} tone="neutral" />
            <Money pence={0} size="caption" />
          </div>
          <div className="flex flex-col gap-2">
            <Notice tone="danger">Your allocations are £400.00 more than your spending money.</Notice>
            <Notice tone="warning">Wants spending is ahead of the month.</Notice>
            <Notice tone="neutral">Expenses paid from a fund don&apos;t count toward this budget.</Notice>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">Neutral</Badge>
            <Badge tone="positive">Positive</Badge>
            <Badge tone="warning">Warning</Badge>
            <Badge tone="danger">Danger</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status="on_track" />
            <StatusBadge status="spending_fast" />
            <StatusBadge status="out_of_budget" />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Chip
                key={c.value}
                label={c.label}
                selected={chip === c.value}
                onClick={() => setChip(c.value)}
              />
            ))}
            <Chip label="Disabled" disabled />
          </div>
        </Widths>
      </Section>

      <Section title="Gauge and ProgressBar">
        <Widths>
          <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-3">
            <Card>
              <Gauge percent={62} state="normal" label="Budget used">
                <Label>Left to spend</Label>
                <Money pence={430178} size="title" />
                <StatusBadge status="on_track" />
              </Gauge>
            </Card>
            <Card>
              <Gauge percent={0} state="normal" label="Budget used">
                <Label>Nothing spent</Label>
                <Money pence={0} size="title" />
              </Gauge>
            </Card>
            <Card>
              <Gauge percent={30} state="over" label="Budget used">
                <Label>Over budget</Label>
                <Money pence={-12550} size="title" />
                <StatusBadge status="out_of_budget" />
              </Gauge>
            </Card>
          </div>
          <Card className="flex flex-col gap-4">
            {bars.map(({ label, percent, state }) => (
              <div key={label} className="flex flex-col gap-2">
                <Label>{label}</Label>
                <ProgressBar percent={percent} state={state} label={label} />
              </div>
            ))}
          </Card>
        </Widths>
      </Section>

      <Section title="Card and ListRow">
        <Widths>
          <Card>
            <ListRow
              icon="wallet"
              title="Tesco"
              subtitle="Groceries · Today"
              trailing={<Money pence={-4235} tone="neutral" />}
              href="#"
            />
            <ListRow
              icon="repeat"
              title="Netflix"
              subtitle="Subscriptions · Due 28 Nov"
              trailing={<Money pence={-1099} tone="neutral" />}
              onClick={() => {}}
            />
            <ListRow
              icon="savings"
              title="Holiday fund"
              subtitle="Static row, no action"
              trailing={<Money pence={125000} />}
            />
            <ListRow
              icon="calendar"
              title="A very long merchant name that has to truncate on a phone"
              subtitle="Overspent"
              trailing={<Badge tone="danger">Over</Badge>}
            />
          </Card>
          <Card raised>
            <Label>Raised card</Label>
          </Card>
        </Widths>
      </Section>

      <Section title="Form controls">
        <Widths>
          <AmountInput label="Amount" hint="In pounds, e.g. 12.50" />
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <AmountInput label="Amount (controlled)" value={amount} onChange={setAmount} />
            </div>
            <Button variant="secondary" onClick={() => setAmount("")}>
              Clear
            </Button>
          </div>
          <AmountInput label="Amount (with error)" error="Enter an amount greater than £0.00" />
          <AmountInput label="Amount (optional, 0 allowed)" allowZero hint="Leave empty or enter 0 to skip" />
          <AmountInput label="Amount (large, for Add expense)" size="lg" />
          <TextField label="Note" placeholder="What was it for?" />
          <TextField label="Note (with error)" defaultValue="" error="Add a note" />
          <Select label="Category" options={categories} placeholder="Choose a category" defaultValue="" />
          <Select
            label="Category (grouped)"
            defaultValue="rent"
            groups={[
              { label: "Needs", options: [{ value: "rent", label: "Rent" }] },
              { label: "Wants", options: [{ value: "gifts", label: "Gifts" }] },
            ]}
            options={[{ value: "new", label: "New category…" }]}
          />
          <Toggle
            label="Paid from a fund"
            description="Counts in expenses, not in monthly spent"
            checked={toggle}
            onChange={setToggle}
          />
          <Toggle label="Disabled" checked={false} onChange={() => {}} disabled />
          <SegmentedTabs
            label="Period"
            value={period}
            onChange={setPeriod}
            options={[
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
              { value: "year", label: "Year" },
            ]}
          />
          <Label>RadioSegments: pick one setting (radiogroup), on bg and inside a Card</Label>
          <RadioSegments
            label="Repeats"
            value={repeat}
            onChange={setRepeat}
            options={[
              { value: "weekly", label: "Weekly" },
              { value: "monthly", label: "Monthly" },
              { value: "yearly", label: "Yearly" },
            ]}
          />
          <Card>
            <RadioSegments
              label="Repeats (in a card)"
              value={repeat}
              onChange={setRepeat}
              options={[
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
                { value: "yearly", label: "Yearly" },
              ]}
            />
          </Card>
        </Widths>
      </Section>

      <Section title="Skeleton">
        <Widths>
          <Label>segments: while a RadioSegments streams in</Label>
          <Skeleton shape="segments" />
          <Label>card: while a short Card streams in</Label>
          <Skeleton shape="card" />
        </Widths>
      </Section>

      <Section title="EmptyState">
        <Widths>
          <Card>
            <EmptyState
              icon="chart"
              title="No budget yet"
              body="Set this month's income and allocations to see what is safe to spend."
              action={<Button variant="primary">Set up budget</Button>}
            />
          </Card>
        </Widths>
      </Section>

      <Section title="BottomSheet and ConfirmDialog">
        <p className="text-body text-muted">
          A sheet from the bottom under 768px wide, a centred dialog above.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>
            Open sheet
          </Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Delete transaction
          </Button>
        </div>
        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Add expense">
          <div className="flex flex-col gap-4">
            <AmountInput label="Amount" value={amount} onChange={setAmount} />
            <Select label="Category" options={categories} defaultValue="groceries" />
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => {
                setAmount("");
                setSheetOpen(false);
              }}
            >
              Save
            </Button>
            <Button variant="ghost" fullWidth onClick={() => setConfirmOpen(true)}>
              Delete (opens a dialog over this sheet)
            </Button>
          </div>
        </BottomSheet>
        <ConfirmDialog
          open={confirmOpen}
          title="Delete transaction?"
          body="Tesco, £42.35 on 21 Nov. This cannot be undone."
          confirmLabel="Delete"
          tone="danger"
          onConfirm={() => setConfirmOpen(false)}
          onCancel={() => setConfirmOpen(false)}
        />
      </Section>
    </main>
  );
}

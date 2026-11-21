"use client";

import { useRef, useState, useTransition } from "react";
import {
  AddCategoryForm,
  AllocationRows,
  AllocationSummary,
  KIND_TABS,
  nameClash,
  type Kind,
} from "@/components/AllocationEditor";
import { AmountInput, BottomSheet, Button, ButtonLink, Card, RadioSegments, SegmentedTabs, TextField } from "@/components/ui";
import {
  allocationTotals,
  formatDayMonth,
  formatShortDate,
  parseOptionalPence,
  parsePence,
  type Period,
} from "@/lib/calc";
import { validateBudgetEdit, type BudgetEditScope, type EditorCategory } from "@/lib/data/budgetEdit";
import { MAX_NAME_LENGTH, checkName } from "@/lib/data/onboarding";
import { saveBudgetAction } from "./actions";

type BudgetEditorProps = {
  /** The period containing today. */
  period: Period;
  /** Whether the next period has been created already (a "From next period" edit). */
  nextExists: boolean;
  incomePence: number;
  savingsPence: number;
  categories: EditorCategory[];
  /** From ?category=: open on this category's tab with its amount focused. */
  focusCategoryId?: string;
};

/** A category row as edited. `id` is set for an existing category; `removed` ones are hidden and saved as removed. */
type Row = { key: string; id?: string; name: string; kind: Kind; amountText: string; removed: boolean };

const SCOPES = [
  { value: "this" as const, label: "From this period" },
  { value: "next" as const, label: "From next period" },
];

const KIND_OPTIONS = [
  { value: "need" as const, label: "Need" },
  { value: "want" as const, label: "Want" },
];

const text = (pence: number) => (pence / 100).toFixed(2);
const livePence = (t: string) => parseOptionalPence(t) ?? 0;

/**
 * Edit budget (§5.3, §5.4): income, savings and every category's allocation,
 * with the live figures from calc, then when the changes start. Nothing is
 * saved until Save, in one go; Cancel leaves everything as it was.
 */
export function BudgetEditor({ period, nextExists, incomePence, savingsPence, categories, focusCategoryId }: BudgetEditorProps) {
  const [incomeText, setIncomeText] = useState(text(incomePence));
  const [savingsText, setSavingsText] = useState(text(savingsPence));
  const [rows, setRows] = useState<Row[]>(() =>
    categories.map((c) => ({ key: c.id, id: c.id, name: c.name, kind: c.kind, amountText: text(c.amountPence), removed: false })),
  );
  const focused = categories.find((c) => c.id === focusCategoryId);
  const [tab, setTab] = useState<Kind>(focused?.kind ?? "need");
  const [focusKey, setFocusKey] = useState<string | undefined>(focused?.id);
  const [scope, setScope] = useState<BudgetEditScope>("this");
  const [editing, setEditing] = useState<Row | null>(null);
  const [error, setError] = useState<{ message: string; field?: "income" | "savings" } | null>(null);
  const [saving, startSaving] = useTransition();
  const nextKey = useRef(1);

  const kept = rows.filter((r) => !r.removed);
  const totals = allocationTotals(
    parsePence(incomeText) ?? 0,
    livePence(savingsText),
    kept.map((r) => ({ kind: r.kind, amountPence: livePence(r.amountText) })),
  );

  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function changeTab(next: Kind) {
    setFocusKey(undefined);
    setTab(next);
  }

  function remove(key: string) {
    setRows((rs) => rs.flatMap((r) => (r.key !== key ? [r] : r.id ? [{ ...r, removed: true }] : [])));
  }

  function add(name: string, amountText: string) {
    // Adding back a category removed in this edit restores it, rather than making a second one.
    const back = rows.find((r) => r.removed && r.name.toLowerCase() === name.toLowerCase());
    if (back) return update(back.key, { removed: false, kind: tab, amountText });
    setRows((rs) => [...rs, { key: `new-${nextKey.current++}`, name, kind: tab, amountText, removed: false }]);
  }

  function save() {
    setError(null);
    const raw = {
      incomePence: parsePence(incomeText) ?? Number.NaN,
      savingsPence: parseOptionalPence(savingsText) ?? Number.NaN,
      scope,
      categories: rows
        .filter((r) => r.id || !r.removed)
        .map((r) => ({
          ...(r.id ? { id: r.id } : {}),
          name: r.name,
          kind: r.kind,
          amountPence: r.removed ? livePence(r.amountText) : (parseOptionalPence(r.amountText) ?? Number.NaN),
          ...(r.removed ? { removed: true } : {}),
        })),
    };
    const checked = validateBudgetEdit(raw);
    if (!checked.ok) return setError({ message: checked.error, field: checked.field });
    startSaving(async () => {
      const result = await saveBudgetAction(raw);
      if (result?.error) setError({ message: result.error });
    });
  }

  const shown = kept.filter((r) => r.kind === tab);
  const nextStartText = formatShortDate(period.nextStart);

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-5 lg:items-start lg:gap-8">
      <div className="order-2 flex flex-col gap-6 lg:col-span-3">
        <Card as="section" className="flex flex-col gap-4">
          <h2 id="money-heading" className="text-body font-semibold text-text">
            Income and savings
          </h2>
          <AmountInput
            label="Monthly income"
            value={incomeText}
            onChange={setIncomeText}
            error={error?.field === "income" ? error.message : null}
          />
          <AmountInput
            label="Pay yourself first"
            value={savingsText}
            onChange={setSavingsText}
            allowZero
            hint="Set aside for savings each month, before spending."
            error={error?.field === "savings" ? error.message : null}
          />
        </Card>

        <section aria-labelledby="categories-heading" className="flex flex-col gap-4">
          <h2 id="categories-heading" className="text-title font-semibold text-text">
            Categories
          </h2>
          <SegmentedTabs label="Category type" options={KIND_TABS} value={tab} onChange={changeTab} />
          <Card className="flex flex-col gap-4">
            <AllocationRows
              kind={tab}
              rows={shown}
              allowZero
              focusKey={focusKey}
              onAmount={(key, amountText) => update(String(key), { amountText })}
              onRemove={(key) => remove(String(key))}
              onEdit={(key) => setEditing(rows.find((r) => r.key === key) ?? null)}
            />
            <AddCategoryForm key={tab} kind={tab} taken={kept.map((r) => r.name)} onAdd={add} />
          </Card>
        </section>
      </div>

      {/* Under lg these join the column above (summary first, then when and save); from lg they are a sticky side panel. */}
      <div className="contents lg:sticky lg:top-8 lg:order-last lg:col-span-2 lg:flex lg:flex-col lg:gap-4">
        <section aria-label="Your budget" className="order-1">
          <AllocationSummary totals={totals} hasCategories={kept.length > 0} />
        </section>

        <Card as="section" className="order-3 flex flex-col gap-3">
          <h2 id="scope-heading" className="text-body font-semibold text-text">
            When the changes start
          </h2>
          <RadioSegments label="When the changes start" options={SCOPES} value={scope} onChange={setScope} />
          <p className="text-caption text-muted">
            {scope === "this"
              ? `Changes this period (${formatDayMonth(period.start)} – ${formatDayMonth(period.end)})${nextExists ? ` and the one from ${nextStartText}` : ""} onward. Past periods stay as they were.`
              : `This period stays as it is. Your new budget starts on ${nextStartText}.`}
          </p>
        </Card>

        <div className="order-4 flex flex-col gap-3">
          {/* Field errors also show here, next to Save, since the field may be scrolled out of view. */}
          {error ? (
            <p role={error.field ? undefined : "alert"} className="text-caption text-danger-fg">
              {error.message}
            </p>
          ) : null}
          <Button variant="primary" size="lg" fullWidth onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save budget"}
          </Button>
          <ButtonLink href="/budget" variant="ghost" fullWidth>
            Cancel
          </ButtonLink>
        </div>
      </div>

      <EditCategorySheet
        row={editing}
        others={kept.filter((r) => r.key !== editing?.key).map((r) => r.name)}
        onClose={() => setEditing(null)}
        onDone={(name, kind) => {
          if (!editing) return;
          update(editing.key, { name, kind });
          if (kind !== tab) setFocusKey(undefined);
          setEditing(null);
        }}
      />
    </div>
  );
}

/** Rename a category and choose need or want, applied to the edit (saved with the rest). */
function EditCategorySheet({
  row,
  others,
  onClose,
  onDone,
}: {
  row: Row | null;
  others: string[];
  onClose: () => void;
  onDone: (name: string, kind: Kind) => void;
}) {
  return (
    <BottomSheet open={row !== null} onClose={onClose} title="Edit category">
      {row ? <EditCategoryForm key={row.key} row={row} others={others} onDone={onDone} /> : null}
    </BottomSheet>
  );
}

function EditCategoryForm({ row, others, onDone }: { row: Row; others: string[]; onDone: (name: string, kind: Kind) => void }) {
  const [name, setName] = useState(row.name);
  const [kind, setKind] = useState<Kind>(row.kind);
  const [error, setError] = useState<string | null>(null);

  function done() {
    const checked = checkName(name, "category");
    if (!checked.ok) return setError(checked.error);
    const clash = nameClash(checked.value, others);
    if (clash) return setError(`You already have a category called ${clash}.`);
    onDone(checked.value, kind);
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        done();
      }}
    >
      <TextField
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={MAX_NAME_LENGTH}
        autoComplete="off"
        error={error}
      />
      <RadioSegments
        label="Type"
        options={KIND_OPTIONS}
        value={kind}
        onChange={setKind}
      />
      <Button type="submit" variant="primary" fullWidth>
        Done
      </Button>
    </form>
  );
}

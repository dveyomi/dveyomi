"use client";

import { useI18n } from "@/i18n/client";
import type { Format } from "@/i18n/format";
import { useRef, useState, useTransition } from "react";
import {
  AddCategoryForm,
  AllocationRows,
  AllocationSummary,
  kindTabs,
  nameClash,
  type Kind,
} from "@/components/AllocationEditor";
import {
  AmountInput,
  BottomSheet,
  Button,
  ButtonLink,
  Card,
  ConfirmDialog,
  Notice,
  RadioSegments,
  SegmentedTabs,
  TextField,
} from "@/components/ui";
import {
  allocationTotals,
  formatPeriodRange,
  formatShortDate,
  type Period,
} from "@/lib/calc";
import { MAX_NAME_LENGTH } from "@/lib/validation/common";
import {
  checkCategoryName,
  validateBudgetEdit,
  type BudgetEditScope,
  type BudgetFigures,
} from "@/lib/validation/budgetEdit";
import { saveBudgetAction } from "./actions";

type OutsideCategory = { id: string; name: string; kind: Kind };

type BudgetEditorProps = {
  /** The period containing today. */
  period: Period;
  /** The current period's income, savings and allocations. */
  budget: BudgetFigures;
  /** The next period's own figures, when it has been set up already (a "From next period" save). */
  nextBudget: BudgetFigures | null;
  /** Whether `nextBudget` differs from `budget`. */
  nextDiffers: boolean;
  /** Categories with no allocation this period: ?category= can open one, and adding one by name brings it back. */
  outside: OutsideCategory[];
  /** From ?category=: open on this category's tab with its amount focused. */
  focusCategoryId?: string;
};

/** A category row as edited. `id` is set for an existing category; `removed` ones are hidden and saved as removed. */
type Row = { key: string; id?: string; name: string; kind: Kind; amountText: string; removed: boolean };
type Form = { incomeText: string; savingsText: string; rows: Row[] };

const SCOPES = [
  { value: "this" as const, label: "From this period" },
  { value: "next" as const, label: "From next period" },
];

function formFrom(f: BudgetFigures, fmt: Format): Form {
  return {
    incomeText: fmt.inputText(f.incomePence),
    savingsText: fmt.inputText(f.savingsPence),
    rows: f.categories.map((c) => ({ key: c.id, id: c.id, name: c.name, kind: c.kind, amountText: fmt.inputText(c.amountPence), removed: false })),
  };
}

const sameForm = (a: Form, b: Form) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Edit budget (§5.3, §5.4): income, savings and every category's allocation,
 * with the live figures from calc, then when the changes start. "From next
 * period" edits the next period's own figures when it has been set up
 * already. Nothing is saved until Save, in one go; Cancel leaves everything
 * as it was.
 */
export function BudgetEditor({ period, budget, nextBudget, nextDiffers, outside, focusCategoryId }: BudgetEditorProps) {
  const i18n = useI18n();
  const { fmt } = i18n;
  const livePence = (t: string) => fmt.parseOptional(t) ?? 0;
  const [scope, setScope] = useState<BudgetEditScope>("this");
  // What the form started from for this scope: switching scope with changes asks first.
  const [base, setBase] = useState<Form>(() => formFrom(budget, fmt));
  const [form, setForm] = useState<Form>(() => {
    const start = formFrom(budget, fmt);
    const added = outside.find((c) => c.id === focusCategoryId);
    if (!added) return start;
    return { ...start, rows: [...start.rows, { key: added.id, id: added.id, name: added.name, kind: added.kind, amountText: "0.00", removed: false }] };
  });
  const focused = form.rows.find((r) => r.id === focusCategoryId);
  const [tab, setTab] = useState<Kind>(focused?.kind ?? "need");
  const [focusKey, setFocusKey] = useState<string | undefined>(focused?.key);
  const [pendingScope, setPendingScope] = useState<BudgetEditScope | null>(null);
  const [renaming, setRenaming] = useState<Row | null>(null);
  /** `savingsMoved`: this month's savings are already in funds, so the error offers From next period. */
  const [error, setError] = useState<{ message: string; field?: "income" | "savings"; savingsMoved?: boolean } | null>(null);
  const [saving, startSaving] = useTransition();
  const nextKey = useRef(1);

  const { rows } = form;
  const kept = rows.filter((r) => !r.removed);
  const totals = allocationTotals(
    fmt.parse(form.incomeText) ?? 0,
    livePence(form.savingsText),
    kept.map((r) => ({ kind: r.kind, amountPence: livePence(r.amountText) })),
  );

  const setRows = (f: (rows: Row[]) => Row[]) => setForm((prev) => ({ ...prev, rows: f(prev.rows) }));
  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function changeTab(next: Kind) {
    setFocusKey(undefined);
    setTab(next);
  }

  /** Shows the figures the scope edits: the next period's own when it exists, else the current period's. */
  function applyScope(next: BudgetEditScope) {
    setScope(next);
    setPendingScope(null);
    if (!nextBudget) return;
    const start = formFrom(next === "next" ? nextBudget : budget, fmt);
    setForm(start);
    setBase(start);
    setFocusKey(undefined);
    setError(null);
  }

  function chooseScope(next: BudgetEditScope) {
    if (next === scope) return;
    if (nextBudget && !sameForm(form, base)) return setPendingScope(next);
    applyScope(next);
  }

  /** After "savings already moved": the same figures, saved from the next period instead. */
  function moveToNext() {
    setScope("next");
    setBase(form);
    setError(null);
  }

  function remove(key: string) {
    setRows((rs) => rs.flatMap((r) => (r.key !== key ? [r] : r.id ? [{ ...r, removed: true }] : [])));
  }

  function add(name: string, amountText: string) {
    const same = (n: string) => n.toLowerCase() === name.toLowerCase();
    // A category removed in this edit, or one outside the budget, comes back (with its own kind)
    // rather than a second category with the same name being made.
    const back = rows.find((r) => r.removed && same(r.name));
    const known = outside.find((c) => same(c.name) && !rows.some((r) => r.id === c.id));
    if (back) update(back.key, { removed: false, amountText });
    else if (known) setRows((rs) => [...rs, { key: known.id, id: known.id, name: known.name, kind: known.kind, amountText, removed: false }]);
    else setRows((rs) => [...rs, { key: `new-${nextKey.current++}`, name, kind: tab, amountText, removed: false }]);
    const kind = back?.kind ?? known?.kind ?? tab;
    if (kind !== tab) changeTab(kind);
  }

  function save() {
    setError(null);
    const raw = {
      incomePence: fmt.parse(form.incomeText) ?? Number.NaN,
      savingsPence: fmt.parseOptional(form.savingsText) ?? Number.NaN,
      scope,
      categories: rows
        .filter((r) => r.id || !r.removed)
        .map((r) => ({
          ...(r.id ? { id: r.id } : {}),
          name: r.name,
          kind: r.kind,
          amountPence: r.removed ? livePence(r.amountText) : (fmt.parseOptional(r.amountText) ?? Number.NaN),
          ...(r.removed ? { removed: true } : {}),
        })),
    };
    const checked = validateBudgetEdit(raw, i18n);
    if (!checked.ok) return setError({ message: checked.error, field: checked.field });
    startSaving(async () => {
      const result = await saveBudgetAction(raw);
      if (result?.error) setError({ message: result.error, savingsMoved: result.savingsMoved });
    });
  }

  const shown = kept.filter((r) => r.kind === tab);
  const nextStartText = formatShortDate(period.nextStart);

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-5 lg:items-start lg:gap-8">
      <div className="order-2 flex flex-col gap-6 lg:col-span-3">
        <Card as="section" className="flex flex-col gap-4">
          <h2 className="text-body font-semibold text-text">Income and savings</h2>
          <AmountInput
            label="Monthly income"
            value={form.incomeText}
            onChange={(incomeText) => setForm((f) => ({ ...f, incomeText }))}
            error={error?.field === "income" ? error.message : null}
          />
          <AmountInput
            label="Pay yourself first"
            value={form.savingsText}
            onChange={(savingsText) => setForm((f) => ({ ...f, savingsText }))}
            allowZero
            hint="Set aside for savings each month, before spending."
            error={error?.field === "savings" ? error.message : null}
          />
        </Card>

        <section aria-labelledby="categories-heading" className="flex flex-col gap-4">
          <h2 id="categories-heading" className="text-title font-semibold text-text">
            Categories
          </h2>
          <SegmentedTabs label={i18n.m.allocation.categoryType} options={kindTabs(i18n.m)} value={tab} onChange={changeTab} />
          <Card className="flex flex-col gap-4">
            <AllocationRows
              kind={tab}
              rows={shown}
              allowZero
              focusKey={focusKey}
              onAmount={(key, amountText) => update(String(key), { amountText })}
              onRemove={(key) => remove(String(key))}
              onEdit={(key) => setRenaming(rows.find((r) => r.key === key) ?? null)}
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
          <h2 className="text-body font-semibold text-text">When the changes start</h2>
          <RadioSegments label="When the changes start" options={SCOPES} value={scope} onChange={chooseScope} />
          <p className="text-caption text-muted">
            {scope === "this"
              ? `Changes this period (${formatPeriodRange(period.start, period.end)})${nextBudget ? ` and the one from ${nextStartText}` : ""} onward. Past periods stay as they were.`
              : nextBudget
                ? `This period stays as it is. These are your budget's figures from ${nextStartText}.`
                : `This period stays as it is. Your new budget starts on ${nextStartText}.`}
          </p>
        </Card>

        <div className="order-4 flex flex-col gap-3">
          {scope === "this" && nextDiffers ? (
            <Notice tone="warning">
              <p>Your budget from {nextStartText} is different. Saving here replaces it with these figures.</p>
            </Notice>
          ) : null}
          {/* Field errors also show here, next to Save, since the field may be scrolled out of view. */}
          {error?.savingsMoved ? (
            <div role="alert">
              <Notice tone="warning">
                <div className="flex flex-col items-start gap-3">
                  <p>{error.message}</p>
                  <Button variant="secondary" onClick={moveToNext}>
                    Change them from next period
                  </Button>
                </div>
              </Notice>
            </div>
          ) : error ? (
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

      <RenameSheet
        row={renaming}
        others={kept.filter((r) => r.key !== renaming?.key).map((r) => r.name)}
        onClose={() => setRenaming(null)}
        onDone={(name) => {
          if (renaming) update(renaming.key, { name });
          setRenaming(null);
        }}
      />

      <ConfirmDialog
        open={pendingScope !== null}
        title="Discard your changes?"
        body={`Your budget from ${nextStartText} has its own figures. Switching shows them, and the changes you've made here are lost.`}
        confirmLabel="Discard and switch"
        cancelLabel="Keep editing"
        onConfirm={() => pendingScope && applyScope(pendingScope)}
        onCancel={() => setPendingScope(null)}
      />
    </div>
  );
}

/** Rename a category, applied to the edit (saved with the rest). Its kind is fixed once created. */
function RenameSheet({
  row,
  others,
  onClose,
  onDone,
}: {
  row: Row | null;
  others: string[];
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  return (
    <BottomSheet open={row !== null} onClose={onClose} title="Rename category">
      {row ? <RenameForm key={row.key} name={row.name} others={others} onDone={onDone} /> : null}
    </BottomSheet>
  );
}

function RenameForm({ name: initial, others, onDone }: { name: string; others: string[]; onDone: (name: string) => void }) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  function done() {
    const checked = checkCategoryName(name);
    if (!checked.ok) return setError(checked.error);
    const clash = nameClash(checked.value, others);
    if (clash) return setError(`You already have a category called ${clash}.`);
    onDone(checked.value);
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
      <Button type="submit" variant="primary" fullWidth>
        Done
      </Button>
    </form>
  );
}

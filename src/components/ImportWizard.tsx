"use client";

import { useI18n } from "@/i18n/client";
import type { Messages } from "@/i18n/messages";
import { useEffect, useRef, useState } from "react";
import { findDuplicatesAction, importAction } from "@/app/(app)/settings/import/actions";
import {
  BottomSheet,
  Badge,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  FileDrop,
  Icon,
  Money,
  Notice,
  RadioSegments,
  Select,
  Toggle,
  type SelectOption,
} from "@/components/ui";
import { type IsoDate } from "@/lib/calc";
import type { Kind } from "@/lib/validation/budgetEdit";
import {
  DATE_FORMATS,
  guessMapping,
  ImportFileError,
  importLimitError,
  mapRows,
  type DateFormat,
  type ImportRow,
  type MoneyOut,
  type RowNote,
} from "@/lib/import/csv";
import { focusRing } from "@/components/ui/focus";
import { IMPORT_ACCEPT, readImportFile } from "@/lib/import/readFile";

type Category = { id: string; name: string; kind: Kind };

type ImportWizardProps = {
  /** The user's categories, by name. */
  categories: Category[];
  /** The user's today: dates more than 10 years before it or a year after it are listed as errors. */
  today: IsoDate;
};

type Step = "upload" | "map" | "preview" | "done";
type Columns = { date: number | null; amount: number | null; name: number | null };
/** `duplicates`: the rows that look like duplicates, by index, with what each looks like. */
type Preview = { rows: ImportRow[]; errors: RowNote[]; skipped: RowNote[]; duplicates: Map<number, string> };

const STEPS: Exclude<Step, "done">[] = ["upload", "map", "preview"];

/** How many problem rows the preview lists before "and N more". */
const LISTED_ERRORS = 50;


/** "Column 2: Description (e.g. TESCO)": a column's header (or number) and a value from the first data row. */
function columnOptions(m: Messages, rows: string[][], hasHeader: boolean): SelectOption[] {
  const width = Math.max(0, ...rows.slice(0, 21).map((r) => r.length));
  const sample = rows[hasHeader ? 1 : 0] ?? [];
  return Array.from({ length: width }, (_, i) => {
    const heading = hasHeader ? rows[0][i]?.trim() : "";
    const example = sample[i]?.trim();
    const shown = example && example.length > 24 ? `${example.slice(0, 23)}…` : example;
    return {
      value: String(i),
      label: shown ? m.importer.columnWithExample(heading || m.importer.column(i + 1), shown) : heading || m.importer.column(i + 1),
    };
  });
}

/**
 * Importing expenses from a bank's CSV or Excel export, in three steps: choose a file,
 * match its columns (guessed from the file; every guess can be changed), then
 * check every row and import. Rows that look like duplicates start unticked;
 * rows that can't be read are listed with their row numbers; money in is left
 * out with a note. Nothing is saved until "Import N expenses", which saves the
 * ticked rows in one go.
 */
export function ImportWizard({ categories, today }: ImportWizardProps) {
  const { m, fmt } = useI18n();
  const w = m.importer;
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<{ name: string; rows: string[][] } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const [hasHeader, setHasHeader] = useState(false);
  const [columns, setColumns] = useState<Columns>({ date: null, amount: null, name: null });
  const [dateFormat, setDateFormat] = useState<DateFormat>("DD/MM/YYYY");
  const [moneyOut, setMoneyOut] = useState<MoneyOut>("negative");
  const [categoryId, setCategoryId] = useState("");
  const [mapError, setMapError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const [rowCategory, setRowCategory] = useState<Map<number, string>>(new Map());
  const [editing, setEditing] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [inserted, setInserted] = useState(0);

  // Each step replaces the last (and the button that was pressed): move focus to its heading.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(step);
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    headingRef.current?.focus();
  }, [step]);

  // A chosen file and its checks live only in this page until Import: warn before leaving.
  const unsaved = step === "map" || step === "preview";
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const categoryGroups = [
    { label: w.needs, options: categories.filter((c) => c.kind === "need").map((c) => ({ value: c.id, label: c.name })) },
    { label: w.wants, options: categories.filter((c) => c.kind === "want").map((c) => ({ value: c.id, label: c.name })) },
  ];

  async function chooseFile(chosen: File) {
    setUploadError(null);
    setReading(true);
    try {
      const rows = await readImportFile(chosen, m);
      const guess = guessMapping(rows);
      const limit = importLimitError({ dataRows: rows.length - (guess.hasHeader ? 1 : 0) });
      if (limit) {
        setUploadError(limit);
        return;
      }
      setFile({ name: chosen.name, rows });
      setHasHeader(guess.hasHeader);
      setColumns({ date: guess.date, amount: guess.amount, name: guess.name });
      setDateFormat(guess.dateFormat);
      setMoneyOut("negative");
      setMapError(null);
      setCategoryError(null);
      setStep("map");
    } catch (e) {
      setUploadError(e instanceof ImportFileError ? e.message : w.unreadable);
    } finally {
      setReading(false);
    }
  }

  async function showPreview() {
    if (!file) return;
    setMapError(null);
    setCategoryError(null);
    const { date, amount, name } = columns;
    if (date === null || amount === null || name === null) {
      setMapError(w.chooseColumns);
      return;
    }
    if (new Set([date, amount, name]).size < 3) {
      setMapError(w.differentColumns);
      return;
    }
    if (!categoryId) {
      setCategoryError(w.chooseCategory);
      return;
    }
    const limit = importLimitError({ dataRows: file.rows.length - (hasHeader ? 1 : 0) });
    if (limit) {
      setMapError(limit);
      return;
    }
    const mapped = mapRows(file.rows, { date, amount, name, dateFormat, moneyOut, hasHeader }, today, m);
    setChecking(true);
    try {
      const result = mapped.ok.length > 0 ? await findDuplicatesAction(mapped.ok) : { duplicates: [] };
      if ("error" in result) {
        setMapError(result.error);
        return;
      }
      const duplicates = new Map(result.duplicates.map((d) => [d.index, d.label] as const));
      setPreview({ rows: mapped.ok, errors: mapped.errors, skipped: mapped.skipped, duplicates });
      setTicked(new Set(mapped.ok.map((_, i) => i).filter((i) => !duplicates.has(i))));
      setRowCategory(new Map());
      setImportError(null);
      setStep("preview");
    } catch {
      setMapError(w.duplicatesFailed);
    } finally {
      setChecking(false);
    }
  }

  async function runImport() {
    if (!file || !preview || ticked.size === 0) return;
    setImportError(null);
    setImporting(true);
    try {
      const rows = preview.rows
        .map((r, i) => ({ r, i }))
        .filter(({ i }) => ticked.has(i))
        .map(({ r, i }) => {
          const own = rowCategory.get(i);
          return own && own !== categoryId ? { ...r, categoryId: own } : r;
        });
      const result = await importAction({ filename: file.name, categoryId, rows });
      if ("error" in result) {
        setImportError(result.error);
        return;
      }
      setInserted(result.inserted);
      setStep("done");
    } catch {
      setImportError(w.importFailed);
    } finally {
      setImporting(false);
    }
  }

  function startAgain() {
    setFile(null);
    setPreview(null);
    setCategoryId("");
    setStep("upload");
  }

  const toggleRow = (i: number, on: boolean) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(i);
      else next.delete(i);
      return next;
    });

  if (step === "done") {
    return (
      <Card as="section" className="flex flex-col items-start gap-4">
        <span className="flex size-12 items-center justify-center rounded-pill bg-positive/15 text-positive-fg">
          <Icon name="check" size="lg" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 ref={headingRef} tabIndex={-1} className="text-title font-semibold text-text outline-none">
            {w.imported(w.count(inserted, "expense"))}
          </h2>
          <p className="text-body text-muted">
            {w.importedBody}
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
          <ButtonLink href="/expenses" variant="primary">
            {w.seeExpenses}
          </ButtonLink>
          <Button variant="secondary" onClick={startAgain}>
            {w.another}
          </Button>
        </div>
      </Card>
    );
  }

  const current = STEPS.findIndex((s) => s === step);
  const tickedDuplicates = preview ? [...preview.duplicates.keys()].filter((i) => ticked.has(i)).length : 0;
  const summary = preview
    ? [
        w.toImport(ticked.size),
        preview.duplicates.size - tickedDuplicates > 0
          ? w.skipped(w.count(preview.duplicates.size - tickedDuplicates, "duplicate"))
          : null,
        preview.errors.length > 0 ? w.count(preview.errors.length, "error") : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const editingRow = editing !== null && preview ? preview.rows[editing] : null;

  return (
    <Card as="section" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="text-caption text-muted md:hidden">
          {w.stepOf(current + 1, STEPS.length)}
        </p>
        <ol aria-label={w.stepsLabel} className="hidden flex-wrap gap-x-4 gap-y-1 text-caption md:flex">
          {STEPS.map((s, i) => (
            <li
              key={s}
              aria-current={i === current ? "step" : undefined}
              className={`flex items-center gap-1 ${i === current ? "font-semibold text-text" : "text-muted"}`}
            >
              {i < current ? <Icon name="check" size="sm" /> : <span aria-hidden="true">{i + 1}.</span>}
              <span>
                <span className="sr-only">{i < current ? "Done: " : `Step ${i + 1} of ${STEPS.length}: `}</span>
                {w.steps[s]}
              </span>
            </li>
          ))}
        </ol>
        <h2 ref={headingRef} tabIndex={-1} className="text-title font-semibold text-text outline-none">
          {w.steps[STEPS[current]]}
        </h2>
      </div>

      {step === "upload" ? (
        <div className="flex flex-col gap-4">
          <p className="text-body text-muted">
            {w.uploadIntro}
          </p>
          <FileDrop
            label={w.fileLabel}
            hint={w.fileHint}
            accept={IMPORT_ACCEPT}
            error={uploadError}
            disabled={reading}
            onFile={chooseFile}
          />
        </div>
      ) : null}

      {step === "map" && file ? (
        <div className="flex flex-col gap-5">
          <p className="text-body text-muted">
            <span translate="no" className="font-semibold text-text">
              {file.name}
            </span> ·{" "}
            {w.rowsGuessed(w.count(file.rows.length - (hasHeader ? 1 : 0), "row"))}
          </p>
          <Toggle
            label={w.headerRow}
            description={w.firstRow(file.rows[0].join(", ").slice(0, 80))}
            checked={hasHeader}
            onChange={setHasHeader}
          />
          <div className="grid gap-4 md:grid-cols-2">
            {(
              [
                ["date", w.dateColumn],
                ["amount", w.amountColumn],
                ["name", w.nameColumn],
              ] as const
            ).map(([key, label]) => (
              <Select
                key={key}
                label={label}
                placeholder={w.chooseColumn}
                options={columnOptions(m, file.rows, hasHeader)}
                value={columns[key] === null ? "" : String(columns[key])}
                onChange={(e) => setColumns((c) => ({ ...c, [key]: Number(e.target.value) }))}
              />
            ))}
            <Select
              label={w.dateFormat}
              hint={w.dateFormatHint}
              options={DATE_FORMATS.map((f) => ({ value: f, label: f }))}
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value as DateFormat)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span aria-hidden="true" className="text-caption font-medium text-muted">
              {w.moneyOut}
            </span>
            <RadioSegments
              label={w.moneyOut}
              options={[
                { value: "negative", label: w.negative },
                { value: "positive", label: w.positive },
              ]}
              value={moneyOut}
              onChange={setMoneyOut}
            />
            <p className="text-caption text-muted">{w.negativeNote}</p>
          </div>
          <div className="md:max-w-sm">
            <Select
              label={w.category}
              hint={w.categoryHint}
              placeholder={w.chooseCategoryPlaceholder}
              groups={categoryGroups}
              options={[]}
              value={categoryId}
              error={categoryError}
              onChange={(e) => setCategoryId(e.target.value)}
            />
          </div>
          {mapError ? (
            <p role="alert" className="text-caption text-danger-fg">
              {mapError}
            </p>
          ) : null}
          <footer className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-3 border-t border-border bg-card px-4 pt-4 pb-safe md:static md:mx-0 md:flex-row md:justify-between md:border-0 md:bg-transparent md:p-0">
            <Button variant="secondary" onClick={startAgain}>
              {w.chooseAnother}
            </Button>
            <Button variant="primary" onClick={showPreview} disabled={checking}>
              {checking ? w.checking : w.preview}
            </Button>
          </footer>
        </div>
      ) : null}

      {step === "preview" && preview ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <p className="text-body font-semibold text-text" aria-live="polite">
              {summary}
            </p>
            <p className="text-caption text-muted">
              {w.untickTransfers}
            </p>
          </div>
          {preview.skipped.length > 0 ? (
            <Notice tone="neutral">
              {w.creditsLeftOut(
                w.count(preview.skipped.length, "row"),
                preview.skipped.length,
                preview.skipped.length <= 10 ? preview.skipped.map((s) => s.row).join(", ") : null,
              )}
              .
            </Notice>
          ) : null}
          {preview.errors.length > 0 ? (
            <Notice tone="danger">
              <span className="font-semibold">{w.cantImport(w.count(preview.errors.length, "row"))}</span>
              <ul className="mt-1 flex flex-col gap-1">
                {preview.errors.slice(0, LISTED_ERRORS).map((e) => (
                  <li key={e.row}>
                    {w.rowReason(e.row, e.reason)}
                  </li>
                ))}
                {preview.errors.length > LISTED_ERRORS ? <li>{w.andMore(preview.errors.length - LISTED_ERRORS)}</li> : null}
              </ul>
            </Notice>
          ) : null}

          {preview.rows.length > 0 ? (
            <ul aria-label={w.rowsToImport} className="flex flex-col divide-y divide-border">
              {preview.rows.map((r, i) => {
                const duplicate = preview.duplicates.get(i);
                const category = categoryName.get(rowCategory.get(i) ?? categoryId) ?? "";
                return (
                  <li key={r.row} className="flex items-center gap-3 py-2 [content-visibility:auto] md:gap-4">
                    <Checkbox checked={ticked.has(i)} onChange={(on) => toggleRow(i, on)}>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="min-w-0 break-words text-body text-text">{r.name}</span>
                        {duplicate ? <Badge tone="warning">{duplicate}</Badge> : null}
                      </span>
                      <span className="text-caption text-muted">
                        {w.rowLine(fmt.dayMonthYear(r.date), r.row)}
                      </span>
                    </Checkbox>
                    <div className="flex shrink-0 flex-col items-end md:flex-row-reverse md:items-center md:gap-4">
                      <span className="text-body text-text md:w-24 md:text-right">
                        <Money pence={r.amountPence} />
                      </span>
                      <button
                        type="button"
                        aria-label={w.categoryFor(r.name, category)}
                        onClick={() => setEditing(i)}
                        className={`-mr-2 flex min-h-11 max-w-36 items-center gap-1 rounded-pill px-2 text-caption text-muted hover:text-text ${focusRing}`}
                      >
                        <span className="truncate">{category}</span>
                        <Icon name="chevron-down" size="sm" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-body text-muted">{w.nothingImportable}</p>
          )}

          {importError ? (
            <p role="alert" className="text-caption text-danger-fg">
              {importError}
            </p>
          ) : null}
          <footer className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-3 border-t border-border bg-card px-4 pt-4 pb-safe md:flex-row md:items-center md:justify-between md:pb-4">
            <Button variant="secondary" onClick={() => setStep("map")} disabled={importing}>
              {w.backToColumns}
            </Button>
            <Button variant="primary" onClick={runImport} disabled={importing || ticked.size === 0}>
              {importing ? w.importing : w.importN(w.count(ticked.size, "expense"))}
            </Button>
          </footer>
        </div>
      ) : null}

      <BottomSheet
        open={editingRow !== null}
        onClose={() => setEditing(null)}
        title={editingRow ? w.categoryForTitle(editingRow.name) : w.category}
      >
        {editing !== null ? (
          <div className="flex flex-col gap-6">
            <Select
              label={w.category}
              groups={categoryGroups}
              options={[]}
              value={rowCategory.get(editing) ?? categoryId}
              onChange={(e) => {
                const value = e.target.value;
                setRowCategory((prev) => new Map(prev).set(editing, value));
              }}
            />
            <Button variant="primary" onClick={() => setEditing(null)}>
              {w.done}
            </Button>
          </div>
        ) : null}
      </BottomSheet>
    </Card>
  );
}

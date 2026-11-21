"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button, Card, Icon, IconButton, Money, ProgressBar } from "@/components/ui";
import { allocationTotals, type IsoDate } from "@/lib/calc";
import { checkBasics, checkCategories, checkSavings, validateOnboarding } from "@/lib/data/onboarding";
import { completeOnboardingAction } from "./actions";
import { livePence, toInput, type CategoryDraft, type Draft, type FundDraft } from "./draft";
import { Income } from "./Income";
import { Live } from "./Live";
import { Savings } from "./Savings";
import { Spending } from "./Spending";

const STEPS = ["The basics", "Spending budget", "Savings", "You're live"] as const;

/**
 * The onboarding flow. Answers live here, client-side, until the last step's
 * confirm sends them to the server in one go.
 */
export function OnboardingWizard({ today }: { today: IsoDate }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    startDay: 1,
    incomeText: "",
    savingsText: "",
    categories: [],
    funds: [],
  });
  const [tab, setTab] = useState<CategoryDraft["kind"]>("need");
  const [incomeError, setIncomeError] = useState<string | null>(null);
  const [savingsError, setSavingsError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const nextId = useRef(1);

  // Announce each new step by moving focus to its heading (not on first load).
  const moved = useRef(false);
  useEffect(() => {
    if (moved.current) document.getElementById("step-heading")?.focus();
    moved.current = true;
  }, [step]);

  // Nothing is saved until the last step, so warn before leaving with answers typed.
  const started = draft.incomeText !== "" || draft.categories.length > 0;
  useEffect(() => {
    if (!started) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [started]);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const go = (to: number) => {
    setStepError(null);
    setStep(to);
  };

  const incomePence = livePence(draft.incomeText);
  const savingsPence = livePence(draft.savingsText);
  const totals = allocationTotals(
    incomePence,
    savingsPence,
    draft.categories.map((c) => ({ kind: c.kind, amountPence: livePence(c.amountText) })),
  );
  const input = toInput(draft);

  // Each step runs the same check the server runs on the whole input.
  function next() {
    setStepError(null);
    setIncomeError(null);
    setSavingsError(null);
    const check =
      step === 0
        ? checkBasics(input.incomePence, input.startDay)
        : step === 1
          ? checkCategories(input.categories)
          : checkSavings(input.incomePence, input.savingsPence, input.funds);
    if (!check.ok) {
      if (check.field === "income") return setIncomeError(check.error);
      if (check.field === "savings") return setSavingsError(check.error);
      return setStepError(check.error);
    }
    go(step + 1);
  }

  function confirm() {
    const checked = validateOnboarding(input);
    if (!checked.ok) return setStepError(checked.error);
    startSaving(async () => {
      const result = await completeOnboardingAction(checked.input);
      if (result?.error) setStepError(result.error);
    });
  }

  const last = step === STEPS.length - 1;

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="hidden md:sticky md:top-0 md:flex md:h-dvh md:w-80 md:shrink-0 md:flex-col md:gap-8 md:overflow-y-auto md:border-r md:border-border md:bg-card md:px-6 md:py-8 lg:w-96 lg:px-8">
        <p className="text-body font-semibold text-text">Set up your budget</p>
        <ol className="flex flex-col gap-1">
          {STEPS.map((label, i) => (
            <li
              key={label}
              aria-current={i === step ? "step" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-sm px-3 text-body ${i === step ? "bg-card-raised font-semibold text-text" : "text-muted"}`}
            >
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-pill text-caption font-semibold ${i < step ? "bg-accent text-accent-ink" : "border border-border-strong"}`}
              >
                {i < step ? <Icon name="check" size="sm" /> : i + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>
        <Card raised className="flex flex-col gap-3">
          <p className="text-caption font-semibold text-muted">So far</p>
          <SoFar label="Monthly income" pence={incomePence} />
          <SoFar label="Savings" pence={savingsPence} />
          <SoFar label="To spend" pence={totals.poolPence} />
          <SoFar label="Allocated" pence={totals.allocatedPence} />
        </Card>
      </aside>

      <div className="flex flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-phone flex-1 flex-col gap-6 px-4 pt-4 md:max-w-2xl md:flex-none md:px-8 md:pt-12 [&_:is(input,select,button)]:scroll-mb-32">
          <div className="flex items-center gap-3">
            {step > 0 ? (
              <IconButton icon="chevron-left" label="Back" onClick={() => go(step - 1)} disabled={saving} />
            ) : null}
            <div className="flex flex-1 flex-col gap-2">
              <p className="text-caption text-muted">
                Step {step + 1} of {STEPS.length}
              </p>
              <ProgressBar percent={((step + 1) / STEPS.length) * 100} state="normal" label="Setup progress" />
            </div>
          </div>

          {step === 0 ? (
            <Income
              today={today}
              startDay={draft.startDay}
              onStartDay={(startDay) => update({ startDay })}
              incomeText={draft.incomeText}
              onIncome={(incomeText) => update({ incomeText })}
              incomeError={incomeError}
            />
          ) : step === 1 ? (
            <Spending
              incomePence={incomePence}
              savingsPence={savingsPence}
              savingsEntered={draft.savingsText.trim() !== ""}
              categories={draft.categories}
              tab={tab}
              onTab={setTab}
              onAdd={(name, kind, amountText) =>
                update({ categories: [...draft.categories, { id: nextId.current++, name, kind, amountText }] })
              }
              onAmount={(id, amountText) =>
                update({ categories: draft.categories.map((c) => (c.id === id ? { ...c, amountText } : c)) })
              }
              onRemove={(id) => update({ categories: draft.categories.filter((c) => c.id !== id) })}
            />
          ) : step === 2 ? (
            <Savings
              savingsText={draft.savingsText}
              onSavings={(savingsText) => update({ savingsText })}
              savingsError={savingsError}
              poolPence={totals.poolPence}
              overAllocatedPence={totals.overAllocatedPence}
              funds={draft.funds}
              onAddFund={() =>
                update({
                  funds: [
                    ...draft.funds,
                    { id: nextId.current++, name: "", amountText: "", alreadySaved: false, alreadyText: "" },
                  ],
                })
              }
              onFund={(id, patch: Partial<FundDraft>) =>
                update({ funds: draft.funds.map((f) => (f.id === id ? { ...f, ...patch } : f)) })
              }
              onRemoveFund={(id) => update({ funds: draft.funds.filter((f) => f.id !== id) })}
            />
          ) : (
            <Live input={input} today={today} />
          )}
        </div>

        <footer className="sticky bottom-0 mt-6 border-t border-border bg-bg pt-4 pb-safe md:static md:border-0 md:bg-transparent md:pb-12">
          <div className="mx-auto flex w-full max-w-phone flex-col gap-3 px-4 md:max-w-2xl md:items-end md:px-8">
            {stepError ? (
              <p role="alert" className="text-caption text-danger-fg md:self-stretch">
                {stepError}
              </p>
            ) : null}
            {last ? (
              <Button variant="primary" size="lg" fullWidth onClick={confirm} disabled={saving} className="md:w-auto">
                {saving ? "Saving…" : "Go to my budget"}
              </Button>
            ) : (
              <Button variant="primary" size="lg" fullWidth onClick={next} className="md:w-auto md:min-w-48">
                Continue
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function SoFar({ label, pence }: { label: string; pence: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-body">
      <span className="text-muted">{label}</span>
      <Money pence={pence} />
    </div>
  );
}

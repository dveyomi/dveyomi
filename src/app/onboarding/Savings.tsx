"use client";

import { useI18n } from "@/i18n/client";
import { AmountInput, Button, Card, IconButton, Money, TextField, Toggle } from "@/components/ui";
import { splitRemainder } from "@/lib/calc";
import { MAX_FUNDS, MAX_NAME_LENGTH } from "@/lib/validation/common";
import { livePence, type FundDraft } from "./draft";
import { StepHeading } from "./StepHeading";

type SavingsProps = {
  savingsText: string;
  onSavings: (text: string) => void;
  savingsError: string | null;
  /** Live figures for the line under the savings amount. */
  poolPence: number;
  overAllocatedPence: number;
  funds: FundDraft[];
  onAddFund: () => void;
  onFund: (id: number, patch: Partial<FundDraft>) => void;
  onRemoveFund: (id: number) => void;
};

/** Step 3: an optional "pay yourself first" amount, then the funds that divide it. */
export function Savings({
  savingsText,
  onSavings,
  savingsError,
  poolPence,
  overAllocatedPence,
  funds,
  onAddFund,
  onFund,
  onRemoveFund,
}: SavingsProps) {
  const { fmt, currency, m } = useI18n();
  const o = m.onboarding;
  const savingsPence = livePence(savingsText, currency);
  const saving = savingsPence > 0;
  const remainder = splitRemainder(
    savingsPence,
    funds.map((f) => livePence(f.amountText, currency)),
  );

  return (
    <section aria-labelledby="step-heading" className="flex flex-col gap-6">
      <StepHeading
        title={o.savingsTitle}
        body={o.savingsBody}
      />

      <Card className="flex flex-col gap-3">
        <AmountInput
          label={o.payYourselfFirst}
          value={savingsText}
          onChange={onSavings}
          allowZero
          hint={o.savingsHint}
          error={savingsError}
        />
        <p aria-live="polite" className="text-caption text-muted">
          {o.leaves(fmt.money(poolPence))}
          {overAllocatedPence > 0 ? <span className="text-danger-fg">{o.categoriesOver(fmt.money(overAllocatedPence))}</span> : null}
        </p>
      </Card>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-body font-semibold text-text">{o.funds}</h2>
          <p className="text-caption text-muted">
            {saving ? o.fundsSplit : o.fundsOptional}
          </p>
        </div>

        {funds.map((f, i) => (
          <Card key={f.id} as="div">
            <fieldset className="flex flex-col gap-4">
              <legend className="sr-only">{o.fund(i + 1)}</legend>
              <div className="flex items-center justify-between gap-2">
                <span aria-hidden="true" className="text-caption font-semibold text-muted">
                  {o.fund(i + 1)}
                </span>
                <IconButton icon="trash" label={o.removeFund(i + 1)} onClick={() => onRemoveFund(f.id)} />
              </div>
              <TextField
                label={o.fundName}
                value={f.name}
                onChange={(e) => onFund(f.id, { name: e.target.value })}
                placeholder={o.fundPlaceholder}
                autoComplete="off"
                maxLength={MAX_NAME_LENGTH}
              />
              {saving ? (
                <AmountInput
                  label={o.eachMonth}
                  value={f.amountText}
                  onChange={(text) => onFund(f.id, { amountText: text })}
                  allowZero
                  hint={o.eachMonthHint}
                />
              ) : null}
              <Toggle
                label={o.alreadySaved}
                description={o.alreadySavedDescription}
                checked={f.alreadySaved}
                onChange={(on) => onFund(f.id, { alreadySaved: on })}
              />
              {f.alreadySaved ? (
                <AmountInput
                  label={o.amountAlreadySaved}
                  value={f.alreadyText}
                  onChange={(text) => onFund(f.id, { alreadyText: text })}
                />
              ) : null}
            </fieldset>
          </Card>
        ))}

        {saving && funds.length > 0 ? (
          <p aria-live="polite" className="text-body font-semibold">
            {remainder > 0 ? (
              <span className="text-warning-fg">{o.stillToSplit(fmt.money(remainder))}</span>
            ) : remainder < 0 ? (
              <span className="text-danger-fg">{o.moreThanSavings(fmt.money(-remainder))}</span>
            ) : (
              <span className="text-positive-fg">{o.fundsAddUp}</span>
            )}
          </p>
        ) : null}

        {funds.length < MAX_FUNDS ? (
          <Button variant="secondary" onClick={onAddFund}>
            {o.addFund}
          </Button>
        ) : (
          <p className="text-caption text-muted">{o.maxFunds(MAX_FUNDS)}</p>
        )}
      </div>
    </section>
  );
}

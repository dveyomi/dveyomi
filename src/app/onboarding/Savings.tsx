"use client";

import { AmountInput, Button, Card, IconButton, Money, TextField, Toggle } from "@/components/ui";
import { formatGBP, splitRemainder } from "@/lib/calc";
import { MAX_FUNDS, MAX_NAME_LENGTH } from "@/lib/data/onboarding";
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
  const savingsPence = livePence(savingsText);
  const saving = savingsPence > 0;
  const remainder = splitRemainder(
    savingsPence,
    funds.map((f) => livePence(f.amountText)),
  );

  return (
    <section aria-labelledby="step-heading" className="flex flex-col gap-6">
      <StepHeading
        title="Savings"
        body="Pay yourself first: set aside your savings before you spend. You can skip this and add it later."
      />

      <Card className="flex flex-col gap-3">
        <AmountInput
          label="Pay yourself first"
          value={savingsText}
          onChange={onSavings}
          allowZero
          hint="Saved each month. Leave empty to skip."
          error={savingsError}
        />
        <p aria-live="polite" className="text-caption text-muted">
          That leaves <Money pence={poolPence} /> a month to spend.
          {overAllocatedPence > 0 ? (
            <span className="text-danger-fg"> Your categories are {formatGBP(overAllocatedPence)} over that.</span>
          ) : null}
        </p>
      </Card>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-body font-semibold text-text">Savings funds</h2>
          <p className="text-caption text-muted">
            {saving
              ? "Split your savings between funds, such as a holiday or a rainy-day pot."
              : "Optional. Add a fund to record money you've already saved."}
          </p>
        </div>

        {funds.map((f, i) => (
          <Card key={f.id} as="div">
            <fieldset className="flex flex-col gap-4">
              <legend className="sr-only">Fund {i + 1}</legend>
              <div className="flex items-center justify-between gap-2">
                <span aria-hidden="true" className="text-caption font-semibold text-muted">
                  Fund {i + 1}
                </span>
                <IconButton icon="trash" label={`Remove fund ${i + 1}`} onClick={() => onRemoveFund(f.id)} />
              </div>
              <TextField
                label="Fund name"
                value={f.name}
                onChange={(e) => onFund(f.id, { name: e.target.value })}
                placeholder="e.g. Holiday…"
                autoComplete="off"
                maxLength={MAX_NAME_LENGTH}
              />
              {saving ? (
                <AmountInput
                  label="Each month"
                  value={f.amountText}
                  onChange={(text) => onFund(f.id, { amountText: text })}
                  allowZero
                  hint="Leave empty if this fund only holds money already saved."
                />
              ) : null}
              <Toggle
                label="Already saved"
                description="Money in this fund from before you started"
                checked={f.alreadySaved}
                onChange={(on) => onFund(f.id, { alreadySaved: on })}
              />
              {f.alreadySaved ? (
                <AmountInput
                  label="Amount already saved"
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
              <span className="text-warning-fg">{formatGBP(remainder)} still to split</span>
            ) : remainder < 0 ? (
              <span className="text-danger-fg">{formatGBP(-remainder)} more than your savings</span>
            ) : (
              <span className="text-positive-fg">Your funds add up to your savings</span>
            )}
          </p>
        ) : null}

        {funds.length < MAX_FUNDS ? (
          <Button variant="secondary" onClick={onAddFund}>
            Add a fund
          </Button>
        ) : (
          <p className="text-caption text-muted">You can add up to {MAX_FUNDS} funds.</p>
        )}
      </div>
    </section>
  );
}

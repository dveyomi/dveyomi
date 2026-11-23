"use client";

import { Card, Select } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { CURRENCY_CODES, LANGUAGE_NAMES, LOCALES, type CurrencyCode, type Locale } from "@/lib/locale";
import { StepHeading } from "./StepHeading";

type WelcomeProps = {
  language: Locale;
  onLanguage: (language: Locale) => void;
  currency: CurrencyCode;
  onCurrency: (currency: CurrencyCode) => void;
};

/**
 * Before step 1: the language (labelled in both languages, each option in its
 * own script), then the currency. Not counted as a step.
 */
export function Welcome({ language, onLanguage, currency, onCurrency }: WelcomeProps) {
  const { m } = useI18n();
  const o = m.onboarding;
  return (
    <section aria-labelledby="step-heading" className="flex flex-col gap-6">
      <StepHeading title={o.welcomeTitle} body={o.welcomeBody} />
      <Card>
        <Select
          label={o.languageLabel}
          options={LOCALES.map((l) => ({ value: l, label: LANGUAGE_NAMES[l] }))}
          value={language}
          onChange={(e) => onLanguage(e.target.value as Locale)}
        />
      </Card>
      <Card>
        <Select
          label={o.currencyLabel}
          options={CURRENCY_CODES.map((c) => ({ value: c, label: m.settings.currencyNames[c] }))}
          value={currency}
          onChange={(e) => onCurrency(e.target.value as CurrencyCode)}
          hint={o.currencyHint}
        />
      </Card>
      <p className="text-center text-caption text-muted">{o.changeLater}</p>
    </section>
  );
}

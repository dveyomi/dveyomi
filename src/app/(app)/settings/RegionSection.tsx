"use client";

import { useMemo, useState } from "react";
import { ConfirmDialog, Select } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { formatMoney } from "@/lib/calc";
import { CURRENCY_CODES, LANGUAGE_NAMES, LOCALES, type CurrencyCode, type Locale } from "@/lib/locale";
import { timeZoneGroups } from "@/lib/timezone";
import { saveCurrency, saveHomeTimezone, saveLanguage } from "./settingsActions";
import { SettingsSection } from "./SettingsSection";
import { useAutoSave } from "./useAutoSave";

/** What the currency warning shows: one amount written in the old currency and in the new. */
const SAMPLE_PENCE = 125000;

type RegionSectionProps = { timezone: string; zones: string[]; language: Locale; currency: CurrencyCode };

/**
 * Region: the home time zone, the app's language and the currency amounts are
 * written in, each saved on change. A new currency is saved only after a
 * warning that amounts aren't converted. `zones` comes from the server, so the
 * list matches on both sides.
 */
export function RegionSection({ timezone, zones, language, currency }: RegionSectionProps) {
  const { m } = useI18n();
  const zone = useAutoSave(timezone, saveHomeTimezone);
  const lang = useAutoSave<Locale>(language, saveLanguage);
  const money = useAutoSave<CurrencyCode>(currency, saveCurrency);
  const [pendingCurrency, setPendingCurrency] = useState<CurrencyCode | null>(null);
  const groups = useMemo(() => timeZoneGroups(zones, timezone), [zones, timezone]);
  return (
    <SettingsSection title={m.settings.regionTitle} description={m.settings.regionDescription}>
      <div className="flex flex-col gap-5">
        <div>
          <Select
            label={m.settings.homeTimeZone}
            options={[]}
            groups={groups}
            value={zone.value}
            onChange={(e) => zone.change(e.target.value)}
            hint={m.settings.homeTimeZoneHint}
            error={zone.error}
          />
          <p role="status" className="mt-1 text-caption text-muted">
            {zone.status}
          </p>
        </div>
        <div>
          <Select
            label={m.settings.language}
            options={LOCALES.map((l) => ({ value: l, label: LANGUAGE_NAMES[l] }))}
            value={lang.value}
            onChange={(e) => lang.change(e.target.value as Locale)}
            hint={m.settings.languageHint}
            error={lang.error}
          />
          <p role="status" className="mt-1 text-caption text-muted">
            {lang.status}
          </p>
        </div>
        <div>
          <Select
            label={m.settings.currency}
            options={CURRENCY_CODES.map((c) => ({ value: c, label: m.settings.currencyNames[c] }))}
            value={money.value}
            onChange={(e) => {
              const next = e.target.value as CurrencyCode;
              if (next !== money.value) setPendingCurrency(next);
            }}
            hint={m.settings.currencyHint}
            error={money.error}
          />
          <p role="status" className="mt-1 text-caption text-muted">
            {money.status}
          </p>
        </div>
      </div>
      <ConfirmDialog
        open={pendingCurrency !== null}
        title={m.settings.currencyConfirmTitle}
        body={
          pendingCurrency
            ? m.settings.currencyConfirmBody(formatMoney(SAMPLE_PENCE, money.value), formatMoney(SAMPLE_PENCE, pendingCurrency))
            : ""
        }
        confirmLabel={m.settings.currencyConfirm}
        cancelLabel={m.common.cancel}
        onConfirm={() => {
          if (pendingCurrency) money.change(pendingCurrency);
          setPendingCurrency(null);
        }}
        onCancel={() => setPendingCurrency(null)}
      />
    </SettingsSection>
  );
}

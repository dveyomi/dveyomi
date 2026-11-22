"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { CurrencyCode, Locale } from "@/lib/locale";
import { DEFAULT_I18N, makeI18n, type I18n } from "./format";

const I18nContext = createContext<I18n>(DEFAULT_I18N);

/** Gives every client component below it the user's language and currency. */
export function I18nProvider({ locale, currency, children }: { locale: Locale; currency: CurrencyCode; children: ReactNode }) {
  const value = useMemo(() => makeI18n(locale, currency), [locale, currency]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** The user's dictionary (`m`) and formatting (`fmt`). English and pounds with no provider (tests, the design gallery). */
export function useI18n(): I18n {
  return useContext(I18nContext);
}

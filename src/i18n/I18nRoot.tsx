import type { ReactNode } from "react";
import { I18nProvider } from "./client";
import { getServerI18n } from "./server";

/** Reads the visitor's language and currency (request time) and provides them to the client. */
export async function I18nRoot({ children }: { children: ReactNode }) {
  const { locale, currency } = await getServerI18n();
  return (
    <I18nProvider locale={locale} currency={currency}>
      {children}
    </I18nProvider>
  );
}

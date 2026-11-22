"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CURRENCY_COOKIE, LOCALE_COOKIE, prefCookie } from "@/i18n/cookies";
import type { CurrencyCode, Locale } from "@/lib/locale";

const cookieValue = (name: string) => new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(document.cookie)?.[1];

/**
 * Keeps this device's language and currency cookies in step with the profile
 * (e.g. after choosing them on another device), then re-renders in them.
 */
export function PrefsSync({ language, currency }: { language: Locale; currency: CurrencyCode }) {
  const router = useRouter();
  useEffect(() => {
    let changed = false;
    if (cookieValue(LOCALE_COOKIE) !== language) {
      document.cookie = prefCookie(LOCALE_COOKIE, language);
      changed = true;
    }
    if (cookieValue(CURRENCY_COOKIE) !== currency) {
      document.cookie = prefCookie(CURRENCY_COOKIE, currency);
      changed = true;
    }
    if (changed) router.refresh();
  }, [language, currency, router]);
  return null;
}

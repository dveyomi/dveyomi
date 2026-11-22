/**
 * English (UK): the source dictionary. Every other language must have exactly
 * these keys (its type is `Messages`), so a missing translation fails the build.
 * Strings, or functions for text with values in it (amounts come in already
 * formatted, so a dictionary never knows the currency).
 */
export const enGB = {
  common: {
    save: "Save",
    cancel: "Cancel",
    close: "Close",
    back: "Back",
    continue: "Continue",
    delete: "Delete",
    edit: "Edit",
    done: "Done",
    saving: "Saving…",
    saved: "Saved.",
  },
  dates: {
    today: "Today",
    tomorrow: "Tomorrow",
    /** A date with its year, when the year isn't this one: "Friday 21 November 2025". */
    withYear: (date: string, year: string) => `${date} ${year}`,
    daysLeft: (n: number) => `${n} ${n === 1 ? "day" : "days"} left`,
  },
  settings: {
    regionTitle: "Region",
    regionDescription: "Today's date and your budget days follow your home time zone.",
    homeTimeZone: "Home time zone",
    homeTimeZoneHint: "While you travel, today's date follows your device.",
    language: "Language",
    languageHint: "Changes every screen. Names you typed stay as they are.",
    currency: "Currency",
    currencyHint: "Changes how amounts are written. Amounts aren't converted.",
    currencyNames: { GBP: "Pound sterling (GBP)", TWD: "New Taiwan dollar (TWD)" },
    currencyConfirmTitle: "Change currency?",
    currencyConfirmBody: (from: string, to: string) => `Your amounts won't be converted. ${from} becomes ${to}.`,
    currencyConfirm: "Change currency",
    chooseLanguage: "Choose a language from the list.",
    languageSaveFailed: "We couldn't save your language. Check your connection and try again.",
    chooseCurrency: "Choose a currency from the list.",
    currencySaveFailed: "We couldn't save your currency. Check your connection and try again.",
  },
};

export type Messages = typeof enGB;

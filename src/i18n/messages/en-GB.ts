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
  errors: {
    withdrawTooMuch: (balance: string) => `You can't withdraw more than the fund holds (${balance}).`,
    moveTooMuch: (balance: string) => `You can't move more than this fund holds (${balance}).`,
    fundShort: (name: string, balance: string) => `${name} only has ${balance}.`,
  },
  validation: {
    /** An amount field that needs more than zero; `example` is "12.50" (GBP) or "1250" (TWD). */
    amountRequired: {
      GBP: (example: string) => `Enter an amount greater than £0.00, e.g. ${example}`,
      TWD: (example: string) => `Enter a whole number of dollars, e.g. ${example}`,
    },
    amountOptional: {
      GBP: "Enter £0.00 or more, e.g. 12.50",
      TWD: "Enter 0 or a whole number of dollars, e.g. 1250",
    },
    incomeRange: (min: string, max: string) => `Enter a monthly income between ${min} and ${max}.`,
    amountRange: (min: string, max: string) => `Enter an amount between ${min} and ${max}.`,
    amountRangeFor: (name: string, min: string, max: string) => `Enter an amount between ${min} and ${max} for ${name}.`,
    /** The largest amount, briefly: "£10m". */
    tenMillion: (symbol: string) => `${symbol}10m`,
    target: (zero: string, max: string) => `Enter a target of ${zero} or more, up to ${max}, or leave it empty.`,
    targetOptional: (zero: string) => `Enter a target of ${zero} or more, or leave it empty.`,
    eachFund: (zero: string) => `Enter ${zero} or more for each fund.`,
    savingsOptional: {
      GBP: "Enter a savings amount, e.g. 250.00, or leave it empty to skip.",
      TWD: "Enter a savings amount in whole dollars, e.g. 5000, or leave it empty to skip.",
    },
    savingsAmount: {
      GBP: "Enter a savings amount, e.g. 250.00, or 0.",
      TWD: "Enter a savings amount in whole dollars, e.g. 5000, or 0.",
    },
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

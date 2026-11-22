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
  shell: {
    tagline: "Know what is safe to spend, every day.",
    skipToContent: "Skip to content",
    mainNav: "Main",
    tabs: { expenses: "Expenses", budget: "Budget", settings: "Settings" },
    addExpense: "Add expense",
    /** A browser tab title: "Budget · Personal Finance OS". */
    pageTitle: (page: string) => `${page} · Personal Finance OS`,
  },
  auth: {
    signIn: "Sign in",
    failed: "Sign-in didn't finish. Please try again.",
    accountFailed: "We couldn't load your account, so you've been signed out. Please sign in again.",
    openingGoogle: "Opening Google…",
    continueWithGoogle: "Continue with Google",
    oneSignIn: "One sign-in for your budget on every device.",
    deleted: "Your account and all your data have been deleted.",
  },
  privacy: {
    title: "Privacy",
    metaDescription: "What Personal Finance OS stores, where, and who can see it.",
    intro: "The short version: your money data is yours. Only you can see it, and you can take it or delete it at any time.",
    storeTitle: "What we store",
    storeGoogle: "What Google shares when you sign in with it: your email address, name and profile picture.",
    storeBudget: "The budget and spending details you enter: income, budgets, expenses, savings funds, trips and recurring payments.",
    storeImports: "The expenses you import from bank files (we keep the file's name, not the file).",
    storeSettings: "Your home time zone and budget settings, so dates and budgets line up with your days.",
    whereTitle: "Where it's kept",
    where: "In a database run by our database provider, Supabase. It's sent over an encrypted connection. Backups are kept by our database provider in case something goes wrong.",
    whoTitle: "Who can see it",
    who: "Only you. The database checks every request against your account (row-level security), so no one else signed in to the app can read your data.",
    sellingTitle: "No selling, no sharing",
    selling: "We don't sell your data or share it with anyone.",
    trackingTitle: "No tracking or ads",
    tracking: "There are no ads, analytics or tracking. The app sets cookies only to keep you signed in and to remember your theme, language, currency and time zone.",
    takeTitle: "Take it with you, or delete it",
    takeBefore: "In ",
    takeLink: "Settings",
    takeAfter: ", Export my data downloads everything you've entered, with your account email, as a file. Delete my account removes your account and all your data for good.",
    questionsTitle: "Questions",
    questions: "Contact the person who invited you to the app.",
  },
  tripPrompt: {
    startTitle: "Are you travelling?",
    startBody: "Start a trip? Your expenses while away are grouped under it. Your budget stays the same.",
    endTitle: "Back home?",
    endBody: (name: string) => `End your trip “${name}” today?`,
    dismiss: "Dismiss",
    notNow: "Not now",
    start: "Start a trip",
    ending: "Ending…",
    end: "End trip",
  },
  ui: {
    overBudget: "Over budget",
    status: { on_track: "On Track", spending_fast: "Spending Fast", out_of_budget: "Out of Budget" },
    donutCategory: "Category",
    donutAmount: "Amount",
    donutShare: "Share",
    dropHere: "Drop it here, or",
    chooseFile: "Choose file",
  },
  notices: { saved: "Budget saved.", deleted: "Category deleted.", reviewed: "Review done." },
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

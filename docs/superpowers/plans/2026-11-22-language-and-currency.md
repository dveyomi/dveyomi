# Language and Currency Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Language setting (English / 繁體中文) and an unlocked Currency setting (GBP / TWD) in Settings that switch every screen, amount and date.

**Architecture:** Typed dictionaries (`en-GB` is the source; `zh-TW` must match its type) and a `Format` object (money and dates for a locale + currency) reach server components through request-time getters that read two cookies, and client components through a React context whose default is English + GBP. The root layout wraps the app in one `<Suspense>` so request-time reads are allowed under `cacheComponents`. Preferences are stored on `profiles` and mirrored to cookies on save and on each signed-in load.

**Tech Stack:** Next.js 16 (App Router, `cacheComponents`), React 19, TypeScript, Supabase Postgres, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-22-language-and-currency-design.md`

## Global Constraints

- Locales: `en-GB` (default) and `zh-TW` only. Currencies: `GBP` (default) and `TWD` only. They are independent.
- Amounts stay integer hundredths in the database (`*_pence`), max `MAX_PENCE` = 1,000,000,000. TWD is shown and entered in whole dollars (`NT$1,250`), so a TWD amount is always a multiple of 100 hundredths.
- No conversion when the currency changes; the switch shows a warning first.
- Every existing test passes unchanged: anything called without a locale/currency behaves exactly as today (English, GBP).
- `zh-TW` text is Traditional Chinese with Taiwan vocabulary (e.g. 預算, 支出, 儲蓄, 類別, 設定, 新增支出), written by hand.
- User-typed names (categories, funds, trips, expenses) are never translated. The `/design` gallery and CSV export headers stay English.
- Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md` ("With Cache Components") before touching metadata (AGENTS.md).

## Review Focus

1. A TWD user types `12.50` in an amount field → a clear "whole dollars" error, never silent rounding. (Task 1 parse test, Task 5 AmountInput test.)
2. A server action receives TWD hundredths that aren't a multiple of 100 (a stale tab after switching currency) → refused with a message, nothing saved. (Task 5 validation test.)
3. A component rendered without any provider (every existing test, the design gallery) → English and GBP, no crash. (Task 3 hook test.)
4. A server action or route runs outside a request (Vitest) → `getServerI18n()` falls back to English/GBP instead of throwing. (Task 3 test.)
5. A cookie with a junk value (`locale=fr`, `currency=USD`) → treated as the default, never a crash. (Task 3 parse tests.)

---

### Task 1: Currency-aware money helpers

**Files:**
- Create: `src/lib/locale.ts`
- Modify: `src/lib/calc/money.ts`, `src/lib/calc/index.ts`
- Test: `src/lib/calc/money.test.ts`

**Interfaces:**
- Produces, in `src/lib/locale.ts` (pure, client-safe):
  `LOCALES = ["en-GB", "zh-TW"] as const`, `type Locale`, `DEFAULT_LOCALE: Locale = "en-GB"`, `parseLocale(v: unknown): Locale`,
  `CURRENCY_CODES = ["GBP", "TWD"] as const`, `type CurrencyCode`, `DEFAULT_CURRENCY: CurrencyCode = "GBP"`, `parseCurrency(v: unknown): CurrencyCode`,
  `CURRENCIES: Record<CurrencyCode, { symbol: "£" | "NT$"; decimals: 2 | 0 }>`.
- Produces, in `money.ts` (all exported from `@/lib/calc`):
  `formatMoney(pence: number, currency: CurrencyCode = "GBP"): string`,
  `formatMoneyShort(pence: number, currency: CurrencyCode = "GBP", locale: Locale = "en-GB"): string`,
  `formatSignedMoney(pence: number, currency: CurrencyCode = "GBP"): string`,
  `parseAmount(input: string, currency: CurrencyCode = "GBP"): number | null`,
  `parseOptionalAmount(input: string, currency: CurrencyCode = "GBP"): number | null`,
  `amountToInputText(pence: number, currency: CurrencyCode = "GBP"): string`.
  `formatGBP`, `formatGBPShort`, `formatSignedGBP`, `parsePence`, `parseOptionalPence`, `penceToInputText` stay, as one-line GBP wrappers.

- [ ] **Step 1: Write failing tests** in `money.test.ts` (new `describe("TWD")` and `describe("zh-TW short")` blocks; existing tests untouched):

```ts
expect(formatMoney(125000, "TWD")).toBe("NT$1,250");
expect(formatMoney(-125000, "TWD")).toBe("-NT$1,250");
expect(formatMoney(0, "TWD")).toBe("NT$0");
expect(formatSignedMoney(10000, "TWD")).toBe("+NT$100");
expect(formatSignedMoney(-4000, "TWD")).toBe("−NT$40");
expect(parseAmount("1,250", "TWD")).toBe(125000);
expect(parseAmount("NT$1250", "TWD")).toBe(125000);
expect(parseAmount("12.50", "TWD")).toBeNull();
expect(parseAmount("0", "TWD")).toBeNull();
expect(parseOptionalAmount("", "TWD")).toBe(0);
expect(parseOptionalAmount("NT$0", "TWD")).toBe(0);
expect(amountToInputText(125000, "TWD")).toBe("1250");
expect(formatMoneyShort(99900, "TWD")).toBe("NT$999");
expect(formatMoneyShort(123400, "TWD")).toBe("NT$1.2k");
expect(formatMoneyShort(100000, "TWD")).toBe("NT$1k");
expect(formatMoneyShort(123400, "TWD", "zh-TW")).toBe("NT$1.2千");
expect(formatMoneyShort(1234500, "TWD", "zh-TW")).toBe("NT$1.2萬");
expect(formatMoneyShort(12345600, "TWD", "zh-TW")).toBe("NT$12.3萬");
expect(formatMoneyShort(18200, "GBP", "zh-TW")).toBe("£182");
expect(formatMoneyShort(120000, "GBP", "zh-TW")).toBe("£1.2千");
expect(formatMoney(430178)).toBe(formatGBP(430178)); // GBP default unchanged
```

- [ ] **Step 2: Run** `npx vitest run src/lib/calc/money.test.ts`. Expected: FAIL (`formatMoney` is not exported).
- [ ] **Step 3: Implement** `locale.ts` and the six functions. TWD rounds hundredths to whole dollars with `divRound`. The short form applies the existing GBP rule below the thousand. For `zh-TW`: from 1,000 major units, one-decimal 千; from 10,000, one-decimal 萬, dropping a `.0`. The GBP sub-£100 exact-pence rule stays GBP-only.
- [ ] **Step 4: Run** `npx vitest run src/lib/calc`. Expected: PASS (old and new tests).
- [ ] **Step 5: Commit** `feat(calc): currency-aware money formatting and parsing`.

### Task 2: Locale-aware dates

**Files:**
- Modify: `src/lib/calc/dates.ts`, `src/lib/calc/expenses.ts` (`formatMonth`, `formatMonthYear`)
- Test: `src/lib/calc/dates.test.ts`, `src/lib/calc/expenses.test.ts`

**Interfaces:**
- Consumes: `Locale` from Task 1.
- Produces: an optional last parameter `locale: Locale = "en-GB"` on `formatWeekdayDate`, `formatDayMonth`, `formatDayMonthYear`, `formatShortDate`, `formatPeriodRange`, `formatMonth`, `formatMonthYear`. Formatters are created once per locale (a `Map` cache). `formatRelativeDay` and `formatDaysLeft` stay English-only; their words move to the dictionary in Task 3.

- [ ] **Step 1: Write failing tests** (values are what `Intl` gives in `zh-TW`):

```ts
expect(formatWeekdayDate("2026-11-22", "zh-TW")).toBe("11月22日星期日");
expect(formatDayMonth("2026-11-22", "zh-TW")).toBe("11月22日");
expect(formatDayMonthYear("2026-11-22", "zh-TW")).toBe("2026年11月22日");
expect(formatShortDate("2026-11-22", "zh-TW")).toBe("11月22日週日");
expect(formatPeriodRange("2026-10-25", "2026-11-24", "zh-TW")).toBe("10月25日 – 11月24日");
expect(formatMonth("2026-11", "zh-TW")).toBe("11月");
expect(formatMonthYear("2026-11", "zh-TW")).toBe("2026年11月");
```

- [ ] **Step 2: Run** `npx vitest run src/lib/calc`. Expected: FAIL.
- [ ] **Step 3: Implement.** The en-GB output must stay byte-identical (existing tests prove it).
- [ ] **Step 4: Run** `npx vitest run src/lib/calc`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(calc): dates in the chosen language`.

### Task 3: Dictionaries, Format, provider and request-time getters

**Files:**
- Create: `src/i18n/messages/en-GB.ts`, `src/i18n/messages/zh-TW.ts`, `src/i18n/messages/index.ts`, `src/i18n/format.ts`, `src/i18n/client.tsx`, `src/i18n/server.ts`, `src/i18n/cookies.ts`
- Modify: `src/app/layout.tsx`, `src/lib/theme.ts` (or a sibling `localeScript`)
- Test: `src/i18n/i18n.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces:
  - `enGB` (a plain object; strings, or functions for interpolation and plurals), `type Messages = typeof enGB`, `zhTW: Messages`, `messagesFor(locale: Locale): Messages`. Namespaces: `common`, `nav`, `auth`, `onboarding`, `budget`, `review`, `saving`, `expenses`, `recurring`, `trips`, `importer`, `settings`, `feedback`, `validation`, `errors`, `dates`. This task adds only `common` (Save, Cancel, Close, Back, Continue, Saving…, Saved., Delete, Edit) and `dates` (`today`, `tomorrow`, `daysLeft(n)`); later tasks add their own namespaces in both files.
  - `type Format = { locale: Locale; currency: CurrencyCode; money(p: number): string; moneyShort(p: number): string; signedMoney(p: number): string; parse(text: string): number | null; parseOptional(text: string): number | null; inputText(p: number): string; weekdayDate(d: IsoDate): string; dayMonth(d: IsoDate): string; dayMonthYear(d: IsoDate): string; shortDate(d: IsoDate): string; periodRange(a: IsoDate, b: IsoDate): string; month(m: YearMonth): string; monthYear(m: YearMonth): string; relativeDay(d: IsoDate, today: IsoDate): string; daysLeft(n: number): string }`, built by `makeFormat(locale: Locale, currency: CurrencyCode): Format`.
  - `type I18n = { locale: Locale; currency: CurrencyCode; m: Messages; fmt: Format }`, `DEFAULT_I18N: I18n` (en-GB, GBP).
  - Client (`"use client"`): `I18nProvider({ locale, currency, children })`, `useI18n(): I18n` (returns `DEFAULT_I18N` with no provider).
  - Server (`import "server-only"`): `getServerI18n(): Promise<I18n>`, wrapped in React `cache`, reading cookies `LOCALE_COOKIE = "locale"` and `CURRENCY_COOKIE = "currency"` (both in `cookies.ts`, which also exports `prefCookie(name, value): string` for one year, like `themeCookie`). If `cookies()` throws (no request), it returns `DEFAULT_I18N`.
  - Root layout: `<body>` holds `<Suspense fallback={null}><I18nRoot>{children}</I18nRoot></Suspense>`, where `I18nRoot` is an async server component that reads `getServerI18n()` and renders `I18nProvider`. `<html lang>` is set before paint by an inline script that reads the `locale` cookie, in the same way as `themeScript`.

- [ ] **Step 1: Write failing tests:**
  - `useI18n()` with no provider has `locale === "en-GB"` and `fmt.money(1250) === "£12.50"`.
  - Inside `<I18nProvider locale="zh-TW" currency="TWD">`, `m.common.save === "儲存"` and `fmt.money(125000) === "NT$1,250"`.
  - `getServerI18n()`, with `next/headers` mocked to throw, returns `DEFAULT_I18N`; with cookies `locale=zh-TW`, `currency=TWD` it returns those.
  - With `locale=fr` and `currency=USD` it returns the defaults.
  - `fmt.daysLeft(1)` gives "1 day left" / "剩 1 天".
- [ ] **Step 2: Run** `npx vitest run src/i18n`. Expected: FAIL.
- [ ] **Step 3: Implement.** The type of `zh-TW.ts` (`Messages`) makes any missing key a compile error.
- [ ] **Step 4: Run** `npx vitest run src/i18n && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Run** `npm run build`. Expected: success, with no "uncached data accessed outside Suspense" errors.
- [ ] **Step 6: Commit** `feat(i18n): dictionaries, formatting and the language provider`.

### Task 4: Saving language and currency (database, Settings, cookie sync, feedback)

**Files:**
- Create: `supabase/migrations/0015_language_currency.sql`, `src/app/(app)/PrefsSync.tsx`
- Modify: `src/db/database.types.ts` (`profiles.language`), `src/lib/data/profile.ts`, `src/lib/supabase/server.ts` (`getProfile` also selects `language, currency`), `src/app/(app)/SignedInSync.tsx`, `src/lib/validation/settings.ts`, `src/app/(app)/settings/settingsActions.ts`, `src/app/(app)/settings/RegionSection.tsx`, `src/app/(app)/settings/useAutoSave.ts`, feedback context (`FeedbackForm.tsx` and `src/lib/validation/feedback.ts` if it restricts keys)
- Test: `src/lib/data/settings.db.test.ts`, `src/app/(app)/settings/settingsActions.test.ts`, `src/app/(app)/settings/sections.test.tsx`, feedback validation test

**Interfaces:**
- Consumes: `Locale`, `CurrencyCode`, `parseLocale`/`parseCurrency`, `prefCookie`, `useI18n`.
- Produces:
  - Migration: `alter table public.profiles add column language text not null default 'en-GB' check (language in ('en-GB', 'zh-TW'))` and `add constraint profiles_currency_check check (currency in ('GBP', 'TWD'))`.
  - `setLanguage(supabase: Db, userId: string, locale: Locale): Promise<void>`, `setCurrency(supabase: Db, userId: string, currency: CurrencyCode): Promise<void>`. `SettingsView` gains `language: Locale`; `currency` becomes `CurrencyCode`.
  - `checkLocale(raw: unknown): Locale | null` and `checkCurrency(raw: unknown): CurrencyCode | null` (strict: unknown values give null).
  - Server actions `saveLanguage(raw: unknown): Promise<SaveResult>` and `saveCurrency(raw: unknown): Promise<SaveResult>`. Each validates, saves, sets its cookie with `(await cookies()).set(...)`, and calls `revalidatePath("/", "layout")`.
  - `PrefsSync({ language, currency })` (client): when the cookies differ from the profile, it writes them and calls `router.refresh()`. It is rendered by `SignedInSync`.
  - RegionSection:
    - A **Language** select. Options are labelled in their own language: "English (UK)", "繁體中文（台灣）". It auto-saves like the time zone.
    - The **Currency** select is enabled, with options "Pound sterling (GBP)" and "New Taiwan dollar (TWD)", translated.
    - Choosing a different currency opens `ConfirmDialog`: title `m.settings.currencyConfirmTitle`, body `m.settings.currencyConfirmBody(fmt.money(125000) in the old currency, the same in the new)`, i.e. "Your amounts won't be converted. £1,250.00 becomes NT$1,250." It saves only on confirm.
  - `useAutoSave`'s status strings come from `m.common.saving` / `m.common.saved`.
  - The feedback context gains `language` and `currency`.

- [ ] **Step 1: Write failing tests:**
  - db test: saving `zh-TW`/`TWD` round-trips, and `language: 'fr'` is refused by the check constraint.
  - Action test: `saveLanguage("zh-TW")` saves and sets the `locale` cookie; `saveLanguage("fr")` returns an error and saves nothing.
  - Section test: choosing TWD shows the warning, Cancel leaves GBP, and Confirm calls `saveCurrency("TWD")`.
  - Feedback test: the context includes `language`.
- [ ] **Step 2: Run** `npx vitest run src/app/\(app\)/settings && npm run test:db -- settings`. Expected: FAIL.
- [ ] **Step 3: Implement.** Apply the migration with `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase db reset`.
- [ ] **Step 4: Run** the same commands. Expected: PASS.
- [ ] **Step 5: Commit** `feat(settings): choose language and currency`.

### Task 5: Amounts follow the chosen currency

**Files:**
- Modify: `src/components/ui/Money.tsx` (becomes `"use client"`, uses `useI18n().fmt`), `src/components/ui/AmountInput.tsx`, `src/components/ui/Donut.tsx`, `src/components/ui/ListRow.tsx`, every file listed by `grep -rln "formatGBP\|formatGBPShort\|formatSignedGBP\|parsePence\|parseOptionalPence\|penceToInputText" src --include=*.tsx --include=*.ts | grep -v test | grep -v src/lib/calc`, `src/lib/validation/common.ts` and each validator with a "£" message, `src/lib/data/onboarding.ts`, `src/lib/import/csv.ts` (also accept `NT$`)
- Test: `src/components/ui/ui.test.tsx`, `src/lib/validation/*.test.ts`

**Interfaces:**
- Consumes: `Format`, `useI18n`, `getServerI18n`, `I18n`.
- Produces:
  - Validators take an optional last parameter `i18n: I18n = DEFAULT_I18N` and build amount messages from `i18n.m.validation.*` with `i18n.fmt.money(...)`.
  - `isAmount(v: unknown, min: number, currency: CurrencyCode = "GBP"): v is number`, in `common.ts`: `isPence`, plus, for TWD, a multiple of 100, and a TWD minimum of at least 100.
  - Server actions pass `await getServerI18n()`; client forms pass `useI18n()`.
  - AmountInput shows the currency symbol as its prefix and parses with `fmt.parse` / `fmt.parseOptional`. Its local errors are `m.validation.amountRequired(fmt)` / `m.validation.amountOptional(fmt)`; for TWD that's "Enter a whole number of dollars, e.g. 1250". `AMOUNT_ERROR` and `OPTIONAL_AMOUNT_ERROR` stay exported, unchanged, for the English tests.
  - A component with no directive that formats money: if it is `async` or reads data, it calls `getServerI18n()`; otherwise it gets `"use client"` and `useI18n()`.

- [ ] **Step 1: Write failing tests:**
  - `<Money pence={125000} />` inside a TWD provider renders "NT$1,250".
  - AmountInput in TWD shows "NT$" and, for `12.50`, shows the whole-dollar error; `onValueChange` gets null.
  - `validateBudgetEdit({ incomePence: 12550, … }, twdI18n)` fails with an income message containing "NT$". The same input as GBP passes.
- [ ] **Step 2: Run** `npx vitest run`. Expected: only the new tests fail.
- [ ] **Step 3: Implement**, then confirm `grep -rn "£" src --include=*.tsx --include=*.ts | grep -v test | grep -v "src/lib/calc/money.ts" | grep -v "src/app/design"` lists only comments and en-GB dictionary entries.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: amounts and amount fields follow the chosen currency`.

### Tasks 6–10: Move every screen's text into the dictionaries (one area per task)

Each task applies the same steps to its own files. For each one:
- Add a namespace to **both** `en-GB.ts` and `zh-TW.ts`.
- Replace every user-facing string with a dictionary read: JSX text, `aria-label`, `label`, `placeholder`, `title`, `hint`, `description`, `body`, option labels, notices, toast and status text, `confirm` text, and errors returned by its server actions and data functions.
- Pass `fmt` dates wherever the area formats dates.
- Turn a page's `export const metadata` into `generateMetadata()` reading `getServerI18n()`.
- Turn a sync page that renders text into an `async` page.
- Data-layer error classes that carry an English `message` (e.g. the savings-already-moved error in `budgetEdit.ts`) get a `code`, and the calling action maps the code to `m.errors.*`.

**Steps for each task:**
- [ ] **Step 1: Write a failing test:** render the area's main component inside `<I18nProvider locale="zh-TW" currency="TWD">` and assert two or three Chinese strings and one NT$ amount (listed per task below).
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Move the strings and write the translations.**
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit && npx eslint src`. Expected: PASS, with the existing English tests unchanged.
- [ ] **Step 5: Commit** `feat(i18n): <area> in Traditional Chinese`.

**Task 6: Shell, sign-in and shared UI.**
- Files: `src/app/(app)/layout.tsx` (skip link), `src/components/Nav.tsx`, `src/app/login/*`, `src/app/privacy/page.tsx`, any `not-found`/`error` files, `src/components/ui/{BottomSheet,ConfirmDialog,EmptyState,FileDrop,Notice,Select,TextField,Toggle,Skeleton,field}.tsx` built-in labels, `TripPrompt`, `TimezoneSync`, `SavedNotice`.
- Test: Nav shows 預算, 支出, 設定 and 新增支出.

**Task 7: Onboarding.**
- Files: `src/app/onboarding/*`, `src/lib/data/onboarding.ts` messages, `src/components/AllocationEditor.tsx`.
- Test: step 1 heading in Chinese; step 2 tabs 必要支出 / 想要支出; the over-allocation line with NT$.

**Task 8: Budget tab.**
- Files: `src/app/(app)/budget/**`, `src/app/(app)/review/**`, `BudgetOverview`, `BudgetTabs`, `AllocationCard`, `CategoryDetail`, `SafeToSpendInfo`, `SavingTab`, `FundForms`, `FundHistory`, `MoveSavingsSheet`, `LeftoverPrompt`, `OverspendReview`, `UnassignedNudge`, `StatusBadge`, `src/lib/validation/{budgetEdit,review,funds}.ts`.
- Test: BudgetOverview shows 可安心花用, a status badge in Chinese, and "NT$…" amounts.

**Task 9: Expenses tab.**
- Files: `src/app/(app)/expenses/**`, `ExpensesOverview`, `Calendar` (weekday headers from `Intl` in the locale, `fmt.moneyShort`), `DaySheet`, `Analytics`, `TransactionList`, `ExpenseForm`, `RepeatFields`, `RecurringList`, `RecurringSuggestions`, `EditRecurringPrompt`, `TripEditor`, `TripForm`, `TripList`, `TripSummary`, `ImportWizard`, `RecentImports`, `src/lib/validation/{expense,trip,import}.ts`.
- Test: Calendar weekday header 一…日 and a phone tile "NT$1.2千"; ExpenseForm label 金額 and button 儲存支出.

**Task 10: Settings.**
- Files: `src/app/(app)/settings/**` (every section, feedback form and list, help, account deletion), `ThemeChooser`, `src/lib/validation/{settings,feedback}.ts`.
- Test: Settings shows 地區, 語言 and 主題 headings, and the currency warning in Chinese.

### Task 11: No English left behind, and full verification

**Files:**
- Modify: `eslint.config.mjs`

- [ ] **Step 1: Turn on `react/jsx-no-literals`** (`{ noStrings: false, ignoreProps: true, allowedStrings: ["·", "–", "—", "%", "/", "+", "−", "×", "…", ":", "(", ")"] }`) for `src/app/**` and `src/components/**`, excluding `src/app/design/**` and tests.
- [ ] **Step 2: Run** `npx eslint src`. Expected: zero `jsx-no-literals` errors. Fix any that remain by adding dictionary keys.
- [ ] **Step 3: Check props eslint doesn't cover.** Run `grep -rnE '(label|aria-label|placeholder|title|hint|description|body|alt)="[A-Z]' src/app src/components | grep -v test | grep -v src/app/design`. Expected: empty.
- [ ] **Step 4: Run the full suite:** `npx vitest run && npm run test:db && npx tsc --noEmit && npm run lint && npm run build && npm run test:e2e -- --trace off`. Expected: all pass.
- [ ] **Step 5: Browser check.** Sign in a seeded user, set 繁體中文 + TWD in Settings, and screenshot every screen at phone (iPhone 15) and desktop (1440) widths, including the onboarding steps for a fresh user with the cookies set. Read each screenshot: no English except user-typed names and brand names, amounts in NT$ without decimals, and nothing clipped or overflowing. Switch back to English + GBP and spot-check Budget and Expenses.
- [ ] **Step 6: Commit and push** `chore(i18n): lint guard against untranslated text`, then `git push -u origin claude/friendly-pasteur-w17o5g`.

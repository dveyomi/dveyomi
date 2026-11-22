# Language and currency settings: design

2026-11-22. Approved approach: option 1 (a language setting; pages built per visitor).

## Why

David's girlfriend uses the app. She has already set up her account. She reads Traditional Chinese (Taiwan), and she thinks in New Taiwan dollars. She needs to understand every screen so she can use the app and give David feedback. Today the app is English-only and shows every amount in pounds.

## Goals

- A **Language** setting in Settings: English (UK) or 繁體中文 (Taiwan). Choosing it switches every screen, straight away. That covers: labels, buttons, headings, help text, empty states, error and validation messages, sheets and dialogs, page titles, accessible names, and dates (e.g. 11月22日 星期日).
- A **Currency** setting in Settings, unlocked: Pound sterling (GBP) or New Taiwan dollar (TWD). Every amount, amount field and money message uses it (£1,250.00 or NT$1,250).
- The choice is remembered on her account and on her device, so it holds across sign-ins and on the sign-in page.
- Bug reports and ideas sent from Settings record the language she was using, so David knows she was reading Chinese.

## Non-goals

- Converting amounts between currencies, exchange rates, or holding several currencies at once. Changing currency only changes how amounts are shown; the numbers stay the same.
- Translating what people type (category, fund, trip and expense names).
- Language-prefixed web addresses (`/zh-TW/…`).
- Other languages or currencies for now. The design must make adding one mostly a matter of writing a dictionary (and a currency entry).
- Translating the onboarding flow for a brand-new Chinese-only user before they reach Settings. It is translated (it uses the same dictionaries), but there is no language picker inside onboarding, and no browser-language detection.
- Translating the bank CSV import's column detection rules for Taiwanese bank exports.
- The `/design` gallery (developer-only) stays English.

## Anti-goals

- Any screen showing a mix of English and Chinese, or a flash of English before Chinese.
- Machine-translated finance terms that mislead (for example "Safe to spend" rendered as something about safety). Translations are written by hand and reviewed by her.
- Silently changing stored amounts when the currency changes.
- Breaking the English app or its tests.

## Constraints (from the codebase)

- Next.js 16 with `cacheComponents: true`. Anything that reads the language cookie is request-time, so it must sit inside a `<Suspense>` boundary. Static page parts that hold text (headings, nav labels, skeleton text, `metadata` titles) can no longer be prerendered in one language. Metadata that reads the cookie must follow the "Cache Components" rules in `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md`.
- The root layout is kept static: the theme is applied by an inline script reading a cookie (`src/lib/theme.ts`). `<html lang>` should be set the same way.
- Money is integer pence in the database (`*_pence` columns, at most 1,000,000,000 where a person enters it). `profiles.currency` already exists (default `'GBP'`) and is shown, disabled, in Settings → Region (`RegionSection.tsx`).
- Formatting lives in `src/lib/calc/money.ts` (`formatGBP`, `formatGBPShort`, `parsePence`, `parseOptionalPence`). It is used by about 30 files, some server-rendered and some client-rendered. About 50 more places write "£" into messages directly.
- Validation (`src/lib/validation/*`, `src/lib/data/onboarding.ts`) runs on both the client and the server, and returns English sentences. Server actions return those to forms.
- 1,041 unit/component tests assert English text. They must keep passing unchanged, which means English stays the default everywhere a language isn't given.

## Approaches considered

1. **Language setting; pages built per visitor (chosen).** The choice is stored on the profile and mirrored in a cookie. Text is read from dictionaries at request time, and request-time parts are wrapped in Suspense. The trade-off: the prerendered static shell gives way to a request-time one, which costs a little speed on first paint. Every page already waits for user data, so the difference is small.
2. **Language in the URL** (`app/[lang]/…`, the Next.js guide's pattern). Keeps prerendering, but every route, link, redirect and the proxy change, and shared links carry a language. Too much upheaval for two users.
3. **Swap text in the browser after load.** Keeps the shell, but shows English first on every page and is worse for screen readers. Rejected by the anti-goals.

## Decided

- Languages: `en-GB` (default) and `zh-TW` (Traditional Chinese, Taiwan usage and vocabulary).
- Currencies: `GBP` (default) and `TWD`. Language and currency are independent settings.
- TWD is shown and entered in **whole dollars**, as prices are in Taiwan: NT$1,250, with no decimals. It is stored, like GBP, in hundredths (×100), so the schema and limits don't change. Amount fields in TWD reject decimals with a clear message. Limits read in the chosen currency (for example "between NT$1 and NT$10,000,000").
- Short amounts (phone calendar tiles): GBP as today (£182, £1.2k). TWD: full below NT$1,000 (NT$999), then NT$1.2k / NT$12k in English and NT$1.2千 / NT$1.2萬 in Chinese.
- Switching currency shows a warning before saving: "Your amounts won't be converted. £1,250 becomes NT$1,250." (in the chosen language).
- Dates and month names come from `Intl` in the chosen language. Week start stays Monday.
- Translations are hand-written in the code, in a typed dictionary. The Chinese dictionary must have every key the English one has (a type error otherwise).
- Language and currency are saved on the profile (a new `profiles.language` column, constrained to the two values; `profiles.currency` constrained to the two values) and copied to cookies on save and on each signed-in load, so the sign-in page and request-time rendering can read them without a database round trip.
- Feedback context gains `language` and `currency`.

## Left to the builder

- Dictionary shape and helper API (plain objects with functions for interpolation and plurals are fine), file layout, cookie names, how the provider reaches client components, and how shared validation receives the dictionary (English as the default argument, so existing callers and tests are unchanged).
- Where exactly Suspense boundaries go to satisfy `cacheComponents`, and how page `metadata` titles become per-language.
- Whether `formatGBP` is kept as an English/GBP wrapper or replaced at call sites.
- Test strategy beyond: existing tests pass unchanged; new tests cover formatting and parsing for both currencies, the dictionary completeness, the settings save and cookie sync, and at least one screen rendered in Chinese with NT$; a manual check in the browser of every screen in Chinese with NT$ at phone and desktop width.

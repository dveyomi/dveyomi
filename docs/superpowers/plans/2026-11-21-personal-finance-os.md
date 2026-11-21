# Personal Finance OS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP of Personal Finance OS: a dark, mobile-first web app with Expenses, Budget and Settings tabs, a + button, safe-to-spend, savings funds, recurring payments and trips.

**Architecture:** Next.js (App Router, TypeScript) on Vercel with Supabase (Postgres, Google Auth, row-level security). Every financial figure comes from one pure, tested module (`src/lib/calc`); screens only render what it returns. Work proceeds in thin vertical slices in the spec's build order: calc module, then auth/schema/onboarding/Budget, then expenses, then recurring and funds, then trips, then imports.

**Tech Stack:** Next.js, React, TypeScript, Tailwind, `@supabase/supabase-js`, `@supabase/ssr`, Supabase CLI (local stack), Vitest, Testing Library, Playwright (one smoke test).

**Spec:** `docs/superpowers/specs/2026-11-20-personal-finance-os-design.md` (copy it into the app repo in Task 1). Section numbers below (§) refer to it. Lines the spec marks "My call" are defaults; where this plan makes a further call the spec left to the builder, it says "(plan call)".

## Skills to load

Load the named skill with the Skill tool before starting the task. If a skill is not installed in the session, say so and carry on without it.

- Tasks 9, 11, 16, 17, 18, 21 (database, RLS, scheduled job, data layer): `supabase:supabase-postgres-best-practices`; also `supabase:supabase` for Tasks 9, 10, 11, 17, 21 (auth, SSR clients, cron).
- Task 9A (design system): `design:design-system` and `ui-ux-pro-max:design-system` (token layers, hard-coded value audit).
- Every screen task (10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21): `vercel-react-best-practices` while writing; `web-design-guidelines` and `design:accessibility-review` once the screen renders.
- Task 23: `design:design-critique` on the finished Budget and Expenses screens at phone and desktop widths, and `design:ux-copy` on empty states, errors and prompts.
- All code tasks: `superpowers:test-driven-development`.
- `next-best-practices` no longer exists as a separate skill: its guidance ships with Next.js 16.3 and later. Task 1 checks the installed version.

## Global Constraints

- Money is integer pence everywhere (TS `number` holding an integer, Postgres `bigint`). No floating-point money maths. Display currency is GBP.
- Dates are calendar dates as `YYYY-MM-DD` strings (`IsoDate`), never timestamps, for transactions, periods and recurring due dates.
- All financial calculations live in `src/lib/calc`. UI and data code import from it and never re-derive a figure.
- Every table has `user_id uuid not null default auth.uid()` and row-level security; no table is readable across users.
- Every transaction has `source text not null default 'manual'` and `external_id text null`.
- Dark theme only: near-black background, charcoal cards, white text, muted grey secondary text, one restrained lime accent, rounded shapes.
- One design system (Task 9A). Colours, type, spacing and radii exist only as tokens in `src/design/tokens.css`; shared UI pieces exist only in `src/components/ui/`. Screens compose those pieces and contain no hex colours, pixel sizes or one-off styles, so a change to a token or a component changes the whole app.
- Safe to spend per day = (total left − Needs left) ÷ days left, counting today (§5.5). Rounding is to the nearest penny, halves up (this reproduces the reference figure: £4,301.78 left, 5 days → £860.36).
- Fund-paid expenses count in Expenses totals, calendar and category charts, but never in monthly spent, Needs/Wants left or safe to spend (§5.7).
- Three concepts are never mixed: transactions, recurring/planned payments, allocations. A transfer is not spending (§6).
- Anti-goals (§2): no figure calculated two ways, no double counting, no misleading £0 or "On Track" before a budget exists.
- Design references: before building any screen, search Mobbin (`search_screens`, `search_flows`) twice for comparable screens, once with platform `ios` for the phone layout and once with platform `web` for the desktop layout. Both are required for every screen, because the desktop layout is designed, not a scaled-up phone. Look at the returned images, and note in the task's commit message which phone and which desktop reference informed it. They inform layout and patterns only. The reference app (DaTrack) screenshots David supplied remain the visual guide, and nothing is copied from any app (§2 anti-goal).
- Nothing from §10 (parked) is built.

## Review Focus

Failure modes the spec implies but its tests would not otherwise exercise. Each is pinned by a test in the named task.

1. Amounts typed as people write them ("£1,200.50", "12.5", "12.555", "0", "-5", "", "abc") must parse to pence or be rejected, never become NaN or a float. (Task 2)
2. Start day 29–31 in short months and leap years (31 Jan → 28 Feb 2027 → 31 Mar; 30 → 29 Feb 2028) must not skip or double a day. (Task 3)
3. A user with no budget, or a budget and no expenses, must see an empty state, not "£0 left" or "On Track". (Tasks 4, 13)
4. Editing or deleting an expense in a past period must change only that period's figures, never the current Safe to Spend. (Task 14)
5. A row must not be able to reference another user's category, fund, rule or trip, even by guessing its id. (Task 9)

---

## Phase A: Calculation module (§7)

### Task 1: Scaffold the project

**Files:**
- Create: `personal-finance-os/` (app root, sibling of `docs/`), `vitest.config.ts`, `src/lib/calc/index.ts`, `docs/specs/…` (copy of the spec and this plan), `.env.example`
- Modify: `package.json` (scripts `test`, `test:db`)

**Interfaces:** Produces: `npm test` runs Vitest over `src/**/*.test.ts(x)`; path alias `@/` → `src/`.

- [ ] **Step 1:** Run `npx create-next-app@latest personal-finance-os --ts --app --src-dir --tailwind --eslint --use-npm`; `cd` into it; `git init`; copy the spec and this plan into `docs/`.
- [ ] **Step 2:** `npm i @supabase/supabase-js @supabase/ssr` and `npm i -D vitest jsdom @testing-library/react @testing-library/jest-dom @playwright/test`. Add `vitest.config.ts` (jsdom environment, alias `@`).
- [ ] **Step 2b:** Run `npx next --version`. If it is below 16.3, upgrade (`npm i next@latest react@latest react-dom@latest`) so the built-in Next.js agent guidance is generated; if the upgrade is not possible, install the guidance skill by the method the Next.js docs give for older versions.
- [ ] **Step 3:** Add `src/lib/calc/smoke.test.ts` asserting `1 + 1 === 2`; run `npx vitest run` → PASS. Delete the smoke test.
- [ ] **Step 4:** Commit `chore: scaffold Next.js app with Vitest`.

### Task 2: Money and date helpers

**Files:**
- Create: `src/lib/calc/money.ts`, `src/lib/calc/dates.ts`
- Test: `src/lib/calc/money.test.ts`, `src/lib/calc/dates.test.ts`

**Interfaces:** Produces:
`parsePence(input: string): number | null`, `formatGBP(pence: number): string`, `divRound(pence: number, divisor: number): number` (nearest, halves up),
`type IsoDate = string`, `addDays(d: IsoDate, n: number): IsoDate`, `daysBetween(from: IsoDate, to: IsoDate): number` (to − from), `lastDayOfMonth(year: number, month1to12: number): number`, `todayIn(timeZone: string, now: Date): IsoDate`.

- [ ] **Step 1:** Write failing tests in `money.test.ts`:
  - `parsePence("£1,200.50") === 120050`, `parsePence("12.5") === 1250`, `parsePence("7") === 700`.
  - `parsePence` returns `null` for `"12.555"`, `"0"`, `"0.00"`, `"-5"`, `""`, `"abc"`, `"1e3"`.
  - `formatGBP(430178) === "£4,301.78"`, `formatGBP(-10000) === "-£100.00"`, `formatGBP(0) === "£0.00"`.
  - `divRound(430178, 5) === 86036`, `divRound(7, 2) === 4`, `divRound(-430178, 5) === -86036`.
  In `dates.test.ts`: `addDays("2026-12-30", 3) === "2027-01-02"`, `daysBetween("2026-11-21", "2026-11-25") === 4`, `lastDayOfMonth(2028, 2) === 29`, `todayIn("Asia/Taipei", new Date("2026-11-20T20:00:00Z")) === "2026-11-21"`.
- [ ] **Step 2:** Run `npx vitest run src/lib/calc` → FAIL (modules missing).
- [ ] **Step 3:** Implement the signatures above. `parsePence` strips a leading `£` and commas, then accepts only `/^\d+(\.\d{1,2})?$/` and a result > 0; parse by splitting on `.` (no `parseFloat`). Use `Intl.DateTimeFormat("en-CA", {timeZone})` for `todayIn`; do date arithmetic in UTC.
- [ ] **Step 4:** Run the tests → PASS. Commit `feat(calc): money and date helpers`.

### Task 3: Budget periods

**Files:**
- Create: `src/lib/calc/periods.ts`
- Test: `src/lib/calc/periods.test.ts`

**Interfaces:** Consumes: `IsoDate`, `addDays`, `daysBetween`, `lastDayOfMonth`. Produces:
`type Period = { start: IsoDate; end: IsoDate; nextStart: IsoDate }` (`end` inclusive; `nextStart = end + 1 day`),
`periodContaining(date: IsoDate, startDay: number): Period`,
`daysLeft(period: Period, today: IsoDate): number` (counting today, minimum 1 inside the period),
`previousPeriod(period: Period, startDay: number): Period`.

- [ ] **Step 1:** Write failing tests (start day clamps to the last day of shorter months, §5.2):
  - `periodContaining("2026-11-21", 25)` → `{start:"2026-10-25", end:"2026-11-24", nextStart:"2026-11-25"}`; `periodContaining("2026-11-25", 25).start === "2026-11-25"`.
  - Start day 31: `periodContaining("2027-02-15", 31)` → start `2027-01-31`, nextStart `2027-02-28`; `periodContaining("2027-02-28", 31)` → start `2027-02-28`, nextStart `2027-03-31`.
  - Start day 30, leap year: `periodContaining("2028-02-10", 30).nextStart === "2028-02-29"`.
  - Start day 1: `periodContaining("2026-12-31", 1)` → `2026-12-01` to `2026-12-31`.
  - `daysLeft(periodContaining("2026-11-21", 25), "2026-11-21") === 4`; on `2026-11-24` it is `1`.
  - `previousPeriod` of the Nov-25 period with start day 25 starts `2026-10-25`.
  - Every date in 2027 falls in exactly one period for start days 1, 25, 29, 30, 31 (loop test: consecutive periods are contiguous).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement; the period start in month M is `min(startDay, lastDayOfMonth)`. **Step 4:** Run → PASS. Commit `feat(calc): budget periods`.

### Task 4: Budget summary, Safe to Spend and status

**Files:**
- Create: `src/lib/calc/budget.ts`
- Test: `src/lib/calc/budget.test.ts`

**Interfaces:** Consumes: `Period`, `daysLeft`, `divRound`. Produces:
```ts
type Txn = { id: string; amountPence: number; date: IsoDate; categoryId: string; fundId: string | null }
type Allocation = { categoryId: string; kind: "need" | "want"; amountPence: number }
type PeriodBudget = { incomePence: number; savingsPence: number; unassignedCarryPence: number; allocations: Allocation[] }
type CategoryFigure = { categoryId: string; kind: "need" | "want" | null; allocatedPence: number; spentPence: number; leftPence: number; overPence: number; noBudget: boolean }
type BudgetSummary = { poolPence: number; spentPence: number; leftToSpendPence: number; needsLeftPence: number; unallocatedPence: number; overAllocatedPence: number; daysLeft: number; safeToSpendPerDayPence: number; categories: CategoryFigure[]; status: "on_track" | "spending_fast" | "out_of_budget" }
summarise(budget: PeriodBudget | null, txns: Txn[], period: Period, today: IsoDate): BudgetSummary | null
```
`null` budget → `null` (the "no budget yet" state; the UI must not invent figures).

Rules: pool = income − savings (never the sum of allocations). Monthly spent = txns dated inside the period with `fundId === null`. Left to spend = pool + `unassignedCarryPence` − spent. Needs left = Σ max(0, allocated − spent) over needs. Per-category `leftPence` is the true (possibly negative) figure, `overPence = max(0, −leftPence)`; spending in a category with no allocation gives `allocatedPence 0, noBudget true`. Safe to spend = `divRound(leftToSpend − needsLeft, daysLeft)` (may be negative). Status (plan call, §9 left it to the builder): `out_of_budget` if safe to spend < 0; else `spending_fast` if wants allocated > 0 and wantsSpent/wantsAllocated > elapsedDays/periodDays + 0.10; else `on_track`.

- [ ] **Step 1:** Write failing tests:
  - Reference figure: pool 600000, spent 169822, no needs left, 5 days left → `leftToSpendPence 430178`, `safeToSpendPerDayPence 86036`.
  - Needs floor: pool 200000; need "rent" allocated 100000, spent 120000; want allocated 100000, spent 0; 10 days left → `needsLeftPence 0`, `leftToSpendPence 80000`, `safeToSpendPerDayPence 8000`, rent `leftPence -20000`, `overPence 20000`.
  - Fund-paid txn (`fundId: "f1"`, 5000) does not change `spentPence`, `leftToSpendPence` or any category `spentPence`.
  - Txn dated before `period.start` is ignored.
  - Over-allocation: pool 100000, allocations sum 150000 → `overAllocatedPence 50000`, `poolPence` still 100000, no category `leftPence` is clamped.
  - Spending in an unallocated category → `noBudget: true`.
  - `unassignedCarryPence 3000` raises `leftToSpendPence` by 3000.
  - `summarise(null, [], period, today) === null`; a budget with no txns gives `status "on_track"` and `spentPence 0`.
  - Wants spent 80% of allocation at 20% of the period → `spending_fast`; safe to spend < 0 → `out_of_budget`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement per the rules above. **Step 4:** Run → PASS. Commit `feat(calc): budget summary and safe to spend`.

### Task 5: Expense totals and month-on-month comparison

**Files:**
- Create: `src/lib/calc/totals.ts`, `src/lib/calc/comparison.ts`
- Test: `src/lib/calc/totals.test.ts`, `src/lib/calc/comparison.test.ts`

**Interfaces:** Consumes: `Txn`, `Period`, `daysBetween`. Produces:
`totalsByDay(txns: Txn[]): Map<IsoDate, number>`, `totalsByCategory(txns: Txn[], period: Period): Map<string, number>`, `totalSpent(txns: Txn[], period: Period): number` (all three **include** fund-paid expenses, §5.7);
```ts
type Comparison = { currentPence: number; previousPence: number; diffPence: number; pct: number | null; direction: "up" | "down" | "same" }
compareToPrevious(txns: Txn[], current: Period, previous: Period, today: IsoDate): Comparison | null
```
Rules (§8): if `today` is inside `current`, compare spend so far with the previous period's spend over the same number of elapsed days (day 1 through the same day index); if `current` has ended, compare full periods. `null` when the previous period has no transactions. `pct = diff / previous × 100`, rounded to one decimal.

- [ ] **Step 1:** Failing tests: fund-paid txn is included in `totalSpent` and `totalsByCategory`; `totalsByDay` sums two txns on one date; mid-period comparison counts only the previous period's first N days (txn on day N+1 of the previous period is excluded); completed period compares full vs full; no previous txns → `null`; equal spend → `direction "same"`, `pct 0`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS. Commit `feat(calc): totals and month-on-month comparison`.

### Task 6: Savings funds

**Files:**
- Create: `src/lib/calc/funds.ts`
- Test: `src/lib/calc/funds.test.ts`

**Interfaces:** Consumes: `Txn`. Produces:
```ts
type FundMovement = { id: string; date: IsoDate; kind: "contribution" | "withdrawal"; amountPence: number }
type FundEntry = { date: IsoDate; direction: "in" | "out"; amountPence: number; label: "contribution" | "withdrawal" | "expense"; refId: string }
fundBalance(openingPence: number, movements: FundMovement[], paidFromFund: Txn[]): number
fundHistory(movements: FundMovement[], paidFromFund: Txn[]): FundEntry[]   // newest first
```
Balance = opening + contributions − withdrawals − fund-paid spending (§5.7).

- [ ] **Step 1:** Failing tests: opening 10000 + contribution 5000 − withdrawal 1000 − expense 2000 = 12000; history is newest first and labels expenses `"expense"`; a fund-paid expense never appears in `summarise` (assert via Task 4 function with the same txn).
- [ ] **Step 2–4:** Run FAIL, implement, run PASS. Commit `feat(calc): savings fund balances and history`.

### Task 7: Recurring schedule and price history

**Files:**
- Create: `src/lib/calc/recurring.ts`
- Test: `src/lib/calc/recurring.test.ts`

**Interfaces:** Consumes: `IsoDate`, `addDays`, `lastDayOfMonth`. Produces:
```ts
type Frequency = "weekly" | "fortnightly" | "monthly" | "quarterly" | "annually"
type Price = { effectiveFrom: IsoDate; amountPence: number }
type Rule = { frequency: Frequency; anchorDate: IsoDate; endDate: IsoDate | null; pausedUntil: IsoDate | null; skippedDates: IsoDate[] }
scheduleBetween(rule: Rule, from: IsoDate, to: IsoDate): { date: IsoDate; skipped: boolean }[]   // inclusive; skipped = paused or in skippedDates
dueOccurrences(rule: Rule, from: IsoDate, to: IsoDate): IsoDate[]   // schedule entries with skipped === false
amountOn(prices: Price[], date: IsoDate): number
withPriceChange(prices: Price[], effectiveFrom: IsoDate, amountPence: number): Price[]
```
Dates always derive from `anchorDate`, not from the previous occurrence, so a monthly anchor of the 31st gives 31 Jan, 28 Feb, 31 Mar. A date is paused when `date < pausedUntil`. Nothing is produced after `endDate` (cancel sets `endDate`).

- [ ] **Step 1:** Failing tests: weekly from `2026-11-02` through `2026-11-30` → 2, 9, 16, 23, 30 Nov; fortnightly steps of 14; monthly anchor `2026-01-31` → `2026-02-28`, `2026-03-31`; quarterly and annually from `2024-02-29` → `2025-02-28`; `pausedUntil` excludes earlier dates from `dueOccurrences` but `scheduleBetween` marks them `skipped: true`; `skippedDates` skips exactly one; `endDate` stops generation; `amountOn` with prices £8 from 2023-01-01 and £12 from 2026-03-01 returns 800 for `2026-02-28` and 1200 for `2026-03-01`; `amountOn` throws if no price applies; `withPriceChange` keeps history (does not mutate the input) and replaces an existing entry with the same `effectiveFrom`.
- [ ] **Step 2–4:** Run FAIL, implement, run PASS. Commit `feat(calc): recurring schedule and price history`.

### Task 8: Leftover breakdown and overspend review

**Files:**
- Create: `src/lib/calc/leftover.ts`
- Test: `src/lib/calc/leftover.test.ts`

**Interfaces:** Consumes: `BudgetSummary`, `divRound`. Produces:
```ts
type LeftoverSource = { kind: "freed_by_pause" | "previously_unassigned" | "unspent_categories"; amountPence: number }
leftoverBreakdown(summary: BudgetSummary, unassignedCarryPence: number, freedByPausePence: number): { totalPence: number; sources: LeftoverSource[] }
categoriesOverTwiceInThree(lastPeriods: { categoryId: string; overPence: number }[][]): string[]
suggestedBudget(recentSpentPence: number[]): number
```
Rules: `totalPence = max(0, summary.leftToSpendPence)` (one whole amount, §5.9). Sources are attributed in this order and capped so they sum to the total (plan call): previously unassigned (the carry), then freed by pause, then the remainder as unspent categories. Zero-amount sources are omitted. `categoriesOverTwiceInThree` looks at the last three periods and returns category ids with `overPence > 0` in at least two. `suggestedBudget` = mean of the given spends rounded up to a whole pound, in pence.

- [ ] **Step 1:** Failing tests: left 50000, carry 10000, freed 15000 → sources `[previously_unassigned 10000, freed_by_pause 15000, unspent_categories 25000]`; left 5000, carry 10000 → previously unassigned capped at 5000; left negative → `totalPence 0`, no sources; a category over in periods 1 and 3 of three → returned; over once → not returned; only two periods supplied and over in both → returned; `suggestedBudget([41050, 43000, 40000]) === 41400` (mean 41350, rounded up to the whole pound).
- [ ] **Step 2–4:** Run FAIL, implement, run PASS. Commit `feat(calc): leftover breakdown and overspend review`.

---

## Phase B: Database, auth, onboarding, Budget tab

### Task 9: Schema and row-level security

**Files:**
- Create: `supabase/migrations/0001_schema.sql`, `supabase/migrations/0002_rls.sql`, `src/db/rls.test.ts`, `src/db/testClients.ts`
- Modify: `package.json` (`"test:db": "vitest run src/db"`)

**Interfaces:** Produces tables (all with `user_id uuid not null default auth.uid()`, `unique (id, user_id)`, and RLS enabled with owner-only select/insert/update/delete policies):
- `profiles(user_id pk, timezone text not null default 'Europe/London', currency text not null default 'GBP', budget_start_day int not null check (between 1 and 31))`
- `categories(id, name, kind check in ('need','want'), icon, colour)`
- `budget_periods(id, start_date, end_date, income_pence, savings_pence, unassigned_carry_pence default 0, unique (user_id, start_date))`
- `allocations(id, period_id, category_id, amount_pence)`
- `funds(id, name, opening_pence default 0, target_pence null, target_date null)`
- `fund_movements(id, fund_id, date, kind check in ('contribution','withdrawal'), amount_pence > 0, note)`
- `savings_prompts(period_id, status check in ('waiting','confirmed'), split jsonb)`
- `leftover_movements(id, period_id, destination check in ('fund','next_period','unassigned'), fund_id null, amount_pence > 0)`
- `trips(id, name, place, start_date, end_date)`
- `recurring_rules(id, name, category_id, fund_id null, frequency, anchor_date, end_date null, paused_until null, skipped_dates date[] default '{}')`, `recurring_prices(id, rule_id, effective_from, amount_pence)`
- `transactions(id, name, amount_pence > 0, date, category_id, fund_id null, account_label null, notes null, trip_id null, trip_override bool default false, recurring_rule_id null, unchecked bool default false, source text default 'manual', external_id null, import_batch_id null, unique (recurring_rule_id, date) where recurring_rule_id is not null)`
- `import_batches(id, filename, created_at)`

Every foreign key is composite `(x_id, user_id) references x(id, user_id)`, so a row can never point at another user's row (Review Focus 5). A trigger on `auth.users` insert creates the `profiles` row with `budget_start_day = 1`.

- [ ] **Step 1:** `npx supabase init`, `npx supabase start`. Write `src/db/rls.test.ts` (runs against the local stack with two users created through the admin API; `testClients.ts` returns a signed-in client per user). Failing tests: user B selecting user A's `transactions`, `funds`, `categories` returns zero rows for each table; B updating or deleting A's row affects zero rows; B inserting a transaction whose `category_id` is A's category **errors** (composite FK); same for `fund_id`, `trip_id`, `recurring_rule_id`; inserting `amount_pence = 0` errors; inserting two transactions with the same `(recurring_rule_id, date)` errors on the second.
- [ ] **Step 2:** `npm run test:db` → FAIL (no tables).
- [ ] **Step 3:** Write the two migrations to satisfy the interface above; `npx supabase db reset`.
- [ ] **Step 4:** `npm run test:db` → PASS. Commit `feat(db): schema with row-level security`.

### Task 9A: Design system

Built before any screen so every later task composes from it. Task 9 and this task are independent; either order works, but both come before Task 10.

**Files:**
- Create: `src/design/tokens.css`, `src/design/README.md`, `src/components/ui/{Button,IconButton,Card,ProgressBar,Gauge,Badge,StatusBadge,Money,AmountInput,TextField,Select,Toggle,SegmentedTabs,BottomSheet,ConfirmDialog,ListRow,EmptyState,Chip,Icon}.tsx`, `src/components/ui/index.ts`, `src/app/design/page.tsx`
- Modify: `src/app/globals.css` (imports the tokens, maps them into Tailwind's theme)
- Test: `src/components/ui/ui.test.tsx`, `src/design/tokens.test.ts`

**Interfaces:** Produces:
- Tokens as CSS variables, defined once in `tokens.css` (plan call, values may be tuned later in this one file):
  - Colour: `--bg #0B0B0C`, `--card #17181A`, `--card-raised #1F2023`, `--text #F5F5F4`, `--muted #8A8D93`, `--accent #C6F432`, `--accent-ink #0B0B0C` (text on accent), `--danger #FF5A5F`, `--warning #FFB020`, `--positive #4ADE80`, `--border #2A2B2E`.
  - Type scale: `--text-display` (amounts, 40px), `--text-title` (20px), `--text-body` (16px), `--text-caption` (13px); one font family variable `--font-sans`; tabular numerals on all money.
  - Spacing `--space-1…8` (4px steps), radii `--radius-sm 8px`, `--radius-md 16px`, `--radius-pill 999px`, elevation `--shadow-sheet`.
- Components, each taking only semantic props (no colour or size strings), exported from `ui/index.ts`:
  `Button({ variant: "primary" | "secondary" | "danger" | "ghost"; size?: "md" | "lg" })`, `IconButton({ icon: IconName; label: string })`, `Card`, `ProgressBar({ percent: number; state: "normal" | "over" })` (over = full and `--danger`), `Gauge({ percent: number; state: "normal" | "over"; children })`, `Badge({ tone: "neutral" | "positive" | "warning" | "danger" })`, `StatusBadge({ status: BudgetSummary["status"] })`, `Money({ pence: number; tone?: "auto" | "neutral" })` (uses `formatGBP`; negative shown in `--danger` when `auto`), `AmountInput` (uses `parsePence`, inline error), `TextField`, `Select`, `Toggle`, `SegmentedTabs`, `BottomSheet` (bottom sheet under 768px, centred dialog above), `ConfirmDialog`, `ListRow`, `EmptyState({ title; body; action? })`, `Chip`, `Icon({ name })` with one icon set kept in `Icon.tsx`.
- `/design` is a living gallery of every token and component in every variant and state, shown only when `NODE_ENV !== "production"`. `src/design/README.md` states the rules: change a colour or size in `tokens.css`; change a component's look in its file; never style a screen directly.

- [ ] **Step 0:** Gather references from Mobbin for the component set: finance and budgeting apps for gauge, progress bar, amount entry, bottom sheet, calendar and list rows (search each separately, both `ios` and `web`). Record the chosen screens' `mobbin_url`s in `src/design/README.md` under "References" and use them to settle the token values below.
- [ ] **Step 1:** Failing tests. `tokens.test.ts`: every `--*` name the components reference exists in `tokens.css`, and no file under `src/app/` or `src/components/` (outside `tokens.css`) contains a hex colour literal or an inline `style=` colour (grep-style test over the source tree). `ui.test.tsx`: `ProgressBar state="over"` renders at 100% with the danger class regardless of `percent`; `Money pence={-10000}` renders "-£100.00" with the danger class and `tone="neutral"` does not; `Button variant="danger"` and `"primary"` render distinct classes; `AmountInput` rejects `"0"` with an inline message; `BottomSheet` renders its children and closes on Escape; `StatusBadge` maps `on_track`, `spending_fast`, `out_of_budget` to their labels "On Track", "Spending Fast", "Out of Budget".
- [ ] **Step 2:** Run `npx vitest run src/design src/components/ui` → FAIL.
- [ ] **Step 3:** Implement tokens, components and the gallery. Components are thin wrappers over Tailwind utilities that read the token variables; the gallery renders each variant side by side at 390px and desktop width.
- [ ] **Step 4:** Run the tests → PASS; open `/design` and check every component in both widths. Commit `feat: design system`.

### Task 10: Google sign-in, app shell, theme, time zones

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/middleware.ts`, `src/app/login/page.tsx`, `src/app/auth/callback/route.ts`, `src/app/(app)/layout.tsx`, `src/components/Nav.tsx`, `src/components/TimezoneSync.tsx`, `src/lib/today.ts`, `src/app/globals.css`
- Test: `src/components/Nav.test.tsx`, `src/lib/today.test.ts`

**Interfaces:** Produces: `getToday(): Promise<IsoDate>` (server; uses the `tz` cookie set by `TimezoneSync` from the device, falling back to `profiles.timezone`); `<Nav />` with tabs Expenses, Budget, Settings and a + button linking to `/expenses/new`; bottom bar under 768px, left rail above. The shell is built from Task 9A's tokens and `ui` components (no colours defined here).

- [ ] **Step 1:** Failing tests: `Nav` renders three tab links in order Expenses, Budget, Settings and a + link to `/expenses/new`; `getToday` with `tz=Asia/Taipei` at `2026-11-20T20:00:00Z` returns `2026-11-21`, and falls back to the profile zone when the cookie is absent.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. Middleware redirects unauthenticated users to `/login` (except `/login`, `/auth/*`, `/privacy`). Google sign-in uses `supabase.auth.signInWithOAuth({provider:"google"})`. On first sign-in `TimezoneSync` writes the device zone to `profiles.timezone` if it still has the default. **Step 4:** Run → PASS; open the app, confirm the dark shell. Commit `feat: Google sign-in, shell, theme, time zone`.

### Task 11: Data layer and period renewal

**Files:**
- Create: `src/lib/data/budget.ts`, `src/lib/data/ensurePeriod.ts`
- Test: `src/lib/data/ensurePeriod.test.ts` (DB-backed, uses `testClients`)

**Interfaces:** Consumes: `periodContaining`, `summarise`. Produces:
`ensureCurrentPeriod(supabase, today: IsoDate): Promise<PeriodRow | null>` (idempotent: creates the period containing `today` by copying the latest earlier period's income, savings and allocations; creates a `savings_prompts` row with status `waiting`; returns `null` if the user has never finished onboarding),
`loadBudgetView(supabase, today: IsoDate): Promise<{ period: Period; summary: BudgetSummary | null; categories: CategoryRow[] }>`. This is the only function the Budget tab and category detail call for figures.

- [ ] **Step 1:** Failing tests: calling `ensureCurrentPeriod` twice creates one period; a new period copies allocations from the previous one and leaves the old period's allocations untouched; a missed month is skipped over and only the current period is created; a user with no periods gets `null` and `loadBudgetView` returns `summary: null`.
- [ ] **Step 2–4:** Run FAIL, implement, run PASS. Commit `feat(data): period renewal and budget view`.

### Task 12: Onboarding

**Files:**
- Create: `src/app/onboarding/{page,Income,Spending,Savings,Live}.tsx`, `src/app/onboarding/actions.ts`, `src/lib/data/onboarding.ts`
- Test: `src/app/onboarding/onboarding.test.tsx`, `src/lib/data/onboarding.test.ts`

**Interfaces:** Consumes: `parsePence`, `periodContaining`, `ensureCurrentPeriod`. Produces: `completeOnboarding(supabase, input: { incomePence: number; startDay: number; savingsPence: number; categories: { name: string; kind: "need" | "want"; amountPence: number }[]; funds: { name: string; amountPence: number; alreadySavedPence: number }[] }, today: IsoDate): Promise<void>` (one transaction: sets `profiles.budget_start_day`, creates the period, categories, allocations, funds, opening balances and a first `waiting` savings split).

Steps per §5.2: (1) period "Monthly" (fixed) and a "starting on" day control with a live line "so budget next on <weekday date>" from `periodContaining`; income; (2) Needs/Wants tabs with an amount per category and a live red over-allocation figure, continuing allowed while over; (3) optional "pay yourself first" split, then funds with amounts and an "already saved" toggle; (4) "You're live" summary then `/budget`. No first-expense step, no fake loading screen.

- [ ] **Step 1:** Failing tests: the live line for start day 25 on `2026-11-21` reads "so budget next on Wednesday 25 November"; over-allocation figure shows red text and the Continue button stays enabled; invalid income (`"0"`) keeps the step from advancing; `completeOnboarding` creates income 600000, one period with allocations summing to the entered amounts, and a fund whose "already saved" 20000 equals its opening balance.
- [ ] **Step 2–4:** Run FAIL, implement, run PASS; walk the flow once in the browser at 390px width. Commit `feat: onboarding`.

### Task 13: Budget tab and category detail

**Files:**
- Create: `src/app/(app)/budget/page.tsx`, `src/app/(app)/budget/[categoryId]/page.tsx`, `src/components/AllocationCard.tsx` (composed from Task 9A's `Card`, `ProgressBar`, `Money`; `Gauge` and `StatusBadge` come from `ui`)
- Test: `src/components/budget.test.tsx`

**Interfaces:** Consumes: `loadBudgetView`, `formatGBP`. Renders (§5.4): header with status label, period dates and "Set new budget"; a semicircle gauge of Left to spend with safe-to-spend per day, next budget date and an info icon explaining the formula; Spending | Saving tabs; allocation cards (progress bar, "£X left of £Y"; "no budget yet" for unallocated spending; "£X over" in red with a red, full bar when over). Category detail: Budget / Spent / Next budget, progress bar with percent left, "£X left", "N days left", the category's expenses newest first, "+ Log expense" opening `/expenses/new?category=<id>`. No figure is computed in a component; each is read from `BudgetSummary`.

- [ ] **Step 1:** Failing tests (render with fixed `BudgetSummary` objects): `summary: null` renders the empty state "Set up your budget" with no "£0" and no "On Track" text (Review Focus 3); a budget with no expenses shows the full pool as Left to spend and `On Track`; an overspent need shows "£200.00 over" in red and a full bar; over-allocated total shows the red over-budget state and every card keeps its true figure (no "£0.00 left" clamping); gauge shows `£860.36` for the reference summary.
- [ ] **Step 2–4:** Run FAIL, implement, run PASS. Commit `feat: Budget tab and category detail`.

---

## Phase C: Expenses

### Task 14: Add and edit expense

**Files:**
- Create: `src/app/(app)/expenses/new/page.tsx`, `src/app/(app)/expenses/[id]/page.tsx`, `src/components/ExpenseForm.tsx`, `src/lib/data/transactions.ts`
- Test: `src/components/ExpenseForm.test.tsx`, `src/lib/data/transactions.test.ts` (DB-backed)

**Interfaces:** Produces: `createTransaction`, `updateTransaction`, `deleteTransaction(supabase, …)` in `transactions.ts`. `createTransaction(supabase, input: { name: string; amountPence: number; date: IsoDate; categoryId: string; fundId?: string | null; accountLabel?: string; notes?: string }): Promise<string>` returns the new id. Form (§5.7): large amount, name, category, date (shows "Today"/"Tomorrow" where it applies; defaults to today or the tapped calendar date via `?date=`), optional "Paid from fund" row with the helper text "Pay with money you saved in a fund. It won't count toward your budget.", close and save buttons, a red "Delete Expense" when editing, and a **Repeat** toggle (wired in Task 17). Amount uses `parsePence`.

- [ ] **Step 1:** Failing tests: the form rejects `"0"`, `"12.555"`, `""` with an inline message and does not call save; `"£12.50"` saves 1250; `?category=<id>` preselects the category; "Paid from fund" is hidden when the user has no funds. DB test (Review Focus 4): with a past-period expense of 5000, `loadBudgetView` for today is unchanged after editing that expense to 9000, and `summarise` for the past period changes by 4000; deleting it likewise changes only the past period.
- [ ] **Step 2–4:** Run FAIL, implement, run PASS. Commit `feat: add and edit expense`.

### Task 15: Expenses tab

**Files:**
- Create: `src/app/(app)/expenses/page.tsx`, `src/components/{Calendar,DaySheet,Analytics,TransactionList}.tsx`
- Test: `src/components/expenses.test.tsx`

**Interfaces:** Consumes: `totalsByDay`, `totalsByCategory`, `totalSpent`, `compareToPrevious`. Renders (§5.6): calendar ⇄ analytics toggle; calendar months by default with a "this budget period" option (Amount mode only); tapping a day opens a sheet with that day's expenses (add, tap to edit, delete); fund-paid items read "Travel · from Holiday"; auto-added recurring items carry an "unchecked" marker. Analytics: donut chart and category list on top, the transaction list directly underneath grouped by date, with search and a category filter (plan call: sort and further filters wait). Comparison card shows percentage and money difference; wording is neutral ("£120 more than last period"), colour is not good/bad; with no previous data it shows an empty state.

- [ ] **Step 1:** Failing tests: calendar cell for a day with 1250 + 500 shows `£17.50`; a fund-paid expense shows in the day total and in the category chart; the day sheet shows "Travel · from Holiday"; comparison with `null` renders "No previous period to compare yet" and no percentage; search "spot" filters the list to Spotify.
- [ ] **Step 2–4:** Run FAIL, implement, run PASS. Commit `feat: Expenses tab`.

---

## Phase D: Recurring payments and savings funds

### Task 16: Savings prompt and funds

**Files:**
- Create: `src/components/{SavingTab,MoveSavingsSheet,FundHistory}.tsx`, `src/lib/data/funds.ts`
- Modify: `src/app/(app)/budget/page.tsx` (Saving tab)
- Test: `src/components/saving.test.tsx`, `src/lib/data/funds.test.ts` (DB-backed)

**Interfaces:** Consumes: `fundBalance`, `fundHistory`. Produces: `confirmSavingsSplit(supabase, periodId: string, split: { fundId: string; amountPence: number }[]): Promise<void>` (creates one dated contribution per fund and marks the prompt `confirmed`; rejects a split whose total differs from the period's `savings_pence`), `createFund`, `addFundMovement`.

Saving tab (§5.4, §5.7): funds with balance, target and optional target date, each with its history of money in and out; a "waiting to be moved" amount with the **Move your savings** action, which pre-fills last period's split and lets the user edit or send it to a new fund. Until confirmed the amount shows as waiting and is excluded from `summarise` (it is already out of the pool).

- [ ] **Step 1:** Failing tests: a waiting prompt shows "£300.00 waiting to be moved"; confirming a 300000 split across two funds creates two contributions dated today and the prompt disappears; a split totalling 250000 is rejected; fund history lists each contribution with its date, and a fund-paid expense appears as money out; confirming twice does not create duplicate contributions.
- [ ] **Step 2–4:** Run FAIL, implement, run PASS. Commit `feat: savings prompt and fund history`.

### Task 17: Recurring payments

**Files:**
- Create: `src/lib/data/recurring.ts`, `src/app/api/cron/recurring/route.ts`, `src/components/{RepeatFields,EditRecurringPrompt,RecurringList}.tsx`, `supabase/migrations/0003_cron.sql`
- Modify: `src/components/ExpenseForm.tsx` (Repeat toggle), `src/app/(app)/layout.tsx` (catch-up on open)
- Test: `src/lib/data/recurring.test.ts` (DB-backed), `src/components/recurring.test.tsx`

**Interfaces:** Consumes: `dueOccurrences`, `amountOn`, `withPriceChange`, `todayIn`. Produces:
`generateDue(supabase, userId: string, timezone: string, now: Date): Promise<number>` (inserts missing occurrences from each active rule's anchor up to the user's local today using `insert … on conflict (recurring_rule_id, date) do nothing`; marks them `unchecked: true`; returns the count created),
`createRule`, `pauseRule(supabase, id, until: IsoDate)`, `skipNext(supabase, id)`, `cancelRule(supabase, id, endDate: IsoDate)`,
`editOccurrence(supabase, txnId: string, scope: "this" | "this_and_future", amountPence: number): Promise<void>` ("this" updates one transaction; "this_and_future" updates it, adds a `recurring_prices` row via `withPriceChange` effective that transaction's date, and updates already-generated later transactions that are still `unchecked`; earlier months keep their amounts),
`confirmOccurrence(supabase, txnId)`, `detectRecurring(txns: Txn[]): { name: string; frequency: Frequency }[]` (three payments with the same name and an even interval).
Cron (plan call): `pg_cron` runs hourly and `net.http_post`s `/api/cron/recurring` with a `CRON_SECRET` header; the route calls `generateDue` for every user with the service role, using each profile's `timezone`. The layout also calls `generateDue` for the signed-in user when the app opens, so missed days are caught up. Frequencies are the five in §5.8; no custom recurrence.

- [ ] **Step 1:** Failing tests: `generateDue` run twice creates occurrences once; after three missed weeks it creates three transactions on the correct dates; with `timezone: "Pacific/Auckland"` at `2026-11-20T12:30:00Z` it generates the 21 Nov occurrence while `Europe/London` does not; auto-added rows are `unchecked` and still count in `summarise`; Spotify £8 → "this and future" £12 from March leaves February at £8 and sets later unchecked rows to £12; "just this payment" changes only that row; a paused rule generates nothing until `pausedUntil`; `skipNext` skips exactly one date; `cancelRule` stops further rows and keeps old ones; `confirmOccurrence` clears `unchecked`; `detectRecurring` flags three monthly "Spotify" payments but not two; the edit prompt shows both options with the exact labels "Just this payment" and "This and future payments"; pausing shows "Frees £X this period" and asks no question.
- [ ] **Step 2–4:** Run FAIL, implement, run PASS. Commit `feat: recurring payments`.

### Task 18: Period-end review

**Files:**
- Create: `src/app/(app)/review/page.tsx`, `src/components/{LeftoverPrompt,OverspendReview}.tsx`, `src/lib/data/review.ts`
- Test: `src/components/review.test.tsx`, `src/lib/data/review.test.ts` (DB-backed)

**Interfaces:** Consumes: `leftoverBreakdown`, `categoriesOverTwiceInThree`, `suggestedBudget`, `previousPeriod`. Produces: `loadReview(supabase, today)` (the ended period's breakdown, with freed-by-pause = the amounts of `scheduleBetween` entries marked `skipped` for the period), `recordLeftover(supabase, periodId, destination: "fund" | "next_period" | "unassigned", fundId?: string): Promise<void>` (one whole amount; writes a `leftover_movements` row; `unassigned` carries into the next period's `unassigned_carry_pence`; `next_period` and `fund` do likewise to the next pool or a fund contribution).

The prompt lists the reasons (freed by pauses, unspent categories, previously unassigned), applies to the whole amount, and for `unassigned` shows the nudge "Give every pound a job" with links to categories and funds; unassigned stays spendable (§5.5). Overspent categories are listed with amounts and never carried forward. A "raise budget" suggestion appears for categories over in 2 of the last 3 periods with an editable amount, shows the effect on the total, and applies from the next period.

- [ ] **Step 1:** Failing tests: breakdown rows render in the Task 8 order; choosing "keep unassigned" for 25000 raises the next period's `leftToSpendPence` by 25000; choosing a fund creates a fund contribution and does not change the next pool; recording twice for one period is rejected; an overspend of 3000 does not reduce the next period's pool; a category over in two of three periods shows the suggestion with the Task 8 amount, and one over once does not.
- [ ] **Step 2–4:** Run FAIL, implement, run PASS. Commit `feat: period-end review`.

---

## Phase E: Trips

### Task 19: Trips

**Files:**
- Create: `src/lib/data/trips.ts`, `src/app/(app)/expenses/trips/page.tsx`, `src/app/(app)/expenses/trips/[id]/page.tsx`, `src/components/{TripPrompt,TripSummary}.tsx`
- Modify: `src/components/ExpenseForm.tsx` (trip override), `src/components/TimezoneSync.tsx`
- Test: `src/lib/data/trips.test.ts` (DB-backed), `src/components/trips.test.tsx`

**Interfaces:** Consumes: `totalsByCategory`, `totalsByDay`, `totalSpent`. Produces: `createTrip(supabase, { name, place, startDate, endDate })`, `tripTransactions(supabase, tripId): Promise<Txn[]>` (expenses dated inside the range unless `trip_override` excludes them, plus any manually added), `setTripOverride(supabase, txnId, tripId | null)`.

Behaviour (§5.12): a trip is a label only. Its expenses stay in the normal budget (or fund) exactly as before; assert this. Place is typed text, never coordinates. When the device zone differs from `profiles.timezone`, show "Are you travelling? Start a trip?" once, and later ask whether to end it. Trip screen: total, per category, per day, expense list. Amounts are GBP.

- [ ] **Step 1:** Failing tests: expenses dated 3 and 10 Dec join "Taiwan 1–15 Dec" and one dated 20 Dec does not; an override removes one and adds an outside one; creating a trip leaves `summarise` unchanged; the zone-change prompt appears when device zone ≠ profile zone and not when equal; no code path or column stores latitude/longitude (grep test for `latitude|longitude|geolocation` returns nothing).
- [ ] **Step 2–4:** Run FAIL, implement, run PASS. Commit `feat: trips`.

---

## Phase F: Imports, Settings, finish

### Task 20: CSV import

**Files:**
- Create: `src/lib/import/csv.ts`, `src/app/(app)/settings/import/page.tsx`, `src/components/ImportWizard.tsx`
- Test: `src/lib/import/csv.test.ts`, `src/components/import.test.tsx`

**Interfaces:** Consumes: `parsePence`. Produces:
`parseCsv(text: string): string[][]` (quoted fields, commas and newlines inside quotes),
`mapRows(rows: string[][], mapping: { date: number; amount: number; name: number; dateFormat: "DD/MM/YYYY" | "YYYY-MM-DD" | "MM/DD/YYYY" }): { ok: ImportRow[]; errors: { row: number; reason: string }[] }`,
`findDuplicates(rows: ImportRow[], existing: Txn[]): Set<number>` (same date, amount and case-insensitive name),
`commitImport(supabase, rows: ImportRow[], categoryId: string): Promise<{ batchId: string; inserted: number }>` (`source: "csv"`, `import_batch_id` set, `external_id` null).

Wizard: upload, column mapping, preview with duplicates unticked and errors listed, then Import. Nothing is saved before the last click. Rows land in the same `transactions` table as manual entries. Negative amounts are treated as spending (bank exports), credits are skipped with a note.

- [ ] **Step 1:** Failing tests: `parseCsv('a,"b,c"\n1,2')` → `[["a","b,c"],["1","2"]]`; `mapRows` converts `"05/11/2026"` with `DD/MM/YYYY` to `2026-11-05` and `"-12.50"` to 1250; a bad date lands in `errors` with its row number; a duplicate row is flagged; the wizard saves nothing until Import is pressed; re-importing the same file inserts zero rows once the duplicates are unticked by default.
- [ ] **Step 2–4:** Run FAIL, implement, run PASS. Commit `feat: CSV import`.

### Task 21: Settings and data rights

**Files:**
- Create: `src/app/(app)/settings/page.tsx`, `src/app/privacy/page.tsx`, `src/app/api/export/route.ts`, `src/app/api/account/delete/route.ts`
- Test: `src/app/api/export.test.ts`, `src/app/api/delete.test.ts` (DB-backed)

**Interfaces:** Produces: Settings with currency (GBP default), time zone, budget start day (affects the next period only), "Connect bank (coming later)" placeholder, Import link, Export my data, Delete my account, Privacy link, Sign out. `GET /api/export` returns a JSON download of all the signed-in user's rows from every table. `POST /api/account/delete` (requires typing "DELETE") removes all of the user's rows and then the auth user (service role). `/privacy` is a simple static page. Backups: enable Supabase's daily backups and note it in the README (no code).

- [ ] **Step 1:** Failing tests: export for user A contains A's transactions and none of B's; delete removes A's rows from every table (query each table as the service role → 0 rows for A) and leaves B's untouched; delete without the confirmation text returns 400.
- [ ] **Step 2–4:** Run FAIL, implement, run PASS. Commit `feat: settings, export and account deletion`.

### Task 22: Excel import (may slip past the first release, §5.10)

**Files:**
- Create: `src/lib/import/xlsx.ts`
- Modify: `src/components/ImportWizard.tsx`
- Test: `src/lib/import/xlsx.test.ts`

**Interfaces:** Consumes: Task 20's mapping, preview and commit. Produces: `parseXlsx(buffer: ArrayBuffer): string[][]` for the first sheet, returning the same row shape as `parseCsv` so the rest of the wizard is shared. Use the `xlsx` package.

- [ ] **Step 1:** Failing test: a small fixture workbook (`src/lib/import/fixtures/sample.xlsx`) parses to the same `string[][]` as its CSV twin. **Step 2–4:** Run FAIL, implement, run PASS. Commit `feat: Excel import`.

### Task 23: End-to-end smoke test and figure consistency

**Files:**
- Create: `e2e/smoke.spec.ts`, `playwright.config.ts`, `src/lib/data/consistency.test.ts` (DB-backed)

**Interfaces:** Consumes everything above.

- [ ] **Step 0:** Re-run Task 9A's `tokens.test.ts`; it must still pass across all the screens added since (no hex colours or one-off styles).
- [ ] **Step 1:** Write `consistency.test.ts`: seed one user (income 600000, savings 100000, needs and wants allocations, one fund-paid expense, one unchecked recurring expense, one past-period expense) and assert that the Budget gauge value, the category detail "left" and the Expenses analytics total are each derived from the same `BudgetSummary` / `totalSpent` (equal to the calc module's output for the same inputs), that the fund-paid expense appears in `totalSpent` but not in `summarise().spentPence`, and that the unchecked recurring expense counts in both.
- [ ] **Step 2:** Write `e2e/smoke.spec.ts` (390×844 viewport, signed-in test user via a seeded session): onboarding → Budget shows the pool → + → log £12.50 → Budget Left to spend drops by £12.50 → Expenses calendar shows £12.50 on today → Settings → Export downloads JSON.
- [ ] **Step 3:** Run `npm test && npm run test:db && npx playwright test` → all PASS. Commit `test: consistency and smoke`.
- [ ] **Step 4:** Deploy to Vercel with the Supabase project (Google OAuth redirect URLs, `CRON_SECRET`, service-role key as server-only env); run the smoke test against the preview URL. Note anything left over in `personal-finance-app-backlog.md`.

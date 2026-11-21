# Personal Finance OS: MVP design

Date: 2026-11-20. Status: draft for David's approval. Nothing is built yet.

How to read this: **Decided** means David decided or confirmed it. **My call** means I (the designer) chose it and David hasn't specifically confirmed it. **Open** means unresolved, with my lean where I have one. The builder should treat "My call" as a sensible default and "Open" as a question to bring back to David.

## 1. Intent and why

David wants one place to manage his own money: log everyday spending, plan a monthly budget from his income, see how much is safe to spend today, and put money aside in savings funds. It is built for his own use first, but anyone will be able to sign in, with each person's data kept separate. He has used a reference app (DaTrack) and likes its structure: an Expenses tab built around a calendar, a Budget tab with a Safe to Spend gauge, and a savings funds view. He wants the same clarity, adapted to how he is paid and how he thinks about money.

Success looks like this: he can open the app on his iPhone, log an expense in a few seconds, and trust the "left to spend" and "safe to spend per day" figures every time.

## 2. Goals, non-goals, anti-goals

**Goals**
- A budget set up once from his monthly income, which renews each pay cycle without redoing it.
- Fast manual expense logging, a calendar view of daily spending, and a list/analytics view with a chart over the transaction list.
- Accurate Safe to Spend, with no double counting.
- Savings funds that track what he has put aside and what he has spent from them.
- Recurring payments that count as paid automatically, with a way to check and correct them.

**Non-goals for the MVP** (all parked, see section 10)
- AI-assisted logging ("Log with AI") and natural-language questions about his money.
- Bank connections (Monzo, Open Banking). A "Connect bank" placeholder sits in Settings.
- Debt tracking, forecasting, notifications, multi-currency, itemised income sources, account balances.
- Calendar modes other than Amount, the yearly view, and the extra menu options from the reference.

**Anti-goals** (a failure even if it technically works)
- A screen showing a figure that is calculated differently from the same figure elsewhere.
- Counting the same money twice (for example a fund-paid expense, or a savings transfer).
- Showing a misleading £0 or "On Track" before a budget exists.
- Turning into a copy of the reference app, including its quirks.

## 3. Constraints

- Web app, not native. Mobile-first for iPhone, with a layout designed for desktop (not a scaled-up phone layout).
- Dark theme: near-black background, charcoal cards, white text, muted grey secondary text, one restrained lime accent, rounded shapes. The reference screenshots are the visual guide.
- **Decided (2026-11-21):** a light theme as well. Settings offers Light, Dark and Match device; light is the default. The light theme mirrors the dark one (off-white background, white cards, near-black text, grey secondary text) with a deeper lime for accent text and icons.
- GBP only. Currency defaults to GBP with no onboarding screen, and there is a currency setting in Settings.
- Money is stored as integer pence. No floating-point money maths.
- All financial calculations live in one shared, tested module, not in individual screens.
- Multi-user from day one: each person signs in and sees only their own data. Row-level security and a `user_id` on every row, with tests proving one user cannot read another's rows.
- **Decided:** the app is not fixed to UK time. Each user has a time zone, detected when they first sign in and editable in Settings. "Today", "days left, counting today" and the daily recurring-payment job all use that user's time zone. Transaction dates are calendar dates, not timestamps. The job adds due recurring payments just after midnight in each user's time zone, and the app also catches up when opened. **Decided:** while travelling, the app follows the time zone of where the user currently is (the device's time zone), so "today", days left and the default date of a new expense are right locally. My call: budget periods and recurring due dates are calendar dates, so they don't move; the user's home time zone is still stored for the daily job.
- **Decided:** public sign-in, starting with Google only. Email sign-in may come later. This replaces my earlier call of a hand-made single account with sign-up disabled. **Decided audience:** David, his girlfriend, and friends and family, so keep it light: a simple privacy policy, "export my data" and "delete my account" in Settings, and regular backups; no admin tools. A wider public launch would add more (terms, support, abuse handling).
- Every transaction has a `source` and an optional `external_id` from day one so a bank feed can slot in later without rework.

## 4. Approaches considered

**Architecture (David chose A).**
- **A. Next.js on Vercel with Supabase (Postgres, Auth, row-level security).** One shared database so phone and laptop always agree, login and a scheduled job available out of the box, free tiers cover one user. Cost: three services to configure.
- **B. Next.js with a self-hosted database and a single-password login.** Slightly simpler at the start, but login, backups and the scheduled job are hand-built, which A gives for free. Rejected: more work, no benefit to David.
- **C. Local-first web app with data only on the device.** No server and private by default, but phone and laptop would hold separate copies, iPhone Safari can clear stored data, and it blocks a bank feed later. Rejected: too risky for financial data.

**Build order (presented alongside A, not objected to).** Build in thin, usable slices rather than screens first, because the brief warns against screens with hardcoded figures:
1. The calculation module with tests (periods, Safe to Spend, fund balances, comparisons).
2. Auth, schema, onboarding and the Budget tab.
3. The Add Expense form and the Expenses tab.
4. Recurring payments (including the scheduled job) and savings funds.
5. Trips (my call: a small slice after funds; David can move it).
6. CSV import, then Excel.

## 5. Product behaviour (decided)

### 5.1 Navigation
- Bottom bar with three tabs, **Expenses**, **Budget**, **Settings**, plus a **+** button. (Decided; this replaces the brief's two-tab idea.) On desktop use a sidebar or rail instead of a bottom bar.
- The **+** opens the Add Expense form directly. When AI logging is added later, it becomes a two-option menu ("Add manually" / "Log with AI"). My call: no one-item menu until then.

### 5.2 Onboarding (playback approved)
1. **Income.** One fixed monthly figure, for example a salary. No itemised income sources. This follows the reference's "Start with the basics" screen ("We recommend using the same budget period as your regular income"): a budget period dropdown (Monthly), a "starting on" dropdown ("First day of the month" or a day such as the 25th), and a live line underneath, "so budget next on Wednesday 25 November", that updates as the day changes. The monthly total follows in the same setup step. My call: Monthly is the only period in the MVP, so the first dropdown can be fixed or hidden; weekly and fortnightly periods are parked. **Decided:** the start day is simply the day the user picks (David will choose the 24th or 25th), and the budget resets on that same day every month, whatever day of the week it falls on. There is no weekend or bank-holiday adjustment, because the app isn't connected to a bank and the budget is a calendar the user sets for themselves. Period length varies only with the length of the month. My call: a start day of 29 to 31 resets on the last day of shorter months.
2. **Spending budget.** Categories are set up here as part of the budget setup. Needs and Wants tabs, an amount per category. A live figure shows how far the allocations are over the total; the user can continue while over.
3. **Savings.** Always shown. An optional "pay yourself first" step (a spending/saving split) comes before it and sets the savings total up front; the funds then divide that total. Then the savings amount for the period and how it is split across funds this time, with an "already saved" toggle for money saved before using the app. In each later period a "Move your savings" prompt asks where the reserved money goes (see 5.7).
4. **You're live.** A short summary, then the Budget screen. There is no "log your first expense" step and no fake loading screen.

Recurring payments are set up after onboarding, not during it.

### 5.3 Budget model and periods
- The budget is **income-first**: one monthly income figure is split into Needs, Wants and savings.
- The budget resets on the chosen start day every month (see 5.2), with no weekend or bank-holiday adjustment.
- Expenses uses calendar months by default, with a "this budget period" option so it lines up with the Budget tab.
- The next budget period renews automatically with the same allocations and can be edited before it starts. "Set new budget" is for a bigger rework. (My call, taken as agreed.)

### 5.4 Budget tab (playback sent; fund rule confirmed, the rest taken as agreed)
- Header: status label and the period dates, with "Set new budget".
- A semicircle gauge showing **Left to spend**, with the **safe to spend per day** and the next budget date, and an info icon that explains the calculation.
- **Spending | Saving** tabs.
- Spending: allocation cards (category, progress bar, left of allocated). A category with spending but no allocation shows "no budget yet".
- **Category detail** (David's screenshots). Tapping a card opens a screen with the period range and a ⋯ menu at the top, then a card with the category icon and name, three figures (**Budget**, **Spent**, **Next budget** date), and a progress bar labelled with the **percent left** (for example 98%), "£4,900.00 left" and "4 days left". Below it, that category's expenses for the period, newest first, with a "+ Log expense" action. The bar and figures update as soon as an expense is logged.
- **Overspent category** (David's screenshots, decided): overspending is allowed and shown plainly. The detail card shows "£100.00 over" in red where "left" would be, and the allocation card on the Budget tab says the same. The headline figure is separate: "Over budget by £X" measures spending against the whole monthly pool, so it can be much larger than a category's own overspend, or appear without any category being over (when allocations exceed the pool).
- My calls: in the overspent state the bar is drawn red and full, because the reference draws it empty, which looks the same as "nothing left"; "+ Log expense" opens the form with that category already chosen; the ⋯ menu on this screen holds edit budget, rename and delete category (left to the builder to refine).
- Saving: funds with progress, target, and optional target date, each with its history of money in and out; plus any savings amount that is "waiting to be moved" this period, with the "Move your savings" action.
- Status labels: **On Track**, **Spending Fast** (Wants spending is ahead of the elapsed-days pace) and **Out of Budget**. The exact thresholds are left to the builder (section 9). Decided (David, 2026-11-21): Spending Fast also when any category is overspent or allocations exceed the spending money; Out of Budget when safe to spend is negative.
- Over-allocation: when allocations exceed the monthly total, the state turns red and the user is not blocked. Category cards must not clamp (the reference shows "£0.00 left" on a £5,000 card with £5 spent, which hides the real position). David's comment on this was unclear, so treat it as my proposal.
- Parked: the swipeable second gauge page and the ⋯ menu options (sort, grid view, reorder, show the today line).

### 5.5 Safe to Spend
- **Safe to spend per day = (total left − Needs left) ÷ days left, counting today.** Unspent Needs money stays reserved whether or not it has been paid. This is the reference's rule, and it reproduces the reference figures: £4,301.78 left with 5 days remaining gives £860.36 a day.
- Total left = the spending pool minus spending so far. The spending pool = monthly income minus the savings amount. The savings amount is a budget figure set in onboarding (through "pay yourself first" or directly) that renews with the budget like Needs and Wants and is reserved from the day pay lands; which fund it goes to is chosen each period (see 5.7). The pool always comes from income, never from the sum of allocations, so over-allocating shows as "over" instead of quietly moving the pool. My call.
- When a Need is overspent, floor that category's Needs left at zero inside this formula, so the overspend reduces what is left for Wants. Category cards still show the true negative figure. (Without the floor, the overspend cancels out of the formula and Safe to Spend would hide it.) My call.
- Safe to Spend covers only the monthly spending money. Savings funds are separate, earmarked money: it is never counted as safe to spend, and money paid from a fund is judged against that fund's own balance, not against Safe to Spend. So a fund-paid expense does not reduce it (see 5.7).
- **Decided:** leftover from a previous period that the user keeps "unassigned" is spendable: it is added to Left to spend and so counts in Safe to Spend. The goal is that every part of the income does a job, so the app shows the unassigned amount plainly and nudges the user to give it one (a category or a fund) without forcing it. My reading: unassigned is a temporary holding state, not a standing category.

### 5.6 Expenses tab (playback approved)
- A **calendar ⇄ analytics** toggle. Calendar months by default, with a "this budget period" option. The yearly view is parked.
- The calendar shows the daily total (Amount mode only). Tapping a day opens a sheet listing that day's expenses, with add, edit and delete.
- The analytics view has a donut or line chart on top with a category list, and the transaction list directly underneath. It includes the month-on-month comparison (rules in section 8).
- The list is grouped by date, with search, filters and sorting as in the brief (builder may phase these).

### 5.7 Add Expense form and savings funds
- Fields: amount, name, category, date (today by default, or the date tapped on the calendar), optional account label, optional notes, a **Repeat** toggle.
- **Paid from a fund.** An expense can be logged against a savings fund. Rule (confirmed): money counts against the monthly budget when it is **set aside** into the fund, not again when it is spent from it. A fund-paid expense still counts as spending in Expenses totals, the calendar and category charts, is tagged "from <fund>", and does not reduce the monthly Needs/Wants or Safe to Spend. **Decided (David's screenshots):** the fund is chosen *in addition* to the category, not instead of it. The Add/Edit Expense form has a separate optional "Paid from fund" row under the date, with the helper text "Pay with money you saved in a fund. It won't count toward your budget." The day sheet shows the expense as "Travel · from Holiday". A fund-paid expense keeps its category; the calculation module excludes it from monthly Spent and Safe to Spend while still including it in Expenses totals and category charts.
- Form layout from the reference: a large amount at the top, then name, category, date (shown as Today or Tomorrow where it can be), and the optional "Paid from fund" row; close (X) and save (tick) buttons at the top, and a red "Delete Expense" at the bottom when editing.
- A fund's balance = "already saved" starting amount + contributions − spending paid from it (and any recorded withdrawals). Every contribution is a dated record the user made, and each fund shows its history of money in and money out, so it is always clear what went in and when. (David's reason for keeping savings manual: automatic refills mixed with spending from the same fund make it hard to see how much went in each time.)
- **Decided:** Needs and Wants allocations renew automatically each period with the same amounts and change only when David edits them (for example after the overspend review). Savings is **not** automatic: money only moves into a fund when the user moves it, because a goal can be reached and a new one started. **Decided (savings reservation):** the savings amount is reserved from the day pay lands and left out of Safe to Spend. When the period starts, a "Move your savings" prompt shows last period's split pre-filled; the user confirms it, edits it, or sends it to a new fund. Until confirmed, the reserved money shows as "waiting to be moved" and cannot be spent. (David decided the reservation; the prompt details are my call.)

### 5.8 Recurring payments
- Created with the **Repeat** toggle on an expense, plus automatic detection: after three regular payments of the same thing, the app asks "is this a recurring payment?".
- A recurring payment **counts as paid automatically on its due date**. Auto-added entries are marked **unchecked** until David confirms them or edits the amount. Unchecked entries count in every total (spent, Safe to Spend, the calendar); the marker is only a review flag. My call. (David decided the auto-count; the unchecked marker is my proposal that matches how he described checking and editing afterwards.)
- **Price changes** (for example a subscription going from £8 to £12): when editing an auto-added payment, ask "just this payment" or "this and future payments". "Future" changes the recurring item from that date onward, and past months keep their old amounts. Variable bills use the same mechanism, so there is no separate fixed/variable setting. **Decided:** David confirmed the "just this payment / this and future payments" prompt on edit.
- **Pause and cancel are separate actions.** Pause is until a date or skip the next one; cancel ends it. A paused payment is excluded from upcoming commitments. **Decided:** David confirmed pause and cancel as separate actions. When a payment is paused, the app shows how much money that frees this period; it asks no question then, and the freed money appears in the end-of-period leftover prompt (see 5.9).
- Generating due payments must be idempotent (never create the same occurrence twice) and must catch up days the job missed.
- Frequencies: weekly, fortnightly, monthly, quarterly, annually. My call: no custom recurrence in the MVP.

### 5.9 Leftover at period end
At the end of a period, a prompt asks where the leftover goes: a savings fund, the next period's budget, or kept unassigned. It shows where the leftover came from (unspent per category, unassigned money, a paused recurring payment, one-off versus recurring savings) with recurring-versus-one-off hints. There is no per-category carry-over; funds handle accumulation. **Decided:** the leftover is handled as one whole amount, not line by line. Leftover can come from several reasons at once, so the prompt lists them: money freed by paused recurring payments, categories that weren't fully spent, and money previously kept unassigned. Pausing a payment asks no question at the time (see 5.8).

**Overspend review (decided).** An overspend is shown, not carried forward, so it never comes off the next budget. The same end-of-period review lists each category that went over its allocation, with the amount, so a one-off can simply be ignored. If the same category goes over in two of the last three periods (my call on the threshold), the app suggests raising that category's budget, for example groceries as prices rise, with an editable suggested amount based on recent actual spending. Because the budget is income-first, raising one category has to come from somewhere, so the suggestion shows its effect on the total (it either uses unallocated money or shows as over-allocation) and applies from the next period.

### 5.10 Imports
CSV import with a column-mapping step, duplicate detection and a preview before anything is saved, and imported rows use the same transaction table as manual entry. My call: Excel follows once CSV works and may slip past the first release; conversational and photo import are parked.

### 5.11 Banks
Monzo's developer API (read-only) is the first planned bank integration, but **not in the first release**. Settings shows a "Connect bank" placeholder. Revisit if tracking recurring payments by hand becomes a pain point. Other banks via Open Banking (for example GoCardless) are a later option.

### 5.12 Trips (David's request)
- **Decided:** David wants to see where he was when he spent money and how much he spent within a trip, so expenses can be grouped into trips.
- My proposal for how: a trip is a named date range with a place, for example "Taiwan, 1 to 15 Dec". Expenses dated inside the range join the trip automatically, with a per-expense override to add or remove one. When the app notices the device's time zone has moved away from home, it asks "Are you travelling? Start a trip?", and later asks whether to end it. A trip screen shows the total spent, spending per category and per day, and its expenses.
- A trip is a label, not a pot of money. Its expenses count against the normal monthly budget (or against a fund, if paid from one) exactly as before.
- My calls: the place is a name the user types (or the country taken from the time zone), never GPS coordinates, because other people's locations are sensitive. Spending abroad is entered in GBP as charged to the card; foreign-currency amounts are parked. Where trips appear in the interface (for example a Trips list in the analytics view) is left to the builder.

## 6. Data model guidance

Three concepts must never be mixed: **actual transactions** (money that moved), **planned/recurring payments** (expected future money movements), and **allocations** (money assigned to a category or fund). An allocation is not a transaction. A planned payment is not an expense until paid. A transfer is not spending.

Suggested entities (the builder owns the exact schema): users/profile, categories (Needs/Wants/Saving type, icon, colour), budget periods, allocations, transactions (amount in pence, date, category, optional account label, `source`, `external_id`, optional fund, `unchecked` flag, link to recurring rule), recurring rules (with an amount history by effective date), savings funds, fund movements (contributions, withdrawals), trips (name, place, start and end date, with an optional trip on each transaction), import batches. Every table carries `user_id` with row-level security. Allocations are stored **per budget period** and copied at renewal, so editing the budget changes the current period onward and never rewrites past periods. Leftover decisions are written as explicit movements: to a fund (a fund movement), to the next period's pool (an adjustment on that period), or to an "unassigned" balance with its own movements. My call.

## 7. Calculation rules to document and test

Put these in one pure module with tests: period boundaries (start day, month length), left to spend, Needs left, Wants left, Safe to Spend, fund balances, status labels, month-on-month comparison, leftover per source. Edge cases: last day of period, zero days left, over-allocation, an expense edited or deleted in a past period, a fund-paid expense, a paused recurring payment, a recurring payment whose price changed mid-period.

## 8. Month-on-month comparison

Taken from the brief. For the current period compare spending to date with the same number of elapsed days in the previous period. For a completed period compare the full period with the previous full period. Show percentage and money difference with a green/red/neutral state, never implying lower is always better. If there is no previous data, show an empty state instead of inventing a comparison.

## 9. Left to the builder

- The exact schema, migrations and row-level-security policies.
- How the scheduled job for due recurring payments runs (for example Supabase scheduled functions) and how missed days are caught up.
- Thresholds for **Spending Fast** and other status labels.
- Visual details: exact colours, spacing, chart styling, desktop layout, animations.
- Empty states for a new user, for a user with a budget and no expenses, and for the reverse.
- How much of the list's search, filter and sort to build in the first slice.

## 10. Parked after the MVP

Log with AI (plain-language entry to a preview card, nothing saved until Confirm, server-side model call), then "ask anything about your money"; Suggest button on allocations; default category names; per-category carry-over; notifications and reminders; photo and conversational import; itemised income and income transactions; account balances; calendar modes Categories, Heatmap and Recurring; yearly analytics view; export; grid/list toggle and reorder categories; debt tracking; other banks via Open Banking; foreign-currency amounts on trips; any GPS location tracking.

## 11. Still open (waiting on David)

Nothing is open. Every item that needed David's answer is decided. Lines marked "My call" above are defaults he hasn't specifically confirmed.

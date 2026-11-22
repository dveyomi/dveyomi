# Personal Finance App: backlog of deferred and open decisions

Updated 2026-11-22. Items move to the design doc once decided.

## Open (waiting on David)
- Release: go-ahead to deploy (nothing is deployed yet). Checklist: a Supabase project with migrations 0001–0010 applied; Google OAuth client with the production and preview callback URLs (Supabase Auth redirect allow-list plus the Google console); Vercel env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only, never `NEXT_PUBLIC_`), `CRON_SECRET`; Vault secrets `app_url` (the deployed origin) and `cron_secret` (same value as `CRON_SECRET`), which the hourly recurring job in migration 0007 reads; then the smoke test against the preview (`npm run test:e2e` signs in with a password through a local-only helper, so the preview needs a test user and a relaxed helper, or a manual pass) and one real Google sign-in round trip (so far only tested by hand on the local stack).
- Backups: the Supabase free plan has no point-in-time recovery; choose between the paid plan's daily backups or a scheduled `pg_dump`. Users can already export their own data.
- Expenses comparison shows very large percentages when last month was small (e.g. "+2913.1%"). Suggest hiding the percentage above a cap or when last month was under a few pounds.
- One default he hasn't specifically confirmed (my call): over-allocation (allocations exceed the monthly total) is allowed, shows a loud red state until fixed, and never clamps category cards (the reference shows "£0.00 left" on a £5,000 card with £5 spent, which hides the real position). His earlier comment on this was unclear; he can correct it when he reviews the design doc.

## Design polish to consider
From the pre-release design critique and copy review (2026-11-22); none blocks release.
- Expenses phone header: Trips, Recurring and Import are icon-only on the phone (they have screen-reader labels). Consider a "More" menu or visible labels.
- Expenses stacks two segmented controls in different styles (neutral Calendar/Analytics, lime Month/Budget period), which compete. Consider one style, or moving the range into the month header.
- Budget: a fully spent category ("£0.00 left of £1,200") shows an empty grey bar, which reads as "nothing" rather than "used up". Consider a full bar in a calm "done" colour.
- Budget: "Set new budget" sits above the headline gauge. Consider moving it below the categories or into a menu so the gauge leads.
- Add expense: the amount field takes focus on open. iOS doesn't open the keyboard for it anyway; kept as the single primary input.
- No `theme-color` meta, so the browser bar doesn't match the theme. Needs a tokens-driven way to give the colours to Next's metadata.
- The date field's calendar button has only the browser's own focus style.
- Copy: "It won't count toward your budget" kept in David's wording ("towards" in British English).
- Long amounts in the Budget gauge shrink to fit. Other large amounts (Expenses total, recurring detail, leftover prompt) don't; they sit on wide cards and fit up to £10m.

## Parked for after the MVP
- Log with AI: plain-language entry to a preview card (nothing saved until Confirm), server-side model call. Later, "ask anything about your money" Q&A (needs transaction data sent to the model). The reference + menu is "Add manually" / "Log with AI".
- Suggest button on allocations (rule-based such as 50/30/20, or history-based).
- Weekly / fortnightly budget periods (MVP is monthly only; the reference's period dropdown has more options).
- Default category names (reference app and brief differ).
- Per-category carry-over (left out; savings funds cover accumulation).
- Notifications and daily reminders.
- Conversational / photo import (MVP uses a mapping and preview wizard); Excel import after CSV.
- Itemised income sources and recording actual income transactions.
- Account balances (MVP: optional account label on transactions only).
- Reference features to confirm in or out: yearly analytics view, export, grid/list toggle, reorder categories.
- Debt tracking (Phase 2 in the brief).
- Open Banking for other banks (GoCardless free tier is one option).

## Decided
- Overspend carry (David, 2026-11-22): see "Overspend at period end" below; this reverses the earlier rule that an overspend is never carried forward.
- Savings edits after moving (David, 2026-11-22): once this month's savings are moved into funds, "This month" can't change them ("This month's savings are already moved, so change them from next month."); "From next period" can.
- Late changes to a reviewed month (David, 2026-11-22): the current month's unassigned money changes by the difference (it can go below zero), shown under the gauge as "Adjustment for October: −£40.00". Fund-paid expenses don't count.
- Import duplicates (David, 2026-11-22): same amount within ±2 days of any recorded expense ("Looks like your Netflix", "…your recurring Netflix"), or a repeat row in the same file; duplicates start unticked.
- Negative safe to spend (David, 2026-11-22): shown as £0.00 a day with Out of Budget; the info sheet explains it.
- Fund withdrawals (David, 2026-11-22): "Add to this month's spending money" (default, shown as "+£100.00 from Emergency fund") or "Just take it out"; and "Move to another fund", which leaves the budget alone.
- A category's Need/Want type is fixed once created (David, 2026-11-21). To move one, remove it from the next budget and add a new category of the other type. Status shows at least Spending Fast when any category is overspent or allocations exceed the spending money (David, 2026-11-21).
- Themes: Light, Dark and Match device, chosen in Settings; light is the default (David, 2026-11-21). Replaces "dark theme only". The light theme uses a deeper lime for accent text and icons so it stays readable on white.
- Sign out sits in Settings, added early (David, 2026-11-21).
- Phone bottom nav: a floating pill with Expenses, Budget and Settings (active tab in a darker inset pill, lime icon and label) and a separate round + to its right (David's screenshot, 2026-11-21).
- Month-on-month comparison uses green/red/neutral states as in the design (§8), with neutral wording (David, 2026-11-21; the plan had said neutral colour only).
- An Edit budget screen is added after the Budget tab task: edit allocations for the current or next period, add, rename and delete categories; "Set new budget" and the category ⋯ menu open it (David, 2026-11-21; the plan had no task for it).
- Web app, mobile-first (iPhone), desktop-first layout. Bottom nav: Expenses, Budget, Settings as three tabs, plus a + button.
- "Log with AI" is out of the MVP. The + button opens the manual Add Expense form. (My call: no one-item menu; the + goes straight to the form, and the two-option menu comes back when AI logging is added.)
- Analytics view: chart on top with the transaction list directly underneath.
- Income-first budget from one fixed monthly figure; optional "pay yourself first"; savings step always shown in onboarding.
- Onboarding flow (playback approved): 1 Income (one monthly figure; start day chosen by the user, for example the 24th or 25th; the budget resets on that day every month, with no weekend or bank-holiday adjustment), 2 Spending budget (Needs/Wants tabs, amount per category, live red over-allocation figure, can continue while over), 3 Savings (optional "pay yourself first", then funds with amounts and "already saved" toggle), 4 short "you're live" summary then the Budget screen. No "log your first expense" step and no fake progress screen. Recurring payments are set up after onboarding.
- Expenses tab (playback approved): calendar ⇄ analytics toggle; calendar months by default with a "this budget period" option; calendar shows Amount mode only (Categories, Heatmap, Recurring parked); tapping a day opens a sheet of that day's expenses, tap to edit; auto-added recurring payments carry an "unchecked" marker; analytics has the chart on top with the transaction list below; yearly view parked.
- Fund-paid expenses: money counts against the monthly budget when it is set aside into the fund, not again when spent from it. The expense still counts as spending in Expenses totals, calendar and category charts, is tagged "from <fund>", and does not reduce monthly Needs/Wants or Safe to Spend. (Confirmed by David.)
- Budget tab (playback sent, David confirmed the fund rule; the rest is taken as agreed unless he corrects it): income-first, period starts on the user-chosen start day; Spending/Saving tabs; Safe to Spend = (total left minus Needs left) ÷ days left counting today, unspent Needs stay reserved; status labels On Track / Spending Fast / Out of Budget; allocation cards tap through to that category's expenses, "no budget yet" for unallocated spending; next budget auto-renews with the same allocations and can be edited before it starts; "Set new budget" for bigger rework; second gauge page and ⋯ menu options parked. Over-total state: red, does not block (my call, see Open).
- Fund choice (David's screenshots): "Paid from fund" is a separate optional row in addition to the category, with the helper text "Pay with money you saved in a fund. It won't count toward your budget."; the day sheet shows "Travel · from Holiday".
- Overspend at period end (David, 2026-11-22, reversing "shown, never carried forward"): the review settles the whole overspend from next month's spending money (default, shown as "October overspend −£X") or from a savings fund; category budgets never carry. The period-end review lists each overspent category; if the same category goes over in two of the last three periods (my call), suggest raising its budget (editable amount, shows the effect on the total, applies from the next period).
- Sign-in: public sign-in with Google first; email later. Each user's data is separate (row-level security). The start day is entered in the budget setup step as in the reference (period plus start day), not as a separate question,.
- Time zones: not fixed to UK time. The app follows the device's time zone; "today", days left and the default expense date use it (see Travelling below).
- Category detail and overspend (David's screenshots): detail screen with Budget / Spent / Next budget, progress bar labelled with percent left, "£X left" and "N days left", the category's expenses and "+ Log expense"; an overspent category shows "£X over" in red. Overspending is allowed. My calls: red full bar in the over state, "+ Log expense" pre-selects the category.
- Renewal: Needs and Wants allocations renew automatically with the same amounts, changed only when David edits them (for example after the overspend review). Savings is not automatic: money moves into a fund only when the user moves it (goals finish and new ones start).
- Savings reservation: the savings amount is reserved from the day pay lands and left out of Safe to Spend; each period a "Move your savings" prompt (my detail) asks where it goes; until confirmed it shows as "waiting to be moved". Every contribution is a dated record. Safe to Spend covers only the monthly spending money; fund money is earmarked and is never counted as safe to spend.
- Travelling: "today", days left and the default expense date follow the device's time zone (where David currently is). Budget periods and recurring due dates are calendar dates and don't move.
- Trips (David's request): group expenses into trips and see how much was spent within one. My proposal: a trip is a named date range plus a typed place; expenses inside the range join automatically with an override; the app offers "Start a trip?" when the time zone changes; a trip screen shows total, per category and per day. A trip is a label only, not a pot of money. No GPS tracking; foreign-currency amounts parked.
- Audience: David, his girlfriend, friends and family. Keep it light: simple privacy policy, "export my data" and "delete my account" in Settings, backups; no admin tools.
- Recurring price changes (e.g. Spotify £8 to £12): editing an auto-added payment asks "just this payment" or "this and future payments"; future changes apply from that date and past months keep their amounts; the recurring item keeps a price history. Variable bills use the same mechanism.
- Pause and cancel are separate actions. Pausing shows how much money it frees this period and asks nothing; the freed money appears in the end-of-period leftover prompt.
- Leftover prompt: handled as one whole amount (not line by line), listing the reasons it exists (freed by pauses, unspent categories, previously unassigned). Money kept "unassigned" is spendable (counts in Left to spend and Safe to Spend); the app nudges the user to assign every pound to a category or fund, without forcing it.
- Currency: defaults to GBP, no onboarding screen; a setting in Settings.
- Expenses can be logged against a fund.
- Recurring payments: manual "Repeat" toggle plus detection after three regular payments.
- Recurring payments count as paid automatically on the due date; David checks and edits the amount afterwards. (My proposal: auto-added entries show as unchecked until confirmed or edited.)
- Categories with spending but no allocation show "no budget yet" (seen in the reference).
- Monzo developer API (read-only) is the first bank integration, but NOT in the first release. Settings shows a "Connect bank" placeholder (coming later). Revisit if manual tracking of recurring payments becomes a pain point. Give transactions a source and external ID from day one so a bank feed slots in without rework.

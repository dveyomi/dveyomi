# Onboarding Language and Currency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A welcome screen before onboarding step 1 where the user picks language, then currency.

**Architecture:** `src/app/onboarding/Welcome.tsx` (client) rendered by `OnboardingWizard` while
`welcomed` is false; it calls `saveLanguage`/`saveCurrency` from `src/app/(app)/settings/settingsActions.ts`.

**Tech Stack:** Next.js 16, React, Vitest + Testing Library, Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-11-23-onboarding-language-currency-design.md`

## Global Constraints

- Every visible string in both dictionaries (`en-GB.ts` source, `zh-TW.ts` must match).
- Setup stays "Step 1 of 4"; the welcome screen has no progress bar.

## Review Focus

1. Cookie says zh-TW but the new profile says en-GB → Start saves both, so the app stays Chinese after setup. (Task 1 test: Start calls both saves with current values.)
2. A save fails → message shown, user can still start. (Task 1 test.)
3. Back from step 1 → welcome screen; typed income kept. (Task 1 test.)

---

### Task 1: Welcome screen

**Files:** Create `src/app/onboarding/Welcome.tsx`; modify `Wizard.tsx`, `src/i18n/messages/{en-GB,zh-TW}.ts`,
`onboarding.test.tsx`, `e2e/smoke.spec.ts`.

**Interfaces:** Produces `Welcome({ onStart }: { onStart: () => void })`. Consumes
`saveLanguage(raw: unknown)`, `saveCurrency(raw: unknown)` → `SaveResult`.

- [ ] Step 1: tests in `onboarding.test.tsx` ("OnboardingWizard: welcome"): opens on "Welcome" with
  Language · 語言 and Currency; choosing 繁體中文（台灣） calls `saveLanguage("zh-TW")`; choosing TWD calls
  `saveCurrency("TWD")`; Start calls both with the current values and shows "Start with the basics";
  Back on step 1 returns to Welcome and keeps typed income; a failed save shows its error. Existing
  tests start through a `renderWizard()` helper that clicks Start.
- [ ] Step 2: run `npx vitest run src/app/onboarding` → FAIL (no Welcome).
- [ ] Step 3: implement Welcome, wire into Wizard, add messages (onboarding namespace:
  `welcomeTitle`, `welcomeBody`, `languageLabel`, `currencyLabel`, `currencyHint`, `changeLater`, `startSettingUp`).
- [ ] Step 4: run `npx vitest run` → PASS; `npm run lint`, `npx tsc --noEmit` clean.
- [ ] Step 5: e2e smoke clicks "Start setting up"; commit.

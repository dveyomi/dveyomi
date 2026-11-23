import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, localStack, seedSignedInUser, STACK_MISSING, type SeededUser } from "./session";

// The whole loop on a phone: set up a budget, log an expense, see it on the
// Budget and Expenses tabs, and find it in the export.

const stack = localStack();
if (stack === null) console.warn(`Skipping the smoke test. ${STACK_MISSING}`);
let admin: SupabaseClient;
let user: SeededUser | undefined;

test.beforeAll(async () => {
  test.skip(stack === null, STACK_MISSING);
  admin = adminClient(stack!);
  user = await seedSignedInUser(stack!, admin);
});

test.afterAll(async () => {
  if (user) await admin.auth.admin.deleteUser(user.id);
});

/** The Budget gauge's "Left to spend" figure, as its accessible value reads ("£2,500.00 left"). */
async function leftToSpend(page: Page): Promise<string | null> {
  return page.getByRole("meter", { name: "Left to spend" }).getAttribute("aria-valuetext");
}

test("onboarding → budget → log £12.50 → Budget, Expenses and export agree", async ({ page, context, baseURL }) => {
  await context.addCookies(user!.cookies.map((c) => ({ ...c, url: baseURL! })));

  // A new user lands in onboarding.
  await page.goto("/budget");
  await expect(page).toHaveURL(/\/onboarding$/);

  // 0 Welcome: keep English and pounds.
  await page.getByRole("button", { name: "Start setting up" }).click();

  // 1 The basics: £3,000 a month from the 1st.
  await page.getByRole("textbox", { name: "Monthly income" }).fill("3000");
  await page.getByRole("button", { name: "Continue" }).click();

  // 2 Spending budget: one need.
  await expect(page.getByRole("heading", { name: "Your spending budget" })).toBeVisible();
  const addNeed = page.getByRole("form", { name: "Add a need" });
  await addNeed.getByRole("textbox", { name: "Category name" }).fill("Groceries");
  await addNeed.getByRole("textbox", { name: "Amount" }).fill("400");
  await addNeed.getByRole("button", { name: /add/i }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // 3 Savings: £500 paid first, all into one fund.
  await expect(page.getByRole("heading", { name: "Savings", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Pay yourself first" }).fill("500");
  await page.getByRole("button", { name: "Add a fund" }).click();
  await page.getByRole("textbox", { name: "Fund name" }).fill("Holiday");
  await page.getByRole("textbox", { name: "Each month" }).fill("500");
  await page.getByRole("button", { name: "Continue" }).click();

  // 4 You're live.
  await page.getByRole("button", { name: "Go to my budget" }).click();

  // Budget shows the pool: £3,000 − £500 savings, nothing spent yet.
  await expect(page).toHaveURL(/\/budget/);
  await expect.poll(() => leftToSpend(page)).toBe("£2,500.00 left");

  // + → log £12.50.
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Add expense" }).click();
  await expect(page).toHaveURL(/\/expenses\/new/);
  await page.getByRole("textbox", { name: "Amount" }).fill("12.50");
  await page.getByRole("textbox", { name: "Name" }).fill("Smoke test lunch");
  await page.getByRole("combobox", { name: "Category" }).selectOption({ label: "Groceries" });
  await page.getByRole("button", { name: "Save expense" }).last().click();
  // The save is done once the form has gone.
  await page.waitForURL((url) => !url.pathname.startsWith("/expenses/new"));

  // Left to spend drops by exactly £12.50.
  await page.goto("/budget");
  await expect.poll(() => leftToSpend(page)).toBe("£2,487.50 left");

  // Expenses calendar: today's tile shows £12.50.
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Expenses" }).click();
  await expect(page).toHaveURL(/\/expenses/);
  const today = page.locator('[aria-current="date"]');
  await expect(today).toHaveAccessibleName(/: £12\.50 spent, 1 expense$/);
  await expect(today).toContainText("£12.50");

  // Settings → Export: a JSON file holding that expense.
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Settings" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: /Export my data/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(exported.account.id).toBe(user!.id);
  expect(exported.tables.transactions).toEqual([expect.objectContaining({ name: "Smoke test lunch", amount_pence: 1250 })]);
});

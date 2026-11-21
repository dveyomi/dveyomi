import { afterEach, describe, expect, it } from "vitest";
import { admin, createSignedInUser, deleteUser, queryAsPostgres, type TestUser } from "@/db/testClients";
import type { IsoDate } from "@/lib/calc";
import { loadBudgetView } from "./budget";
import { loadTransaction, MissingReferenceError, saveExpense, TransactionNotFoundError } from "./transactions";
import {
  createTrip,
  deleteTrip,
  endTrip,
  listTrips,
  loadTrip,
  removedFromTrip,
  resetTripOverride,
  setTripOverride,
  tripCovering,
  TripNotFoundError,
  TripOverlapError,
  tripTransactions,
  updateTrip,
} from "./trips";
import type { Db } from "./types";

const users: TestUser[] = [];
afterEach(async () => {
  await Promise.all(users.splice(0).map((u) => deleteUser(u)));
});

const db = (u: TestUser) => u.client as unknown as Db;
const TAIWAN = { name: "Taiwan", place: "Taipei", startDate: "2026-12-01", endDate: "2026-12-15" };

async function signIn(label = "trips"): Promise<TestUser> {
  const u = await createSignedInUser(label);
  users.push(u);
  const { error } = await u.client.from("profiles").update({ budget_start_day: 1 }).eq("user_id", u.id);
  if (error) throw error;
  return u;
}

/** A user with Food and Travel, a Holiday fund, a December budget, and expenses on 3, 10 and 20 Dec and 28 Nov. */
async function seed(label?: string) {
  const u = await signIn(label);
  const cats = await u.client.from("categories").insert([
    { name: "Food", kind: "need" },
    { name: "Travel", kind: "want" },
  ]).select("id, name");
  if (cats.error) throw cats.error;
  const cat = (name: string) => cats.data.find((c) => c.name === name)!.id;
  const fund = await u.client.from("funds").insert({ name: "Holiday" }).select("id").single();
  if (fund.error) throw fund.error;
  const period = await u.client
    .from("budget_periods")
    .insert({ start_date: "2026-12-01", end_date: "2026-12-31", income_pence: 300000, savings_pence: 50000 })
    .select("id")
    .single();
  if (period.error) throw period.error;
  const allocs = await u.client.from("allocations").insert([
    { period_id: period.data.id, category_id: cat("Food"), amount_pence: 40000 },
    { period_id: period.data.id, category_id: cat("Travel"), amount_pence: 100000 },
  ]);
  if (allocs.error) throw allocs.error;
  const rows = [
    { name: "Night market", amount_pence: 1250, date: "2026-12-03", category_id: cat("Food") },
    { name: "Hotel", amount_pence: 60000, date: "2026-12-10", category_id: cat("Travel"), fund_id: fund.data.id },
    { name: "Tesco", amount_pence: 4000, date: "2026-12-20", category_id: cat("Food") },
    { name: "Flights", amount_pence: 90000, date: "2026-11-28", category_id: cat("Travel"), fund_id: fund.data.id },
  ];
  const txns = await u.client.from("transactions").insert(rows).select("id, name");
  if (txns.error) throw txns.error;
  const txn = (name: string) => txns.data.find((t) => t.name === name)!.id;
  return { u, cat, txn, fundId: fund.data.id };
}

const names = async (u: TestUser, tripId: string) => (await tripTransactions(db(u), tripId)).map((t) => t.name).sort();

async function overrideOf(u: TestUser, txnId: string) {
  const { data, error } = await u.client.from("transactions").select("trip_id, trip_override").eq("id", txnId).single();
  if (error) throw error;
  return data;
}

describe("createTrip and tripTransactions", () => {
  it("expenses dated 3 and 10 Dec join Taiwan 1–15 Dec; 20 Dec and 28 Nov do not", async () => {
    const { u } = await seed();
    const id = await createTrip(db(u), TAIWAN);
    expect(await loadTrip(db(u), id)).toEqual({ id, ...TAIWAN });
    expect(await names(u, id)).toEqual(["Hotel", "Night market"]);
  });

  it("lists each expense with its category, fund and whether it was added by hand, newest first", async () => {
    const { u, cat, fundId } = await seed();
    const id = await createTrip(db(u), TAIWAN);
    const txns = await tripTransactions(db(u), id);
    expect(txns.map((t) => t.date)).toEqual(["2026-12-10", "2026-12-03"]);
    expect(txns[0]).toMatchObject({
      name: "Hotel", amountPence: 60000, categoryId: cat("Travel"), categoryName: "Travel", fundId, fundName: "Holiday", tripOverride: false,
    });
  });

  it("stores the place as typed text", async () => {
    const { u } = await seed();
    const id = await createTrip(db(u), { ...TAIWAN, place: null });
    expect((await loadTrip(db(u), id))?.place).toBeNull();
  });

  it("lists trips newest first and finds the one covering a day", async () => {
    const { u } = await seed();
    const taiwan = await createTrip(db(u), TAIWAN);
    const paris = await createTrip(db(u), { name: "Paris", place: "Paris", startDate: "2027-02-01", endDate: "2027-02-04" });
    expect((await listTrips(db(u))).map((t) => t.id)).toEqual([paris, taiwan]);
    expect((await tripCovering(db(u), "2026-12-15"))?.id).toBe(taiwan);
    expect(await tripCovering(db(u), "2026-12-16")).toBeNull();
  });

  it("an unknown trip is not found", async () => {
    const { u } = await seed();
    await expect(tripTransactions(db(u), crypto.randomUUID())).rejects.toBeInstanceOf(TripNotFoundError);
    expect(await loadTrip(db(u), "not-an-id")).toBeNull();
  });
});

describe("overlap", () => {
  it("refuses a trip that overlaps another, naming it; trips that only touch are fine", async () => {
    const { u } = await seed();
    await createTrip(db(u), TAIWAN);
    const err = await createTrip(db(u), { name: "Japan", place: "Tokyo", startDate: "2026-12-15", endDate: "2026-12-20" }).catch((e) => e);
    expect(err).toBeInstanceOf(TripOverlapError);
    expect(err.message).toBe("These dates overlap your trip “Taiwan” (1–15 Dec 2026). Trips can't overlap.");
    await expect(createTrip(db(u), { name: "Japan", place: "Tokyo", startDate: "2026-12-16", endDate: "2026-12-20" })).resolves.toEqual(
      expect.any(String),
    );
  });

  it("refuses moving a trip onto another", async () => {
    const { u } = await seed();
    await createTrip(db(u), TAIWAN);
    const japan = await createTrip(db(u), { name: "Japan", place: "Tokyo", startDate: "2027-01-10", endDate: "2027-01-20" });
    await expect(updateTrip(db(u), japan, { name: "Japan", place: "Tokyo", startDate: "2026-11-25", endDate: "2026-12-02" })).rejects.toBeInstanceOf(
      TripOverlapError,
    );
  });

  it("the database refuses overlapping rows itself (exclusion constraint)", async () => {
    const { u } = await seed();
    await createTrip(db(u), TAIWAN);
    const { error } = await u.client.from("trips").insert({ name: "Inside", start_date: "2026-12-05", end_date: "2026-12-06" });
    expect(error?.code).toBe("23P01");
  });

  it("another user's trip on the same dates doesn't count", async () => {
    const { u } = await seed();
    const other = await signIn("trips-other");
    await createTrip(db(other), TAIWAN);
    await expect(createTrip(db(u), TAIWAN)).resolves.toEqual(expect.any(String));
  });
});

describe("overrides", () => {
  it("removing one takes it out; adding one from outside the dates brings it in; reset makes it automatic again", async () => {
    const { u, txn } = await seed();
    const id = await createTrip(db(u), TAIWAN);

    await setTripOverride(db(u), txn("Night market"), null);
    await setTripOverride(db(u), txn("Flights"), id);
    expect(await names(u, id)).toEqual(["Flights", "Hotel"]);
    expect(await overrideOf(u, txn("Night market"))).toEqual({ trip_id: null, trip_override: true });
    expect(await overrideOf(u, txn("Flights"))).toEqual({ trip_id: id, trip_override: true });
    expect((await removedFromTrip(db(u), id)).map((t) => t.name)).toEqual(["Night market"]);
    expect((await tripTransactions(db(u), id)).find((t) => t.name === "Flights")?.tripOverride).toBe(true);

    await resetTripOverride(db(u), txn("Night market"));
    await resetTripOverride(db(u), txn("Flights"));
    expect(await overrideOf(u, txn("Night market"))).toEqual({ trip_id: null, trip_override: false });
    expect(await names(u, id)).toEqual(["Hotel", "Night market"]);
    expect(await removedFromTrip(db(u), id)).toEqual([]);
  });

  it("an expense dated in one trip but added to another counts only in that other one", async () => {
    const { u, txn } = await seed();
    const taiwan = await createTrip(db(u), TAIWAN);
    const later = await createTrip(db(u), { name: "Later", place: null, startDate: "2027-01-01", endDate: "2027-01-02" });
    await setTripOverride(db(u), txn("Hotel"), later);
    expect(await names(u, taiwan)).toEqual(["Night market"]);
    expect(await names(u, later)).toEqual(["Hotel"]);
    expect((await removedFromTrip(db(u), taiwan)).map((t) => t.name)).toEqual(["Hotel"]);
  });

  it("a trip id needs the override flag (check constraint)", async () => {
    const { u, txn } = await seed();
    const id = await createTrip(db(u), TAIWAN);
    const { error } = await u.client.from("transactions").update({ trip_id: id, trip_override: false }).eq("id", txn("Tesco"));
    expect(error?.code).toBe("23514");
  });

  it("refuses another user's expense or trip", async () => {
    const { u, txn } = await seed();
    const other = await seed("trips-other");
    const theirTrip = await createTrip(db(other.u), TAIWAN);
    await expect(setTripOverride(db(u), txn("Tesco"), theirTrip)).rejects.toBeInstanceOf(MissingReferenceError);
    await expect(setTripOverride(db(u), other.txn("Tesco"), null)).rejects.toBeInstanceOf(TransactionNotFoundError);
    await expect(resetTripOverride(db(u), other.txn("Tesco"))).rejects.toBeInstanceOf(TransactionNotFoundError);
    await expect(tripTransactions(db(u), theirTrip)).rejects.toBeInstanceOf(TripNotFoundError);
    expect(await loadTrip(db(u), theirTrip)).toBeNull();
    expect(await listTrips(db(u))).toEqual([]);
    expect(await overrideOf(other.u, other.txn("Tesco"))).toEqual({ trip_id: null, trip_override: false });
  });
});

describe("editing and deleting", () => {
  it("changing the dates changes which expenses join", async () => {
    const { u } = await seed();
    const id = await createTrip(db(u), TAIWAN);
    await updateTrip(db(u), id, { ...TAIWAN, startDate: "2026-12-05", endDate: "2026-12-20" });
    expect(await names(u, id)).toEqual(["Hotel", "Tesco"]);
  });

  it("deleting a trip clears overrides pointing to it (they become automatic); expenses stay", async () => {
    const { u, txn } = await seed();
    const id = await createTrip(db(u), TAIWAN);
    await setTripOverride(db(u), txn("Flights"), id);
    await setTripOverride(db(u), txn("Night market"), null);
    await deleteTrip(db(u), id);
    expect(await loadTrip(db(u), id)).toBeNull();
    expect(await overrideOf(u, txn("Flights"))).toEqual({ trip_id: null, trip_override: false });
    // "Not in a trip" points at no trip, so it stays.
    expect(await overrideOf(u, txn("Night market"))).toEqual({ trip_id: null, trip_override: true });
    expect(await loadTransaction(db(u), txn("Flights"))).not.toBeNull();
  });

  it("refuses to edit, end or delete an unknown trip", async () => {
    const { u } = await seed();
    const missing = crypto.randomUUID();
    await expect(updateTrip(db(u), missing, TAIWAN)).rejects.toBeInstanceOf(TripNotFoundError);
    await expect(deleteTrip(db(u), missing)).rejects.toBeInstanceOf(TripNotFoundError);
    await expect(endTrip(db(u), missing, "2026-12-05")).rejects.toBeInstanceOf(TripNotFoundError);
  });

  it("ending a trip sets its end date to today", async () => {
    const { u } = await seed();
    const id = await createTrip(db(u), TAIWAN);
    await endTrip(db(u), id, "2026-12-05");
    expect((await loadTrip(db(u), id))?.endDate).toBe("2026-12-05");
    expect(await names(u, id)).toEqual(["Night market"]);
  });
});

describe("a trip is a label only", () => {
  it("the budget summary is the same before and after creating a trip and overriding expenses", async () => {
    const { u, txn } = await seed();
    const today: IsoDate = "2026-12-21";
    const before = (await loadBudgetView(db(u), today)).summary;
    expect(before).not.toBeNull();
    const id = await createTrip(db(u), TAIWAN);
    await setTripOverride(db(u), txn("Tesco"), id);
    await setTripOverride(db(u), txn("Night market"), null);
    expect((await loadBudgetView(db(u), today)).summary).toEqual(before);
  });
});

describe("saveExpense with a trip", () => {
  it("records the choice: a trip, not in a trip, or automatic; a new category goes through the same save", async () => {
    const { u, cat, txn } = await seed();
    const id = await createTrip(db(u), TAIWAN);
    const base = { name: "Taxi", amountPence: 800, date: "2026-11-30", fundId: null };

    const added = await saveExpense(db(u), null, { ...base, category: { id: cat("Travel") }, trip: id });
    expect(await overrideOf(u, added)).toEqual({ trip_id: id, trip_override: true });

    const viaRpc = await saveExpense(db(u), null, { ...base, date: "2026-12-04", category: { name: "Taxis", kind: "want" }, trip: "none" });
    expect(await overrideOf(u, viaRpc)).toEqual({ trip_id: null, trip_override: true });

    await saveExpense(db(u), viaRpc, { ...base, date: "2026-12-04", category: { name: "Cabs", kind: "want" }, trip: "auto" });
    expect(await overrideOf(u, viaRpc)).toEqual({ trip_id: null, trip_override: false });

    // No trip choice given (the form shows no Trip row): an edit leaves it as it was.
    await setTripOverride(db(u), txn("Tesco"), id);
    await saveExpense(db(u), txn("Tesco"), { name: "Tesco", amountPence: 4100, date: "2026-12-20", category: { id: cat("Food") }, fundId: null });
    expect(await overrideOf(u, txn("Tesco"))).toEqual({ trip_id: id, trip_override: true });
    await saveExpense(db(u), txn("Tesco"), { name: "Tesco", amountPence: 4100, date: "2026-12-20", category: { name: "Shops", kind: "need" }, fundId: null });
    expect(await overrideOf(u, txn("Tesco"))).toEqual({ trip_id: id, trip_override: true });
  });

  it("refuses another user's trip", async () => {
    const { u } = await seed();
    const other = await signIn("trips-other");
    const theirs = await createTrip(db(other), TAIWAN);
    await expect(
      saveExpense(db(u), null, { name: "Taxi", amountPence: 800, date: "2026-12-04", fundId: null, category: { name: "Cabs", kind: "want" }, trip: theirs }),
    ).rejects.toBeInstanceOf(MissingReferenceError);
  });
});

describe("trips schema", () => {
  it("save_expense runs as the caller with an empty search_path; only signed-in users may call it (one version)", () => {
    const fns = queryAsPostgres<{ definer: boolean; anon: boolean; authenticated: boolean; path: string; args: string }>(`
      select p.prosecdef as definer,
             has_function_privilege('anon', p.oid, 'execute') as anon,
             has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
             array_to_string(p.proconfig, ',') as path,
             pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'save_expense'`);
    expect(fns).toHaveLength(1);
    expect(fns[0]).toMatchObject({ definer: false, anon: false, authenticated: true, path: 'search_path=""' });
    expect(fns[0].args).toContain("p_trip text");
  });

  it("the trip-delete trigger function is private and runs as the caller", () => {
    const [fn] = queryAsPostgres<{ definer: boolean; anon: boolean; authenticated: boolean; path: string }>(`
      select p.prosecdef as definer,
             has_function_privilege('anon', p.oid, 'execute') as anon,
             has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
             array_to_string(p.proconfig, ',') as path
      from pg_proc p where p.oid = 'private.clear_trip_overrides()'::regprocedure`);
    expect(fn).toEqual({ definer: false, anon: false, authenticated: false, path: 'search_path=""' });
  });

  it("no column anywhere stores a location (latitude, longitude or coordinates)", () => {
    const cols = queryAsPostgres<{ column_name: string }>(`
      select column_name from information_schema.columns
      where table_schema = 'public' and column_name ~* '(lat|lng|lon|longitude|latitude|coord|geo)'`);
    expect(cols).toEqual([]);
  });

  it("trips keep their RLS: another user can't update or delete them", async () => {
    const { u } = await seed();
    const id = await createTrip(db(u), TAIWAN);
    const other = await signIn("trips-other");
    const upd = await other.client.from("trips").update({ name: "Mine" }).eq("id", id).select("id");
    expect(upd.data).toEqual([]);
    const del = await other.client.from("trips").delete().eq("id", id).select("id");
    expect(del.data).toEqual([]);
    const { data } = await admin.from("trips").select("name").eq("id", id).single();
    expect(data?.name).toBe("Taiwan");
  });
});

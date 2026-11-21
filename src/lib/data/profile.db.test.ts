import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, createSignedInUser, deleteUser, type TestUser } from "@/db/testClients";
import { adoptDeviceTimezone } from "./profile";

let user: TestUser;

async function profile() {
  const { data, error } = await admin
    .from("profiles")
    .select("timezone, timezone_detected")
    .eq("user_id", user.id)
    .single();
  if (error) throw error;
  return data;
}

beforeAll(async () => {
  user = await createSignedInUser("tz");
});
afterAll(() => deleteUser(user));

describe("adoptDeviceTimezone", () => {
  it("a new profile starts on Europe/London, not yet detected", async () => {
    expect(await profile()).toEqual({ timezone: "Europe/London", timezone_detected: false });
  });

  it("first call stores the device zone and marks it detected", async () => {
    await adoptDeviceTimezone(user.client, user.id, "Asia/Taipei");
    expect(await profile()).toEqual({ timezone: "Asia/Taipei", timezone_detected: true });
  });

  it("a later call with another zone changes nothing", async () => {
    await adoptDeviceTimezone(user.client, user.id, "America/New_York");
    expect(await profile()).toEqual({ timezone: "Asia/Taipei", timezone_detected: true });
  });

  it("ignores an invalid zone", async () => {
    const other = await createSignedInUser("tz-bad");
    try {
      await adoptDeviceTimezone(other.client, other.id, "Mars/Olympus");
      const { data } = await admin.from("profiles").select("timezone, timezone_detected").eq("user_id", other.id).single();
      expect(data).toEqual({ timezone: "Europe/London", timezone_detected: false });
    } finally {
      await deleteUser(other);
    }
  });

  it("a London device marks the profile detected, so travelling later cannot change it", async () => {
    const londoner = await createSignedInUser("tz-london");
    try {
      await adoptDeviceTimezone(londoner.client, londoner.id, "Europe/London");
      await adoptDeviceTimezone(londoner.client, londoner.id, "Asia/Taipei");
      const { data } = await admin
        .from("profiles")
        .select("timezone, timezone_detected")
        .eq("user_id", londoner.id)
        .single();
      expect(data).toEqual({ timezone: "Europe/London", timezone_detected: true });
    } finally {
      await deleteUser(londoner);
    }
  });
});

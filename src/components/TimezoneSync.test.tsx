import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimezoneSync } from "./TimezoneSync";

const refresh = vi.fn();
const adoptDeviceTimezone = vi.fn<(zone: string) => Promise<void>>(async () => {});
// One router object, as Next.js gives: TimezoneSync's effect depends on it.
const router = { refresh, push: vi.fn() };
let pathname = "/budget";
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => pathname }));
vi.mock("@/app/(app)/actions", () => ({
  adoptDeviceTimezone: (zone: string) => adoptDeviceTimezone(zone),
  endCurrentTrip: async () => ({}),
}));

/** Home is the device's zone in these tests, so no travelling prompt. */
const HOME = { homeZone: "Asia/Taipei", today: "2026-12-03", currentTrip: null, nextTripStart: null };

function setDeviceZone(timeZone: string) {
  const real = Intl.DateTimeFormat;
  vi.spyOn(Intl, "DateTimeFormat").mockImplementation(((...args: ConstructorParameters<typeof real>) => {
    const fmt = new real(...args);
    const resolved = fmt.resolvedOptions();
    fmt.resolvedOptions = () => ({ ...resolved, timeZone });
    return fmt;
  }) as unknown as typeof Intl.DateTimeFormat);
}

function clearCookies() {
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0].trim();
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  }
}

describe("TimezoneSync", () => {
  beforeEach(() => {
    clearCookies();
    refresh.mockClear();
    adoptDeviceTimezone.mockClear();
  });
  afterEach(() => vi.restoreAllMocks());

  it("writes the device zone to the tz cookie and refreshes once", async () => {
    setDeviceZone("Asia/Taipei");
    render(<TimezoneSync {...HOME} homeDetected />);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(document.cookie).toContain("tz=Asia%2FTaipei");
    expect(adoptDeviceTimezone).not.toHaveBeenCalled();
  });

  it("does nothing when the cookie already matches the device", async () => {
    setDeviceZone("Asia/Taipei");
    document.cookie = "tz=Asia%2FTaipei; path=/";
    render(<TimezoneSync {...HOME} homeDetected />);
    await new Promise((r) => setTimeout(r, 10));
    expect(refresh).not.toHaveBeenCalled();
    expect(adoptDeviceTimezone).not.toHaveBeenCalled();
  });

  it("detects the home zone once: saves the device zone while not yet detected", async () => {
    setDeviceZone("Asia/Taipei");
    document.cookie = "tz=Asia%2FTaipei; path=/";
    render(<TimezoneSync {...HOME} homeDetected={false} />);
    await waitFor(() => expect(adoptDeviceTimezone).toHaveBeenCalledWith("Asia/Taipei"));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("also records a London device as detected", async () => {
    setDeviceZone("Europe/London");
    document.cookie = "tz=Europe%2FLondon; path=/";
    render(<TimezoneSync {...HOME} homeDetected={false} />);
    await waitFor(() => expect(adoptDeviceTimezone).toHaveBeenCalledWith("Europe/London"));
  });

  it("never touches a detected home zone, even when travelling", async () => {
    setDeviceZone("Asia/Taipei");
    render(<TimezoneSync {...HOME} homeDetected />);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(adoptDeviceTimezone).not.toHaveBeenCalled();
  });

  describe("the travelling prompt", () => {
    const trip = { homeZone: "Europe/London", today: "2026-12-03", currentTrip: null, nextTripStart: null };
    beforeEach(() => {
      window.localStorage.clear();
      pathname = "/budget";
    });

    it.each(["/expenses/new", "/expenses/11111111-1111-4111-8111-111111111111", "/review", "/expenses/trips/new"])(
      "stays out of the way on %s (a focused screen or the new trip form)",
      async (path) => {
        pathname = path;
        setDeviceZone("Asia/Taipei");
        document.cookie = "tz=Asia%2FTaipei; path=/";
        render(<TimezoneSync homeDetected {...trip} />);
        await new Promise((r) => setTimeout(r, 20));
        expect(screen.queryByRole("region")).not.toBeInTheDocument();
      },
    );

    it("asks 'Are you travelling?' when the device zone differs from the home zone", async () => {
      setDeviceZone("Asia/Taipei");
      render(<TimezoneSync homeDetected {...trip} />);
      expect(await screen.findByRole("region", { name: "Are you travelling?" })).toBeInTheDocument();
    });

    it("asks nothing when the device zone equals the home zone", async () => {
      setDeviceZone("Europe/London");
      render(<TimezoneSync homeDetected {...trip} />);
      await waitFor(() => expect(refresh).toHaveBeenCalled());
      expect(screen.queryByRole("region")).not.toBeInTheDocument();
    });

    it("asks nothing before the home zone is detected (first sign-in adopts the device zone)", async () => {
      setDeviceZone("Asia/Taipei");
      render(<TimezoneSync homeDetected={false} {...trip} />);
      await waitFor(() => expect(adoptDeviceTimezone).toHaveBeenCalled());
      expect(screen.queryByRole("region")).not.toBeInTheDocument();
    });
  });
});

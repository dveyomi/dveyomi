import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimezoneSync } from "./TimezoneSync";

const refresh = vi.fn();
const adoptDeviceTimezone = vi.fn<(zone: string) => Promise<void>>(async () => {});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/(app)/actions", () => ({ adoptDeviceTimezone: (zone: string) => adoptDeviceTimezone(zone) }));

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
    render(<TimezoneSync profileTimezone="Asia/Taipei" />);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(document.cookie).toContain("tz=Asia%2FTaipei");
    expect(adoptDeviceTimezone).not.toHaveBeenCalled();
  });

  it("does nothing when the cookie already matches the device", async () => {
    setDeviceZone("Asia/Taipei");
    document.cookie = "tz=Asia%2FTaipei; path=/";
    render(<TimezoneSync profileTimezone="Asia/Taipei" />);
    await new Promise((r) => setTimeout(r, 10));
    expect(refresh).not.toHaveBeenCalled();
    expect(adoptDeviceTimezone).not.toHaveBeenCalled();
  });

  it("saves the device zone to a profile still on the default zone", async () => {
    setDeviceZone("Asia/Taipei");
    document.cookie = "tz=Asia%2FTaipei; path=/";
    render(<TimezoneSync profileTimezone="Europe/London" />);
    await waitFor(() => expect(adoptDeviceTimezone).toHaveBeenCalledWith("Asia/Taipei"));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("leaves a profile that chose a zone alone", async () => {
    setDeviceZone("Asia/Taipei");
    render(<TimezoneSync profileTimezone="America/New_York" />);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(adoptDeviceTimezone).not.toHaveBeenCalled();
  });

  it("does not touch a default profile when the device is in London", async () => {
    setDeviceZone("Europe/London");
    document.cookie = "tz=Europe%2FLondon; path=/";
    render(<TimezoneSync profileTimezone="Europe/London" />);
    await new Promise((r) => setTimeout(r, 10));
    expect(adoptDeviceTimezone).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});

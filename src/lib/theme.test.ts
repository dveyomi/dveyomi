import { afterEach, describe, expect, it } from "vitest";
import {
  applyTheme,
  parseTheme,
  THEME_COOKIE,
  themeCookie,
  themeFromCookie,
  themeScript,
} from "./theme";

function clearCookies() {
  for (const c of document.cookie.split("; ").filter(Boolean)) {
    document.cookie = `${c.split("=")[0]}=; path=/; max-age=0`;
  }
}

afterEach(() => {
  clearCookies();
  document.documentElement.removeAttribute("data-theme");
});

describe("parseTheme", () => {
  it.each(["light", "dark", "system"] as const)("accepts %s", (t) => {
    expect(parseTheme(t)).toBe(t);
  });

  it.each([undefined, null, "", "Dark", "blue", "dark;"])("falls back to light for %s", (v) => {
    expect(parseTheme(v)).toBe("light");
  });
});

describe("themeCookie", () => {
  it("serialises the choice for a year, site-wide, SameSite=Lax", () => {
    expect(THEME_COOKIE).toBe("theme");
    expect(themeCookie("dark")).toBe("theme=dark; path=/; max-age=31536000; samesite=lax");
  });

  it("round-trips through themeFromCookie", () => {
    for (const t of ["light", "dark", "system"] as const) {
      expect(themeFromCookie(themeCookie(t).split(";")[0])).toBe(t);
    }
  });
});

describe("themeFromCookie (the inline script's logic)", () => {
  it("is light when there is no theme cookie", () => {
    expect(themeFromCookie("")).toBe("light");
    expect(themeFromCookie("tz=Europe%2FLondon; sb-auth=abc")).toBe("light");
  });

  it("reads the theme among other cookies", () => {
    expect(themeFromCookie("tz=Europe%2FLondon; theme=dark; sb=1")).toBe("dark");
    expect(themeFromCookie("theme=system")).toBe("system");
  });

  it("ignores cookies whose name only ends in theme", () => {
    expect(themeFromCookie("oldtheme=dark")).toBe("light");
  });

  it("falls back to light for an invalid value", () => {
    expect(themeFromCookie("theme=neon")).toBe("light");
    expect(themeFromCookie("theme=")).toBe("light");
  });
});

describe("themeScript", () => {
  const run = () => new Function(themeScript)();

  it("sets data-theme on <html> from the cookie", () => {
    document.cookie = "theme=dark; path=/";
    run();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("sets light when the cookie is absent", () => {
    run();
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

describe("applyTheme", () => {
  it("switches <html> and remembers the choice in the cookie", () => {
    applyTheme("system");
    expect(document.documentElement.dataset.theme).toBe("system");
    expect(document.cookie).toContain("theme=system");
  });
});

describe("themeScript runs on its own (no module scope)", () => {
  function runWith(cookie: string) {
    const fakeDocument = { cookie, documentElement: { dataset: {} as Record<string, string> } };
    new Function("document", themeScript)(fakeDocument);
    return fakeDocument.documentElement.dataset.theme;
  }

  it.each([
    ["theme=dark", "dark"],
    ["a=1; theme=system", "system"],
    ["theme=light", "light"],
    ["", "light"],
    ["theme=neon", "light"],
  ])("cookie %j gives %s", (cookie, expected) => {
    expect(runWith(cookie)).toBe(expected);
  });
});

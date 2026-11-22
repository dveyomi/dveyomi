import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(import.meta.dirname, "..");
const TOKENS_FILE = path.join(SRC, "design", "tokens.css");
const GLOBALS_FILE = path.join(SRC, "app", "globals.css");
const SOURCE_EXT = /\.(tsx?|css|m?js)$/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : SOURCE_EXT.test(name) ? [full] : [];
  });
}

/** Every source file a screen or component lives in: src/app and src/components. */
const scanned = [...walk(path.join(SRC, "app")), ...walk(path.join(SRC, "components"))].filter(
  (f) => f !== TOKENS_FILE,
);
const read = (f: string) => readFileSync(f, "utf8");
const rel = (f: string) => path.relative(SRC, f);

const tokensCss = read(TOKENS_FILE);
const definedTokens = new Set([...tokensCss.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

/** Theme variables globals.css defines inside `@theme` (Tailwind's own namespace). */
function themeBlock(css: string): string {
  const start = css.indexOf("@theme");
  if (start === -1) return "";
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  return "";
}

function offences(pattern: RegExp, files = scanned): string[] {
  return files.flatMap((f) =>
    read(f)
      .split("\n")
      .flatMap((line, i) => (pattern.test(line) ? [`${rel(f)}:${i + 1}: ${line.trim()}`] : [])),
  );
}

describe("design tokens", () => {
  it("defines the colour, type, spacing, radius and elevation tokens", () => {
    for (const name of [
      "--bg",
      "--card",
      "--card-raised",
      "--text",
      "--muted",
      "--accent",
      "--accent-ink",
      "--accent-fg",
      "--danger",
      "--danger-fg",
      "--warning-fg",
      "--positive-fg",
      "--warning",
      "--positive",
      "--border",
      "--text-display",
      "--text-title",
      "--text-body",
      "--text-caption",
      "--font-sans",
      ...Array.from({ length: 8 }, (_, i) => `--space-${i + 1}`),
      "--radius-sm",
      "--radius-md",
      "--radius-pill",
      "--shadow-sheet",
    ]) {
      expect(definedTokens, name).toContain(name);
    }
  });

  it("every --token referenced under src/app and src/components exists in tokens.css", () => {
    const themeNames = new Set(
      [...themeBlock(read(GLOBALS_FILE)).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]),
    );
    const missing = scanned.flatMap((f) =>
      [...read(f).matchAll(/var\(\s*(--[\w-]+)|\((--[\w-]+)\)/g)]
        .map((m) => m[1] ?? m[2])
        .filter((name) => !definedTokens.has(name) && !themeNames.has(name))
        .map((name) => `${rel(f)}: ${name}`),
    );
    expect(missing).toEqual([]);
  });

  it("maps every colour token into the Tailwind theme", () => {
    const theme = themeBlock(read(GLOBALS_FILE));
    const colours = [...tokensCss.matchAll(/(--[\w-]+)\s*:\s*#/g)].map((m) => m[1]);
    expect(colours.length).toBeGreaterThan(0);
    for (const token of colours) {
      expect(theme, token).toContain(`var(${token})`);
    }
  });
});

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The body of the first rule whose selector is exactly `selector`, searching from `from`. */
function ruleBody(css: string, selector: string, from = 0): string {
  const at = css.indexOf(`${selector} {`, from);
  if (at === -1) throw new Error(`no "${selector} {" block in tokens.css`);
  const open = css.indexOf("{", at);
  return css.slice(open + 1, css.indexOf("}", open));
}
/** Custom properties declared in a rule body, name to value. */
function declarations(body: string): Map<string, string> {
  return new Map([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const DARK = ':root[data-theme="dark"]';
const SYSTEM = ':root[data-theme="system"]';
/** The light (default) colours: the top-level `:root {` block that sets color-scheme. */
const lightBody =
  [...tokensCss.matchAll(/^:root \{/gm)]
    .map((m) => ruleBody(tokensCss, ":root", m.index))
    .find((body) => /color-scheme/.test(body)) ?? "";
const darkBody = ruleBody(tokensCss, DARK);
const mediaAt = tokensCss.indexOf("@media (prefers-color-scheme: dark)");
const systemDarkBody = mediaAt === -1 ? "" : ruleBody(tokensCss, SYSTEM, mediaAt);
const themes = { light: declarations(lightBody), dark: declarations(darkBody) };

function hex(theme: Map<string, string>, name: string): string {
  const value = theme.get(name);
  if (!value || !/^#[0-9a-fA-F]{6}$/.test(value)) throw new Error(`${name} is not a 6-digit hex token`);
  return value;
}

describe("themes", () => {
  it("light is the default (:root) and declares color-scheme: light", () => {
    expect(lightBody).toMatch(/color-scheme:\s*light;/);
  });

  it('dark lives under [data-theme="dark"] with color-scheme: dark', () => {
    expect(darkBody).toMatch(/color-scheme:\s*dark;/);
  });

  it('[data-theme="system"] takes the dark values, unchanged, when the device prefers dark', () => {
    expect(mediaAt).toBeGreaterThan(-1);
    const normalise = (body: string) => body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim();
    expect(normalise(systemDarkBody)).toBe(normalise(darkBody));
  });

  it('[data-theme="system"] declares both color schemes so native controls follow the device', () => {
    expect(ruleBody(tokensCss, SYSTEM)).toMatch(/color-scheme:\s*light dark;/);
  });

  it("both themes define the same colour and elevation tokens", () => {
    const light = [...themes.light.keys()].sort();
    expect(light.length).toBeGreaterThan(10);
    expect([...themes.dark.keys()].sort()).toEqual(light);
  });

  it("keeps the approved dark palette", () => {
    expect(Object.fromEntries(themes.dark)).toMatchObject({
      "--bg": "#0B0B0C",
      "--card": "#17181A",
      "--card-raised": "#1F2023",
      "--text": "#F5F5F4",
      "--muted": "#8A8D93",
      "--accent": "#C6F432",
      "--accent-ink": "#0B0B0C",
      "--danger": "#FF5A5F",
      "--warning": "#FFB020",
      "--positive": "#4ADE80",
      "--border": "#2A2B2E",
      "--border-strong": "#6B6E74",
    });
  });
});

describe.each(Object.entries(themes))("contrast (%s)", (_name, theme) => {
  const on = (fg: string, bg: string) => contrast(hex(theme, fg), hex(theme, bg));

  it.each(["--text", "--muted"])("%s is at least 4.5:1 on bg, card and card-raised", (fg) => {
    for (const surface of ["--bg", "--card", "--card-raised"]) {
      expect(on(fg, surface), surface).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(["--accent-fg", "--danger-fg", "--warning-fg", "--positive-fg"])(
    "%s (text and icons) is at least 4.5:1 on bg and card",
    (fg) => {
      for (const surface of ["--bg", "--card"]) {
        expect(on(fg, surface), surface).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it("--accent-ink is at least 4.5:1 on --accent", () => {
    expect(on("--accent-ink", "--accent")).toBeGreaterThanOrEqual(4.5);
  });

  it("--accent-ink (the danger button's text) is at least 4.5:1 on --danger", () => {
    expect(on("--accent-ink", "--danger")).toBeGreaterThanOrEqual(4.5);
  });

  it("--border-strong (form control boundaries) is at least 3:1 on card and card-raised", () => {
    for (const surface of ["--card", "--card-raised"]) {
      expect(on("--border-strong", surface), surface).toBeGreaterThanOrEqual(3);
    }
  });
});

/** Foreground utilities given a fill token; foregrounds use the -fg (or -ink) tokens instead. */
const FILL_AS_FOREGROUND =
  /(?<![\w-])(?:text|stroke|fill|outline|ring|decoration|caret|border)-(?:accent|danger|warning|positive)(?![\w-])/;

describe("no styling outside the design system", () => {
  it("has no hex colour literals", () => {
    expect(offences(/(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/)).toEqual(
      [],
    );
  });

  it("has no rgb/hsl/oklch colour functions", () => {
    expect(offences(/\b(?:rgba?|hsla?|oklch|oklab)\(/)).toEqual([]);
  });

  it("has no arbitrary pixel Tailwind values", () => {
    expect(offences(/\[[^\]\s]*\d(?:\.\d+)?px[^\]\s]*\]/)).toEqual([]);
  });

  it("has no pixel literals in CSS outside tokens.css", () => {
    const css = scanned.filter((f) => f.endsWith(".css"));
    expect(offences(/\b\d+(?:\.\d+)?px\b/, css)).toEqual([]);
  });

  it("has no inline style colours or pixel sizes", () => {
    const found = scanned.flatMap((f) =>
      [...read(f).matchAll(/style=\{\{([\s\S]*?)\}\}/g)]
        .filter((m) =>
          /\d(?:\.\d+)?px|colou?r|background|fill|stroke|border|shadow|rgb|hsl|#/i.test(m[1]),
        )
        .map((m) => `${rel(f)}: style={{${m[1].trim()}}}`),
    );
    expect(found).toEqual([]);
  });

  it("never uses a fill colour (accent, danger, warning, positive) for text, icons, strokes or outlines", () => {
    expect(offences(FILL_AS_FOREGROUND)).toEqual([]);
  });

  it("the scan itself catches offences (guards the regexes)", () => {
    expect(FILL_AS_FOREGROUND.test('className="text-accent"')).toBe(true);
    expect(FILL_AS_FOREGROUND.test("stroke-danger")).toBe(true);
    expect(FILL_AS_FOREGROUND.test("focus-visible:outline-accent")).toBe(true);
    expect(FILL_AS_FOREGROUND.test("text-accent-fg text-accent-ink bg-accent")).toBe(false);
    const hex = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/;
    expect(hex.test('className="text-[#C6F432]"')).toBe(true);
    expect(hex.test('href="#budget"')).toBe(false);
    const px = /\[[^\]\s]*\d(?:\.\d+)?px[^\]\s]*\]/;
    expect(px.test("w-[13px]")).toBe(true);
    expect(px.test("-mt-[20px]")).toBe(true);
    expect(px.test("max-h-[85dvh]")).toBe(false);
  });
});

describe("focus rings", () => {
  // Tailwind v4's `outline-none` (also inside shared classes such as
  // buttonClasses) sets --tw-outline-style to none, and `focus-visible:outline-2`
  // only sets the width, so a ring shows only if the focused state sets the
  // style too. Required everywhere, wherever outline-none might come from.
  it("every focus outline width comes with its outline style, in the same state", () => {
    const lines = offences(/(focus-visible|focus-within|has-focus-visible):outline-\d/).filter((line) =>
      [...line.matchAll(/(?<![\w-])((?:has-)?focus-(?:visible|within)):outline-\d+\b/g)].some(
        ([, state]) => !line.includes(`${state}:outline-solid`),
      ),
    );
    expect(lines).toEqual([]);
  });
});

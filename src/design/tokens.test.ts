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
      "--danger",
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
function tokenHex(name: string): string {
  const m = tokensCss.match(new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{6})\\b`));
  if (!m) throw new Error(`${name} is not a 6-digit hex token`);
  return m[1];
}

describe("contrast", () => {
  it("--border-strong (form control boundaries) is at least 3:1 on --card and --card-raised", () => {
    for (const surface of ["--card", "--card-raised"]) {
      expect(contrast(tokenHex("--border-strong"), tokenHex(surface)), surface).toBeGreaterThanOrEqual(3);
    }
  });
});

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

  it("the scan itself catches offences (guards the regexes)", () => {
    const hex = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/;
    expect(hex.test('className="text-[#C6F432]"')).toBe(true);
    expect(hex.test('href="#budget"')).toBe(false);
    const px = /\[[^\]\s]*\d(?:\.\d+)?px[^\]\s]*\]/;
    expect(px.test("w-[13px]")).toBe(true);
    expect(px.test("-mt-[20px]")).toBe(true);
    expect(px.test("max-h-[85dvh]")).toBe(false);
  });
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A server file may render a "use client" component, but it cannot call a
 * plain function exported from one: Next.js replaces it with a reference and
 * the page fails with "Attempted to call X() from the server". Translating the
 * app moved many components to the client, so this guards every import.
 */
const SRC = resolve(__dirname, "..");

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return files(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

const isClient = (source: string) => /^\s*["']use client["']/.test(source);

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (statSync(c, { throwIfNoEntry: false })?.isFile()) return c;
  }
  return null;
}

describe("client boundary", () => {
  it("no server file calls a plain function from a client module", () => {
    const problems: string[] = [];
    for (const file of files(SRC)) {
      const source = readFileSync(file, "utf8");
      if (isClient(source)) continue;
      const imports = source.matchAll(/import\s+(?!type\b)\{([^}]*)\}\s+from\s+["']([^"']+)["']/g);
      for (const [, names, spec] of imports) {
        const target = resolveImport(file, spec);
        if (!target || !isClient(readFileSync(target, "utf8"))) continue;
        for (const raw of names.split(",")) {
          const name = raw.trim();
          if (!name || name.startsWith("type ")) continue;
          const local = name.split(/\s+as\s+/)[0];
          if (/^[a-z]/.test(local)) problems.push(`${file.slice(SRC.length + 1)}: ${local} from ${spec}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

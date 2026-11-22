import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let jar: Map<string, string> | "throw" = new Map();
vi.mock("next/headers", () => ({
  cookies: async () => {
    if (jar === "throw") throw new Error("cookies() outside a request");
    const j = jar;
    return { get: (name: string) => (j.has(name) ? { name, value: j.get(name)! } : undefined) };
  },
}));

import { I18nProvider, useI18n } from "./client";
import { DEFAULT_I18N } from "./format";
import { getServerI18n } from "./server";

function Probe() {
  const { locale, m, fmt } = useI18n();
  return (
    <p>
      {locale}|{m.common.save}|{fmt.money(125000)}|{fmt.daysLeft(1)}
    </p>
  );
}

afterEach(() => {
  jar = new Map();
});

describe("useI18n", () => {
  it("is English and GBP with no provider", () => {
    render(<Probe />);
    expect(screen.getByText("en-GB|Save|£1,250.00|1 day left")).toBeInTheDocument();
  });

  it("follows the provider's language and currency", () => {
    render(
      <I18nProvider locale="zh-TW" currency="TWD">
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByText("zh-TW|儲存|NT$1,250|剩 1 天")).toBeInTheDocument();
  });
});

describe("getServerI18n", () => {
  it("falls back to English and GBP outside a request", async () => {
    jar = "throw";
    const i18n = await getServerI18n();
    expect(i18n.locale).toBe(DEFAULT_I18N.locale);
    expect(i18n.currency).toBe("GBP");
  });

  it("reads the locale and currency cookies", async () => {
    jar = new Map([["locale", "zh-TW"], ["currency", "TWD"]]);
    const i18n = await getServerI18n();
    expect(i18n.locale).toBe("zh-TW");
    expect(i18n.fmt.money(125000)).toBe("NT$1,250");
  });

  it("treats unknown cookie values as the defaults", async () => {
    jar = new Map([["locale", "fr"], ["currency", "USD"]]);
    const i18n = await getServerI18n();
    expect(i18n.locale).toBe("en-GB");
    expect(i18n.currency).toBe("GBP");
  });
});

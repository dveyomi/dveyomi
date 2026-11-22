import { describe, expect, it } from "vitest";
import { NameTakenError } from "@/lib/data/budgetEdit";
import { FundShortError } from "@/lib/data/funds";
import { LeftoverChangedError } from "@/lib/data/review";
import { TripOverlapError } from "@/lib/data/trips";
import { localizeError } from "./errors";
import { DEFAULT_I18N, makeI18n } from "./format";

const zh = makeI18n("zh-TW", "TWD");

describe("localizeError", () => {
  it("keeps the English message in English", () => {
    const e = new NameTakenError("Rent");
    expect(localizeError(e, DEFAULT_I18N)).toBe(e.message);
  });

  it("rebuilds messages in Chinese, with names, months, dates and amounts", () => {
    expect(localizeError(new NameTakenError("房租"), zh)).toBe("你已經有一個叫「房租」的類別了。");
    expect(localizeError(new FundShortError("旅遊", 125000), zh)).toBe("「旅遊」只有 NT$1,250。");
    expect(localizeError(new LeftoverChangedError("October", "2026-10-25"), zh)).toBe("你回顧時10月的金額有變動。請確認新的金額後再試一次。");
    expect(localizeError(new TripOverlapError({ name: "台北", startDate: "2026-12-01", endDate: "2026-12-15" }), zh)).toBe(
      "這些日期和你的旅程「台北」（2026年12月1日 – 12月15日）重疊了。旅程不能重疊。",
    );
  });

  it("falls back to the error's own message for anything unknown", () => {
    expect(localizeError(new Error("boom"), zh)).toBe("boom");
  });
});

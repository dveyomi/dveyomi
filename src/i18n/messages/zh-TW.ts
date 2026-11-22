import type { Messages } from "./en-GB";

/** 繁體中文（台灣）. Typed as Messages: every English key must be here. */
export const zhTW: Messages = {
  common: {
    save: "儲存",
    cancel: "取消",
    close: "關閉",
    back: "返回",
    continue: "繼續",
    delete: "刪除",
    edit: "編輯",
    done: "完成",
    saving: "儲存中…",
    saved: "已儲存。",
  },
  dates: {
    today: "今天",
    tomorrow: "明天",
    withYear: (date: string, year: string) => `${year}年${date}`,
    daysLeft: (n: number) => `剩 ${n} 天`,
  },
  settings: {
    regionTitle: "地區",
    regionDescription: "今天的日期和預算日都依照你的所在時區。",
    homeTimeZone: "所在時區",
    homeTimeZoneHint: "旅行時，今天的日期會依照你的裝置。",
    language: "語言",
    languageHint: "會變更所有畫面。你輸入的名稱不會改變。",
    currency: "幣別",
    currencyHint: "只變更金額的顯示方式，金額不會換算。",
    currencyNames: { GBP: "英鎊（GBP）", TWD: "新台幣（TWD）" },
    currencyConfirmTitle: "要變更幣別嗎？",
    currencyConfirmBody: (from: string, to: string) => `金額不會換算。${from} 會變成 ${to}。`,
    currencyConfirm: "變更幣別",
    chooseLanguage: "請從清單中選擇語言。",
    languageSaveFailed: "無法儲存語言。請檢查網路連線後再試一次。",
    chooseCurrency: "請從清單中選擇幣別。",
    currencySaveFailed: "無法儲存幣別。請檢查網路連線後再試一次。",
  },
};

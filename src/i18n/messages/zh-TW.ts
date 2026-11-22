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
};

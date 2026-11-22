import type { Locale } from "@/lib/locale";
import { enGB, type Messages } from "./en-GB";
import { zhTW } from "./zh-TW";

export type { Messages };
export { enGB, zhTW };

const dictionaries: Record<Locale, Messages> = { "en-GB": enGB, "zh-TW": zhTW };

/** The dictionary for a locale. */
export function messagesFor(locale: Locale): Messages {
  return dictionaries[locale];
}

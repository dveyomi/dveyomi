import { iconNames, type IconName } from "@/components/ui";
import type { CategoryRow } from "@/lib/data/types";

/** The category's chosen icon when it is one of ours, else one for its kind. */
export function categoryIcon(category: Pick<CategoryRow, "icon" | "kind">): IconName {
  const chosen = iconNames.find((name) => name === category.icon);
  if (chosen) return chosen;
  return category.kind === "need" ? "home" : "wallet";
}

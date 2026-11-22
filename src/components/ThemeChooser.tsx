"use client";

import { useI18n } from "@/i18n/client";
import { useSyncExternalStore } from "react";
import { RadioSegments } from "@/components/ui";
import { applyTheme, parseTheme, type Theme } from "@/lib/theme";


/** Re-renders whenever <html data-theme> changes, from this chooser or anywhere else. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const pageTheme = () => parseTheme(document.documentElement.dataset.theme);

/**
 * Light / Dark / Match device. Applies at once and remembers the choice in the
 * `theme` cookie. The selection is read from <html data-theme> (what the page
 * really shows), so it cannot go stale after back/forward; `initial` (the
 * cookie, read on the server) is only used for the server render.
 */
export function ThemeChooser({ initial }: { initial: Theme }) {
  const { m } = useI18n();
  const theme = useSyncExternalStore(subscribe, pageTheme, () => initial);
  const options: { value: Theme; label: string }[] = [
    { value: "light", label: m.settingsPage.themes.light },
    { value: "dark", label: m.settingsPage.themes.dark },
    { value: "system", label: m.settingsPage.themes.system },
  ];
  return <RadioSegments label={m.settingsPage.themeTitle} options={options} value={theme} onChange={applyTheme} />;
}

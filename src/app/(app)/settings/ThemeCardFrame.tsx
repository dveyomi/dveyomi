"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/i18n/client";
import { SettingsSection } from "./SettingsSection";

/** The Theme card's frame, titled in the user's language. */
export function ThemeCardFrame({ children }: { children: ReactNode }) {
  const { m } = useI18n();
  return (
    <SettingsSection title={m.settingsPage.themeTitle} description={m.settingsPage.themeDescription}>
      {children}
    </SettingsSection>
  );
}

import type { ReactNode } from "react";
import { ThemeChooser } from "@/components/ThemeChooser";
import { savedTheme } from "@/lib/savedTheme";
import { SettingsSection } from "./SettingsSection";

/** The Theme card. Static, so it paints at once; the chooser inside streams in. */
export function ThemeCard({ children }: { children: ReactNode }) {
  return (
    <SettingsSection title="Theme" description="Match device follows your phone or computer's setting.">
      {children}
    </SettingsSection>
  );
}

/** The chooser starting from the saved cookie. Request-time, so render inside Suspense. */
export async function SavedThemeChooser() {
  return <ThemeChooser initial={await savedTheme()} />;
}

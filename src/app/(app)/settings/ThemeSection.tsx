import type { ReactNode } from "react";
import { ThemeChooser } from "@/components/ThemeChooser";
import { savedTheme } from "@/lib/savedTheme";
import { ThemeCardFrame } from "./ThemeCardFrame";

/** The Theme card. Static, so it paints at once; the chooser inside streams in. */
export function ThemeCard({ children }: { children: ReactNode }) {
  return <ThemeCardFrame>{children}</ThemeCardFrame>;
}

/** The chooser starting from the saved cookie. Request-time, so render inside Suspense. */
export async function SavedThemeChooser() {
  return <ThemeChooser initial={await savedTheme()} />;
}

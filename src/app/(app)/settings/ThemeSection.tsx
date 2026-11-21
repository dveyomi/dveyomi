import type { ReactNode } from "react";
import { ThemeChooser } from "@/components/ThemeChooser";
import { Card } from "@/components/ui";
import { savedTheme } from "@/lib/savedTheme";

/** The Theme card. Static, so it paints at once; the chooser inside streams in. */
export function ThemeCard({ children }: { children: ReactNode }) {
  return (
    <Card as="section">
      <h2 className="text-body font-semibold text-text">Theme</h2>
      <p className="mt-1 text-body text-muted">Match device follows your phone or computer&apos;s setting.</p>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

/** The chooser starting from the saved cookie. Request-time, so render inside Suspense. */
export async function SavedThemeChooser() {
  return <ThemeChooser initial={await savedTheme()} />;
}

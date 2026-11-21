import { ThemeChooser } from "@/components/ThemeChooser";
import { Card } from "@/components/ui";
import { savedTheme } from "@/lib/savedTheme";

/** The Theme card: Light, Dark or Match device. Reads the cookie, so render inside Suspense. */
export async function ThemeSection() {
  const theme = await savedTheme();
  return (
    <Card as="section">
      <h2 className="text-body font-semibold text-text">Theme</h2>
      <p className="mt-1 text-body text-muted">Match device follows your phone or computer&apos;s setting.</p>
      <div className="mt-4">
        <ThemeChooser initial={theme} />
      </div>
    </Card>
  );
}

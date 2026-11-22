import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Suspense } from "react";
import { localeScript } from "@/i18n/cookies";
import { I18nRoot } from "@/i18n/I18nRoot";
import { getServerI18n } from "@/i18n/server";
import { themeScript } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getServerI18n();
  return { title: "Personal Finance OS", description: m.shell.tagline };
}

/**
 * Draw under the phone's home indicator; the tab bar pads itself with the safe-area inset.
 * The app supports both schemes; tokens.css sets color-scheme for the chosen theme.
 */
export const viewport: Viewport = { viewportFit: "cover", colorScheme: "light dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The inline script sets data-theme before hydration, so React is told not to mind it.
    <html lang="en-GB" className={`${geistSans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Applies the theme cookie before first paint (keeps pages static; see src/lib/theme.ts). */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Sets <html lang> from the locale cookie before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: localeScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-bg font-sans text-text">
        {/* The language and currency come from cookies, so everything below is rendered at request time. */}
        <Suspense fallback={null}>
          <I18nRoot>{children}</I18nRoot>
        </Suspense>
      </body>
    </html>
  );
}

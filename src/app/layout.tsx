import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { themeScript } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Personal Finance OS",
  description: "Know what is safe to spend, every day.",
};

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
      </head>
      <body className="flex min-h-full flex-col bg-bg font-sans text-text">{children}</body>
    </html>
  );
}

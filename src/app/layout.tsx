import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Personal Finance OS",
  description: "Know what is safe to spend, every day.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg font-sans text-text">{children}</body>
    </html>
  );
}

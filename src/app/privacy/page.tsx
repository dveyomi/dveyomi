import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import { focusRing } from "@/components/ui/focus";

export const metadata: Metadata = {
  title: "Privacy · Personal Finance OS",
  description: "What Personal Finance OS stores, where, and who can see it.",
};

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-body font-semibold text-text">{title}</h2>
      {children}
    </section>
  );
}

const text = "text-body text-muted";
const link = `rounded-sm text-accent-fg underline underline-offset-4 ${focusRing}`;

/** The privacy notice, in plain English. Static and open to signed-out visitors. */
export default function PrivacyPage() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-phone flex-col gap-6 px-4 py-10 md:max-w-2xl md:py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-title font-semibold text-text">Privacy</h1>
        <p className={text}>The short version: your money data is yours. Only you can see it, and you can take it or delete it at any time.</p>
      </div>
      <Card className="flex flex-col gap-6 md:p-8">
        <Part title="What we store">
          <ul className={`list-disc pl-5 ${text}`}>
            <li>What Google shares when you sign in with it: your email address, name and profile picture.</li>
            <li>
              The budget and spending details you enter: income, budgets, expenses, savings funds, trips and recurring
              payments.
            </li>
            <li>The expenses you import from bank files (we keep the file&apos;s name, not the file).</li>
            <li>Your home time zone and budget settings, so dates and budgets line up with your days.</li>
          </ul>
        </Part>
        <Part title="Where it's kept">
          <p className={text}>
            In a database run by our database provider, Supabase. It&apos;s sent over an encrypted connection.
            Backups are kept by our database provider in case something goes wrong.
          </p>
        </Part>
        <Part title="Who can see it">
          <p className={text}>
            Only you. The database checks every request against your account (row-level security), so no one else
            signed in to the app can read your data.
          </p>
        </Part>
        <Part title="No selling, no sharing">
          <p className={text}>We don&apos;t sell your data or share it with anyone.</p>
        </Part>
        <Part title="No tracking or ads">
          <p className={text}>
            There are no ads, analytics or tracking. The app sets cookies only to keep you signed in and to remember your
            theme and time zone.
          </p>
        </Part>
        <Part title="Take it with you, or delete it">
          <p className={text}>
            In{" "}
            <Link href="/settings" className={link}>
              Settings
            </Link>
            , Export my data downloads everything you&apos;ve entered, with your account email, as a file. Delete my
            account removes your account and all your data for good.
          </p>
        </Part>
        <Part title="Questions">
          <p className={text}>Contact the person who invited you to the app.</p>
        </Part>
      </Card>
    </main>
  );
}

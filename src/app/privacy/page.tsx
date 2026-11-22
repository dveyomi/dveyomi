import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import { focusRing } from "@/components/ui/focus";
import { getServerI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getServerI18n();
  return { title: m.shell.pageTitle(m.privacy.title), description: m.privacy.metaDescription };
}

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

/** The privacy notice, in plain words. Open to signed-out visitors. */
export default async function PrivacyPage() {
  const { m } = await getServerI18n();
  const p = m.privacy;
  return (
    <main id="main" className="mx-auto flex w-full max-w-phone flex-col gap-6 px-4 py-10 md:max-w-2xl md:py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-title font-semibold text-text">{p.title}</h1>
        <p className={text}>{p.intro}</p>
      </div>
      <Card className="flex flex-col gap-6 md:p-8">
        <Part title={p.storeTitle}>
          <ul className={`list-disc pl-5 ${text}`}>
            <li>{p.storeGoogle}</li>
            <li>{p.storeBudget}</li>
            <li>{p.storeImports}</li>
            <li>{p.storeSettings}</li>
          </ul>
        </Part>
        <Part title={p.whereTitle}>
          <p className={text}>{p.where}</p>
        </Part>
        <Part title={p.whoTitle}>
          <p className={text}>{p.who}</p>
        </Part>
        <Part title={p.sellingTitle}>
          <p className={text}>{p.selling}</p>
        </Part>
        <Part title={p.trackingTitle}>
          <p className={text}>{p.tracking}</p>
        </Part>
        <Part title={p.takeTitle}>
          <p className={text}>
            {p.takeBefore}
            <Link href="/settings" className={link}>
              {p.takeLink}
            </Link>
            {p.takeAfter}
          </p>
        </Part>
        <Part title={p.questionsTitle}>
          <p className={text}>{p.questions}</p>
        </Part>
      </Card>
    </main>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ButtonLink, Card, Skeleton } from "@/components/ui";
import { todayIn } from "@/lib/calc";
import { listFeedback } from "@/lib/data/feedback";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getTimeZone } from "@/lib/today";
import { checkFromPath } from "@/lib/validation/feedback";
import { FeedbackForm } from "./FeedbackForm";
import { FeedbackList } from "./FeedbackList";

export const metadata: Metadata = { title: "Help & feedback · Personal Finance OS" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The form (preset from ?kind= and ?from=) beside, or on a phone above, what you've sent. */
async function FeedbackContent({ searchParams }: { searchParams: SearchParams }) {
  if (!(await getUserId())) redirect("/login");
  const params = await searchParams;
  const kind = params.kind === "idea" ? "idea" : "bug";
  const from = checkFromPath(params.from);
  const [supabase, zone] = await Promise.all([createClient(), getTimeZone()]);
  const sent = (await listFeedback(supabase)).map((f) => ({
    id: f.id,
    kind: f.kind,
    firstLine: f.firstLine,
    status: f.status,
    sentOn: todayIn(zone, new Date(f.createdAt)),
  }));

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3 lg:gap-6">
      <Card className="lg:col-span-2 md:p-6">
        <FeedbackForm initialKind={kind} from={from} />
      </Card>
      <div className="flex flex-col gap-4">
        <Card as="section" className="flex flex-col gap-3">
          <h2 className="text-caption font-semibold text-muted">What you&rsquo;ve sent</h2>
          <FeedbackList items={sent} />
        </Card>
        <Card as="section" className="flex flex-col gap-2">
          <h2 className="text-caption font-semibold text-muted">Good to know</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-body text-text">
            <li>We read every message.</li>
            <li>New means it hasn&rsquo;t been looked at yet, Seen that it has, and Done that it&rsquo;s sorted.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="mx-auto flex w-full max-w-phone flex-col gap-4 px-4 py-6 md:mx-0 md:max-w-none md:p-8">
      <div className="flex flex-col items-start gap-2">
        <ButtonLink href="/settings" variant="ghost" icon="chevron-left">
          Settings
        </ButtonLink>
        <h1 className="text-title font-semibold text-text">Help &amp; feedback</h1>
      </div>
      <Suspense
        fallback={
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3 lg:gap-6">
            <div className="lg:col-span-2">
              <Skeleton shape="card" />
            </div>
            <Skeleton shape="card" />
          </div>
        }
      >
        <FeedbackContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

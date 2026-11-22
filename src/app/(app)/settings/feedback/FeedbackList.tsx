"use client";

import { useI18n } from "@/i18n/client";
import { Badge, type BadgeTone } from "@/components/ui";
import { type IsoDate } from "@/lib/calc";
import type { FeedbackKind, FeedbackStatus } from "@/lib/data/feedback";

export type SentFeedback = { id: string; kind: FeedbackKind; firstLine: string; status: FeedbackStatus; sentOn: IsoDate };


/** triaged reads as "Seen": someone has looked at it and filed it. Only Done gets a colour. */
const TONE: Record<FeedbackStatus, BadgeTone> = { new: "neutral", triaged: "neutral", done: "positive" };

/** "What you've sent": newest first (as given), each with its kind, first line, date and status. */
export function FeedbackList({ items }: { items: SentFeedback[] }) {
  const { m, fmt } = useI18n();
  if (items.length === 0) return <p className="text-body text-muted">{m.feedback.nothingSent}</p>;
  return (
    <ul className="flex flex-col divide-y divide-border">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-caption font-semibold text-muted">{m.feedback.kinds[item.kind]}</span>
            <span className="line-clamp-2 break-words text-body text-text">{item.firstLine}</span>
            <span className="text-caption text-muted">{fmt.dayMonthYear(item.sentOn)}</span>
          </div>
          <Badge tone={TONE[item.status]}>{m.feedback.statuses[item.status]}</Badge>
        </li>
      ))}
    </ul>
  );
}

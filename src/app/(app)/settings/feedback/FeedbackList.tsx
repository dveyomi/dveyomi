import { Badge, type BadgeTone } from "@/components/ui";
import { formatDayMonthYear, type IsoDate } from "@/lib/calc";
import type { FeedbackKind, FeedbackStatus } from "@/lib/data/feedback";

export type SentFeedback = { id: string; kind: FeedbackKind; firstLine: string; status: FeedbackStatus; sentOn: IsoDate };

const KIND_LABEL: Record<FeedbackKind, string> = { bug: "Bug", idea: "Idea" };

/** triaged reads as "Seen": someone has looked at it and filed it. */
const STATUS: Record<FeedbackStatus, { label: string; tone: BadgeTone }> = {
  new: { label: "New", tone: "neutral" },
  triaged: { label: "Seen", tone: "warning" },
  done: { label: "Done", tone: "positive" },
};

/** "What you've sent": newest first (as given), each with its kind, first line, date and status. */
export function FeedbackList({ items }: { items: SentFeedback[] }) {
  if (items.length === 0) return <p className="text-body text-muted">Nothing sent yet.</p>;
  return (
    <ul className="flex flex-col divide-y divide-border">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-caption font-semibold text-muted">{KIND_LABEL[item.kind]}</span>
            <span className="line-clamp-2 break-words text-body text-text">{item.firstLine}</span>
            <span className="text-caption text-muted">{formatDayMonthYear(item.sentOn)}</span>
          </div>
          <Badge tone={STATUS[item.status].tone}>{STATUS[item.status].label}</Badge>
        </li>
      ))}
    </ul>
  );
}

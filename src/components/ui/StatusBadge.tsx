import type { BudgetSummary } from "@/lib/calc";
import { Badge, type BadgeTone } from "./Badge";

const statuses: Record<BudgetSummary["status"], { label: string; tone: BadgeTone }> = {
  on_track: { label: "On Track", tone: "positive" },
  spending_fast: { label: "Spending Fast", tone: "warning" },
  out_of_budget: { label: "Out of Budget", tone: "danger" },
};

export function StatusBadge({ status }: { status: BudgetSummary["status"] }) {
  const { label, tone } = statuses[status];
  return <Badge tone={tone}>{label}</Badge>;
}

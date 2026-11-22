"use client";

import { useI18n } from "@/i18n/client";
import type { BudgetSummary } from "@/lib/calc";
import { Badge, type BadgeTone } from "./Badge";

const tones: Record<BudgetSummary["status"], BadgeTone> = {
  on_track: "positive",
  spending_fast: "warning",
  out_of_budget: "danger",
};

export function StatusBadge({ status }: { status: BudgetSummary["status"] }) {
  const { m } = useI18n();
  return <Badge tone={tones[status]}>{m.ui.status[status]}</Badge>;
}

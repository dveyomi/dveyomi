/** Clamp a percentage into 0–100 for drawing; "over" always draws full. */
export function drawnPercent(percent: number, state: "normal" | "over"): number {
  if (state === "over") return 100;
  if (!Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, Math.round(percent)));
}

import type { ReactNode } from "react";
import { formatGBP } from "@/lib/calc";

/** Categorical series slots in fixed order (tokens --chart-1…5), plus the neutral "other". */
export type Series = 1 | 2 | 3 | 4 | 5 | "other";

export type DonutSlice = {
  key: string;
  label: string;
  pence: number;
  /** Whole-percent share, as worked out in src/lib/calc. */
  percent: number;
  series: Series;
};

const strokes: Record<Series, string> = {
  1: "stroke-chart-1",
  2: "stroke-chart-2",
  3: "stroke-chart-3",
  4: "stroke-chart-4",
  5: "stroke-chart-5",
  other: "stroke-chart-other",
};
const fills: Record<Series, string> = {
  1: "bg-chart-1",
  2: "bg-chart-2",
  3: "bg-chart-3",
  4: "bg-chart-4",
  5: "bg-chart-5",
  other: "bg-chart-other",
};

/** Gap between touching slices, in hundredths of the ring (about 2px at the drawn size). */
const GAP = 0.8;

type DonutProps = {
  /** Names the chart and its table alternative, e.g. "Spending by category". */
  label: string;
  /** Largest first; each slice takes its own series slot. */
  slices: DonutSlice[];
  /** The headline in the hole, e.g. the total. */
  children?: ReactNode;
};

/**
 * A part-to-whole ring for a few categories (fold the tail into "other"
 * first). The drawing is decorative for assistive tech: a visually hidden
 * table carries every slice's name, amount and share, and screens pair it
 * with a visible legend (SeriesSwatch rows) so colour is never the only cue.
 */
export function Donut({ label, slices, children }: DonutProps) {
  const total = slices.reduce((sum, s) => sum + s.pence, 0);
  const gap = slices.length > 1 ? GAP : 0;
  let start = 0;

  return (
    <figure className="relative mx-auto aspect-square w-full max-w-56">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
        <circle cx={50} cy={50} r={40} fill="none" strokeWidth={12} className="stroke-card-raised" />
        {total > 0
          ? slices.map((s) => {
              const share = (s.pence / total) * 100;
              const drawn = Math.max(share - gap, 0.3);
              const offset = -start;
              start += share;
              return (
                <circle
                  key={s.key}
                  data-slice={s.key}
                  cx={50}
                  cy={50}
                  r={40}
                  fill="none"
                  strokeWidth={12}
                  pathLength={100}
                  strokeDasharray={`${drawn} ${100 - drawn}`}
                  strokeDashoffset={offset}
                  className={strokes[s.series]}
                >
                  <title>{`${s.label}: ${formatGBP(s.pence)} (${s.percent}%)`}</title>
                </circle>
              );
            })
          : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-center">{children}</div>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Amount</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {slices.map((s) => (
            <tr key={s.key}>
              <th scope="row">{s.label}</th>
              <td>{formatGBP(s.pence)}</td>
              <td>{s.percent}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** The colour key for one slice, beside its name in a legend or list row. */
export function SeriesSwatch({ series }: { series: Series }) {
  return <span aria-hidden="true" className={`inline-block size-3 shrink-0 rounded-pill ${fills[series]}`} />;
}

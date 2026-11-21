const shapes = {
  /** The height of RadioSegments or SegmentedTabs. */
  segments: "h-13.5 rounded-pill",
  /** A short Card (heading, a line, a button). */
  card: "h-36 rounded-md",
} as const;

/** A quiet placeholder while request-time content streams in. Hidden from assistive tech. */
export function Skeleton({ shape }: { shape: keyof typeof shapes }) {
  return <div aria-hidden="true" className={`w-full bg-card-raised motion-safe:animate-pulse ${shapes[shape]}`} />;
}

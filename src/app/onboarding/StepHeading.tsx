/**
 * A wizard step's title. The wizard moves focus here when the step changes,
 * so screen readers announce the new step.
 */
export function StepHeading({ title, body }: { title: string; body?: string }) {
  return (
    <header className="flex flex-col gap-2">
      <h1 id="step-heading" tabIndex={-1} className="text-title font-semibold text-balance text-text outline-none md:text-display">
        {title}
      </h1>
      {body ? <p className="text-body text-muted">{body}</p> : null}
    </header>
  );
}

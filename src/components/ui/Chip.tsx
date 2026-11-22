import { focusRing } from "./focus";

type ChipProps = {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
};

/** A compact toggleable filter or choice, e.g. a category in a picker. */
export function Chip({ label, selected = false, onClick, disabled }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 items-center rounded-pill border px-4 text-caption font-semibold transition-colors disabled:opacity-40 ${focusRing} ${selected ? "border-accent-fg bg-accent text-accent-ink" : "border-border-strong bg-card text-text hover:bg-card-raised"}`}
    >
      {label}
    </button>
  );
}

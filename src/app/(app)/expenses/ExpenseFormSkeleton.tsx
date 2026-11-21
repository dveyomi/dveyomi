import { Skeleton } from "@/components/ui";

/** Holds the expense form's place (same panel as the form) while it streams in. */
export function ExpenseFormSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-phone flex-col gap-6 px-4 py-4 md:my-10 md:max-w-xl md:rounded-md md:bg-card md:p-8 md:shadow-float">
      <Skeleton shape="segments" />
      <Skeleton shape="card" />
      <Skeleton shape="card" />
    </div>
  );
}

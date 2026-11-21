import { Card, EmptyState } from "@/components/ui";

/** Placeholder home until the app shell lands. */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-4">
      <Card>
        <EmptyState
          icon="wallet"
          title="Personal Finance OS"
          body="Your budget, spending and savings will live here."
        />
      </Card>
    </main>
  );
}

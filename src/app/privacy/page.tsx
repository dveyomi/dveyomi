import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy · Personal Finance OS" };

/** Stub: the privacy page is written in a later task. Open to signed-out visitors. */
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-phone flex-col gap-4 px-4 py-10 md:max-w-md">
      <h1 className="text-title font-semibold text-text">Privacy</h1>
      <p className="text-body text-muted">Our privacy notice is on its way.</p>
    </main>
  );
}

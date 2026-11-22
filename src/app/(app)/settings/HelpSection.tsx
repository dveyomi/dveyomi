"use client";

import { useI18n } from "@/i18n/client";
import { ListRow } from "@/components/ui";
import { SettingsSection } from "./SettingsSection";

/** Settings → Help & feedback: report a bug or share an idea (the form, with what you've sent). */
export function HelpSection() {
  const f = useI18n().m.feedback;
  return (
    <SettingsSection title={f.title} description={f.description}>
      <div className="-mx-2">
        <ListRow href="/settings/feedback?kind=bug" icon="bug" title={f.reportBug} subtitle={f.reportBugSubtitle} />
        <ListRow href="/settings/feedback?kind=idea" icon="idea" title={f.shareIdea} subtitle={f.shareIdeaSubtitle} />
      </div>
    </SettingsSection>
  );
}

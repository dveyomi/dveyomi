import { ListRow } from "@/components/ui";
import { SettingsSection } from "./SettingsSection";

/** Settings → Help & feedback: report a bug or share an idea (the form, with what you've sent). */
export function HelpSection() {
  return (
    <SettingsSection title="Help & feedback" description="Something not right, or an idea to make it better? Tell us.">
      <div className="-mx-2">
        <ListRow href="/settings/feedback?kind=bug" icon="bug" title="Report a bug" subtitle="Something isn't working" />
        <ListRow href="/settings/feedback?kind=idea" icon="idea" title="Share an idea" subtitle="Something you'd like to see" />
      </div>
    </SettingsSection>
  );
}

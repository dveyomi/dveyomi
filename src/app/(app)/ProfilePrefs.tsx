import { getProfile } from "@/lib/supabase/server";
import { PrefsSync } from "./PrefsSync";

/** Renders PrefsSync with the signed-in user's saved language and currency (the profile read is shared per request). */
export async function ProfilePrefs() {
  const profile = await getProfile();
  return profile ? <PrefsSync language={profile.language} currency={profile.currency} /> : null;
}

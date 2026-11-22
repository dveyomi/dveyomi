import { checkFromPath } from "@/lib/validation/feedback";

/** sessionStorage key for the last in-app page outside Settings (for "the page you came from"). */
const KEY = "lastPage";

/**
 * Remembers `pathname` as the page the user was on, unless it's under
 * Settings (where Help & feedback lives). Per tab, cleared when it closes.
 * Storage that's blocked or full is ignored.
 */
export function rememberPage(pathname: string): void {
  if (pathname === "/settings" || pathname.startsWith("/settings/")) return;
  try {
    sessionStorage.setItem(KEY, pathname);
  } catch {
    // Private mode or blocked storage: there's just no page to report.
  }
}

/** The last page outside Settings, as a safe in-app path (no query), or null. */
export function lastPage(): string | null {
  try {
    return checkFromPath(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}

import { createHash, timingSafeEqual } from "node:crypto";
import { generateDue } from "@/lib/data/recurring";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_TIMEZONE, isTimeZone } from "@/lib/timezone";

/** Profiles read per page (under PostgREST's 1000-row cap). */
const PAGE = 500;

/** Whether `header` is exactly `Bearer <secret>`, compared in constant time. */
function authorised(header: string | null, secret: string): boolean {
  if (!secret || !header) return false;
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

/**
 * The hourly recurring-payments run (pg_cron → pg_net, migration 0007). It
 * must carry `Authorization: Bearer <CRON_SECRET>`; it then adds every
 * user's due payments, each in their profile's time zone, with the service
 * role. Public in the proxy (no session); the secret is the only way in.
 */
export async function POST(request: Request): Promise<Response> {
  if (!authorised(request.headers.get("authorization"), process.env.CRON_SECRET ?? "")) {
    return Response.json({ error: "unauthorised" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  let users = 0;
  let added = 0;
  let failed = 0;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, timezone")
      .order("user_id")
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("cron/recurring: couldn't read profiles", error);
      return Response.json({ error: "profiles" }, { status: 500 });
    }
    for (const p of data) {
      users++;
      try {
        added += await generateDue(supabase, p.user_id, isTimeZone(p.timezone) ? p.timezone : DEFAULT_TIMEZONE, now);
      } catch (e) {
        failed++;
        console.error("cron/recurring: generateDue failed", p.user_id, e);
      }
    }
    if (data.length < PAGE) break;
  }
  return Response.json({ users, added, failed });
}

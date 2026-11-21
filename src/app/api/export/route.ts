import { exportUserData } from "@/lib/data/account";
import { createClient, getClaims } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";

const noStore = { "Cache-Control": "no-store" };

/**
 * "Export my data": every row the signed-in user has, from every table, as a
 * JSON download. Reads with the user's own client, so RLS is what limits it
 * to their rows; the service role is never used here.
 */
export async function GET(): Promise<Response> {
  const claims = await getClaims();
  if (!claims?.sub) return Response.json({ error: "Sign in to export your data." }, { status: 401, headers: noStore });
  try {
    const [tables, today] = await Promise.all([exportUserData(await createClient()), getToday()]);
    const body = JSON.stringify(
      {
        app: "Personal Finance OS",
        exportedOn: today,
        exportedAt: new Date().toISOString(),
        account: { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null },
        tables,
      },
      null,
      2,
    );
    return new Response(body, {
      headers: {
        ...noStore,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="personal-finance-export-${today}.json"`,
      },
    });
  } catch (e) {
    console.error("export failed", e);
    return Response.json({ error: "We couldn't export your data. Try again in a moment." }, { status: 500, headers: noStore });
  }
}

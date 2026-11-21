import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPublic } from "@/lib/publicPaths";

/**
 * Refreshes the Supabase session on every request and sends signed-out
 * visitors to /login. Server code still verifies the user itself.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims(): it refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims.sub);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string, next?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = next ? `?next=${encodeURIComponent(next)}` : "";
    const redirect = NextResponse.redirect(url);
    // Keep any refreshed session cookies.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  if (!signedIn && !isPublic(pathname)) {
    return redirectTo("/login", pathname === "/" ? undefined : `${pathname}${search}`);
  }
  if (signedIn && pathname === "/login") return redirectTo("/budget");

  return response;
}

export const config = {
  // Everything except Next's build assets and the favicon. There is no public/
  // folder; if one is added, list its files here by name rather than bypassing
  // any path that merely ends in an image extension.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico$).*)"],
};

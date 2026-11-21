/** Paths a signed-out visitor may open: sign-in, the auth round trip and the privacy notice. */
export function isPublic(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/privacy" ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/")
  );
}

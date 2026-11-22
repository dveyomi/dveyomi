"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { rememberPage } from "@/lib/lastPage";

/** Remembers each page the user moves to, so a bug report can say where they came from. Renders nothing. */
export function PageMemory() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname) rememberPage(pathname);
  }, [pathname]);
  return null;
}

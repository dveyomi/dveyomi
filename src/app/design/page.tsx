import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ThemeChooser } from "@/components/ThemeChooser";
import { savedTheme } from "@/lib/savedTheme";
import { DesignGallery } from "./DesignGallery";

export const metadata: Metadata = { title: "Design system · Personal Finance OS" };

async function GalleryThemeSwitch() {
  return <ThemeChooser initial={await savedTheme()} />;
}

/** Living gallery of every token and component. Development only. */
export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <DesignGallery
      themeSwitch={
        <Suspense fallback={null}>
          <GalleryThemeSwitch />
        </Suspense>
      }
    />
  );
}

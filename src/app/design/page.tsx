import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DesignGallery } from "./DesignGallery";

export const metadata: Metadata = { title: "Design system · Personal Finance OS" };

/** Living gallery of every token and component. Development only. */
export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignGallery />;
}

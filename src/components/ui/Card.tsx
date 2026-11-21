import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  /** Raised cards sit on top of another card (e.g. a stat inside a panel). */
  raised?: boolean;
  as?: "div" | "section" | "article";
  /** Layout only (spacing, grid placement). */
  className?: string;
};

export function Card({ children, raised = false, as: Tag = "div", className = "" }: CardProps) {
  return (
    <Tag className={`rounded-md p-4 ${raised ? "bg-card-raised" : "bg-card"} ${className}`}>
      {children}
    </Tag>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui";
import { focusRing } from "@/components/ui/focus";

const ADD_HREF = "/expenses/new";

const tabs: { href: string; label: string; icon: IconName; order: string }[] = [
  { href: "/expenses", label: "Expenses", icon: "wallet", order: "order-1 md:order-none" },
  { href: "/budget", label: "Budget", icon: "chart", order: "order-2 md:order-none" },
  // order-4: the + sits between Budget and Settings on a phone.
  { href: "/settings", label: "Settings", icon: "settings", order: "order-4 flex-2 md:order-none md:flex-none" },
];

function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Main navigation. Under 768px: a bottom tab bar with a raised + in the
 * middle. From 768px: a left rail with "Add expense" as its first action.
 */
export function Nav() {
  const pathname = usePathname();
  const adding = pathname === ADD_HREF;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:inset-y-0 md:right-auto md:flex md:w-60 md:flex-col md:gap-8 md:border-t-0 md:border-r md:px-4 md:py-6"
    >
      <p translate="no" className="hidden px-3 text-body font-semibold text-text md:block">Personal Finance OS</p>
      <ul className="flex items-center md:flex-col md:items-stretch md:gap-1">
        {/* First in the DOM, so keyboard order matches the rail. On a phone, CSS order puts it in the middle. */}
        <li className="order-3 flex justify-center px-2 md:order-none md:mb-4 md:px-0">
          <Link
            href={ADD_HREF}
            aria-current={adding ? "page" : undefined}
            className={`-mt-6 flex size-14 items-center justify-center gap-2 rounded-pill bg-accent font-semibold text-accent-ink shadow-sheet ring-4 ring-bg transition-colors hover:bg-accent/90 md:mt-0 md:h-11 md:w-full md:shadow-none md:ring-0 ${focusRing}`}
          >
            <Icon name="plus" size="lg" />
            <span className="sr-only md:not-sr-only">Add expense</span>
          </Link>
        </li>
        {tabs.map((tab) => {
          const current = !adding && isCurrent(pathname, tab.href);
          return (
            <li key={tab.href} className={`flex-1 ${tab.order}`}>
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 text-caption font-medium transition-colors md:min-h-11 md:flex-row md:justify-start md:gap-3 md:rounded-pill md:px-3 md:text-body ${focusRing} ${
                  current ? "text-accent md:bg-card-raised" : "text-muted hover:text-text"
                }`}
              >
                <Icon name={tab.icon} />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

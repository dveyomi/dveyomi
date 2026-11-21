"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui";
import { focusRing } from "@/components/ui/focus";

const ADD_HREF = "/expenses/new";

const tabs: { href: string; label: string; icon: IconName }[] = [
  { href: "/expenses", label: "Expenses", icon: "pie" },
  { href: "/budget", label: "Budget", icon: "gauge" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

/**
 * Focused screens with their own close: the add/edit expense form
 * (/expenses/new, /expenses/<uuid>) and the period-end review (/review).
 * Other /expenses/* pages keep the nav.
 */
const FOCUSED = /^\/(?:expenses\/(?:new|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})|review)$/i;

function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Main navigation, in one DOM order for every width: Expenses, Budget,
 * Settings, then +. Under 768px it floats above the bottom edge as a pill of
 * three tabs with a round + beside it. From 768px it is a left rail with
 * "Add expense" under the tabs. On a focused screen (the expense form at
 * /expenses/new and /expenses/[id], and /review) the phone pill and + are hidden: it has its own close
 * and save. The desktop rail stays.
 */
export function Nav() {
  return <NavBar pathname={usePathname()} />;
}

/**
 * The navigation for a known pathname. With `null` (the Suspense fallback while
 * a route with an unknown dynamic param prerenders) no link is marked current.
 */
export function NavBar({ pathname }: { pathname: string | null }) {
  const adding = pathname === ADD_HREF;
  const onForm = pathname !== null && FOCUSED.test(pathname);

  return (
    <nav
      aria-label="Main"
      className={`fixed inset-x-4 bottom-safe z-30 ${onForm ? "hidden md:flex" : "flex"} items-stretch gap-3 md:inset-x-auto md:top-0 md:bottom-0 md:left-0 md:w-60 md:flex-col md:justify-start md:gap-6 md:border-r md:border-border md:bg-card md:px-4 md:py-6`}
    >
      <p translate="no" className="hidden px-3 text-body font-semibold text-text md:block">
        Personal Finance OS
      </p>
      <ul className="flex flex-1 items-stretch rounded-pill border border-border bg-card-raised p-1 shadow-float md:flex-none md:flex-col md:gap-1 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        {tabs.map((tab) => {
          const current = pathname !== null && !adding && isCurrent(pathname, tab.href);
          return (
            <li key={tab.href} className="flex flex-1 md:flex-none">
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-pill text-caption font-semibold transition-colors md:min-h-11 md:flex-row md:justify-start md:gap-3 md:px-3 md:text-body ${focusRing} ${
                  current ? "bg-bg text-accent-fg md:bg-card-raised" : "text-text hover:bg-card md:hover:bg-card-raised"
                }`}
              >
                <Icon name={tab.icon} size="lg" />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link
        href={ADD_HREF}
        aria-current={adding ? "page" : undefined}
        className={`flex size-16.5 shrink-0 items-center justify-center gap-2 self-center rounded-pill border border-border font-semibold text-accent-fg shadow-float transition-colors md:h-11 md:w-full md:border-0 md:bg-accent md:text-accent-ink md:shadow-none md:hover:bg-accent/90 ${focusRing} ${
          adding ? "bg-bg" : "bg-card-raised hover:bg-card"
        }`}
      >
        {/* size-16.5 = the pill's height: min-h-14 tab + p-1 either side + border. */}
        <Icon name="plus" size="lg" />
        <span className="sr-only md:not-sr-only">Add expense</span>
      </Link>
    </nav>
  );
}

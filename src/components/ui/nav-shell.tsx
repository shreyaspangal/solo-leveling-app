"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { signOut } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { navIndicatorTransition } from "@/lib/motion";
import { cn } from "@/lib/utils";

// ADR-007: only routes that actually exist. Spirituality/Finance/
// Fitness/Learning are omitted entirely (not shown disabled) -- those
// domains don't exist yet, matching CLAUDE.md's Phase 2 sequencing.
// /quests itself is a dead redirect since Slice 4's dashboard merge, so
// there's no separate "Quests" destination -- Home covers it.
const NAV_ITEMS = [
  { href: "/dashboard", label: "Home" },
  { href: "/quests/new", label: "Create Quest" },
];

export function NavShell() {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  return (
    <nav className="flex w-full items-center justify-between gap-1 border-b border-border px-4 py-2">
      <div className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                // Audit finding U19: 32px (px-3 py-1.5) passed WCAG's 24px
                // minimum but read below Apple/Android's 44px mobile
                // guidance for a tracker meant to be tapped daily. flex +
                // min-h-11 gets there without changing the visible pill size.
                "relative flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  aria-hidden
                  layoutId="nav-active-indicator"
                  layout={!shouldReduceMotion}
                  className="absolute inset-0 -z-10 rounded-lg bg-primary/10"
                  transition={navIndicatorTransition}
                />
              )}
              {item.label}
            </Link>
          );
        })}
      </div>
      <form action={signOut}>
        {/* h-11 override, not the "sm" size variant (U19) -- shadcn's size
            scale tops out at h-9 ("lg"), short of the 44px mobile-tap
            guidance this app's own hand-built buttons already target
            elsewhere (e.g. the auth-flow submit buttons). */}
        <Button type="submit" variant="ghost" className="h-11">
          Sign out
        </Button>
      </form>
    </nav>
  );
}

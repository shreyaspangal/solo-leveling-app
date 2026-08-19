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
                "relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
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
        <Button type="submit" variant="ghost" size="sm">
          Sign out
        </Button>
      </form>
    </nav>
  );
}

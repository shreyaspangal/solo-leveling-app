"use client";

import { Dumbbell, GraduationCap, Home, Sparkles, Swords, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { navIndicatorTransition } from "@/lib/motion";
import { cn } from "@/lib/utils";

// Audit finding U30: icon *components* can't be prop values crossing the
// Server->Client boundary (functions aren't serializable -- the same class
// of RSC violation as U16, this time a 500 on every authenticated route
// instead of a type/lint/test failure, since none of tsc/eslint/vitest/build
// exercise a real request across this boundary). The icon identities have to
// originate inside this client module -- `NavItem.icon` is a string key into
// this map, not a component reference, so nav-shell.tsx (a Server Component)
// can only ever pass serializable data here.
const ICONS = {
  home: Home,
  spirituality: Sparkles,
  finance: Wallet,
  fitness: Dumbbell,
  learning: GraduationCap,
  quests: Swords,
} as const;

export interface NavItem {
  key: string;
  label: string;
  short: string;
  icon: keyof typeof ICONS;
  // null = not built yet (Spirituality/Finance/Fitness/Learning) --
  // rendered as a disabled "coming soon" tile, not a Link. Owner decision
  // 2026-08-20: disabled coming-soon tiles are a standard pattern, superseding
  // ADR-007's original "omit rather than show disabled" nav bullet.
  href: string | null;
}

// Two independent `layoutId`s (one per variant) rather than one shared
// across both -- only one of <aside>/<nav> is ever `display` at a given
// viewport, and a shared id would try to animate the indicator across the
// hidden instance on resize.
const RAIL_INDICATOR = "nav-rail-indicator";
const BOTTOM_INDICATOR = "nav-bottom-indicator";

export function NavLinks({
  items,
  variant,
}: {
  items: NavItem[];
  variant: "rail" | "bottom";
}) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const layoutId = variant === "rail" ? RAIL_INDICATOR : BOTTOM_INDICATOR;

  return (
    <ul
      className={cn(
        variant === "rail"
          ? "flex flex-col gap-0.5 py-2"
          : "flex w-full items-stretch justify-around"
      )}
    >
      {items.map((item) => {
        const Icon = ICONS[item.icon];

        if (item.href === null) {
          return (
            <li key={item.key} className={variant === "bottom" ? "flex-1" : undefined}>
              {/* Audit finding U30 (part 2): `aria-disabled` on a plain <div>
                  with no widget role is generally not announced -- it only
                  means something on an element AT already has a reason to
                  treat as interactive. `role="link"` gives it that role so
                  the disabled state is actually communicated, and the
                  dimmed color is backed by a real (visually-hidden on the
                  bottom bar, visible "Soon" badge on the rail) text signal
                  rather than color alone (WCAG 2.2 SC 1.4.1). */}
              <div
                role="link"
                aria-disabled="true"
                className={cn(
                  "flex select-none items-center gap-3 text-muted-foreground/50",
                  variant === "rail"
                    ? "min-h-11 border-l-2 border-transparent px-3.5 py-2"
                    : "min-h-11 flex-col justify-center gap-0.5 px-1 py-1.5"
                )}
              >
                <Icon size={variant === "rail" ? 17 : 19} className="shrink-0" />
                <span
                  className={cn(
                    "truncate font-heading uppercase",
                    variant === "rail" ? "text-[13px] tracking-[1px]" : "text-[9px] tracking-[.5px]"
                  )}
                >
                  {variant === "rail" ? item.label : item.short}
                </span>
                {/* Rail: visible "Soon" badge. Bottom bar: no room at 9px
                    text for a legible second label, so a visually-hidden
                    span carries the same information instead of dropping it. */}
                {variant === "rail" ? (
                  <Badge
                    variant="outline"
                    className="ml-auto shrink-0 border-muted-foreground/30 text-[9px] tracking-wide text-muted-foreground/70"
                  >
                    Soon
                  </Badge>
                ) : (
                  <span className="sr-only">, coming soon</span>
                )}
              </div>
            </li>
          );
        }

        const active = pathname === item.href;

        return (
          <li key={item.key} className={variant === "bottom" ? "flex-1" : undefined}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 font-heading uppercase transition-colors",
                variant === "rail"
                  ? "min-h-11 border-l-2 px-3.5 py-2 text-[13px] tracking-[1px]"
                  : "min-h-11 flex-col justify-center gap-0.5 px-1 py-1.5 text-[9px] tracking-[.5px]",
                active
                  ? cn(variant === "rail" && "border-primary", "text-foreground")
                  : cn(variant === "rail" && "border-transparent", "text-muted-foreground hover:text-foreground")
              )}
            >
              {active && (
                <motion.span
                  aria-hidden
                  layoutId={layoutId}
                  layout={!shouldReduceMotion}
                  className={cn(
                    "absolute -z-10",
                    variant === "rail"
                      ? "inset-0 bg-gradient-to-r from-primary/15 to-transparent"
                      : "inset-x-3 bottom-0.5 h-0.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]"
                  )}
                  transition={navIndicatorTransition}
                />
              )}
              <Icon size={variant === "rail" ? 17 : 19} className="shrink-0" />
              <span className="truncate">{variant === "rail" ? item.label : item.short}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

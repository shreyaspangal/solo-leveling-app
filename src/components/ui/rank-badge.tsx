"use client";

import { motion, useReducedMotion } from "motion/react";
import { rankUpAnimate, rankUpEnter, rankUpSpring } from "@/lib/motion";
import type { Rank } from "@/lib/rank-engine/types";
import { cn } from "@/lib/utils";

const RANK_ORDER: Rank[] = ["E", "D", "C", "B", "A", "S"];

export function RankBadge({
  rankTarget,
  justRankedUp = false,
  className,
}: {
  // Takes the RankWindow's target, not a "current rank" prop -- there is no
  // separately-tracked current rank anywhere in the app yet (rank_target is
  // set once at setup and never advances; full promotion mechanics are
  // explicitly undecided, ADR-002 addendum / CLAUDE.md's "not decided yet"
  // list). Current rank is derived here, one step behind the target in the
  // fixed E-D-C-B-A-S sequence -- kept inside this client component rather
  // than a separately exported function, deliberately: a prior version
  // exported it from this "use client" module and a Server Component
  // called it directly, which Next.js runs as a real RSC boundary
  // violation (500 on every page that had a RankWindow), not a lint/type
  // error either tool surfaces. Keeping the derivation un-exported removes
  // the ability to make that mistake again, not just this instance of it.
  rankTarget: Rank;
  // No caller passes true yet -- there's no rank-promotion event to detect
  // (see above). The reveal is built and ready; wiring a real trigger is
  // future work once promotion mechanics exist. Until then this always
  // renders in its resting state, matching ADR-007's cut of every other
  // "animate on ordinary page load" case.
  justRankedUp?: boolean;
  className?: string;
}) {
  const rank = RANK_ORDER[Math.max(0, RANK_ORDER.indexOf(rankTarget) - 1)];
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={justRankedUp && !shouldReduceMotion ? rankUpEnter : false}
      animate={rankUpAnimate}
      transition={rankUpSpring}
      className={cn("relative flex size-16 shrink-0 items-center justify-center", className)}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
        <polygon
          points="50,3 93,26 93,74 50,97 7,74 7,26"
          className="fill-card stroke-primary"
          strokeWidth={2}
        />
      </svg>
      <span
        className="relative font-heading text-2xl font-bold text-primary [text-shadow:0_0_12px_var(--primary)]"
        aria-label={`Rank ${rank}`}
      >
        {rank}
      </span>
    </motion.div>
  );
}

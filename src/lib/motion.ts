// Named Motion for React presets (ADR-007) -- treats easing/duration as
// documented tokens rather than inline magic numbers per component, per
// the vessa.design takeaway recorded in the ADR. Only two components in
// this app actually use these (RankBadge's rank-up reveal, NavShell's
// active-route indicator) -- everything else stays CSS-only per
// `pick-ui-library`'s own interception rule against reaching for Motion
// on a plain hover/fade.

// Nav active-route indicator (layoutId) -- an on-screen element moving,
// not entering/exiting, so ease-in-out per the animate skill's blueprint.
export const navIndicatorTransition = { duration: 0.18, ease: "easeInOut" } as const;

// Rank-up badge reveal -- rare (weeks/months apart), delight-worthy, spring
// with bounce: 0 per the project owner's "crisp and serious" choice, not
// the playful alternative.
export const rankUpSpring = { type: "spring", duration: 0.45, bounce: 0 } as const;
export const rankUpEnter = { opacity: 0, scale: 0.9 } as const;
export const rankUpAnimate = { opacity: 1, scale: 1 } as const;

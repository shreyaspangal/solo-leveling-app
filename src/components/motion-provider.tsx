"use client";

import { MotionConfig } from "motion/react";

// App-wide reduced-motion baseline (ADR-007) -- MotionConfig itself needs
// "use client", but `children` is passed through from the Server Component
// root layout rather than created here, so this doesn't push the rest of
// the tree to the client boundary. Per-component `useReducedMotion()`
// branches sit on top of this for the two components that need more than
// the opacity/backgroundColor-only default.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

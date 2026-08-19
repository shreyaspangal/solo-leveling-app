import { cn } from "@/lib/utils";

// Deliberately a plain Server Component, not shadcn's Radix-based Progress
// primitive -- ADR-007 decided the progress bar renders its final value
// immediately (no client-side entrance animation; a server-rendered
// dashboard "animating itself becoming true" on every visit fabricates a
// transition that never happened). Radix's Progress.Root also ships a
// `transition: all` on its indicator, which `pick-ui-library` flags as an
// anti-pattern regardless. `role="progressbar"` + the aria-value* triad
// keep the accessibility semantics Radix would otherwise provide, without
// the client-component cost.
export function Progress({
  value,
  label,
  className,
}: {
  value: number;
  // Audit finding U12: role="progressbar" plus the aria-value* triad alone
  // announce "progress bar, 2" with no indication of what's 2% complete --
  // required, not optional, so a screen-reader-only label is always paired
  // with the number.
  label: string;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}

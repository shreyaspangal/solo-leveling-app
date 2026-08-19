// ADR-006: each user's "today" is computed in their own IANA timezone, not
// UTC. This is the one place real wall-clock time enters the app --
// deliberately NOT part of rank-engine/date-utils.ts, which stays pure
// arithmetic on already-known date strings, UTC-anchored so day math never
// shifts by the host machine's timezone (a correct, unrelated concern).
const FALLBACK_TIMEZONE = "UTC";

// Shared read of the value TimezoneSync writes (src/app/timezone-sync.tsx),
// so every server-side "what is today" call site reads it the same way
// rather than repeating `user.user_metadata?.timezone` inline.
export function userTimezone(user: { user_metadata?: Record<string, unknown> } | null): string | undefined {
  const timezone = user?.user_metadata?.timezone;
  return typeof timezone === "string" ? timezone : undefined;
}

export function todayInTimezone(timeZone: string | undefined, now: Date = new Date()): string {
  try {
    // en-CA formats as YYYY-MM-DD, a convenient built-in match for this
    // app's date format -- no date-formatting library needed.
    return new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || FALLBACK_TIMEZONE }).format(
      now,
    );
  } catch {
    // Invalid/corrupted stored timezone (Intl.DateTimeFormat throws a
    // RangeError on an unrecognized IANA identifier) -- fall back rather
    // than let a bad stored value break every date computation downstream.
    return new Intl.DateTimeFormat("en-CA", { timeZone: FALLBACK_TIMEZONE }).format(now);
  }
}

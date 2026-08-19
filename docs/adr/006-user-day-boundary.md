# ADR-006: User Day Boundary (Per-User Timezone)

**Status:** Proposed
**Context:** Builds on ADR-002 (the rank/streak/pause engine consumes date strings as input — it
never decided what "today" means, deliberately, since it's meant to be pure and DB-agnostic) and
ADR-003 (auth). Triggered by Phase 1 audit finding P1-1: the app derived "today" from
`toISOString()`, i.e. the UTC calendar day, everywhere — with no timezone handling anywhere in
`src/`.

## The problem

A user reads dates on their own clock. The app was computing "today" on the server's clock,
normalized to UTC. Measured where the UTC day boundary actually lands on each user's local clock:

| Timezone | app's day flips at local |
|---|---|
| Pacific/Auckland | 12:00 (noon) |
| Asia/Kolkata | 05:30 |
| Europe/London | 01:00 |
| America/New_York | 20:00 (previous evening) |
| America/Los_Angeles | 17:00 (previous evening) |

Only a narrow band of timezones near UTC see the boundary land anywhere close to their own
midnight. A Los Angeles user marking a quest done at 6pm Tuesday local writes to Wednesday's row.
This is invisible from a UTC-ish development machine or a Vercel runner, which is exactly why it
went unnoticed through Phase 0.

The cost is asymmetric by slice: mild in Phase 1 slice 1 (a form's default `startDate` can be a
day off, and for a `weekly` goal that permanently shifts which weekday it recurs on, since
`scheduledOn` keys the cadence off `start_date`'s weekday). Severe from slice 2 onward: every
completion, streak boundary, and grace decision is built on "which day is today." A user doing
their evening routine after their local rollover silently logs it to tomorrow, and then *both*
days read incomplete — breaking a streak they actually earned. That is precisely the "silent bug
misrepresenting a user's real progress" failure mode ADR-002 and CLAUDE.md single out as the
hardest thing to get wrong quietly.

## Decision

Each user's "today" is computed in **their own IANA timezone**, captured once, not in UTC and not
re-derived per request from anything other than that stored value.

- **Capture:** client-side, via `Intl.DateTimeFormat().resolvedOptions().timeZone` — a standard
  browser API, auto-detected, no user input required. Captured at the end of `/setup`, alongside
  the existing `RankWindow` creation (`completeSetup`), since that's already the one-time
  onboarding-completion step — **and** opportunistically re-checked/refreshed by `TimezoneSync`
  (`src/app/timezone-sync.tsx`), mounted on `/dashboard`, on every authenticated visit. The setup
  capture alone would only ever reach accounts created after this ADR; `TimezoneSync` closes that
  gap for every pre-existing account too (audit finding P1-6) and, as a side effect within the
  same "auto-detected only" scope, keeps a traveling user's timezone current without needing a
  manual-override feature. It only writes when the stored value differs from the freshly-detected
  one, so it's a no-op comparison on most visits.
- **Storage:** Supabase Auth's `user_metadata.timezone` (via `supabase.auth.updateUser({ data:
  { timezone } })`), **not a new table or column.** `user_metadata` exists exactly for a small,
  non-sensitive per-user preference like this, and a dedicated `user_settings` table for one field
  would be a real structural addition ADR-001 doesn't currently need. Revisit if more per-user
  preferences accumulate later.
- **Computation:** a new `todayInTimezone(timezone, now)` helper (`src/lib/today.ts`), using
  `Intl.DateTimeFormat("en-CA", { timeZone })` (the `en-CA` locale formats as `YYYY-MM-DD`, a
  convenient built-in match for this app's date format — no new dependency). Deliberately **not**
  part of `rank-engine/date-utils.ts`, which stays pure arithmetic on already-known date strings,
  UTC-anchored so day math never shifts by the host machine's timezone (that reasoning is correct
  and unrelated to this decision — see that file's own comment). `today.ts` is the one place real
  wall-clock time enters the app; `date-utils.ts` never needs to know a timezone exists.
- **Fallback:** no stored timezone yet (a brand-new session before `TimezoneSync` has run once) or
  an invalid/corrupted stored value (`Intl.DateTimeFormat` throws a `RangeError` on an unrecognized
  IANA identifier) → falls back to `"UTC"` for that request. Self-correcting on the next
  authenticated `/dashboard` visit rather than a permanent state, per the capture mechanism above.
- **Where it's used:** everywhere the app currently computes "today" server-side. Concretely as of
  this ADR: the quest-creation form's default `startDate` (Phase 1 slice 1). Going forward: slice
  2's entry-write default date, and slice 3's rank engine calls (`streak`/`rankProgress`/
  `personalDevelopmentScore` all take `today` as an explicit parameter already — per ADR-002's own
  design, they don't compute it themselves — so this ADR's helper is exactly what feeds that
  parameter from here on).

## Rejected alternatives

- **Keep UTC days, disclose the boundary in the UI.** Cheapest — no code change beyond adding
  copy. Rejected because the boundary lands mid-afternoon or evening local time for most of the US
  and Asia-Pacific, which reads as *broken*, not merely *different*. CLAUDE.md's core hypothesis is
  that rank + streak on a plain interface drives daily consistency; a day boundary that fires while
  most users are still mid-day directly undermines the thing being tested, for the majority of a
  realistic user base.
- **Client sends the local day with each write, no stored timezone.** Solves the write path
  cheaply (the browser always has a real local clock). Rejected as the sole mechanism because it
  doesn't solve reads: rendering the dashboard's rank/streak "as of today" happens in a Server
  Component with no client clock to ask. A stored timezone is needed regardless for reads to be
  consistent with writes, which makes this a partial answer, not a different one.

## Test surface

- `todayInTimezone`: returns the correct `YYYY-MM-DD` for a representative timezone set (Auckland,
  Kolkata, London, New York, Los Angeles, UTC) at a fixed moment straddling at least one of their
  boundaries; falls back to `"UTC"` for an invalid or missing timezone string, without throwing.

## Addendum (2026-08-19): the traveling-user question, decided explicitly (audit finding P1-7)

The original text above left "what happens when a user's detected timezone changes" implicit —
the Decision section already described `TimezoneSync` auto-following a changed browser timezone
(§"Capture," above), but the original version of this section still listed manual override as
merely out of scope, without stating that auto-follow was the chosen behavior for the case that
*isn't* manual override. Round-3 review correctly called this out: the question the ADR appeared
to defer was actually already answered by the code, just not written down here.

**Decided: timezone auto-follows the browser's detected value, with no pinning to the timezone
captured at onboarding.** This was the only behavior `TimezoneSync` could implement without also
building a manual-override UI (out of scope, below) — pinning to onboarding's timezone forever
would be actively wrong for a user who relocates permanently, and there's no signal available to
distinguish "traveling temporarily" from "moved," so the auto-detected value is authoritative,
same as it is on first capture.

**Consequence, stated rather than left implicit:** a timezone change that crosses a calendar-day
boundary mid-window can cause a day to be skipped from the user's perspective entirely — e.g.
flying LA→Auckland forward across enough hours that "today" jumps from one calendar date straight
to a later one, with no `today()` call ever landing on the date in between. For a daily goal, that
skipped date has zero entries and *was* actively scheduled, so `dailyCompletion` reads it as a
genuine miss (per ADR-002 — it's indistinguishable from a real missed day, not a `null` day the
C1/C4 neutral-day rule would catch), consuming grace or breaking a streak the user didn't actually
fail to earn. The reverse direction (timezone moves backward, revisiting an already-passed date)
is benign — `goal_entries`' `unique (goal_id, date)` constraint means a repeat write upserts rather
than duplicating.

**Accepted as a known tradeoff for now, not fixed:** this needs both an offset large enough to
skip a calendar day *and* landing mid-streak — a genuine edge case, not a common path. Per
CLAUDE.md's build-order rationale (test the core hypothesis cheaply before investing further),
building detection for "was this specific miss caused by a timezone shift" is more machinery than
this edge case currently justifies. If it proves to matter — e.g. real usage data shows travelers
losing streaks — the fix is the same neutral-day mechanism C1/C4 already established: detect a
day skipped purely by a timezone shift and treat it as unscheduled (skip, don't count as a miss)
rather than building a new sentinel or rule from scratch.

## Explicitly out of scope

- Letting a user manually override their detected timezone (e.g. to opt out of auto-follow while
  traveling) — auto-detected only, for now; see the addendum above for what auto-follow itself
  decides and its accepted streak consequence.
- A general per-user settings/preferences table — `user_metadata` is sufficient for one field;
  revisit if more accumulate.

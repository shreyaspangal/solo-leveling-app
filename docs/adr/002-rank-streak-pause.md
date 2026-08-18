# ADR-002: Rank, Streak, and Pause Calculation Logic

**Status:** Proposed
**Context:** Builds on ADR-001 (`Goal`, `GoalEntry`, `RankWindow`). Defines how those rows become the numbers a user actually sees.

## Decision

Three numbers get shown to the user, and they are **deliberately decoupled** — computed by separate functions, not derived from each other.

1. **Daily completion %** — today's snapshot
2. **Streak** — consecutive-day counter, fragile, resets on any miss outside pause
3. **Rank progress** — the multi-month climb, forgiving via grace period

## 1. Daily completion %

```
dailyCompletion(user, date):
  active_goals = Goal.where(user_id, domain in ["quest","spirituality","learning"])
                     .where(start_date <= date)
                     .where(target_date is null OR target_date >= date)
  if active_goals.empty: return null   // no goals = no score, not 0%

  expected = active_goals.filter(g => scheduledOn(g, date))  // respects frequency
  completed = GoalEntry.where(goal_id in expected, date, completed=true).count

  return round(completed / expected.length * 100)
```

`scheduledOn(goal, date)` checks frequency (daily = every day between start/target; weekly/monthly/custom = per the goal's own cadence). A weekly Spirituality goal shouldn't count against a user on the six days it wasn't due — "100% daily completion" only makes sense against what was actually scheduled that day.

Only counts domains the user opted into at onboarding — a domain with zero goals is absent from `active_goals` entirely, not scored as 0%.

## 2. Streak (fragile, no grace)

```
streak(user, upto_date):
  if dailyCompletion(user, upto_date) < 100:
    check = upto_date - 1
  else:
    check = upto_date
  n = 0
  while dailyCompletion(user, check) == 100
        OR isPaused(user, check):     // paused days don't break streak, don't extend it either
    if isPaused(user, check):
      check -= 1
      continue                        // skip past paused days without incrementing
    n += 1
    check -= 1
  return n
```

Strict: any day below 100% breaks it. No grace period applies here — the streak is meant to feel fragile. Paused days are skipped over (frozen), not counted as hits or misses.

## 3. Rank progress (forgiving, grace + pause aware)

```
rankProgress(user):
  window = RankWindow.current(user)
  days_in_window = window.window_start .. today

  for date in days_in_window:
    if isPaused(user, date): continue          // frozen, doesn't count either way
    completion = dailyCompletion(user, date)
    if completion < 100:
      window.grace_used += 1
      if window.grace_used > 2:
        window.window_start = date             // 3rd miss resets the window's clock
        window.grace_used = 0

  required_days = rankRequirement(window.rank_target)  // e.g. D→C = 4 months
  elapsed = today - window.window_start
  return {
    pct: round(elapsed / required_days * 100),
    grace_remaining: 2 - window.grace_used
  }
```

`window_start` resetting on the 3rd miss means the user doesn't drop back to a lower rank — they just restart the countdown for the *next* one.

## Pause

```
startPause(user, days):
  assert days <= 7
  window = RankWindow.current(user)
  assert window.pause_used == false        // 1 per window, enforced here
  window.paused_from = today
  window.paused_until = today + days - 1   // inclusive span of `days` days: day 1 == today, day `days` == today + days - 1
  window.pause_used = true

isPaused(user, date):
  window = RankWindow.for(user, date)
  return window.paused_from <= date <= window.paused_until
```

Paused days are excluded from both `dailyCompletion` inputs and `rankProgress`'s grace calculation — they don't count as misses, but they also don't advance the streak. History view (Phase 3) reads `isPaused` to render "paused" instead of blank.

## Addendum (2026-08-18): unscheduled-day semantics, rank-progress clamping, Personal Development Score

Written before Phase 1 dashboard work, per CLAUDE.md's sequencing. Triggered in part by a round-2
audit (`docs/audit/PHASE_0_AUDIT.md`, findings C1/C2/C3) that found the original spec above never
actually defined what a `null` `dailyCompletion` means to its *consumers* — only that `dailyCompletion`
itself produces one. The implementation inherited that gap: `streak` and `rankProgress` both tested
for `=== 100` / `!== 100`, and in JS `null !== 100`, so an unscheduled day silently read as a miss.
Proven empirically: a weekly-only user with 4 consecutive perfect weeks had `window_start` reset
every few days and a streak that capped at 1, and — worse — this is reachable through the *normal*
onboarding path, since ADR-003 creates the `RankWindow` at setup before any goal exists, so every
user starts their first window with goal-less days by construction.

### A. Unscheduled days are neutral, everywhere — not just in `dailyCompletion`

The original text above already says it for the producer side: *"no goals = no score, not 0%."*
This addendum states the consumer-side rule that was missing: **a `null` day is treated exactly like
a paused day by every function that walks a date range — skipped, counting neither as a hit nor a
miss.** `streak` and `rankProgress` must agree on this, or the dashboard shows two numbers that
contradict each other for the same user.

```
streak(user, upto_date):
  if dailyCompletion(user, upto_date) != 100:     // unchanged: "today" is soft either way
    check = upto_date - 1
  else:
    check = upto_date
  n = 0
  while check >= earliest_goal_start_date:        // NEW: explicit floor, see below
    if isPaused(user, check):
      check -= 1
      continue
    completion = dailyCompletion(user, check)
    if completion is null:                        // NEW: unscheduled, same as paused
      check -= 1
      continue
    if completion != 100:
      break                                        // a real miss still ends the streak
    n += 1
    check -= 1
  return n
```

`streak` previously relied on a `null` day terminating its backward walk as an (accidental) lower
bound. Once `null` no longer breaks the loop, a user with zero goals ever configured — or asking
for streak before their first goal's `start_date` — would walk backward indefinitely. The floor is
`earliest_goal_start_date` (the minimum `start_date` across the goals passed in): before that date,
nothing was ever scheduled *or* unscheduled in any meaningful sense, dailyCompletion is null for the
same structural reason, and using it as the bound keeps `streak` self-contained in its own inputs
rather than coupling it to `RankWindow` state (preserving the "decoupled" principle from the top of
this ADR). If `goals` is empty, return `0` immediately — there is no walk to bound.

```
rankProgress(user):
  window = RankWindow.current(user)
  for date in window.window_start .. today:
    if isPaused(user, date): continue
    completion = dailyCompletion(user, date)
    if completion is null: continue                // NEW: unscheduled, same as paused
    if completion != 100:
      window.grace_used += 1
      if window.grace_used > 2:
        window.window_start = date
        window.grace_used = 0
  ...
```

`rankProgress`'s own walk is already forward-bounded (`window_start .. today`), so it needs no new
floor — only the added `if completion is null: continue` line.

### B. `pct` is clamped, and completion is a signal, not a mutation

`pct` was never bounded: 200 perfect days against D-rank's 60-day requirement returned `pct: 332`.
Fixed to `pct: clamp(round(elapsed / required_days * 100), 0, 100)`, with a `required_days` floor of
1 (defensive — `RANK_REQUIREMENT_DAYS["E"]` is `0`, and while S3 already made the Zod schema reject
an `"E"` `rank_target`, `rankProgress` is a pure function with no schema in front of it, so it
shouldn't divide by zero if ever called with one directly, e.g. from a test or future caller).

`rankProgress` now also returns `completed: pct >= 100`. This is a **signal, not a mutation** —
`rankProgress` still does not write anything, does not advance `rank_target`, and does not create a
new `RankWindow` row. Full promotion mechanics (what record a completed window leaves, whether it's
a notification, how the *next* window gets created) is Phase-1-dashboard-wiring work, not a pure
calculation — CLAUDE.md already lists this as explicitly undecided, and it stays that way here.
What this addendum closes is narrower: the number shown on a progress bar must never read past
"full," and callers now have an unambiguous way to know a window is ready to promote without
inferring it from `pct === 100` (which, before the clamp, wasn't even reliably true at completion).

### C. Personal Development Score (display-layer formula, not a new entity)

The PRD lists an "Overall development score" on the Home Dashboard, alongside — not replacing —
rank progress, streak, and daily completion (`Solo_Leveling_PRD.pdf`, Rank & Overall Progress
section). It defines no formula. This is that formula, and it is deliberately a **derived,
display-only aggregate**: it does not feed back into `rank_target`, `grace_used`, or `window_start`,
preserving this ADR's opening principle that the three underlying numbers are computed independently
of each other. `personalDevelopmentScore` is a fourth, separate function layered on top of the other
three — never a fourth code path that recomputes their logic.

```
personalDevelopmentScore(user, today):
  daily = dailyCompletion(user, today)
  daily_component = daily is null ? 100 : daily    // unscheduled today is neutral, not a drag,
                                                     // same rule as section A
  rank_component = rankProgress(user).pct           // already clamped 0-100
  streak_component = min(streak(user, today) / 30, 1) * 100
    // Normalized against 30 days, not against the rank requirement (60-730
    // days) -- against rank's own timeline, early streak-building would
    // barely move the number and the score would read as flat for months.
    // 30 days is a legible, self-contained "a month of consistency is full
    // marks on this component."

  return round(0.5 * rank_component + 0.3 * streak_component + 0.2 * daily_component)
```

Weights (50% rank / 30% streak / 20% daily) favor the long-horizon signal, matching CLAUDE.md's core
hypothesis that rank+streak on a plain interface is the thing being tested — today's completion is
the most volatile of the three inputs (a single day's data), so it gets the smallest weight to keep
the score from swinging on any given day. These weights are a first version, not a load-bearing
contract; revisit once Phase 1 usage data exists, same as everything else this build is testing
cheaply before investing further.

### Test surface additions

- `streak`/`rankProgress`: weekly-only and monthly-only goals across several due/not-due cycles —
  the original test surface only exercised daily goals, which is exactly why C1/C2 shipped with 22
  green tests.
- `streak`: does not walk earlier than the earliest goal's `start_date`; returns `0` for zero goals.
- `rankProgress`: `pct` clamps at 100 past the requirement; `completed` is `true` only once `pct`
  reaches 100; a `rank_target` of `"E"` (schema-illegal but engine-reachable) doesn't divide by zero.
- `personalDevelopmentScore`: matches the weighted formula given each component's real output; an
  unscheduled "today" does not drag the score down.

## Test surface (write before implementation)

- `dailyCompletion`: goals with no entries, weekly goal not due today, mixed domains, zero active goals → null not 0
- `streak`: exact 100% chain, single miss breaks it, pause mid-streak preserves it, pause doesn't inflate it
- `rankProgress`: exactly 2 misses stays in window, 3rd miss resets `window_start`, pause during grace-tracking doesn't consume grace
- `startPause`: rejects 8+ days, rejects second pause in same window, boundary dates (day 1 and day 7 both count as paused)

## Explicitly out of scope

- Full rank-window promotion mechanics when `completed` becomes true (new `RankWindow` row, notification, history record) — `rankProgress` now signals completion (see addendum §B) but does not act on it; this is Phase 1 dashboard/persistence wiring, not a pure-function decision.
- Finance/Fitness contribution to `dailyCompletion` — deferred until those entities exist (ADR-004/005).

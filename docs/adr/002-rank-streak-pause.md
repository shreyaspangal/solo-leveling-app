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
  window.paused_until = today + days
  window.pause_used = true

isPaused(user, date):
  window = RankWindow.for(user, date)
  return window.paused_from <= date <= window.paused_until
```

Paused days are excluded from both `dailyCompletion` inputs and `rankProgress`'s grace calculation — they don't count as misses, but they also don't advance the streak. History view (Phase 3) reads `isPaused` to render "paused" instead of blank.

## Test surface (write before implementation)

- `dailyCompletion`: goals with no entries, weekly goal not due today, mixed domains, zero active goals → null not 0
- `streak`: exact 100% chain, single miss breaks it, pause mid-streak preserves it, pause doesn't inflate it
- `rankProgress`: exactly 2 misses stays in window, 3rd miss resets `window_start`, pause during grace-tracking doesn't consume grace
- `startPause`: rejects 8+ days, rejects second pause in same window, boundary dates (day 1 and day 7 both count as paused)

## Explicitly out of scope

- What happens when a `RankWindow` completes (promotion to next rank, notification, history record) — likely folds into implementation of this ADR rather than needing its own.
- Finance/Fitness contribution to `dailyCompletion` — deferred until those entities exist (ADR-004/005).

// Pure domain types for the rank/streak/pause engine (ADR-001, ADR-002).
// Dates are plain "YYYY-MM-DD" strings (UTC, no time component) so the engine
// stays free of timezone bugs and easy to feed with fixture data in tests.

export type Domain = "quest" | "spirituality" | "learning";
export type Frequency = "daily" | "weekly" | "monthly" | "custom";
export type Rank = "E" | "D" | "C" | "B" | "A" | "S";

export interface Goal {
  id: string;
  domain: Domain;
  frequency: Frequency;
  startDate: string;
  targetDate: string | null;
  // ADR-001: "if false, goal is tracked as overall % only, no per-day
  // checklist." ADR-002 addendum (2026-08-19, audit finding P2-1): the
  // engine excludes these goals entirely, not just the checklist UI.
  dailyTracking: boolean;
}

export interface GoalEntry {
  goalId: string;
  date: string;
  completed: boolean;
}

export interface RankWindow {
  rankTarget: Rank;
  windowStart: string;
  graceUsed: number;
  pausedFrom: string | null;
  pausedUntil: string | null;
  pauseUsed: boolean;
}

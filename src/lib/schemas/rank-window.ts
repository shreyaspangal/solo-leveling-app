import { z } from "zod";
import { isoDate } from "./common";

// Mirrors ADR-001/ADR-002's RankWindow. One row per user, created at the end
// of onboarding setup -- not at signup (ADR-003).

// Full rank domain -- used where "E" is a legitimate value (e.g. a user's
// currently-held rank, before any window has been completed).
export const rankSchema = z.enum(["E", "D", "C", "B", "A", "S"]);

// RankWindow.rankTarget is the rank being climbed *toward*, which can never
// be "E" -- nothing climbs toward the starting rank. Matches the DB check
// constraint on rank_windows.rank_target exactly; keep these in sync.
export const rankTargetSchema = z.enum(["D", "C", "B", "A", "S"]);

export const rankWindowSchema = z
  .object({
    id: z.uuid(),
    userId: z.uuid(),
    rankTarget: rankTargetSchema,
    windowStart: isoDate,
    graceUsed: z.number().int().min(0).max(2),
    pausedFrom: isoDate.nullable(),
    pausedUntil: isoDate.nullable(),
    pauseUsed: z.boolean(),
  })
  .refine(
    (w) => (w.pausedFrom === null) === (w.pausedUntil === null),
    { error: "pausedFrom and pausedUntil must both be null or both be set" },
  )
  .refine(
    (w) => w.pausedFrom === null || w.pausedUntil === null || w.pausedUntil >= w.pausedFrom,
    { error: "pausedUntil must be on or after pausedFrom", path: ["pausedUntil"] },
  );

export type RankWindow = z.infer<typeof rankWindowSchema>;

// Input for creating the first RankWindow at the end of onboarding setup.
export const createRankWindowSchema = z.object({
  userId: z.uuid(),
  rankTarget: rankTargetSchema.default("D"), // E -> D is always the first climb
  windowStart: isoDate,
});

export type CreateRankWindowInput = z.infer<typeof createRankWindowSchema>;

// Input for the startPause action (see rank-engine/engine.ts for the logic).
export const startPauseSchema = z.object({
  days: z.number().int().min(1).max(7),
});

export type StartPauseInput = z.infer<typeof startPauseSchema>;

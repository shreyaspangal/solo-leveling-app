import { z } from "zod";
import { isoDate } from "./common";

// Mirrors ADR-001's Goal/GoalEntry/Milestone entity. `domain` only affects
// onboarding template + display filtering, never validation or calculation
// logic (ADR-001) -- Finance and Fitness are explicitly out of scope here.
export const domainSchema = z.enum(["quest", "spirituality", "learning"]);

export const frequencySchema = z.enum(["daily", "weekly", "monthly", "custom"]);

const goalShape = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  domain: domainSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
  // Free text by design (ADR-001): onboarding seeds suggested values per
  // domain, but nothing at the schema level restricts it to those values.
  category: z.string().min(1).max(100),
  frequency: frequencySchema,
  dailyTracking: z.boolean(),
  startDate: isoDate,
  targetDate: isoDate.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

function targetAfterStart() {
  return {
    error: "targetDate must be on or after startDate",
    path: ["targetDate"] as PropertyKey[],
  };
}

export const goalSchema = goalShape.refine(
  (goal) => goal.targetDate === null || goal.targetDate >= goal.startDate,
  targetAfterStart(),
);

export type Goal = z.infer<typeof goalSchema>;

// Input shape for creating a goal: server assigns id/userId/timestamps.
export const createGoalSchema = goalShape
  .omit({ id: true, userId: true, createdAt: true, updatedAt: true })
  .refine(
    (goal) => goal.targetDate === null || goal.targetDate >= goal.startDate,
    targetAfterStart(),
  );

export type CreateGoalInput = z.infer<typeof createGoalSchema>;

export const goalEntrySchema = z.object({
  id: z.uuid(),
  goalId: z.uuid(),
  date: isoDate,
  completed: z.boolean(),
  createdAt: z.iso.datetime(),
});

export type GoalEntry = z.infer<typeof goalEntrySchema>;

export const createGoalEntrySchema = goalEntrySchema.omit({
  id: true,
  createdAt: true,
});

export type CreateGoalEntryInput = z.infer<typeof createGoalEntrySchema>;

export const milestoneSchema = z.object({
  id: z.uuid(),
  goalId: z.uuid(),
  title: z.string().min(1).max(200),
  completed: z.boolean(),
  order: z.number().int().nonnegative(),
});

export type Milestone = z.infer<typeof milestoneSchema>;

export const createMilestoneSchema = milestoneSchema.omit({ id: true });

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;

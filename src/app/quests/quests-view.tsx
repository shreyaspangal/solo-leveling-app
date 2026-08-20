"use client";

import { BarChart3, Plus, Swords, Target } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, PanelHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { createMilestone, toggleMilestone } from "./actions";

export interface QuestMilestone {
  id: string;
  title: string;
  completed: boolean;
  order: number;
}

export interface Quest {
  id: string;
  title: string;
  description: string | null;
  category: string;
  dailyTracking: boolean;
  startDate: string;
  targetDate: string | null;
  milestones: QuestMilestone[];
  dueToday: boolean;
  doneToday: boolean;
}

type Tab = "active" | "completed" | "upcoming";

// A goal with no milestones can never be "completed" here -- an ongoing
// daily habit with no finish line correctly stays Active indefinitely.
// See page.tsx's comment on why this deliberately isn't a percentage.
function isCompleted(q: Quest): boolean {
  return q.milestones.length > 0 && q.milestones.every((m) => m.completed);
}

// Owner decision 2026-08-20, resolving the auditer's U-finding on this exact
// edge case: a quest's target date passing only means something if there
// were milestones to judge it against -- a milestone-less quest has no
// completion signal at all, so it stays in its normal bucket forever ("the
// user might pick it up sometime in future"), never "Missed". A quest WITH
// milestones that's past its target date without finishing all of them is
// unambiguous, though: it was due, and it isn't done.
function isMissed(q: Quest, today: string): boolean {
  return (
    q.milestones.length > 0 &&
    q.targetDate !== null &&
    q.targetDate < today &&
    !isCompleted(q)
  );
}

export function QuestsView({ quests, today }: { quests: Quest[]; today: string }) {
  const [tab, setTab] = useState<Tab>("active");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Milestone state lives here (lifted above the list/detail split) so a
  // toggle or a new milestone shows up in both the card's "x/y milestones"
  // chip and the detail pane immediately, from the same optimistic update.
  const [milestonesByQuest, setMilestonesByQuest] = useState<Record<string, QuestMilestone[]>>(
    () => Object.fromEntries(quests.map((q) => [q.id, q.milestones])),
  );

  const buckets = useMemo(() => {
    const upcoming = quests.filter((q) => q.startDate > today);
    const rest = quests.filter((q) => q.startDate <= today);
    const completed = rest.filter((q) => isCompleted({ ...q, milestones: milestonesByQuest[q.id] }));
    const active = rest.filter((q) => !isCompleted({ ...q, milestones: milestonesByQuest[q.id] }));
    return { active, completed, upcoming };
  }, [quests, today, milestonesByQuest]);

  const shown = buckets[tab];
  const detail = quests.find((q) => q.id === selectedId) ?? shown[0] ?? quests[0] ?? null;

  const categoryProgress = useMemo(() => {
    const byCategory = new Map<string, { withMilestones: number; totalPct: number; count: number }>();
    for (const q of quests) {
      const entry = byCategory.get(q.category) ?? { withMilestones: 0, totalPct: 0, count: 0 };
      entry.count += 1;
      const ms = milestonesByQuest[q.id] ?? [];
      if (ms.length > 0) {
        entry.withMilestones += 1;
        entry.totalPct += Math.round((ms.filter((m) => m.completed).length / ms.length) * 100);
      }
      byCategory.set(q.category, entry);
    }
    return Array.from(byCategory, ([category, v]) => ({
      category,
      count: v.count,
      // Only defined when at least one goal in the category has milestones
      // -- averaging in goals with none would silently pull every
      // category toward 0%, which isn't what "no milestones yet" means.
      pct: v.withMilestones > 0 ? Math.round(v.totalPct / v.withMilestones) : null,
    }));
  }, [quests, milestonesByQuest]);

  async function handleToggleMilestone(questId: string, milestoneId: string, completed: boolean) {
    setMilestonesByQuest((prev) => ({
      ...prev,
      [questId]: prev[questId].map((m) => (m.id === milestoneId ? { ...m, completed } : m)),
    }));
    const result = await toggleMilestone(milestoneId, completed);
    if (result.error) {
      // Revert on failure -- same optimistic-then-reconcile pattern as
      // TodayChecklist's toggle.
      setMilestonesByQuest((prev) => ({
        ...prev,
        [questId]: prev[questId].map((m) => (m.id === milestoneId ? { ...m, completed: !completed } : m)),
      }));
    }
  }

  if (quests.length === 0) {
    return (
      <div className="flex w-full flex-1 flex-col items-center px-6 py-16">
        <div className="w-full max-w-lg">
          <Card brackets>
            <PanelHeader icon={Swords}>Quests</PanelHeader>
            <div className="p-8 text-center text-muted-foreground">
              <p>No quests yet.</p>
              <Button asChild className="mt-4">
                <Link href="/quests/new">
                  <Plus className="size-4" />
                  New Quest
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-4xl">
        <Card brackets>
          <PanelHeader
            icon={Swords}
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/quests/new">
                  <Plus className="size-3.5" />
                  New Quest
                </Link>
              </Button>
            }
          >
            Quests
          </PanelHeader>
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 text-sm text-muted-foreground">
            {buckets.active.length} active &middot; {buckets.completed.length} completed &middot;{" "}
            {buckets.upcoming.length} upcoming
          </div>

          <div className="flex gap-1 overflow-x-auto border-b border-border px-2">
            {(
              [
                ["active", `Active (${buckets.active.length})`],
                ["completed", `Completed (${buckets.completed.length})`],
                ["upcoming", `Upcoming (${buckets.upcoming.length})`],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                variant="ghost"
                onClick={() => setTab(key)}
                aria-current={tab === key ? "true" : undefined}
                className={cn(
                  "h-auto shrink-0 rounded-none border-0 border-b-2 bg-transparent px-3.5 py-2.5 font-heading text-xs tracking-[1.5px] uppercase transition-colors hover:bg-transparent",
                  tab === key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </Button>
            ))}
          </div>

          {/* Audit finding U32: grid items default to min-width:auto too
              (same trap as flex, U32's other half) -- without min-w-0 here
              and on the detail pane below, the two columns floor at their
              content's intrinsic width instead of actually collapsing to
              one column below `lg`. */}
          <div className="grid min-w-0 gap-4 p-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="flex min-w-0 flex-col gap-3">
              {shown.length === 0 && (
                <Card className="p-6 text-center text-sm text-muted-foreground">
                  {tab === "upcoming"
                    ? "No upcoming quests."
                    : tab === "completed"
                      ? "No quests completed yet."
                      : "No active quests."}
                </Card>
              )}
              {shown.map((q) => {
                const ms = milestonesByQuest[q.id] ?? [];
                const selected = detail?.id === q.id;
                return (
                  <Button
                    key={q.id}
                    type="button"
                    variant="ghost"
                    onClick={() => setSelectedId(q.id)}
                    className="h-auto w-full justify-start rounded-none border-0 bg-transparent p-0 text-left hover:bg-transparent"
                  >
                    <Card
                      brackets={selected}
                      className={cn("w-full p-4 transition-colors", !selected && "hover:bg-muted/40")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{q.title}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <Badge variant="outline">{q.category}</Badge>
                            {q.dailyTracking && (
                              <Badge variant="outline" className="border-secondary/40 text-secondary">
                                Daily
                              </Badge>
                            )}
                            {ms.length > 0 && (
                              <Badge variant="outline">
                                {ms.filter((m) => m.completed).length}/{ms.length} milestones
                              </Badge>
                            )}
                            {q.dailyTracking && q.dueToday && (
                              <Badge variant={q.doneToday ? "default" : "outline"}>
                                {q.doneToday ? "Done today" : "Due today"}
                              </Badge>
                            )}
                            {isMissed({ ...q, milestones: ms }, today) && (
                              <Badge variant="destructive">Missed</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {ms.length > 0 && (
                        <Progress
                          value={Math.round((ms.filter((m) => m.completed).length / ms.length) * 100)}
                          label={`${ms.filter((m) => m.completed).length} of ${ms.length} milestones complete`}
                          className="mt-3"
                        />
                      )}
                    </Card>
                  </Button>
                );
              })}

              {/* Audit finding U33: this is milestone completion, not the
                  same "progress" the rank card elsewhere on this screen
                  shows (rank progress is entry/streak-based, per the
                  milestone-scoring decision in CLAUDE.md -- milestones
                  don't feed it). The Progress component's accessible label
                  already said "milestone completion"; the visible text
                  didn't, so a sighted user had no way to know these are two
                  different numbers. Header and row now say so visibly too. */}
              <Card brackets>
                <PanelHeader icon={BarChart3}>Category Milestone Progress</PanelHeader>
                <div className="space-y-3 p-4">
                  {categoryProgress.map((c) => (
                    <div key={c.category}>
                      <div className="flex items-center justify-between text-sm">
                        <span>
                          {c.category} <span className="text-muted-foreground">&middot; {c.count}</span>
                        </span>
                        {c.pct !== null && (
                          <span className="font-heading text-primary">
                            {c.pct}% <span className="text-xs text-muted-foreground">milestones</span>
                          </span>
                        )}
                      </div>
                      {c.pct !== null ? (
                        <Progress
                          value={c.pct}
                          label={`${c.category} milestone completion, ${c.pct}%`}
                          className="mt-1.5"
                        />
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">No milestones yet</p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {detail && (
              <QuestDetail
                quest={detail}
                milestones={milestonesByQuest[detail.id] ?? []}
                today={today}
                onToggleMilestone={(milestoneId, completed) =>
                  handleToggleMilestone(detail.id, milestoneId, completed)
                }
                onMilestoneCreated={(milestone) =>
                  setMilestonesByQuest((prev) => ({
                    ...prev,
                    [detail.id]: [...(prev[detail.id] ?? []), milestone],
                  }))
                }
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function QuestDetail({
  quest,
  milestones,
  today,
  onToggleMilestone,
  onMilestoneCreated,
}: {
  quest: Quest;
  milestones: QuestMilestone[];
  today: string;
  onToggleMilestone: (milestoneId: string, completed: boolean) => void;
  onMilestoneCreated: (milestone: QuestMilestone) => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completedCount = milestones.filter((m) => m.completed).length;

  async function handleAdd() {
    const title = newTitle.trim();
    if (!title) return;
    setPending(true);
    setError(null);
    const result = await createMilestone(quest.id, title);
    setPending(false);
    if (result.error || !result.milestone) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    onMilestoneCreated(result.milestone);
    setNewTitle("");
  }

  return (
    <Card brackets className="h-fit min-w-0">
      <PanelHeader icon={Target}>{quest.title}</PanelHeader>
      <div className="p-4">
        {quest.description && (
          <p className="mb-3 text-sm text-muted-foreground">{quest.description}</p>
        )}
        <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground uppercase tracking-[1px]">Category</dt>
            <dd className="mt-0.5">{quest.category}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase tracking-[1px]">Target</dt>
            <dd className="mt-0.5 flex items-center gap-1.5">
              {quest.targetDate ?? "No target date"}
              {isMissed({ ...quest, milestones }, today) && <Badge variant="destructive">Missed</Badge>}
            </dd>
          </div>
        </dl>

        <div className="flex items-center justify-between">
          <span className="font-heading text-xs text-secondary uppercase tracking-[1.5px]">
            Milestones
          </span>
          <span className="font-heading text-xs text-primary">
            {completedCount}/{milestones.length}
          </span>
        </div>

        {/* Audit follow-up: was a <Button> with an aria-hidden box + sr-only
            state text -- operable and announced, but AT doesn't present it
            as a checkable item or announce toggles as checkbox state
            changes. The real Checkbox (Radix, real role="checkbox" +
            aria-checked) is what TodayChecklist already uses for this exact
            "imperative toggle, not inside a <form>" case -- same component,
            same pattern, not a new one. */}
        <ul className="mt-2 divide-y divide-border">
          {milestones.map((m) => (
            <li key={m.id}>
              <label className="flex w-full items-center gap-3 py-2.5">
                <Checkbox
                  checked={m.completed}
                  onCheckedChange={() => onToggleMilestone(m.id, !m.completed)}
                />
                <span
                  className={cn(
                    "text-sm",
                    m.completed && "text-muted-foreground line-through decoration-muted-foreground/60",
                  )}
                >
                  {m.title}
                </span>
              </label>
            </li>
          ))}
        </ul>
        {milestones.length === 0 && (
          <p className="py-3 text-sm text-muted-foreground">
            No milestones yet — break this quest into steps.
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Add a milestone"
            aria-label="New milestone title"
            className="h-9 min-w-0 flex-1"
            maxLength={200}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={pending || !newTitle.trim()}
          >
            <Plus className="size-3.5" />
            Add
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { upsertGoalEntry } from "./actions";

interface ChecklistGoal {
  id: string;
  title: string;
  category: string;
  completed: boolean;
}

// Called imperatively from onChange, not via <form action> -- no form-reset
// behavior to guard against here (P1-8 was specific to forms), so a plain
// controlled checkbox with optimistic local state is enough on its own.
export function TodayChecklist({ goals }: { goals: ChecklistGoal[] }) {
  const [completed, setCompleted] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(goals.map((g) => [g.id, g.completed])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});

  async function toggle(goalId: string) {
    const next = !completed[goalId];
    // Optimistic update -- reverted below if the write fails.
    setCompleted((prev) => ({ ...prev, [goalId]: next }));
    setErrors((prev) => ({ ...prev, [goalId]: "" }));
    setPending((prev) => ({ ...prev, [goalId]: true }));

    const result = await upsertGoalEntry(goalId, next);

    setPending((prev) => ({ ...prev, [goalId]: false }));
    if (result.error) {
      setCompleted((prev) => ({ ...prev, [goalId]: !next }));
      setErrors((prev) => ({ ...prev, [goalId]: result.error! }));
    }
  }

  return (
    <ul className="mt-6 space-y-3">
      {goals.map((goal) => (
        <li key={goal.id} className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={completed[goal.id]}
              disabled={pending[goal.id]}
              onChange={() => toggle(goal.id)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="block font-medium">{goal.title}</span>
              <span className="block text-sm text-zinc-500">{goal.category}</span>
            </span>
          </label>
          {errors[goal.id] && (
            <p className="mt-2 text-sm text-red-600">{errors[goal.id]}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

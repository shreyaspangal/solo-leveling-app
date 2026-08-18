"use client";

import { useActionState } from "react";
import { createQuest } from "../actions";

const SUGGESTED_CATEGORIES = [
  "Personal",
  "Career",
  "Family",
  "Travel",
  "Business",
  "Relationships",
  "Habits",
  "Lifestyle",
  "Hobbies",
  "Other",
];

export function NewQuestForm() {
  const [state, formAction, pending] = useActionState(createQuest, { error: null });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="mt-6 space-y-3">
      <label className="block text-sm text-zinc-500" htmlFor="title">
        Quest title
      </label>
      <input
        id="title"
        name="title"
        type="text"
        placeholder="e.g. Wake up at 6 AM"
        required
        minLength={1}
        maxLength={200}
        className="h-11 w-full rounded-lg border border-zinc-300 px-3 dark:border-zinc-700 dark:bg-transparent"
      />
      <label className="block text-sm text-zinc-500" htmlFor="description">
        Description (optional)
      </label>
      <textarea
        id="description"
        name="description"
        maxLength={2000}
        rows={3}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-transparent"
      />
      <label className="block text-sm text-zinc-500" htmlFor="category">
        Category
      </label>
      <input
        id="category"
        name="category"
        type="text"
        placeholder="e.g. Habits"
        required
        list="category-suggestions"
        className="h-11 w-full rounded-lg border border-zinc-300 px-3 dark:border-zinc-700 dark:bg-transparent"
      />
      <datalist id="category-suggestions">
        {SUGGESTED_CATEGORIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <label className="block text-sm text-zinc-500" htmlFor="frequency">
        Frequency
      </label>
      <select
        id="frequency"
        name="frequency"
        defaultValue="daily"
        className="h-11 w-full rounded-lg border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"
      >
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
        <option value="custom">Custom</option>
      </select>

      <label className="block text-sm text-zinc-500" htmlFor="startDate">
        Start date
      </label>
      <input
        id="startDate"
        name="startDate"
        type="date"
        required
        defaultValue={today}
        className="h-11 w-full rounded-lg border border-zinc-300 px-3 dark:border-zinc-700 dark:bg-transparent"
      />

      <label className="block text-sm text-zinc-500" htmlFor="targetDate">
        Target completion date (optional)
      </label>
      <input
        id="targetDate"
        name="targetDate"
        type="date"
        className="h-11 w-full rounded-lg border border-zinc-300 px-3 dark:border-zinc-700 dark:bg-transparent"
      />

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="dailyTracking" defaultChecked />
        Track this daily
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="flex h-11 w-full items-center justify-center rounded-full bg-foreground px-5 font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {pending ? "Creating…" : "Create Quest"}
      </button>
    </form>
  );
}

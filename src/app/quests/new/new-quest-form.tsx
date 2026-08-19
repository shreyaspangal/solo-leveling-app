"use client";

import { useActionState, useEffect, useState } from "react";
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

  // Audit finding P1-8: a <form action={formAction}> resets every
  // uncontrolled field once the action completes, success or failure --
  // real React 19 behavior, not something reading the component reveals.
  // A rejected submission would silently wipe everything the user typed
  // while showing an error about a form that no longer has the values the
  // error refers to. Every field below is controlled from local state
  // specifically so a failed submission leaves it exactly as the user left
  // it; `name` attributes are unchanged, so the server action still reads
  // these the same way via FormData.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [targetDate, setTargetDate] = useState("");
  const [dailyTracking, setDailyTracking] = useState(true);

  // ADR-006: the user's local day, not UTC -- computed after mount (not
  // during render) so SSR's initial HTML never guesses at a value only the
  // browser actually knows, which would risk a hydration mismatch if the
  // server process's own timezone/moment disagreed. Empty until then, so
  // the field starts blank rather than momentarily showing a wrong date.
  const [today, setToday] = useState("");
  useEffect(() => {
    // Genuinely a client-only value (the browser's own local day) with no
    // way to derive it safely during the render that SSR and hydration
    // both run -- a lazy useState initializer would re-execute on the
    // client during hydration and could disagree with the server-rendered
    // value, which is the mismatch this pattern exists to avoid.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(new Date().toLocaleDateString("en-CA"));
  }, []);

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
        value={title}
        onChange={(e) => setTitle(e.target.value)}
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
        value={description}
        onChange={(e) => setDescription(e.target.value)}
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
        value={category}
        onChange={(e) => setCategory(e.target.value)}
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
        value={frequency}
        onChange={(e) => setFrequency(e.target.value)}
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
        value={today}
        onChange={(e) => setToday(e.target.value)}
        className="h-11 w-full rounded-lg border border-zinc-300 px-3 dark:border-zinc-700 dark:bg-transparent"
      />

      <label className="block text-sm text-zinc-500" htmlFor="targetDate">
        Target completion date (optional)
      </label>
      <input
        id="targetDate"
        name="targetDate"
        type="date"
        value={targetDate}
        onChange={(e) => setTargetDate(e.target.value)}
        className="h-11 w-full rounded-lg border border-zinc-300 px-3 dark:border-zinc-700 dark:bg-transparent"
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="dailyTracking"
          checked={dailyTracking}
          onChange={(e) => setDailyTracking(e.target.checked)}
        />
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

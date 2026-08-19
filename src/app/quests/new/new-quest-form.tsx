"use client";

import { Check } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  // Not React state -- see the comment at the checkbox below (audit finding
  // U10/U13) for why this field is deliberately uncontrolled.
  const dailyTrackingRef = useRef(true);
  const dailyTrackingCheckboxRef = useRef<HTMLInputElement>(null);

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
    <form
      action={formAction}
      onReset={() => {
        // See the checkbox comment below (audit findings U10/U13) -- this
        // is the fix, not a defensive extra. React 19 resets every form
        // control to its mount-time default after an action completes,
        // success or failure; for an uncontrolled checkbox that means the
        // DOM's own `checked` property, which this line reasserts from the
        // one place the reset can't reach.
        if (dailyTrackingCheckboxRef.current) {
          dailyTrackingCheckboxRef.current.checked = dailyTrackingRef.current;
        }
      }}
      className="mt-6 space-y-3"
    >
      <Label htmlFor="title">Quest title</Label>
      <Input
        id="title"
        name="title"
        type="text"
        placeholder="e.g. Wake up at 6 AM"
        required
        minLength={1}
        maxLength={200}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-11 rounded-lg"
      />
      <Label htmlFor="description">Description (optional)</Label>
      <Textarea
        id="description"
        name="description"
        maxLength={2000}
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="rounded-lg"
      />
      <Label htmlFor="category">Category</Label>
      <Input
        id="category"
        name="category"
        type="text"
        placeholder="e.g. Habits"
        required
        list="category-suggestions"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="h-11 rounded-lg"
      />
      <datalist id="category-suggestions">
        {SUGGESTED_CATEGORIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {/* Native <select>, not shadcn's Radix-based Select -- this form
          submits via FormData through a Server Action (createQuest), and a
          native select's `name`/`value` work with that directly. Radix's
          Select needs onValueChange + extra wiring to participate in
          FormData the same way, which is out of scope for this
          no-functional-change primitive-swap pass (ADR-007). */}
      <Label htmlFor="frequency">Frequency</Label>
      <select
        id="frequency"
        name="frequency"
        value={frequency}
        onChange={(e) => setFrequency(e.target.value)}
        className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
      >
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
        <option value="custom">Custom</option>
      </select>

      <Label htmlFor="startDate">Start date</Label>
      <Input
        id="startDate"
        name="startDate"
        type="date"
        required
        value={today}
        onChange={(e) => setToday(e.target.value)}
        className="h-11 rounded-lg"
      />

      <Label htmlFor="targetDate">Target completion date (optional)</Label>
      <Input
        id="targetDate"
        name="targetDate"
        type="date"
        value={targetDate}
        onChange={(e) => setTargetDate(e.target.value)}
        className="h-11 rounded-lg"
      />

      {/* Audit findings U10/U13: a rejected submission re-checks this box
          -- both what it submits (U10, high) and what it visibly shows
          (U13) -- reversing the user's explicit choice with no
          indication. Worse than P1-8: that finding lost visible input,
          this silently substitutes the opposite value.

          Two earlier attempts didn't hold up, both ruled out by
          reproducing U10 against them in a real browser rather than
          trusting the fix: shadcn's Radix Checkbox registers a `reset`
          listener on its ancestor form unconditionally (keyed only on
          being nested inside a <form>, not on `name`/the bubble input --
          confirmed by reading @radix-ui/react-checkbox's source, not
          assumed); a plain *controlled* native checkbox fails the same
          way through a second, independent mechanism -- React 19 itself
          restores a controlled `checked` prop to its value at mount after
          the action completes.

          A first fix for that used a second ref plus a separate hidden
          input written imperatively at submit time. Correct, but more
          machinery than the problem needs, and it only fixed what gets
          submitted (U10), not what the box visibly shows (U13) -- the
          checkbox still displayed the opposite of its real value after a
          reset. This version fixes both by being uncontrolled instead of
          controlled: the checkbox IS the field that submits (real
          `name`), `defaultChecked` sets its initial value, and `onChange`
          only updates `dailyTrackingRef` -- a ref, so nothing but a real
          user click ever touches it, unlike React state. The one thing a
          reset *can* reach is the DOM's own `checked` property, and the
          form's `onReset` above reasserts it from the ref the moment that
          happens -- fixing the display, not working around it after the
          fact. The shared shadcn/Radix Checkbox is untouched and still
          correct for the non-form, imperative toggle in
          today-checklist.tsx -- this is specific to a checkbox living
          inside a <form action={formAction}>. */}
      <label className="flex items-center gap-2 text-sm">
        <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
          <input
            ref={dailyTrackingCheckboxRef}
            type="checkbox"
            name="dailyTracking"
            defaultChecked
            onChange={(e) => {
              dailyTrackingRef.current = e.target.checked;
            }}
            className="peer size-4 shrink-0 appearance-none rounded-[4px] border border-input outline-none checked:border-primary checked:bg-primary focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Check
            className="pointer-events-none absolute size-3.5 text-primary-foreground opacity-0 peer-checked:opacity-100"
            strokeWidth={3}
          />
        </span>
        Track this daily
      </label>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="h-11 w-full rounded-full">
        {pending ? "Creating…" : "Create Quest"}
      </Button>
    </form>
  );
}

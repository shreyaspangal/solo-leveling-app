"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ComboboxInput } from "@/components/ui/combobox-input";
import { DatePicker } from "@/components/ui/date-picker";
import { FormCheckbox } from "@/components/ui/form-checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      {/* Free text by design (ADR-001: nothing at the schema level
          restricts it to these suggestions) -- a native datalist (<input
          list>) renders a confusing dropdown-arrow affordance that reads as
          a <select> even though it's a text field (owner report,
          2026-08-20). ComboboxInput keeps free text + suggestions without
          that native mechanism. */}
      <ComboboxInput
        id="category"
        name="category"
        placeholder="e.g. Habits"
        required
        value={category}
        onChange={setCategory}
        suggestions={SUGGESTED_CATEGORIES}
      />

      <Label htmlFor="frequency">Frequency</Label>
      {/* Radix Select (owner report, 2026-08-20 -- replacing the native
          <select>'s unstyled look). Its onValueChange doesn't populate
          FormData the way a native select's name/value would, so a
          controlled hidden input carries the real value, same pattern
          FormCheckbox already established for "custom UI control, hidden
          input submits" (audit finding U10's fix). */}
      <Select value={frequency} onValueChange={setFrequency}>
        <SelectTrigger id="frequency" className="h-11 w-full rounded-lg">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="daily">Daily</SelectItem>
          <SelectItem value="weekly">Weekly</SelectItem>
          <SelectItem value="monthly">Monthly</SelectItem>
          <SelectItem value="custom">Custom</SelectItem>
        </SelectContent>
      </Select>
      <Input type="hidden" name="frequency" value={frequency} readOnly />

      <Label htmlFor="startDate">Start date</Label>
      <DatePicker id="startDate" name="startDate" value={today} onChange={setToday} required />

      <Label htmlFor="targetDate">Target completion date (optional)</Label>
      <DatePicker
        id="targetDate"
        name="targetDate"
        value={targetDate}
        onChange={setTargetDate}
        placeholder="No target date"
        min={today}
      />

      {/* Audit finding U10 -- see FormCheckbox for why this isn't a plain
          <input type="checkbox">. */}
      <label className="flex items-center gap-2 text-sm">
        <FormCheckbox name="dailyTracking" defaultChecked />
        Track this daily
      </label>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="h-11 w-full">
        {pending ? "Creating…" : "Create Quest"}
      </Button>
    </form>
  );
}

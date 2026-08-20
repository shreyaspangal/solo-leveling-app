"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Audit finding (owner report, 2026-08-20): a plain <input list="..."> (a
// native HTML datalist) renders a dropdown-arrow affordance in Chrome that
// reads as a <select> even though the field accepts free text -- exactly
// the "which kind of control is this" confusion the report flagged.
// Category is free text by design (ADR-001: "nothing at the schema level
// restricts it to [the suggested] values"), so this isn't a <Select> either
// -- it needs to accept anything AND offer suggestions. A small
// custom-styled dropdown-on-focus, not the native mechanism, is what
// resolves the ambiguity while keeping both.
export function ComboboxInput({
  id,
  name,
  value,
  onChange,
  suggestions,
  placeholder,
  required,
  className,
}: {
  id?: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const listboxId = useId();
  const filtered = suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase()));

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type="text"
        role="combobox"
        aria-expanded={open && filtered.length > 0}
        aria-controls={listboxId}
        autoComplete="off"
        required={required}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Blur fires before a suggestion's click handler would otherwise
        // run -- delay long enough for the click (onMouseDown below also
        // prevents the blur from stealing focus first, belt and suspenders)
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        placeholder={placeholder}
        className={cn("h-11 rounded-lg", className)}
      />
      {open && filtered.length > 0 && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-md"
        >
          {filtered.map((s) => (
            <Button
              key={s}
              type="button"
              variant="ghost"
              role="option"
              aria-selected={s === value}
              // Prevents the input's onBlur from closing the list before
              // this click is registered.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
              className="h-auto w-full justify-start rounded-none border-0 bg-transparent px-3 py-2 text-sm font-normal normal-case tracking-normal hover:bg-muted"
            >
              {s}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

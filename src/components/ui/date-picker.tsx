"use client";

import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ISO "YYYY-MM-DD" <-> Date, parsed/formatted in local time (not UTC) so a
// date typed/picked in the browser's own timezone round-trips to the same
// calendar day -- `new Date("YYYY-MM-DD")` alone parses as UTC midnight,
// which can display as the previous day in timezones behind UTC.
function isoToDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dateToIso(date: Date): string {
  return date.toLocaleDateString("en-CA");
}

// Reference-quality replacement for a native <input type="date"> -- the
// user's own words were "terrible looking native... date... pickers." Not a
// native form control, so a controlled hidden input carries the real
// `name`/value` for the enclosing <form>'s FormData, same pattern
// FormCheckbox already established for "custom UI control, hidden input
// submits" (audit finding U10's fix).
export function DatePicker({
  id,
  name,
  value,
  onChange,
  placeholder = "Pick a date",
  min,
  max,
  required,
  className,
}: {
  id?: string;
  name: string;
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  required?: boolean;
  className?: string;
}) {
  const selected = isoToDate(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            "h-11 w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0" />
          {value ? selected?.toLocaleDateString("en-US", { dateStyle: "medium" }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => date && onChange(dateToIso(date))}
          disabled={(date) => {
            const iso = dateToIso(date);
            if (min && iso < min) return true;
            if (max && iso > max) return true;
            return false;
          }}
          autoFocus
        />
      </PopoverContent>
      <Input type="hidden" name={name} value={value} required={required} readOnly />
    </Popover>
  );
}

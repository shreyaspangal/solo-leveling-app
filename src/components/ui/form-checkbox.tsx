"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// A checkbox for use inside a <form action={...}> submitted via FormData.
// Not shadcn's Checkbox (Radix) or a plain <input type="checkbox"> -- both
// get their `checked` state reset by React 19's post-action form reset,
// which silently flips a value the user explicitly chose (audit finding
// U10). Built from the shared Button/Input primitives, not raw elements:
// Button as a small icon-sized toggle (not a form control, so no reset
// algorithm ever touches it), Input (type="hidden", so none of its visible
// styling paints) as the field that actually submits -- the same
// controlled-value pattern already used for every text/date field here.
export function FormCheckbox({
  name,
  defaultChecked = false,
  className,
}: {
  name: string;
  defaultChecked?: boolean;
  className?: string;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon-xs"
        role="checkbox"
        aria-checked={checked}
        onClick={() => setChecked((v) => !v)}
        className={cn(
          "size-4 rounded-[4px] p-0 aria-checked:border-primary aria-checked:bg-primary",
          className,
        )}
      >
        {checked && <Check className="size-3.5 text-primary-foreground" strokeWidth={3} />}
      </Button>
      <Input type="hidden" name={name} value={checked ? "on" : ""} readOnly />
    </>
  );
}

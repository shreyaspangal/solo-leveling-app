"use client"

import * as React from "react"
import { Label as LabelPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        // ADR-007 Phase 8: matches the reference's `.lbl` -- uppercase,
        // letterspaced, muted, Chakra Petch -- replacing shadcn's default
        // sentence-case label style. Every current usage is a form-field
        // label (new-quest-form.tsx), so this is a safe blanket change,
        // not a per-callsite override. Audit finding U29: `text-xs`/
        // `tracking-widest` measured 20% larger / 20% less tracking than
        // the reference's 10px/1.5px -- arbitrary values instead of named
        // steps to hit the reference exactly.
        "flex items-center gap-2 font-heading text-[10px] tracking-[1.5px] text-muted-foreground uppercase select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }

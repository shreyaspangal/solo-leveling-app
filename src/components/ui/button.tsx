import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // ADR-007 Phase 8: reference `.sysbtn` is a bordered *transparent*
        // control with a glow on hover -- the opposite of a solid filled
        // pill (audit finding U25, "the button language is inverted").
        // uppercase/tracking-[2px]/text-[13px]/font-heading is common to the
        // whole sysbtn family (default/outline/secondary here) per the
        // reference's shared `.sysbtn` base class. `ghost`/`destructive`/
        // `link` are untouched by this pass -- NOT because their reference
        // counterparts are unstyled (`.nav-item` is: 13px Chakra Petch,
        // uppercase, 1px tracking, active-state left-border + gradient --
        // this comment previously claimed otherwise, corrected per audit
        // follow-up to U29), but because `ghost` isn't how nav items are
        // styled today (nav-shell.tsx styles its own `<Link>`s directly, not
        // via this Button's `ghost` variant) and matching `.nav-item` is
        // Phase 9's job (nav rebuild), not this one. Audit finding U29:
        // `tracking-widest` (a relative 0.1em) measured 20-40% short of the
        // reference's absolute px values, so this uses `tracking-[2px]`
        // directly instead of a named step.
        default:
          "border-primary bg-primary/10 text-foreground text-[13px] uppercase tracking-[2px] font-heading hover:bg-primary/20 hover:shadow-[0_0_24px_oklch(from_var(--primary)_l_c_h_/_35%)] aria-expanded:bg-primary/20",
        outline:
          "border-border bg-transparent text-muted-foreground text-[13px] uppercase tracking-[2px] font-heading hover:border-primary hover:bg-primary/5 hover:text-foreground aria-expanded:border-primary aria-expanded:text-foreground",
        // Reference's `.sysbtn.mon:hover` overrides only `background` --
        // the base `.sysbtn:hover`'s cyan glow (not a monarch/purple one)
        // still applies on hover (U29). Only the background tint uses
        // --secondary; the glow intentionally matches `default`'s.
        secondary:
          "border-secondary bg-secondary/10 text-foreground text-[13px] uppercase tracking-[2px] font-heading hover:bg-secondary/20 hover:shadow-[0_0_24px_oklch(from_var(--primary)_l_c_h_/_35%)] aria-expanded:bg-secondary/20",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

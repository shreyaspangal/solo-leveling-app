import * as React from "react"

import { cn } from "@/lib/utils"

// Corner-bracket accents matching the client reference's ".panel > .c"
// treatment (ADR-007) -- four small L-shaped borders in the primary color,
// one per corner, purely decorative (aria-hidden). Opt-in via `brackets`
// rather than the default: most cards (list items, form containers) read
// better plain, and the reference itself only brackets its more prominent
// panels, not every bordered box on the page.
function CardBrackets() {
  const corner = "absolute size-3.5 border-primary"
  return (
    <>
      <span aria-hidden className={cn(corner, "top-0 left-0 border-t-2 border-l-2")} />
      <span aria-hidden className={cn(corner, "top-0 right-0 border-t-2 border-r-2")} />
      <span aria-hidden className={cn(corner, "bottom-0 left-0 border-b-2 border-l-2")} />
      <span aria-hidden className={cn(corner, "right-0 bottom-0 border-r-2 border-b-2")} />
    </>
  )
}

function Card({
  className,
  size = "default",
  brackets = false,
  children,
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm"; brackets?: boolean }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card relative flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        // Aceternity-sourced glow pattern (ADR-007 phase 4), CSS-only per
        // pick-ui-library -- a plain box-shadow, not Motion. Paired with
        // `brackets` rather than a separate prop: both mark the same
        // "prominent panel" treatment the reference applies together, and
        // box-shadow isn't clipped by this element's own overflow-hidden
        // (that only clips content/children, not the box's own shadow).
        brackets && "shadow-[0_0_32px_-8px_var(--primary)]",
        className
      )}
      {...props}
    >
      {brackets && <CardBrackets />}
      {children}
    </div>
  )
}

// ADR-007 Phase 8: matches the reference's `.phead` -- a bordered header bar
// (icon + pulse dot + uppercase letterspaced label, optional right-aligned
// action) distinct from shadcn's plain CardHeader/CardTitle. Opt-in, same as
// `brackets`: not every Card needs a panel header, only the ones the
// reference gives one to.
function PanelHeader({
  icon: Icon,
  children,
  action,
  className,
  as: HeadingTag = "h2",
}: {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  // Every real usage titles a meaningful section, so this defaults to a
  // real heading element (not a bare styled `<span>`) rather than making
  // callers opt into accessible structure. Pass `as="h1"` for a page's
  // single primary heading (the auth-flow screens, setup) -- one per page.
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div
      data-slot="panel-header"
      className={cn(
        // Audit finding U29: tracking-[2px] matches the reference's `.phead`
        // exactly (tracking-widest measured 40% short, live).
        "flex items-center gap-2 border-b border-border px-3.5 py-2.5 font-heading text-xs tracking-[2px] text-primary uppercase",
        action ? "justify-between" : "justify-start",
        className
      )}
    >
      {/* Tailwind's preflight resets h1-h3's font-size/font-weight to
          `inherit`; color/text-transform/letter-spacing are naturally
          inherited CSS properties Tailwind's reset never touches -- so this
          heading picks up the parent div's styling with no override classes
          needed. */}
      <HeadingTag className="flex min-w-0 items-center gap-2">
        {Icon && <Icon size={14} className="shrink-0" />}
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]"
        />
        <span className="truncate">{children}</span>
      </HeadingTag>
      {action}
    </div>
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  PanelHeader,
}

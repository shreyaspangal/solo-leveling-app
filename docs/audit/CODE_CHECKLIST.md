# Pre-handoff checklist — evidence-based

Every rule here exists because something in this repo actually broke. The finding ID after each
rule is the receipt. This is not generic best-practice advice; generic advice did not catch any of
these.

**Who this is for:** the implementing session, before saying "built, pending verification".
**Who maintains it:** the auditing session, appending a rule whenever a finding recurs.

---

## 0. The gate — run before every handoff

A green `tsc` / `eslint` / `vitest` / `next build` suite **does not** mean the app renders.
Twice now a Critical regression has reached handoff behind a fully green suite (**U16**, **U30**).
Both times the app was 500 for every signed-in user. Both times only a browser pass caught it.

    npm run smoke        # authenticated GET on every protected route, asserts 200

`next build` cannot catch this class: it does not exercise cookie-reading dynamic routes, and the
offending values type-check cleanly. **If `smoke` is not green, the handoff is not real.**

---

## 1. React Server Components — the repeat offender

Two Criticals, same class, same component, five weeks apart (**U16**, **U30**).

- [ ] **No functions cross the RSC boundary.** Icon components, callbacks, class instances,
      `Symbol`s — none are serializable. `icon: LucideIcon` **type-checks perfectly** and still
      500s at runtime, which is exactly why `tsc` is not protection here (**U30**).
- [ ] **A `"use client"` module's exports must not be *called* by a Server Component.** Importing
      is fine; invoking is not (**U16**).
- [ ] When a Server Component must configure a client one, pass **serializable keys** (a string
      icon name the client maps locally), not the value itself.
- [ ] After any change to a shared shell/layout component, **load a real authenticated page**.
      `NavShell` has now broken every route that renders it, twice.

## 2. Primitive vs. callsite

- [ ] **Measure the rendered page, not the primitive.** A correct variant is worthless if callsites
      override it. Phase 8's button work was defeated by 11 `rounded-full` overrides across 7 files;
      inspecting `button.tsx` alone would have reported a pass (**U28**).
- [ ] After changing a variant, `grep` for callsite overrides of the properties you changed.
- [ ] Verify **computed styles**, never class presence. "The class is there" and "the value is
      right" are different claims (**U28**, **U29**).

## 3. Matching the reference

- [ ] **Absolute units where the reference uses absolute units.** `tracking-widest` is `0.1em` and
      drifts with font-size; the reference uses px. This produced a silent 20–40% shortfall across
      every letterspaced surface (**U29**).
- [ ] Default to the reference; deviate only where it is broken or violates UI/UX best practice,
      and **say why in a code comment** (owner rule, 2026-08-20).
- [ ] Legitimate deviations so far: 44px touch targets over the reference's ~35px (**U19**);
      `aria-current` the reference lacks (**U18**); Escape-to-dismiss the reference's date popover
      lacks (**U27**).

## 4. Accessibility — six findings and counting

**U12**, **U18**, **U19**, **U21**, **U24**, plus the open bottom-bar issue.

- [ ] **Every input has an accessible name.** A `placeholder` is not a name — it vanishes on input
      (SC 1.3.1, 3.3.2, 4.1.2). Verify via the **accessibility tree**, not DOM presence (**U24**).
- [ ] **Never convey state by colour alone** (SC 1.4.1). Dimming is not a disabled state.
- [ ] **`aria-disabled` on a role-less `<div>` is not announced.** It is only meaningful on
      elements with a widget role. Use a real role, or visually-hidden text.
- [ ] **Interactive targets ≥ 44px** (SC 2.5.8 floor is 24px; platform guidance is 44px) (**U19**).
- [ ] **Text contrast ≥ 4.5:1 against its actual container.** Check against `--card`, not just
      `--background` — cards are the dominant surface and passed on one while failing the other
      (**U21**).
- [ ] `aria-current` on the active nav item (**U18**).
- [ ] Progress/meter elements need an accessible name (**U12**).
- [ ] Test focus indicators with **real `Tab` presses**. Programmatic `.focus()` does not reliably
      trigger `:focus-visible` and will produce false failures.

## 5. Forms and Server Actions

Four attempts to fix one checkbox (**U10**, **U13**, **U14**), including one regression.

- [ ] **Assert on submitted `FormData`, not the DB outcome.** Inferring intent from what landed in
      Postgres hides the actual defect (**U10**).
- [ ] React 19 resets controlled `checked` to its **mount-time** value after an action. The `reset`
      event fires *before* the reset algorithm runs, so a listener cannot observe the final state.
- [ ] Radix Checkbox registers a `reset` listener keyed only on **form nesting**, not on `name`.
- [ ] A control whose visible state can diverge from its submitted value is a bug even when the DB
      write is correct (**U13**, **U14**).
- [ ] **After changing the mechanism, re-run the original repro** — not just the new path. U10 was
      declared fixed, then silently regressed in `85bf60b`.

## 6. Docs and guardrails

- [ ] **Update the ADR in the same change that contradicts it.** U20 existed only because the nav
      changed and ADR-007 kept describing the old one.
- [ ] **Never leave an undocumented guardrail deviation.** ADR-007 forbids any diff under
      `src/lib/**` except `utils.ts` / `motion.ts`, explicitly including `schemas/`, `supabase/`,
      `today.ts`, `rate-limit.ts`. Breaching it may be right on the merits — `domains.ts` was — but
      it must be recorded in the ADR, or the next session finds a diff the rule says cannot exist
      and stops trusting the rule (**U4**, **U7**, and the 2026-08-20 `domains.ts` breach).
- [ ] Guardrail carve-outs must name paths the rule actually covers (**U7**).

## 7. Shipping hygiene

- [ ] **Do not stack unreviewed work.** Phase 8 + Phase 9 reached ~600 insertions across 17 files
      on a single unreviewed diff, which makes bisecting a regression impossible. Flagged as `D2`
      in the Phase 0 audit and still recurring.
- [ ] No dead code. `select.tsx` was committed and never imported (**U11**).
- [ ] Fonts that are loaded must be applied (**U5**); `--font-mono` must point at a monospace
      face (**U8**).
- [ ] Deviating from the reference is fine; **silently** deviating is not.

---

## Appendix — what each check can and cannot catch

| Check | Catches | Blind to |
|---|---|---|
| `tsc` | type errors | RSC boundary values, computed styles, a11y |
| `eslint` | lint rules | everything above |
| `vitest` | engine logic | anything rendered |
| `next build` | build-time errors | **cookie-reading dynamic routes** — where U16 and U30 both lived |
| `npm run smoke` | route 500s | styling, a11y, behaviour |
| browser pass | the rest | — |

No single row is sufficient. The bottom two rows are the ones that have actually caught Criticals.

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const rawFormElement = (tag, component) => ({
  selector: `JSXOpeningElement[name.name='${tag}']`,
  message: `Use the shared <${component}> from @/components/ui/${component.toLowerCase()} instead of a raw <${tag}>. If this one genuinely can't (documented reason required, e.g. the frequency <select>'s FormData constraint), disable this rule for the line and say why.`,
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // ADR-007 Phase 3 existed specifically to de-duplicate hand-copied
    // Tailwind form-element markup into shared components -- this rule is
    // the mechanical version of that review, so it doesn't have to be
    // caught by a human every time.
    //
    // Applies everywhere except the three files that ARE the base
    // primitives (button.tsx/input.tsx/textarea.tsx each wrap exactly one
    // raw element, once). Everything else under src/components/ui/ is
    // expected to compose those, not reach past them -- form-checkbox.tsx
    // hand-rolling its own <button>/<input> instead of using Button/Input
    // is exactly the mistake a blanket directory exemption let through
    // uncaught; a per-file allowlist doesn't have that gap.
    files: ["src/**/*.tsx"],
    // Maintenance: adding a new base primitive that legitimately wraps a
    // raw <button>/<input>/<textarea> for the first time (not composing
    // Button/Input/Textarea) makes this rule fail on that new file by
    // design -- that's the signal to add its path here, not a bug to work
    // around. If a new file trips this and it's NOT a first-time wrapper,
    // it should compose the existing primitive instead of joining this list.
    ignores: [
      "src/components/ui/button.tsx",
      "src/components/ui/input.tsx",
      "src/components/ui/textarea.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        rawFormElement("button", "Button"),
        rawFormElement("input", "Input"),
        rawFormElement("textarea", "Textarea"),
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // supabase/.temp is gitignored (supabase/.gitignore) but ESLint's flat
    // config doesn't respect .gitignore automatically -- `supabase start`
    // drops a minified edge-runtime vendor file in here that isn't ours to
    // lint (discovered when it produced 150+ prefer-const/no-var errors
    // the moment local Supabase was first started).
    "supabase/.temp/**",
    // docs/reference/client-ui-prototype.tsx is the client's UI/UX reference,
    // saved verbatim -- not wired into the app (its own header comment says
    // so explicitly), so it isn't ours to lint either.
    "docs/reference/**",
  ]),
]);

export default eslintConfig;

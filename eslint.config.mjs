import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
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

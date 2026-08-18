import path from "node:path";
import { defineConfig } from "vitest/config";

// Separate from vitest.config.mts on purpose (audit finding D7): these tests
// make real HTTP calls to a running local Supabase stack (`supabase start`,
// which needs Docker) and must never share a test run with the fast,
// network-free pure-unit suite. Run via `npm run test:rls`.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.integration.test.ts"],
    // RLS-isolation tests do real signups + Postgres round-trips per case;
    // the local stack is fast, but give it more room than the 5s unit-test
    // default before a hung request fails the whole run.
    testTimeout: 20_000,
  },
});

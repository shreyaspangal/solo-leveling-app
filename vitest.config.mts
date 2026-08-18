import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    // Integration tests need a running local Supabase (`supabase start`,
    // which needs Docker) and hit it over real HTTP -- kept out of the fast
    // pure-unit run. See vitest.config.integration.mts / `npm run test:rls`.
    exclude: ["**/node_modules/**", "**/*.integration.test.ts"],
  },
});

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { supabaseAnonKey, supabaseUrl } from "./env";

describe("supabaseUrl / supabaseAnonKey", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the value when the env var is set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    expect(supabaseUrl()).toBe("https://example.supabase.co");
    expect(supabaseAnonKey()).toBe("test-anon-key");
  });

  it("throws a clear error when the env var is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(() => supabaseUrl()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  // Audit finding P1-9: process.env[name] (a dynamic key) reads correctly
  // under Node/Vitest -- Node has a real process.env regardless of how it's
  // indexed -- but Next.js's bundler only inlines NEXT_PUBLIC_* values into
  // the client bundle for STATIC literal access (process.env.THE_NAME), so
  // the same code silently returns undefined in every browser session.
  // Vitest never runs through that bundling step, so no runtime test here
  // can reproduce the actual failure -- this instead guards the source
  // pattern directly: fail the build if a dynamic env-var read reappears.
  it("reads env vars via static literal property access, not a dynamic key", () => {
    const source = readFileSync(new URL("./env.ts", import.meta.url), "utf-8");
    expect(source).not.toMatch(/process\.env\[/);
    expect(source).toContain("process.env.NEXT_PUBLIC_SUPABASE_URL");
    expect(source).toContain("process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });
});

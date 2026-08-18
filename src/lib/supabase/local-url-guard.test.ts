import { describe, expect, it } from "vitest";
import { isLocalSupabaseUrl } from "./local-url-guard";

describe("isLocalSupabaseUrl", () => {
  it("accepts the default local Supabase URL", () => {
    expect(isLocalSupabaseUrl("http://127.0.0.1:54321")).toBe(true);
  });

  it("accepts localhost, case-insensitively", () => {
    expect(isLocalSupabaseUrl("http://localhost:54321")).toBe(true);
    expect(isLocalSupabaseUrl("http://LOCALHOST:54321")).toBe(true);
  });

  it("accepts the IPv6 loopback address", () => {
    expect(isLocalSupabaseUrl("http://[::1]:54321")).toBe(true);
  });

  it("rejects the real linked/remote project", () => {
    expect(isLocalSupabaseUrl("https://qmhrfmrmpxqhcoekgwau.supabase.co")).toBe(false);
  });

  it("rejects a userinfo bypass (audit finding D8)", () => {
    // The regex this guard used to be built on matched this string because
    // "localhost:54321" appears in it -- but it's the URL's userinfo
    // component (a username:password@ prefix), and the real hostname is
    // evil.com. A real URL parser assigns it correctly.
    expect(isLocalSupabaseUrl("http://localhost:54321@evil.com/")).toBe(false);
  });

  it("rejects hostname-suffix lookalikes", () => {
    expect(isLocalSupabaseUrl("http://localhost.evil.com/")).toBe(false);
    expect(isLocalSupabaseUrl("http://127.0.0.1.evil.com/")).toBe(false);
  });

  it("rejects a malformed URL rather than throwing", () => {
    expect(isLocalSupabaseUrl("not a url")).toBe(false);
  });
});

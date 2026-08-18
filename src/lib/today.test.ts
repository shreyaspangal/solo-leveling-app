import { describe, expect, it } from "vitest";
import { todayInTimezone } from "./today";

describe("todayInTimezone", () => {
  // A fixed moment that straddles the UTC day boundary, so timezones ahead
  // of and behind UTC land on different calendar days (ADR-006).
  const moment = new Date("2026-01-15T01:00:00Z");

  it("computes the correct local day for timezones ahead of UTC", () => {
    // Auckland is well ahead of UTC -- already the 15th there.
    expect(todayInTimezone("Pacific/Auckland", moment)).toBe("2026-01-15");
  });

  it("computes the correct local day for timezones behind UTC", () => {
    // Los Angeles is behind UTC -- still the 14th there at this moment.
    expect(todayInTimezone("America/Los_Angeles", moment)).toBe("2026-01-14");
  });

  it("computes the correct local day across a representative timezone set", () => {
    expect(todayInTimezone("Asia/Kolkata", moment)).toBe("2026-01-15");
    expect(todayInTimezone("Europe/London", moment)).toBe("2026-01-15");
    expect(todayInTimezone("America/New_York", moment)).toBe("2026-01-14");
  });

  it("matches the UTC day for the UTC timezone itself", () => {
    expect(todayInTimezone("UTC", moment)).toBe("2026-01-15");
  });

  it("falls back to UTC for a missing timezone", () => {
    expect(todayInTimezone(undefined, moment)).toBe(todayInTimezone("UTC", moment));
  });

  it("falls back to UTC for an invalid/corrupted timezone string, without throwing", () => {
    expect(todayInTimezone("Not/AZone", moment)).toBe(todayInTimezone("UTC", moment));
  });

  it("defaults `now` to the current time when not provided", () => {
    const result = todayInTimezone("UTC");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

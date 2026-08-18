import { describe, expect, it } from "vitest";
import { isoDate } from "./common";

describe("isoDate", () => {
  it("accepts a well-formed YYYY-MM-DD string", () => {
    expect(isoDate.safeParse("2026-01-05").success).toBe(true);
  });

  it.each([
    "2026-1-5", // not zero-padded
    "01-05-2026", // wrong order
    "2026/01/05", // wrong separator
    "2026-01-05T00:00:00Z", // datetime, not date
    "not-a-date",
    "",
  ])("rejects %s", (value) => {
    expect(isoDate.safeParse(value).success).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toUserError } from "./errors";

describe("toUserError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a generic message, never the raw error", () => {
    const message = toUserError(
      { message: 'new row for relation "goals" violates check constraint "goals_frequency_check"' },
      "createQuest",
    );
    expect(message).not.toMatch(/goals|constraint|relation/i);
  });

  it("logs the real error server-side, tagged with the calling context", () => {
    const consoleError = vi.spyOn(console, "error");
    toUserError({ message: "boom" }, "createQuest");
    expect(consoleError).toHaveBeenCalledWith("[createQuest]", "boom");
  });
});

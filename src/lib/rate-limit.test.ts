import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimitStore } from "./rate-limit";

beforeEach(() => {
  resetRateLimitStore();
});

describe("checkRateLimit", () => {
  it("allows requests up to the limit", () => {
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit("ip:1", { limit: 5, windowMs: 60_000 }, 0);
      expect(result.limited).toBe(false);
    }
  });

  it("blocks the request after the limit is reached", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("ip:1", { limit: 5, windowMs: 60_000 }, 0);
    }
    const sixth = checkRateLimit("ip:1", { limit: 5, windowMs: 60_000 }, 0);
    expect(sixth.limited).toBe(true);
    expect(sixth.remaining).toBe(0);
  });

  it("tracks identifiers independently", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("ip:1", { limit: 5, windowMs: 60_000 }, 0);
    }
    const otherIp = checkRateLimit("ip:2", { limit: 5, windowMs: 60_000 }, 0);
    expect(otherIp.limited).toBe(false);
  });

  it("allows requests again once the window has fully passed", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("ip:1", { limit: 5, windowMs: 60_000 }, 0);
    }
    const afterWindow = checkRateLimit("ip:1", { limit: 5, windowMs: 60_000 }, 60_001);
    expect(afterWindow.limited).toBe(false);
  });

  it("slides the window rather than resetting all at once", () => {
    // Five attempts spread 10ms apart, limit 5 per 100ms.
    checkRateLimit("ip:1", { limit: 5, windowMs: 100 }, 0);
    checkRateLimit("ip:1", { limit: 5, windowMs: 100 }, 10);
    checkRateLimit("ip:1", { limit: 5, windowMs: 100 }, 20);
    checkRateLimit("ip:1", { limit: 5, windowMs: 100 }, 30);
    checkRateLimit("ip:1", { limit: 5, windowMs: 100 }, 40);

    // At t=105, only the t=0 attempt has aged out (105 - 100 = 5, so only
    // timestamps > 5 survive) -- one slot should have freed up, not all five.
    const result = checkRateLimit("ip:1", { limit: 5, windowMs: 100 }, 105);
    expect(result.limited).toBe(false);
    expect(result.remaining).toBe(0); // consumed the one freed-up slot
  });

  it("reports remaining attempts accurately", () => {
    const first = checkRateLimit("ip:1", { limit: 5, windowMs: 60_000 }, 0);
    expect(first.remaining).toBe(4);
  });
});

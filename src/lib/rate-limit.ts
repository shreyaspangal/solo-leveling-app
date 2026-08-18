// Sliding-window rate limiter (audit finding S1). Pure and framework-agnostic
// by design -- `now` is injected rather than read from Date.now() internally,
// so tests are deterministic without fake timers.
//
// LIMITATION, not yet resolved: this store is an in-memory Map, scoped to a
// single server process. On Vercel's serverless/edge runtime a user's
// requests can land on different instances, so this does NOT enforce a
// global limit in a multi-instance production deployment -- it only bounds
// abuse within one warm instance. Before this app takes real production
// traffic, the store needs to move to something shared across instances
// (Vercel KV / Upstash Redis are the natural fit here, per the
// api-rate-limiting skill's guidance for serverless deployments). Tracked as
// a guardrail in docs/audit/PHASE_0_AUDIT.md.

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  limited: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  identifier: string,
  { limit, windowMs }: RateLimitOptions,
  now: number = Date.now(),
): RateLimitResult {
  const windowStart = now - windowMs;
  const entry = store.get(identifier) ?? { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  const limited = entry.timestamps.length >= limit;
  if (!limited) {
    entry.timestamps.push(now);
  }

  if (entry.timestamps.length === 0) {
    store.delete(identifier); // avoid leaking an entry per distinct IP forever
  } else {
    store.set(identifier, entry);
  }

  return {
    limited,
    remaining: Math.max(0, limit - entry.timestamps.length),
    resetAt: (entry.timestamps[0] ?? now) + windowMs,
  };
}

export function resetRateLimitStore(): void {
  store.clear();
}

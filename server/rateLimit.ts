const buckets = new Map<string, { count: number; resetAt: number }>();

/** Periodic eviction so idle IPs don't accumulate forever on a public server. */
let nextSweep = 0;
const SWEEP_INTERVAL_MS = 60_000;

function sweep(now: number): void {
  if (now < nextSweep) return;
  nextSweep = now + SWEEP_INTERVAL_MS;
  for (const [key, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(key);
  }
}

export function rateLimit(
  key: string,
  maxPerWindow: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  sweep(now);
  let b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  if (b.count > maxPerWindow) {
    return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { ok: true };
}

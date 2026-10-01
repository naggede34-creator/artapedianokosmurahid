// In-memory rate limiter — resets on cold start (serverless), good enough for
// abuse prevention. For multi-instance deployments, swap the Map with Redis.

const store = new Map(); // key -> { count, resetAt }

/**
 * @param {string} key    - e.g. `${ip}:transfer`
 * @param {number} limit  - max requests in the window
 * @param {number} windowMs - window length in ms
 * @returns {boolean} true = allowed, false = rate limited
 */
export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

/**
 * Versi berinfo untuk API publik: mengembalikan sisa jatah & waktu reset (untuk header X-RateLimit-*).
 * @returns {{ ok: boolean, limit: number, sisa: number, resetAt: number }}
 */
export function rateLimitInfo(key, limit, windowMs) {
  const now = Date.now();
  let entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }
  if (entry.count >= limit) return { ok: false, limit, sisa: 0, resetAt: entry.resetAt };
  entry.count += 1;
  return { ok: true, limit, sisa: Math.max(0, limit - entry.count), resetAt: entry.resetAt };
}

// Periodically clean up expired entries to avoid unbounded memory growth.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now > v.resetAt) store.delete(k);
  }
}, 60_000);

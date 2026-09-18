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

// Periodically clean up expired entries to avoid unbounded memory growth.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now > v.resetAt) store.delete(k);
  }
}, 60_000);

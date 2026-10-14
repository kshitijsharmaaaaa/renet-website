/*
  Small in-memory, per-IP fixed-window rate limiter.
  Good for a single server instance. With several instances behind a load
  balancer, move this to a shared store (e.g. Redis) so limits are global.
*/
export function createRateLimiter({ windowMs, max, message, maxTrackedIps = 50_000 }) {
  const hits = new Map();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now - entry.start >= windowMs) hits.delete(key);
    }
  }, windowMs);
  cleanup.unref();

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = req.ip || "unknown";
    let entry = hits.get(key);
    if (!entry || now - entry.start >= windowMs) {
      // Bound memory under a many-IP flood: evict the oldest tracked entries.
      if (!entry && hits.size >= maxTrackedIps) {
        const evict = hits.keys();
        for (let i = 0; i < Math.ceil(maxTrackedIps / 10); i++) hits.delete(evict.next().value);
      }
      entry = { start: now, count: 0 };
      hits.delete(key);
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader("Retry-After", Math.ceil((entry.start + windowMs - now) / 1000));
      return res.status(429).json({ error: message });
    }
    next();
  };
}

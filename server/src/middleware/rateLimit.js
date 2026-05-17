import { rateLimited } from '../lib/errors.js';

const WINDOW_MS = 60 * 1000;
const MAX_REQ = 30;
const buckets = new Map();

setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, times] of buckets) {
    const filtered = times.filter((t) => t > cutoff);
    if (filtered.length === 0) buckets.delete(key);
    else buckets.set(key, filtered);
  }
}, WINDOW_MS).unref();

export function rateLimit(req, _res, next) {
  if (req.path === '/api/healthz' || req.path === '/api/events') return next();
  const key = req.visitorId;
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const recent = (buckets.get(key) || []).filter((t) => t > cutoff);
  if (recent.length >= MAX_REQ) {
    return next(rateLimited(`Rate limit exceeded (${MAX_REQ}/min)`));
  }
  recent.push(now);
  buckets.set(key, recent);
  next();
}

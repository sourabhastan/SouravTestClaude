import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

const BUILD_TIME = process.env.BUILD_TIME || new Date().toISOString();
const ping = db.prepare('SELECT 1 AS ok');

router.get('/healthz', (_req, res) => {
  const start = process.hrtime.bigint();
  ping.get();
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  res.json({
    ok: true,
    build_time: BUILD_TIME,
    db_latency_ms: Math.round(elapsedMs * 1000) / 1000,
  });
});

export default router;

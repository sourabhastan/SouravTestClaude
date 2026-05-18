import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

const BUILD_TIME =
  process.env.BUILD_TIME ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  new Date().toISOString();

router.get('/healthz', async (_req, res, next) => {
  try {
    const start = process.hrtime.bigint();
    await pool.query('SELECT 1');
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    res.json({
      ok: true,
      build_time: BUILD_TIME,
      db_latency_ms: Math.round(elapsedMs * 1000) / 1000,
    });
  } catch (e) {
    next(e);
  }
});

export default router;

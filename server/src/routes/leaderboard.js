import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.get('/leaderboard', async (_req, res, next) => {
  try {
    const r = await pool.query(`
      SELECT t.id, t.title, t.speaker_name, COUNT(v.id)::int AS vote_count
      FROM talks t
      LEFT JOIN votes v ON v.talk_id = t.id
      GROUP BY t.id
      ORDER BY vote_count DESC, t.created_at ASC
      LIMIT 5
    `);
    res.json(r.rows);
  } catch (e) {
    next(e);
  }
});

export default router;

import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

router.get('/leaderboard', async (_req, res, next) => {
  try {
    const r = await db.execute(`
      SELECT t.id, t.title, t.speaker_name, COUNT(v.id) AS vote_count
      FROM talks t
      LEFT JOIN votes v ON v.talk_id = t.id
      GROUP BY t.id
      ORDER BY vote_count DESC, t.created_at ASC
      LIMIT 5
    `);
    res.json(
      r.rows.map((row) => ({
        id: Number(row.id),
        title: row.title,
        speaker_name: row.speaker_name,
        vote_count: Number(row.vote_count),
      }))
    );
  } catch (e) {
    next(e);
  }
});

export default router;

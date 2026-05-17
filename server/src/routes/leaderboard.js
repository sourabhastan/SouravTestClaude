import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

const topTalks = db.prepare(`
  SELECT t.id, t.title, t.speaker_name, COUNT(v.id) AS vote_count
  FROM talks t
  LEFT JOIN votes v ON v.talk_id = t.id
  GROUP BY t.id
  ORDER BY vote_count DESC, t.created_at ASC
  LIMIT 5
`);

router.get('/leaderboard', (_req, res) => {
  res.json(topTalks.all());
});

export default router;

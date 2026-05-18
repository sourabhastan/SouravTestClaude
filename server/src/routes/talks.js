import { Router } from 'express';
import { pool } from '../db.js';
import { notFound } from '../lib/errors.js';
import { broadcast } from '../lib/sse.js';
import { cleanText } from '../lib/sanitize.js';
import { validateTalkInput, validateCommentInput } from '../middleware/validate.js';

const router = Router();

async function getTalk(id) {
  const r = await pool.query('SELECT * FROM talks WHERE id = $1', [id]);
  return r.rows[0] || null;
}

async function getVoteCount(id) {
  const r = await pool.query(
    'SELECT COUNT(*)::int AS c FROM votes WHERE talk_id = $1',
    [id]
  );
  return r.rows[0].c;
}

async function getHasVoted(talkId, visitorId) {
  const r = await pool.query(
    'SELECT 1 FROM votes WHERE talk_id = $1 AND visitor_id = $2 LIMIT 1',
    [talkId, visitorId]
  );
  return r.rowCount > 0;
}

function toIso(d) {
  return d instanceof Date ? d.toISOString() : d;
}

router.post('/talks', async (req, res, next) => {
  try {
    const { title, abstract, speaker_name } = req.body || {};
    validateTalkInput({ title, abstract, speaker_name });
    const safe = {
      title: cleanText(title),
      abstract: cleanText(abstract),
      speaker_name: cleanText(speaker_name),
    };
    const ins = await pool.query(
      `INSERT INTO talks (title, abstract, speaker_name)
       VALUES ($1, $2, $3)
       RETURNING id, title, abstract, speaker_name, created_at`,
      [safe.title, safe.abstract, safe.speaker_name]
    );
    const talk = ins.rows[0];
    const full = {
      id: talk.id,
      title: talk.title,
      abstract: talk.abstract,
      speaker_name: talk.speaker_name,
      created_at: toIso(talk.created_at),
      vote_count: 0,
      has_voted: false,
    };
    broadcast('talk_created', { id: talk.id, vote_count: 0 });
    res.status(201).json(full);
  } catch (e) {
    next(e);
  }
});

router.get('/talks', async (req, res, next) => {
  try {
    const rowsRes = await pool.query(`
      SELECT t.id, t.title, t.abstract, t.speaker_name, t.created_at,
             COUNT(v.id)::int AS vote_count
      FROM talks t
      LEFT JOIN votes v ON v.talk_id = t.id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `);
    const votedRes = await pool.query(
      'SELECT talk_id FROM votes WHERE visitor_id = $1',
      [req.visitorId]
    );
    const voted = new Set(votedRes.rows.map((r) => r.talk_id));
    res.json(
      rowsRes.rows.map((r) => ({
        id: r.id,
        title: r.title,
        abstract: r.abstract,
        speaker_name: r.speaker_name,
        created_at: toIso(r.created_at),
        vote_count: r.vote_count,
        has_voted: voted.has(r.id),
      }))
    );
  } catch (e) {
    next(e);
  }
});

router.get('/talks/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const talk = await getTalk(id);
    if (!talk) throw notFound('Talk not found');
    const count = await getVoteCount(id);
    const voted = await getHasVoted(id, req.visitorId);
    const cRes = await pool.query(
      `SELECT id, talk_id, body, author_name, created_at
       FROM comments WHERE talk_id = $1 ORDER BY created_at DESC`,
      [id]
    );
    res.json({
      id: talk.id,
      title: talk.title,
      abstract: talk.abstract,
      speaker_name: talk.speaker_name,
      created_at: toIso(talk.created_at),
      vote_count: count,
      has_voted: voted,
      comments: cRes.rows.map((c) => ({
        id: c.id,
        talk_id: c.talk_id,
        body: c.body,
        author_name: c.author_name,
        created_at: toIso(c.created_at),
      })),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/talks/:id/vote', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const talk = await getTalk(id);
    if (!talk) throw notFound('Talk not found');
    await pool.query(
      `INSERT INTO votes (talk_id, visitor_id) VALUES ($1, $2)
       ON CONFLICT (talk_id, visitor_id) DO NOTHING`,
      [id, req.visitorId]
    );
    const count = await getVoteCount(id);
    broadcast('vote', { talk_id: id, vote_count: count });
    res.json({ talk_id: id, vote_count: count, has_voted: true });
  } catch (e) {
    next(e);
  }
});

router.post('/talks/:id/comments', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const talk = await getTalk(id);
    if (!talk) throw notFound('Talk not found');
    const { body, author_name } = req.body || {};
    validateCommentInput({ body, author_name });
    const safe = {
      body: cleanText(body),
      author_name: cleanText(author_name),
    };
    const ins = await pool.query(
      `INSERT INTO comments (talk_id, body, author_name)
       VALUES ($1, $2, $3)
       RETURNING id, talk_id, body, author_name, created_at`,
      [id, safe.body, safe.author_name]
    );
    const c = ins.rows[0];
    const comment = {
      id: c.id,
      talk_id: c.talk_id,
      body: c.body,
      author_name: c.author_name,
      created_at: toIso(c.created_at),
    };
    broadcast('comment', comment);
    res.status(201).json(comment);
  } catch (e) {
    next(e);
  }
});

export default router;

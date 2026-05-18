import { Router } from 'express';
import { db } from '../db.js';
import { notFound } from '../lib/errors.js';
import { broadcast } from '../lib/sse.js';
import { cleanText } from '../lib/sanitize.js';
import { validateTalkInput, validateCommentInput } from '../middleware/validate.js';

const router = Router();

async function getTalk(id) {
  const r = await db.execute({
    sql: 'SELECT * FROM talks WHERE id = ?',
    args: [id],
  });
  return r.rows[0] || null;
}

async function getVoteCount(id) {
  const r = await db.execute({
    sql: 'SELECT COUNT(*) AS c FROM votes WHERE talk_id = ?',
    args: [id],
  });
  return Number(r.rows[0].c);
}

async function getHasVoted(talkId, visitorId) {
  const r = await db.execute({
    sql: 'SELECT 1 AS x FROM votes WHERE talk_id = ? AND visitor_id = ? LIMIT 1',
    args: [talkId, visitorId],
  });
  return r.rows.length > 0;
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
    const ins = await db.execute({
      sql: 'INSERT INTO talks (title, abstract, speaker_name) VALUES (?, ?, ?)',
      args: [safe.title, safe.abstract, safe.speaker_name],
    });
    const id = Number(ins.lastInsertRowid);
    const talk = await getTalk(id);
    const full = { ...talk, id, vote_count: 0, has_voted: false };
    broadcast('talk_created', { id, vote_count: 0 });
    res.status(201).json(full);
  } catch (e) {
    next(e);
  }
});

router.get('/talks', async (req, res, next) => {
  try {
    const rowsRes = await db.execute(`
      SELECT t.id, t.title, t.abstract, t.speaker_name, t.created_at,
             COUNT(v.id) AS vote_count
      FROM talks t
      LEFT JOIN votes v ON v.talk_id = t.id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `);
    const votedRes = await db.execute({
      sql: 'SELECT talk_id FROM votes WHERE visitor_id = ?',
      args: [req.visitorId],
    });
    const voted = new Set(votedRes.rows.map((r) => Number(r.talk_id)));
    res.json(
      rowsRes.rows.map((r) => ({
        id: Number(r.id),
        title: r.title,
        abstract: r.abstract,
        speaker_name: r.speaker_name,
        created_at: r.created_at,
        vote_count: Number(r.vote_count),
        has_voted: voted.has(Number(r.id)),
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
    const cRes = await db.execute({
      sql: `SELECT id, talk_id, body, author_name, created_at
            FROM comments WHERE talk_id = ? ORDER BY created_at DESC`,
      args: [id],
    });
    res.json({
      id: Number(talk.id),
      title: talk.title,
      abstract: talk.abstract,
      speaker_name: talk.speaker_name,
      created_at: talk.created_at,
      vote_count: count,
      has_voted: voted,
      comments: cRes.rows.map((c) => ({
        id: Number(c.id),
        talk_id: Number(c.talk_id),
        body: c.body,
        author_name: c.author_name,
        created_at: c.created_at,
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
    await db.execute({
      sql: 'INSERT OR IGNORE INTO votes (talk_id, visitor_id) VALUES (?, ?)',
      args: [id, req.visitorId],
    });
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
    const ins = await db.execute({
      sql: 'INSERT INTO comments (talk_id, body, author_name) VALUES (?, ?, ?)',
      args: [id, safe.body, safe.author_name],
    });
    const comment = {
      id: Number(ins.lastInsertRowid),
      talk_id: id,
      body: safe.body,
      author_name: safe.author_name,
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
    broadcast('comment', comment);
    res.status(201).json(comment);
  } catch (e) {
    next(e);
  }
});

export default router;

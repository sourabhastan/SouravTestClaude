import { Router } from 'express';
import { db } from '../db.js';
import { notFound } from '../lib/errors.js';
import { broadcast } from '../lib/sse.js';
import { cleanText } from '../lib/sanitize.js';
import { validateTalkInput, validateCommentInput } from '../middleware/validate.js';

const router = Router();

const insertTalk = db.prepare(
  `INSERT INTO talks (title, abstract, speaker_name) VALUES (?, ?, ?)`
);
const selectTalk = db.prepare(`SELECT * FROM talks WHERE id = ?`);
const listTalksSql = db.prepare(`
  SELECT t.id, t.title, t.abstract, t.speaker_name, t.created_at,
         COUNT(v.id) AS vote_count
  FROM talks t
  LEFT JOIN votes v ON v.talk_id = t.id
  GROUP BY t.id
  ORDER BY t.created_at DESC
`);
const visitorVotes = db.prepare(
  `SELECT talk_id FROM votes WHERE visitor_id = ?`
);
const insertVote = db.prepare(
  `INSERT OR IGNORE INTO votes (talk_id, visitor_id) VALUES (?, ?)`
);
const voteCount = db.prepare(
  `SELECT COUNT(*) AS c FROM votes WHERE talk_id = ?`
);
const hasVoted = db.prepare(
  `SELECT 1 FROM votes WHERE talk_id = ? AND visitor_id = ?`
);
const insertComment = db.prepare(
  `INSERT INTO comments (talk_id, body, author_name) VALUES (?, ?, ?)`
);
const listComments = db.prepare(
  `SELECT id, talk_id, body, author_name, created_at
   FROM comments WHERE talk_id = ? ORDER BY created_at DESC`
);

router.post('/talks', (req, res, next) => {
  try {
    const { title, abstract, speaker_name } = req.body || {};
    validateTalkInput({ title, abstract, speaker_name });
    const safe = {
      title: cleanText(title),
      abstract: cleanText(abstract),
      speaker_name: cleanText(speaker_name),
    };
    const info = insertTalk.run(safe.title, safe.abstract, safe.speaker_name);
    const talk = selectTalk.get(info.lastInsertRowid);
    const full = { ...talk, vote_count: 0, has_voted: false };
    broadcast('talk_created', { id: talk.id, vote_count: 0 });
    res.status(201).json(full);
  } catch (e) {
    next(e);
  }
});

router.get('/talks', (req, res, next) => {
  try {
    const rows = listTalksSql.all();
    const voted = new Set(
      visitorVotes.all(req.visitorId).map((r) => r.talk_id)
    );
    res.json(
      rows.map((r) => ({ ...r, has_voted: voted.has(r.id) }))
    );
  } catch (e) {
    next(e);
  }
});

router.get('/talks/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const talk = selectTalk.get(id);
    if (!talk) throw notFound('Talk not found');
    const count = voteCount.get(id).c;
    const voted = !!hasVoted.get(id, req.visitorId);
    const comments = listComments.all(id);
    res.json({
      ...talk,
      vote_count: count,
      has_voted: voted,
      comments,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/talks/:id/vote', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const talk = selectTalk.get(id);
    if (!talk) throw notFound('Talk not found');
    insertVote.run(id, req.visitorId);
    const count = voteCount.get(id).c;
    broadcast('vote', { talk_id: id, vote_count: count });
    res.json({ talk_id: id, vote_count: count, has_voted: true });
  } catch (e) {
    next(e);
  }
});

router.post('/talks/:id/comments', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const talk = selectTalk.get(id);
    if (!talk) throw notFound('Talk not found');
    const { body, author_name } = req.body || {};
    validateCommentInput({ body, author_name });
    const safe = {
      body: cleanText(body),
      author_name: cleanText(author_name),
    };
    const info = insertComment.run(id, safe.body, safe.author_name);
    const comment = {
      id: info.lastInsertRowid,
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

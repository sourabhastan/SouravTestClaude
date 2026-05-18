import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { cleanText } from './sanitize.js';
import {
  ApiError,
  errorResponseBody,
  notFound,
  rateLimited,
  validateCommentInput,
  validateTalkInput,
} from './validate.js';

const BUILD_TIME = new Date().toISOString();
const ONE_YEAR_S = 365 * 24 * 60 * 60;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const UUID_RE = /^[0-9a-f-]{36}$/i;

const buckets = new Map();

function checkRateLimit(visitorId) {
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  const recent = (buckets.get(visitorId) || []).filter((t) => t > cutoff);
  if (recent.length >= RATE_MAX) {
    throw rateLimited(`Rate limit exceeded (${RATE_MAX}/min)`);
  }
  recent.push(now);
  buckets.set(visitorId, recent);
}

const app = new Hono();

app.use('*', async (c, next) => {
  let visitorId = getCookie(c, 'visitor_id');
  if (!visitorId || !UUID_RE.test(visitorId)) {
    visitorId = crypto.randomUUID();
    const isHttps = new URL(c.req.url).protocol === 'https:';
    setCookie(c, 'visitor_id', visitorId, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: isHttps,
      maxAge: ONE_YEAR_S,
      path: '/',
    });
  }
  c.set('visitorId', visitorId);
  await next();
});

app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/healthz') return next();
  try {
    checkRateLimit(c.get('visitorId'));
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return c.json(body, status);
  }
  return next();
});

app.onError((err, c) => {
  if (!(err instanceof ApiError)) {
    console.error('[worker]', err);
  }
  const { status, body } = errorResponseBody(err);
  return c.json(body, status);
});

app.get('/api/healthz', async (c) => {
  const start = Date.now();
  await c.env.DB.prepare('SELECT 1').first();
  return c.json({
    ok: true,
    build_time: BUILD_TIME,
    db_latency_ms: Date.now() - start,
  });
});

app.get('/api/events', (c) =>
  c.json(
    {
      error: {
        code: 'SSE_DISABLED',
        message:
          'Real-time stream is not available on Cloudflare Workers; client should poll.',
      },
    },
    503
  )
);

app.post('/api/talks', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  validateTalkInput(body);
  const safe = {
    title: cleanText(body.title),
    abstract: cleanText(body.abstract),
    speaker_name: cleanText(body.speaker_name),
  };
  const row = await c.env.DB.prepare(
    `INSERT INTO talks (title, abstract, speaker_name) VALUES (?, ?, ?)
     RETURNING id, title, abstract, speaker_name, created_at`
  )
    .bind(safe.title, safe.abstract, safe.speaker_name)
    .first();
  return c.json({ ...row, vote_count: 0, has_voted: false }, 201);
});

app.get('/api/talks', async (c) => {
  const visitorId = c.get('visitorId');
  const [listRes, votedRes] = await c.env.DB.batch([
    c.env.DB.prepare(`
      SELECT t.id, t.title, t.abstract, t.speaker_name, t.created_at,
             COUNT(v.id) AS vote_count
      FROM talks t
      LEFT JOIN votes v ON v.talk_id = t.id
      GROUP BY t.id
      ORDER BY t.created_at DESC, t.id DESC
    `),
    c.env.DB.prepare('SELECT talk_id FROM votes WHERE visitor_id = ?').bind(
      visitorId
    ),
  ]);
  const voted = new Set(
    (votedRes.results || []).map((r) => Number(r.talk_id))
  );
  return c.json(
    (listRes.results || []).map((r) => ({
      id: Number(r.id),
      title: r.title,
      abstract: r.abstract,
      speaker_name: r.speaker_name,
      created_at: r.created_at,
      vote_count: Number(r.vote_count),
      has_voted: voted.has(Number(r.id)),
    }))
  );
});

app.get('/api/talks/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) throw notFound('Talk not found');
  const visitorId = c.get('visitorId');
  const talk = await c.env.DB.prepare(
    'SELECT id, title, abstract, speaker_name, created_at FROM talks WHERE id = ?'
  )
    .bind(id)
    .first();
  if (!talk) throw notFound('Talk not found');
  const countRow = await c.env.DB.prepare(
    'SELECT COUNT(*) AS c FROM votes WHERE talk_id = ?'
  )
    .bind(id)
    .first();
  const votedRow = await c.env.DB.prepare(
    'SELECT 1 AS x FROM votes WHERE talk_id = ? AND visitor_id = ? LIMIT 1'
  )
    .bind(id, visitorId)
    .first();
  const commentsRes = await c.env.DB.prepare(
    `SELECT id, talk_id, body, author_name, created_at
     FROM comments WHERE talk_id = ? ORDER BY created_at DESC, id DESC`
  )
    .bind(id)
    .all();
  return c.json({
    id: Number(talk.id),
    title: talk.title,
    abstract: talk.abstract,
    speaker_name: talk.speaker_name,
    created_at: talk.created_at,
    vote_count: Number(countRow?.c || 0),
    has_voted: !!votedRow,
    comments: (commentsRes.results || []).map((cm) => ({
      id: Number(cm.id),
      talk_id: Number(cm.talk_id),
      body: cm.body,
      author_name: cm.author_name,
      created_at: cm.created_at,
    })),
  });
});

app.post('/api/talks/:id/vote', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) throw notFound('Talk not found');
  const visitorId = c.get('visitorId');
  const exists = await c.env.DB.prepare('SELECT 1 AS x FROM talks WHERE id = ?')
    .bind(id)
    .first();
  if (!exists) throw notFound('Talk not found');
  await c.env.DB.prepare(
    'INSERT OR IGNORE INTO votes (talk_id, visitor_id) VALUES (?, ?)'
  )
    .bind(id, visitorId)
    .run();
  const countRow = await c.env.DB.prepare(
    'SELECT COUNT(*) AS c FROM votes WHERE talk_id = ?'
  )
    .bind(id)
    .first();
  return c.json({
    talk_id: id,
    vote_count: Number(countRow?.c || 0),
    has_voted: true,
  });
});

app.post('/api/talks/:id/comments', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) throw notFound('Talk not found');
  const exists = await c.env.DB.prepare('SELECT 1 AS x FROM talks WHERE id = ?')
    .bind(id)
    .first();
  if (!exists) throw notFound('Talk not found');
  const body = await c.req.json().catch(() => ({}));
  validateCommentInput(body);
  const safe = {
    body: cleanText(body.body),
    author_name: cleanText(body.author_name),
  };
  const row = await c.env.DB.prepare(
    `INSERT INTO comments (talk_id, body, author_name) VALUES (?, ?, ?)
     RETURNING id, talk_id, body, author_name, created_at`
  )
    .bind(id, safe.body, safe.author_name)
    .first();
  return c.json(row, 201);
});

app.get('/api/leaderboard', async (c) => {
  const res = await c.env.DB.prepare(`
    SELECT t.id, t.title, t.speaker_name, COUNT(v.id) AS vote_count
    FROM talks t
    LEFT JOIN votes v ON v.talk_id = t.id
    GROUP BY t.id
    ORDER BY vote_count DESC, t.created_at ASC, t.id ASC
    LIMIT 5
  `).all();
  return c.json(
    (res.results || []).map((r) => ({
      id: Number(r.id),
      title: r.title,
      speaker_name: r.speaker_name,
      vote_count: Number(r.vote_count),
    }))
  );
});

app.all('/api/*', (c) =>
  c.json(
    { error: { code: 'NOT_FOUND', message: 'Route not found' } },
    404
  )
);

export default app;

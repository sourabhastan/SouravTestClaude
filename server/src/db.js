import { createClient } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

function buildUrl() {
  const url = process.env.TURSO_DATABASE_URL || 'file:./data/app.db';
  if (url.startsWith('file:')) {
    const path = url.slice('file:'.length);
    mkdirSync(dirname(path), { recursive: true });
  }
  return url;
}

export const db = createClient({
  url: buildUrl(),
  authToken: process.env.TURSO_AUTH_TOKEN,
});

let initPromise = null;

export function ensureDb() {
  if (!initPromise) initPromise = initialize();
  return initPromise;
}

async function initialize() {
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS talks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        abstract TEXT NOT NULL,
        speaker_name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        talk_id INTEGER NOT NULL REFERENCES talks(id) ON DELETE CASCADE,
        visitor_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(talk_id, visitor_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_votes_talk ON votes(talk_id)`,
      `CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        talk_id INTEGER NOT NULL REFERENCES talks(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        author_name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_comments_talk ON comments(talk_id)`,
    ],
    'write'
  );

  if (process.env.AUTO_SEED !== 'false') {
    const r = await db.execute('SELECT COUNT(*) AS c FROM talks');
    const count = Number(r.rows[0].c);
    if (count === 0) {
      const { SAMPLE_TALKS } = await import('./sampleTalks.js');
      for (const t of SAMPLE_TALKS) {
        await db.execute({
          sql: 'INSERT INTO talks (title, abstract, speaker_name) VALUES (?, ?, ?)',
          args: [t.title, t.abstract, t.speaker_name],
        });
      }
      console.log(`[db] auto-seeded ${SAMPLE_TALKS.length} talks`);
    }
  }
}

import pg from 'pg';
import { SAMPLE_TALKS } from './sampleTalks.js';

const connectionString =
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'No database connection string. Set POSTGRES_URL or DATABASE_URL.'
  );
}

export const pool = new pg.Pool({ connectionString });

export function query(sql, params) {
  return pool.query(sql, params);
}

let initPromise = null;

export function ensureDb() {
  if (!initPromise) initPromise = initialize();
  return initPromise;
}

async function initialize() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS talks (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        abstract TEXT NOT NULL,
        speaker_name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS votes (
        id SERIAL PRIMARY KEY,
        talk_id INTEGER NOT NULL REFERENCES talks(id) ON DELETE CASCADE,
        visitor_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(talk_id, visitor_id)
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_votes_talk ON votes(talk_id)`
    );
    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        talk_id INTEGER NOT NULL REFERENCES talks(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        author_name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_comments_talk ON comments(talk_id)`
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  if (process.env.AUTO_SEED !== 'false') {
    const r = await pool.query('SELECT COUNT(*)::int AS c FROM talks');
    if (r.rows[0].c === 0) {
      for (const t of SAMPLE_TALKS) {
        await pool.query(
          'INSERT INTO talks (title, abstract, speaker_name) VALUES ($1, $2, $3)',
          [t.title, t.abstract, t.speaker_name]
        );
      }
      console.log(`[db] auto-seeded ${SAMPLE_TALKS.length} talks`);
    }
  }
}

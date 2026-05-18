import { pool, ensureDb } from '../src/db.js';
import { SAMPLE_TALKS } from '../src/sampleTalks.js';

process.env.AUTO_SEED = 'false';
await ensureDb();

await pool.query('TRUNCATE comments, votes, talks RESTART IDENTITY CASCADE');

for (const t of SAMPLE_TALKS) {
  await pool.query(
    'INSERT INTO talks (title, abstract, speaker_name) VALUES ($1, $2, $3)',
    [t.title, t.abstract, t.speaker_name]
  );
}

console.log(`Seeded ${SAMPLE_TALKS.length} talks.`);
await pool.end();

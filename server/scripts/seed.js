import { db, ensureDb } from '../src/db.js';
import { SAMPLE_TALKS } from '../src/sampleTalks.js';

process.env.AUTO_SEED = 'false';
await ensureDb();

await db.batch(
  [
    'DELETE FROM comments',
    'DELETE FROM votes',
    'DELETE FROM talks',
    "DELETE FROM sqlite_sequence WHERE name IN ('talks','votes','comments')",
  ],
  'write'
);

for (const t of SAMPLE_TALKS) {
  await db.execute({
    sql: 'INSERT INTO talks (title, abstract, speaker_name) VALUES (?, ?, ?)',
    args: [t.title, t.abstract, t.speaker_name],
  });
}

console.log(`Seeded ${SAMPLE_TALKS.length} talks.`);
process.exit(0);

CREATE TABLE IF NOT EXISTS talks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  abstract TEXT NOT NULL,
  speaker_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  talk_id INTEGER NOT NULL REFERENCES talks(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(talk_id, visitor_id)
);
CREATE INDEX IF NOT EXISTS idx_votes_talk ON votes(talk_id);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  talk_id INTEGER NOT NULL REFERENCES talks(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  author_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_talk ON comments(talk_id);

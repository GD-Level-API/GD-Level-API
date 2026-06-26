CREATE TABLE IF NOT EXISTS comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  page        TEXT    NOT NULL DEFAULT 'general',
  discord_id  TEXT    NOT NULL,
  username    TEXT    NOT NULL,
  avatar      TEXT,
  content     TEXT    NOT NULL,
  is_bug      INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comments_page ON comments(page);
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at DESC);

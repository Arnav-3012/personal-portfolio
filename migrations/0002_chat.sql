-- One row per accepted /api/chat request (SPEC "EDITH tab", Limits). The per-IP hourly limit and the global daily
-- cap count recent rows, so they live in D1 (100,000 free writes a day) and not in KV (1,000). `ip_hash` is a
-- salted hash, never the address. Rows older than two days are pruned by the cron.
CREATE TABLE chat_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX chat_events_created ON chat_events (created_at);

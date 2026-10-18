-- Every accepted form submission (SPEC "Open to freelance": emailed to Arnav and stored so nothing is lost).
-- `fields` is the validated payload as JSON; `ip_hash` is a salted hash, never the address; `emailed` is 0 until
-- the message reaches the Email Routing binding (task 1.9's inbox lists the unsent ones).
CREATE TABLE submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('contact', 'freelance', 'notebook')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  fields TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  emailed INTEGER NOT NULL DEFAULT 0 CHECK (emailed IN (0, 1))
);

-- The per-hour and per-day limits (worker/forms.ts) count recent rows by time: without this index every
-- submission would scan the whole table and eat D1's 5M free row reads a day as the table grows.
CREATE INDEX submissions_created ON submissions (created_at);

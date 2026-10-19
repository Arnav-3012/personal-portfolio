-- /admin inbox (task 1.9): Arnav marks a message handled once he has replied.
ALTER TABLE submissions ADD COLUMN handled INTEGER NOT NULL DEFAULT 0 CHECK (handled IN (0, 1));

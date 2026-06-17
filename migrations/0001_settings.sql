CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  password TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (id, password) VALUES (1, 'change-me-now');

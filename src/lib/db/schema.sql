-- meshblog Phase 1 schema (single-user, no user_id)
-- content_hash is included from day 1 to support future incremental rebuild.

CREATE TABLE IF NOT EXISTS notes (
  id            TEXT PRIMARY KEY,         -- slug or stable id
  slug          TEXT UNIQUE NOT NULL,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  content_hash  TEXT NOT NULL,            -- sha256 of content; for v2 incremental
  folder_path   TEXT NOT NULL DEFAULT '/',
  tags          TEXT NOT NULL DEFAULT '[]', -- JSON array
  graph_status  TEXT NOT NULL DEFAULT 'pending', -- pending | done | failed
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS entities (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  mention_count   INTEGER NOT NULL DEFAULT 1,
  first_seen_at   TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(name, entity_type)
);

CREATE TABLE IF NOT EXISTS note_entities (
  note_id    TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  entity_id  INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, entity_id)
);

CREATE TABLE IF NOT EXISTS entity_relationships (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  source_entity_id    INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_entity_id    INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relationship        TEXT NOT NULL,
  confidence          REAL NOT NULL DEFAULT 0.5,
  source_type         TEXT NOT NULL DEFAULT 'INFERRED',
  UNIQUE(source_entity_id, target_entity_id, relationship)
);

CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
CREATE INDEX IF NOT EXISTS idx_note_entities_entity ON note_entities(entity_id);
CREATE INDEX IF NOT EXISTS idx_notes_hash ON notes(content_hash);

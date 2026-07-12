-- VibeCheck scan history + leaderboard.
-- One row per host (upserted): the latest scan wins. The leaderboard and the
-- recent feed both dedup by host for free because there is only ever one row.

CREATE TABLE IF NOT EXISTS scans (
  id          TEXT    PRIMARY KEY,        -- uuid
  host        TEXT    NOT NULL,           -- hostname only, lowercased, no www.
  url         TEXT    NOT NULL,           -- origin only (https://host) — never a path/query
  seo_passed  INTEGER NOT NULL,
  seo_total   INTEGER NOT NULL,
  aeo_passed  INTEGER NOT NULL,
  aeo_total   INTEGER NOT NULL,
  score       REAL    NOT NULL,           -- combined pass rate 0..1, used for ordering
  created_at  INTEGER NOT NULL,           -- epoch ms
  slug        TEXT    NOT NULL,           -- short shareable id (stable per host)
  UNIQUE(host),                           -- upsert target + implicit index on host
  UNIQUE(slug)
);

-- host is already indexed by the UNIQUE(host) constraint above.
CREATE INDEX IF NOT EXISTS idx_scans_score   ON scans(score);
CREATE INDEX IF NOT EXISTS idx_scans_created ON scans(created_at);

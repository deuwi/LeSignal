-- Schema initial. Voir SPEC.md §4.

CREATE TABLE IF NOT EXISTS sources (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  type      TEXT NOT NULL,               -- rss | atom | api | search | scrape
  nom       TEXT NOT NULL,
  url       TEXT NOT NULL,
  flux      TEXT NOT NULL,               -- dev | deuwi | both
  rank      INTEGER DEFAULT 0,
  config    TEXT,                        -- JSON
  actif     INTEGER DEFAULT 1,
  last_run  TEXT
);

CREATE TABLE IF NOT EXISTS items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id    INTEGER REFERENCES sources(id),
  url          TEXT NOT NULL,
  titre        TEXT NOT NULL,
  resume       TEXT,
  contenu      TEXT,
  date_pub     TEXT,
  hash         TEXT UNIQUE NOT NULL,
  flux         TEXT NOT NULL,
  statut       TEXT NOT NULL DEFAULT 'brut',  -- brut | retenu | rejete | cure
  raison_rejet TEXT,
  lu           INTEGER DEFAULT 0,
  favori       INTEGER DEFAULT 0,
  cree_le      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_items_flux_statut ON items(flux, statut);
CREATE INDEX IF NOT EXISTS idx_items_date ON items(date_pub);

-- Tables phases 2-3 (créées maintenant, alimentées plus tard)
CREATE TABLE IF NOT EXISTS verdicts (
  item_id       INTEGER PRIMARY KEY REFERENCES items(id),
  pertinent     INTEGER,
  chapitre      INTEGER,
  profil        TEXT,
  chiffres_flag TEXT,
  score         REAL,
  raw_llm       TEXT,
  cree_le       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS drafts (
  item_id      INTEGER PRIMARY KEY REFERENCES items(id),
  fait         TEXT,
  angle        TEXT,
  sources_line TEXT,
  statut       TEXT NOT NULL DEFAULT 'brouillon',  -- brouillon | valide | jete
  notion_id    TEXT,
  edite_le     TEXT
);

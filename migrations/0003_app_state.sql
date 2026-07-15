-- État applicatif clé/valeur (garde-fou "1 passe / jour").
CREATE TABLE IF NOT EXISTS app_state (
  key   TEXT PRIMARY KEY,
  value TEXT
);

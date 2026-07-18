-- Source « Google Trends » : ancre source_id pour les signaux poussés via
-- POST /api/ingest-trends. actif=0 : elle n'est PAS fetchée par le batch Worker
-- (l'API Trends est CAPTCHA-wallée sur IP datacenter) ; la récupération se fait
-- hors-Worker (trend_watch.py) puis push. flux=deuwi.
INSERT OR REPLACE INTO sources (id, type, nom, url, flux, rank, config, actif) VALUES
(26,'api','Google Trends','https://trends.google.com/','deuwi',2,'{"kind":"trends-push"}',0);

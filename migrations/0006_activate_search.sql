-- Active les sources `search` (Brave). APEC passe de `scrape` (contenu JS,
-- non scrapable depuis un Worker) à `search`.
UPDATE sources
  SET type='search', url='APEC étude emploi cadres',
      config='{"query":"APEC étude emploi cadres marché"}'
  WHERE nom='APEC études';

UPDATE sources SET actif=1 WHERE type='search';

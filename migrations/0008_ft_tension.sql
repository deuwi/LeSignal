-- Ajoute la tension de recrutement (indicateur PERSP_2, API Marché du travail) à la
-- source France Travail : territoire par défaut national (NAT/FR), éditable en config.
-- Les codes ROME restent partagés avec les offres. Passe mensuelle (garde-fou ingest).
UPDATE sources
  SET config='{"kind":"francetravail","romeCodes":["M1805","M1802","M1810","M1806"],"territoire":{"type":"NAT","code":"FR"}}'
  WHERE type='api'
    AND json_extract(config, '$.kind')='francetravail';

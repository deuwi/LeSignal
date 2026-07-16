-- Active France Travail (volume d'offres dev). Liste de codes ROME dev éditable
-- en config (pas figée dans le code). Passe mensuelle (garde-fou côté ingestion).
UPDATE sources
  SET nom='France Travail — offres dev',
      config='{"kind":"francetravail","romeCodes":["M1805","M1802","M1810","M1806"]}',
      actif=1
  WHERE nom='France Travail tensions';

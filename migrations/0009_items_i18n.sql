-- Traductions bilingues des items de la sélection (flux dev).
-- titre/resume restent le texte source brut; _fr/_en = versions traduites (Haiku).
ALTER TABLE items ADD COLUMN titre_fr  TEXT;
ALTER TABLE items ADD COLUMN resume_fr TEXT;
ALTER TABLE items ADD COLUMN titre_en  TEXT;
ALTER TABLE items ADD COLUMN resume_en TEXT;

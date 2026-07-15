-- Versions anglaises des fiches (bilingue FR/EN à la génération).
ALTER TABLE drafts ADD COLUMN fait_en TEXT;
ALTER TABLE drafts ADD COLUMN angle_en TEXT;

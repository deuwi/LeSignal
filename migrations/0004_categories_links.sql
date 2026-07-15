-- Catégories (tags dev) + liens de référence extraits, par item.
ALTER TABLE items ADD COLUMN categories TEXT;  -- JSON array de noms de catégories
ALTER TABLE items ADD COLUMN links TEXT;        -- JSON array d'URLs de référence

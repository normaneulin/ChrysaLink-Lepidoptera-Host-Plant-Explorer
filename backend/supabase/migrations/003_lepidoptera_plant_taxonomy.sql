-- Create taxonomy tables for Lepidoptera and Plants with proper hierarchy

-- Lepidoptera Taxonomy Table
CREATE TABLE IF NOT EXISTS lepidoptera_taxonomy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division TEXT NOT NULL,
  family TEXT,
  genus TEXT,
  species TEXT,
  common_name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plant Taxonomy Table
CREATE TABLE IF NOT EXISTS plant_taxonomy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division TEXT NOT NULL,
  family TEXT,
  genus TEXT,
  species TEXT,
  common_name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_lepidoptera_division ON lepidoptera_taxonomy(division);
CREATE INDEX IF NOT EXISTS idx_lepidoptera_family ON lepidoptera_taxonomy(family);
CREATE INDEX IF NOT EXISTS idx_lepidoptera_genus ON lepidoptera_taxonomy(genus);
CREATE INDEX IF NOT EXISTS idx_plant_division ON plant_taxonomy(division);
CREATE INDEX IF NOT EXISTS idx_plant_family ON plant_taxonomy(family);
CREATE INDEX IF NOT EXISTS idx_plant_genus ON plant_taxonomy(genus);

-- Insert Lepidoptera Divisions (only 2)
INSERT INTO lepidoptera_taxonomy (division, common_name) VALUES
  ('Rhopalocera', 'Butterflies'),
  ('Heterocera', 'Moths');

-- Insert Lepidoptera Families (Rhopalocera)
INSERT INTO lepidoptera_taxonomy (division, family) VALUES
  ('Rhopalocera', 'Hesperiidae'),
  ('Rhopalocera', 'Papilionidae'),
  ('Rhopalocera', 'Pieridae'),
  ('Rhopalocera', 'Lycaenidae'),
  ('Rhopalocera', 'Riodinidae'),
  ('Rhopalocera', 'Nymphalidae'),
  ('Rhopalocera', 'Hedylidae');

-- Insert Lepidoptera Families (Heterocera - selection)
INSERT INTO lepidoptera_taxonomy (division, family) VALUES
  ('Heterocera', 'Noctuidae'),
  ('Heterocera', 'Geometridae'),
  ('Heterocera', 'Erebidae'),
  ('Heterocera', 'Sphingidae'),
  ('Heterocera', 'Saturniidae'),
  ('Heterocera', 'Pyralidae'),
  ('Heterocera', 'Crambidae'),
  ('Heterocera', 'Notodontidae'),
  ('Heterocera', 'Lasiocampidae'),
  ('Heterocera', 'Bombycidae'),
  ('Heterocera', 'Tortricidae'),
  ('Heterocera', 'Gelechiidae'),
  ('Heterocera', 'Tineidae');

-- Insert Plant Divisions (only 3)
INSERT INTO plant_taxonomy (division, common_name) VALUES
  ('Pteridophyte', 'Ferns & Allies'),
  ('Gymnosperm', 'Conifers & Cycads'),
  ('Angiosperm', 'Flowering Plants');

-- Insert Plant Families (Pteridophyte)
INSERT INTO plant_taxonomy (division, family) VALUES
  ('Pteridophyte', 'Aspleniaceae'),
  ('Pteridophyte', 'Polypodiaceae'),
  ('Pteridophyte', 'Dryopteridaceae'),
  ('Pteridophyte', 'Pteridaceae'),
  ('Pteridophyte', 'Thelypteridaceae'),
  ('Pteridophyte', 'Athyriaceae'),
  ('Pteridophyte', 'Blechnaceae'),
  ('Pteridophyte', 'Osmundaceae');

-- Insert Plant Families (Gymnosperm)
INSERT INTO plant_taxonomy (division, family) VALUES
  ('Gymnosperm', 'Cycadaceae'),
  ('Gymnosperm', 'Zamiaceae'),
  ('Gymnosperm', 'Araucariaceae'),
  ('Gymnosperm', 'Podocarpaceae'),
  ('Gymnosperm', 'Pinaceae'),
  ('Gymnosperm', 'Cupressaceae'),
  ('Gymnosperm', 'Taxaceae');

-- Insert Plant Families (Angiosperm - selection)
INSERT INTO plant_taxonomy (division, family) VALUES
  ('Angiosperm', 'Acanthaceae'),
  ('Angiosperm', 'Aceraceae'),
  ('Angiosperm', 'Amaranthaceae'),
  ('Angiosperm', 'Apiaceae'),
  ('Angiosperm', 'Asteraceae'),
  ('Angiosperm', 'Brassicaceae'),
  ('Angiosperm', 'Cactaceae'),
  ('Angiosperm', 'Cucurbitaceae'),
  ('Angiosperm', 'Ericaceae'),
  ('Angiosperm', 'Fabaceae'),
  ('Angiosperm', 'Fagaceae'),
  ('Angiosperm', 'Lamiaceae'),
  ('Angiosperm', 'Lauraceae'),
  ('Angiosperm', 'Malvaceae'),
  ('Angiosperm', 'Myrtaceae'),
  ('Angiosperm', 'Oleaceae'),
  ('Angiosperm', 'Orchidaceae'),
  ('Angiosperm', 'Papaveraceae'),
  ('Angiosperm', 'Passifloraceae'),
  ('Angiosperm', 'Poaceae'),
  ('Angiosperm', 'Ranunculaceae'),
  ('Angiosperm', 'Rosaceae'),
  ('Angiosperm', 'Rutaceae'),
  ('Angiosperm', 'Salicaceae'),
  ('Angiosperm', 'Solanaceae'),
  ('Angiosperm', 'Urticaceae'),
  ('Angiosperm', 'Vitaceae');

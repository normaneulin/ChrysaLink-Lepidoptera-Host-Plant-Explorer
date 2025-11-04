-- Create taxonomy_divisions table for Lepidoptera and Plant divisions
CREATE TABLE IF NOT EXISTS taxonomy_divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'lepidoptera' or 'plant'
  division_name TEXT NOT NULL,
  common_name TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_taxonomy_divisions_type ON taxonomy_divisions(type);
CREATE INDEX IF NOT EXISTS idx_taxonomy_divisions_name ON taxonomy_divisions(division_name);

-- Insert Lepidoptera divisions
INSERT INTO taxonomy_divisions (type, division_name, common_name, description)
VALUES
  ('lepidoptera', 'Rhopalocera', 'Butterflies', 'Butterflies - day-flying Lepidoptera'),
  ('lepidoptera', 'Heterocera', 'Moths', 'Moths - typically nocturnal Lepidoptera');

-- Insert Plant divisions
INSERT INTO taxonomy_divisions (type, division_name, common_name, description)
VALUES
  ('plant', 'Pteridophyte', 'Ferns & Allies', 'Ferns, horsetails, clubmosses, and related plants'),
  ('plant', 'Gymnosperm', 'Conifers & Cycads', 'Cycads, pines, firs, and other non-flowering seed plants'),
  ('plant', 'Angiosperm', 'Flowering Plants', 'Flowering plants or magnoliophytes');

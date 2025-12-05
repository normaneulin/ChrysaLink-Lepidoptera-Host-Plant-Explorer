-- Migration: Add observation_id to relationships and FK with ON DELETE CASCADE
-- Run this migration using your Supabase migrations or psql against the project

BEGIN;

-- Add observation_id column (nullable to avoid blocking if existing rows present)
ALTER TABLE IF EXISTS relationships
  ADD COLUMN IF NOT EXISTS observation_id uuid;

-- Create foreign key constraint to observations.id with cascade on delete
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'relationships' AND c.conname = 'relationships_observation_id_fkey'
  ) THEN
    ALTER TABLE relationships
      ADD CONSTRAINT relationships_observation_id_fkey
      FOREIGN KEY (observation_id) REFERENCES observations(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Optional: index to speed lookups by observation_id
CREATE INDEX IF NOT EXISTS idx_relationships_observation_id ON relationships(observation_id);

COMMIT;

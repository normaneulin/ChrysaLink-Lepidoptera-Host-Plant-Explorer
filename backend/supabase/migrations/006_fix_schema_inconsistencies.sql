-- ChrysaLink Database Schema Fixes
-- Run this in Supabase SQL Editor to fix all identified inconsistencies
-- Date: 2025-11-07

-- ============================================================================
-- 1. ADD MISSING scientific_name COLUMNS TO TAXONOMY TABLES
-- ============================================================================

ALTER TABLE public.lepidoptera_taxonomy
ADD COLUMN scientific_name TEXT;

ALTER TABLE public.plant_taxonomy
ADD COLUMN scientific_name TEXT;

-- ============================================================================
-- 2. ADD MISSING UNIQUE CONSTRAINTS
-- ============================================================================

-- Prevent duplicate relationships between same lepidoptera and plant
ALTER TABLE public.relationships
ADD CONSTRAINT relationships_unique UNIQUE(lepidoptera_id, plant_id);

-- Prevent user from unlocking same achievement multiple times
ALTER TABLE public.user_achievements
ADD CONSTRAINT user_achievements_unique UNIQUE(user_id, achievement_id);

-- ============================================================================
-- 3. ADD ON DELETE CASCADE TO FOREIGN KEYS
-- ============================================================================

-- Drop existing constraints and recreate with CASCADE
ALTER TABLE public.points_ledger
DROP CONSTRAINT points_ledger_identification_id_fkey,
ADD CONSTRAINT points_ledger_identification_id_fkey 
  FOREIGN KEY (identification_id) 
  REFERENCES public.identifications(id) 
  ON DELETE CASCADE;

ALTER TABLE public.points_ledger
DROP CONSTRAINT points_ledger_observation_id_fkey,
ADD CONSTRAINT points_ledger_observation_id_fkey 
  FOREIGN KEY (observation_id) 
  REFERENCES public.observations(id) 
  ON DELETE CASCADE;

ALTER TABLE public.user_achievements
DROP CONSTRAINT user_achievements_achievement_id_fkey,
ADD CONSTRAINT user_achievements_achievement_id_fkey 
  FOREIGN KEY (achievement_id) 
  REFERENCES public.achievements(id) 
  ON DELETE CASCADE;

-- ============================================================================
-- 4. FIX TIMESTAMP WITHOUT TIMEZONE (convert to WITH TIME ZONE)
-- ============================================================================

-- For lepidoptera_taxonomy
ALTER TABLE public.lepidoptera_taxonomy
ALTER COLUMN created_at 
SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN created_at 
TYPE timestamp with time zone USING created_at AT TIME ZONE 'UTC';

-- For plant_taxonomy
ALTER TABLE public.plant_taxonomy
ALTER COLUMN created_at 
SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN created_at 
TYPE timestamp with time zone USING created_at AT TIME ZONE 'UTC';

-- ============================================================================
-- 5. VERIFY INDEXES EXIST (these should already exist from migrations)
-- ============================================================================

-- Run this query to check if all indexes exist:
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename IN 
-- ('profiles', 'rating_systems', 'observations', 'identifications', 'comments', 'notifications', 'relationships', 'points_ledger');

-- If any are missing, create them here (uncomment if needed):

-- CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);
-- CREATE INDEX IF NOT EXISTS idx_rating_systems_user_id ON public.rating_systems(user_id);
-- CREATE INDEX IF NOT EXISTS idx_rating_systems_expertise_level ON public.rating_systems(expertise_level);
-- CREATE INDEX IF NOT EXISTS idx_rating_systems_current_rating ON public.rating_systems(current_rating DESC);
-- CREATE INDEX IF NOT EXISTS idx_observations_user_id ON public.observations(user_id);
-- CREATE INDEX IF NOT EXISTS idx_observations_lepidoptera_id ON public.observations(lepidoptera_id);
-- CREATE INDEX IF NOT EXISTS idx_observations_plant_id ON public.observations(plant_id);
-- CREATE INDEX IF NOT EXISTS idx_observations_location ON public.observations(location);
-- CREATE INDEX IF NOT EXISTS idx_observations_created_at ON public.observations(created_at DESC);
-- CREATE INDEX IF NOT EXISTS idx_observations_is_public ON public.observations(is_public);
-- CREATE INDEX IF NOT EXISTS idx_identifications_observation_id ON public.identifications(observation_id);
-- CREATE INDEX IF NOT EXISTS idx_identifications_user_id ON public.identifications(user_id);
-- CREATE INDEX IF NOT EXISTS idx_identifications_is_verified ON public.identifications(is_verified);
-- CREATE INDEX IF NOT EXISTS idx_identifications_created_at ON public.identifications(created_at DESC);
-- CREATE INDEX IF NOT EXISTS idx_comments_observation_id ON public.comments(observation_id);
-- CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);
-- CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments(created_at DESC);
-- CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
-- CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
-- CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
-- CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
-- CREATE INDEX IF NOT EXISTS idx_relationships_lepidoptera_id ON public.relationships(lepidoptera_id);
-- CREATE INDEX IF NOT EXISTS idx_relationships_plant_id ON public.relationships(plant_id);
-- CREATE INDEX IF NOT EXISTS idx_relationships_relationship_type ON public.relationships(relationship_type);
-- CREATE INDEX IF NOT EXISTS idx_points_ledger_user_id ON public.points_ledger(user_id);
-- CREATE INDEX IF NOT EXISTS idx_points_ledger_created_at ON public.points_ledger(created_at DESC);

-- ============================================================================
-- 6. VERIFICATION QUERIES (run after fixes to confirm)
-- ============================================================================

-- Check that all tables exist and have correct columns:
-- SELECT table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
-- ORDER BY table_name, ordinal_position;

-- Check that all indexes exist:
-- SELECT indexname, tablename 
-- FROM pg_indexes 
-- WHERE schemaname = 'public' 
-- ORDER BY tablename, indexname;

-- Check that scientific_name columns were added:
-- SELECT column_name 
-- FROM information_schema.columns 
-- WHERE table_name IN ('lepidoptera_taxonomy', 'plant_taxonomy') 
-- AND column_name = 'scientific_name';

-- Check that UNIQUE constraints exist:
-- SELECT constraint_name, table_name 
-- FROM information_schema.table_constraints 
-- WHERE constraint_type = 'UNIQUE' 
-- AND table_schema = 'public'
-- ORDER BY table_name;

-- ============================================================================
-- END OF SCHEMA FIX SCRIPT
-- ============================================================================

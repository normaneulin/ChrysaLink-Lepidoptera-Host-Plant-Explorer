-- Migration 015: Add backward-compatible column aliases for profiles table
-- Instead of renaming, we keep old columns and add computed columns that act as aliases

-- Step 1: Add new columns if they don't exist (these will be the primary columns going forward)
DO $$
BEGIN
  -- Add identifications_agreed_count if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'identifications_agreed_count'
  ) THEN
    -- If validated_identifications exists, copy its value; otherwise default to 0
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'validated_identifications'
    ) THEN
      ALTER TABLE public.profiles ADD COLUMN identifications_agreed_count INTEGER;
      UPDATE public.profiles SET identifications_agreed_count = validated_identifications;
      ALTER TABLE public.profiles ALTER COLUMN identifications_agreed_count SET DEFAULT 0;
      ALTER TABLE public.profiles ALTER COLUMN identifications_agreed_count SET NOT NULL;
    ELSE
      ALTER TABLE public.profiles ADD COLUMN identifications_agreed_count INTEGER DEFAULT 0 NOT NULL;
    END IF;
  END IF;

  -- Add species_accepted_count if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'species_accepted_count'
  ) THEN
    -- If validated_species exists, copy its value; otherwise default to 0
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'validated_species'
    ) THEN
      ALTER TABLE public.profiles ADD COLUMN species_accepted_count INTEGER;
      UPDATE public.profiles SET species_accepted_count = validated_species;
      ALTER TABLE public.profiles ALTER COLUMN species_accepted_count SET DEFAULT 0;
      ALTER TABLE public.profiles ALTER COLUMN species_accepted_count SET NOT NULL;
    ELSE
      ALTER TABLE public.profiles ADD COLUMN species_accepted_count INTEGER DEFAULT 0 NOT NULL;
    END IF;
  END IF;
END $$;

-- Step 2: Create triggers to keep old and new columns in sync (backward compatibility)
-- This allows old code using validated_identifications to still work

CREATE OR REPLACE FUNCTION sync_profile_column_aliases()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync identifications_agreed_count <-> validated_identifications
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- If validated_identifications column exists, keep it in sync
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'validated_identifications'
    ) THEN
      NEW.validated_identifications := NEW.identifications_agreed_count;
    END IF;
    
    -- If validated_species column exists, keep it in sync
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'validated_species'
    ) THEN
      NEW.validated_species := NEW.species_accepted_count;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_profile_aliases ON profiles;

CREATE TRIGGER trigger_sync_profile_aliases
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION sync_profile_column_aliases();

-- Step 3: Update the trigger function to use new column names
CREATE OR REPLACE FUNCTION update_observation_counts_on_verification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_verified AND NOT OLD.is_verified THEN
    -- Update profile statistics with new column names
    -- The sync trigger will automatically update the old column names too
    UPDATE profiles
    SET 
      identifications_agreed_count = identifications_agreed_count + 1,
      species_accepted_count = (
        SELECT COUNT(DISTINCT species) 
        FROM identifications 
        WHERE user_id = NEW.verified_by_user_id 
        AND is_verified = true
      )
    WHERE id = NEW.verified_by_user_id;
    
    -- Update rating system verified count (if rating_systems table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rating_systems') THEN
      UPDATE rating_systems
      SET verified_identification_count = verified_identification_count + 1
      WHERE user_id = NEW.verified_by_user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Ensure the trigger exists (recreate if needed)
DROP TRIGGER IF EXISTS trigger_update_counts_on_verification ON identifications;

CREATE TRIGGER trigger_update_counts_on_verification
AFTER UPDATE ON identifications
FOR EACH ROW
EXECUTE FUNCTION update_observation_counts_on_verification();

-- Migration 015 complete: Both old and new column names now work
-- validated_identifications <-> identifications_agreed_count (kept in sync)
-- validated_species <-> species_accepted_count (kept in sync)

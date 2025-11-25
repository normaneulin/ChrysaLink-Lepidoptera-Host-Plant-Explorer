-- Migration: Setup observation images storage
-- IMPORTANT: Storage policies must be created via Supabase Dashboard!
-- 
-- Manual Steps Required:
-- 1. Create bucket: Dashboard → Storage → New bucket
--    - Name: observation-images
--    - Public: Yes (check "Public bucket")
--
-- 2. Create policies: Dashboard → Storage → observation-images → Policies
--    
--    Policy 1: "Users can upload their own observation images"
--    - Allowed operation: INSERT
--    - Target roles: authenticated
--    - Policy definition:
--      bucket_id = 'observation-images' AND (storage.foldername(name))[1] = auth.uid()::text
--
--    Policy 2: "Public can view observation images"  
--    - Allowed operation: SELECT
--    - Target roles: public
--    - Policy definition:
--      bucket_id = 'observation-images'
--
--    Policy 3: "Users can delete their own observation images"
--    - Allowed operation: DELETE
--    - Target roles: authenticated
--    - Policy definition:
--      bucket_id = 'observation-images' AND (storage.foldername(name))[1] = auth.uid()::text

-- Update observations table to ensure image columns exist
-- (These should already exist from the schema, but this ensures they're present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'observations' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE public.observations ADD COLUMN image_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'observations' AND column_name = 'image_storage_path'
  ) THEN
    ALTER TABLE public.observations ADD COLUMN image_storage_path text;
  END IF;
END $$;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_observations_user_date 
ON public.observations(user_id, observation_date DESC);

CREATE INDEX IF NOT EXISTS idx_observations_location 
ON public.observations(location);

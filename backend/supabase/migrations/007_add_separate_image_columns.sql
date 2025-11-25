-- Add separate image columns for lepidoptera and host plant
ALTER TABLE observations 
ADD COLUMN lepidoptera_image_url TEXT,
ADD COLUMN plant_image_url TEXT;

-- Migrate existing data if needed (image_url -> lepidoptera_image_url)
UPDATE observations 
SET lepidoptera_image_url = image_url 
WHERE image_url IS NOT NULL;

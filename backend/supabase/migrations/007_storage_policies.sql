-- Storage Policies for observation-images bucket
-- PREREQUISITE: The 'observation-images' bucket must exist first
-- Create it via: Dashboard → Storage → New bucket (Name: observation-images, Public: Yes)

-- Allow authenticated users to upload their own images
CREATE POLICY "Users can upload their own observation images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'observation-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to all observation images
CREATE POLICY "Public can view observation images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'observation-images');

-- Allow users to delete their own images
CREATE POLICY "Users can delete their own observation images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'observation-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

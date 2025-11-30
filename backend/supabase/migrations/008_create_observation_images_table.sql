
CREATE TABLE observation_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    observation_id UUID NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_storage_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    image_type TEXT NOT NULL CHECK (image_type IN ('lepidoptera', 'plant'))
);

CREATE INDEX idx_observation_images_observation_id ON observation_images(observation_id);

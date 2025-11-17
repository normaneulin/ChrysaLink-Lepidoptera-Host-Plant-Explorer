-- 004_core_entities.sql
-- Core tables for ChrysaLink: User profiles, Observations, Identifications, Comments, Notifications, Rating System

-- ============================================================================
-- 1. PROFILES TABLE (1:1 with auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bio TEXT DEFAULT NULL,
  followers INT DEFAULT 0,
  following INT DEFAULT 0,
  observation_count INT DEFAULT 0,
  validated_species INT DEFAULT 0,
  validated_identifications INT DEFAULT 0,
  avatar_url TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for quick profile lookups
CREATE INDEX idx_profiles_created_at ON profiles(created_at DESC);

-- ============================================================================
-- 2. RATING_SYSTEM TABLE (1:1 with auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rating_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  current_rating INT DEFAULT 0,
  expertise_level VARCHAR(20) DEFAULT 'Novice' CHECK (expertise_level IN ('Novice', 'Amateur', 'Intermediate', 'Expert', 'Specialist')),
  verified_identification_count INT DEFAULT 0,
  points_awarded_total INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_rating_systems_user_id ON rating_systems(user_id);
CREATE INDEX idx_rating_systems_expertise_level ON rating_systems(expertise_level);
CREATE INDEX idx_rating_systems_current_rating ON rating_systems(current_rating DESC);

-- ============================================================================
-- 3. OBSERVATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lepidoptera_id UUID NOT NULL REFERENCES lepidoptera_taxonomy(id),
  plant_id UUID NOT NULL REFERENCES plant_taxonomy(id),
  location TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  observation_date DATE NOT NULL,
  notes TEXT DEFAULT NULL,
  image_url TEXT DEFAULT NULL,
  image_storage_path TEXT DEFAULT NULL,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX idx_observations_user_id ON observations(user_id);
CREATE INDEX idx_observations_lepidoptera_id ON observations(lepidoptera_id);
CREATE INDEX idx_observations_plant_id ON observations(plant_id);
CREATE INDEX idx_observations_location ON observations(location);
CREATE INDEX idx_observations_created_at ON observations(created_at DESC);
CREATE INDEX idx_observations_is_public ON observations(is_public);

-- Geo-spatial index for map queries (if PostGIS is enabled)
-- CREATE INDEX idx_observations_geo ON observations USING GIST(ll_to_earth(latitude, longitude));

-- ============================================================================
-- 4. IDENTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS identifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id UUID NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  species TEXT NOT NULL,
  scientific_name TEXT DEFAULT NULL,
  caption TEXT DEFAULT NULL,
  confidence_score DECIMAL(3, 2) DEFAULT NULL CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  is_verified BOOLEAN DEFAULT FALSE,
  is_auto_suggested BOOLEAN DEFAULT FALSE,
  points_awarded INT DEFAULT 0,
  verified_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  verified_by_user_id UUID DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_identifications_observation_id ON identifications(observation_id);
CREATE INDEX idx_identifications_user_id ON identifications(user_id);
CREATE INDEX idx_identifications_is_verified ON identifications(is_verified);
CREATE INDEX idx_identifications_created_at ON identifications(created_at DESC);

-- ============================================================================
-- 5. COMMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id UUID NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_comments_observation_id ON comments(observation_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);

-- ============================================================================
-- 6. NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  observation_id UUID DEFAULT NULL REFERENCES observations(id) ON DELETE CASCADE,
  identification_id UUID DEFAULT NULL REFERENCES identifications(id) ON DELETE CASCADE,
  comment_id UUID DEFAULT NULL REFERENCES comments(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'new_comment',
    'identification_suggested',
    'identification_verified',
    'identification_rejected',
    'points_awarded',
    'rating_increased',
    'new_follower',
    'observation_liked'
  )),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(type);

-- ============================================================================
-- 7. RELATIONSHIPS TABLE (Lepidoptera ↔ Plant connections)
-- ============================================================================
CREATE TABLE IF NOT EXISTS relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lepidoptera_id UUID NOT NULL REFERENCES lepidoptera_taxonomy(id) ON DELETE CASCADE,
  plant_id UUID NOT NULL REFERENCES plant_taxonomy(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) DEFAULT 'host_plant' CHECK (relationship_type IN ('host_plant', 'alternate_host', 'occasional_host', 'preferred_host')),
  observation_count INT DEFAULT 0,
  verified_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(lepidoptera_id, plant_id)
);

-- Indexes
CREATE INDEX idx_relationships_lepidoptera_id ON relationships(lepidoptera_id);
CREATE INDEX idx_relationships_plant_id ON relationships(plant_id);
CREATE INDEX idx_relationships_relationship_type ON relationships(relationship_type);

-- ============================================================================
-- HELPER FUNCTIONS (Define early for RLS policies)
-- ============================================================================

-- Function to get current user ID safely
CREATE OR REPLACE FUNCTION current_user_id() RETURNS UUID AS $$
BEGIN
  RETURN auth.uid();
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- TRIGGERS: Auto-update updated_at timestamps
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rating_systems_updated_at
BEFORE UPDATE ON rating_systems
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_observations_updated_at
BEFORE UPDATE ON observations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_identifications_updated_at
BEFORE UPDATE ON identifications
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at
BEFORE UPDATE ON comments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_relationships_updated_at
BEFORE UPDATE ON relationships
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- PROFILES RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RATING_SYSTEMS RLS
ALTER TABLE rating_systems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all rating systems" ON rating_systems
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own rating system" ON rating_systems
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- OBSERVATIONS RLS
ALTER TABLE observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view public observations or their own" ON observations
  FOR SELECT USING (is_public OR auth.uid() = user_id);

CREATE POLICY "Users can create observations" ON observations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own observations" ON observations
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own observations" ON observations
  FOR DELETE USING (auth.uid() = user_id);

-- IDENTIFICATIONS RLS
ALTER TABLE identifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all identifications" ON identifications
  FOR SELECT USING (true);

CREATE POLICY "Users can create identifications" ON identifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own identifications" ON identifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- COMMENTS RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all comments" ON comments
  FOR SELECT USING (true);

CREATE POLICY "Users can create comments" ON comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON comments
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON comments
  FOR DELETE USING (auth.uid() = user_id);

-- NOTIFICATIONS RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Only service can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RELATIONSHIPS RLS
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view relationships" ON relationships
  FOR SELECT USING (true);

-- Function to update observation counts when identifications are verified
CREATE OR REPLACE FUNCTION update_observation_counts_on_verification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_verified AND NOT OLD.is_verified THEN
    -- Update profile statistics
    UPDATE profiles
    SET 
      validated_identifications = validated_identifications + 1,
      validated_species = (SELECT COUNT(DISTINCT species) FROM identifications WHERE user_id = NEW.verified_by_user_id AND is_verified = true)
    WHERE id = NEW.verified_by_user_id;
    
    -- Update rating system verified count
    UPDATE rating_systems
    SET verified_identification_count = verified_identification_count + 1
    WHERE user_id = NEW.verified_by_user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_counts_on_verification
AFTER UPDATE ON identifications
FOR EACH ROW
EXECUTE FUNCTION update_observation_counts_on_verification();

-- ============================================================================
-- DONE
-- ============================================================================
-- Migration 004 complete: All core tables created with RLS policies and triggers

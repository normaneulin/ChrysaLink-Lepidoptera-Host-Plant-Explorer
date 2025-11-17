-- 005_points_and_achievements.sql
-- Point system, achievement tracking, and user statistics

-- ============================================================================
-- POINTS_LEDGER TABLE (Audit trail for point awards)
-- ============================================================================
CREATE TABLE IF NOT EXISTS points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  identification_id UUID DEFAULT NULL REFERENCES identifications(id) ON DELETE SET NULL,
  observation_id UUID DEFAULT NULL REFERENCES observations(id) ON DELETE SET NULL,
  points_amount INT NOT NULL,
  reason VARCHAR(100) NOT NULL CHECK (reason IN (
    'identification_verified',
    'identification_accepted',
    'observation_created',
    'comment_helpful',
    'bonus_achievement'
  )),
  description TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_points_ledger_user_id ON points_ledger(user_id);
CREATE INDEX idx_points_ledger_created_at ON points_ledger(created_at DESC);

-- ============================================================================
-- ACHIEVEMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon_url TEXT DEFAULT NULL,
  points_reward INT DEFAULT 0,
  requirement_type VARCHAR(50) NOT NULL CHECK (requirement_type IN (
    'observations_count',
    'identifications_verified',
    'species_documented',
    'rating_threshold',
    'streak_days',
    'community_contribution'
  )),
  requirement_value INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sample achievements
INSERT INTO achievements (name, description, requirement_type, requirement_value, points_reward) VALUES
  ('First Observation', 'Upload your first Lepidoptera observation', 'observations_count', 1, 10),
  ('Prolific Observer', 'Upload 50 observations', 'observations_count', 50, 100),
  ('Expert Observer', 'Upload 200 observations', 'observations_count', 200, 500),
  ('First Identification', 'Suggest your first species identification', 'identifications_verified', 1, 5),
  ('Verified Identifier', 'Get 10 identifications verified', 'identifications_verified', 10, 50),
  ('Species Expert', 'Document 50 different species', 'species_documented', 50, 200),
  ('Rating Master', 'Achieve 500 rating points', 'rating_threshold', 500, 100),
  ('Community Champion', 'Contribute 100 verified identifications', 'community_contribution', 100, 300)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- USER_ACHIEVEMENTS TABLE (Junction table: Users ↔ Achievements)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, achievement_id)
);

-- Indexes
CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_achievement_id ON user_achievements(achievement_id);

-- ============================================================================
-- USER_STATISTICS VIEW (Denormalized statistics for quick dashboard queries)
-- ============================================================================
CREATE OR REPLACE VIEW user_statistics AS
SELECT 
  u.id as user_id,
  p.name,
  p.avatar_url,
  rs.current_rating,
  rs.expertise_level,
  COALESCE((SELECT COUNT(*) FROM observations WHERE user_id = u.id), 0) as total_observations,
  COALESCE((SELECT COUNT(*) FROM observations WHERE user_id = u.id AND created_at >= NOW() - INTERVAL '7 days'), 0) as observations_this_week,
  COALESCE((SELECT COUNT(*) FROM identifications WHERE user_id = u.id AND is_verified = true), 0) as verified_identifications,
  COALESCE((SELECT COUNT(DISTINCT species) FROM identifications WHERE user_id = u.id AND is_verified = true), 0) as unique_species_identified,
  COALESCE((SELECT COUNT(*) FROM comments WHERE user_id = u.id), 0) as total_comments,
  COALESCE((SELECT COUNT(*) FROM user_achievements WHERE user_id = u.id), 0) as achievements_unlocked,
  p.followers,
  p.following,
  rs.verified_identification_count,
  COALESCE((SELECT SUM(points_amount) FROM points_ledger WHERE user_id = u.id), 0) as lifetime_points,
  p.created_at as member_since
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
LEFT JOIN rating_systems rs ON u.id = rs.user_id;

-- ============================================================================
-- EXPERTISE LEVEL RANGES
-- ============================================================================
-- Novice:      0-99 points
-- Amateur:     100-299 points
-- Intermediate: 300-699 points
-- Expert:      700-1499 points
-- Specialist:  1500+ points

-- ============================================================================
-- FUNCTION: Award points and update rating
-- ============================================================================
CREATE OR REPLACE FUNCTION award_points(
  p_user_id UUID,
  p_points INT,
  p_reason VARCHAR(100),
  p_identification_id UUID DEFAULT NULL,
  p_observation_id UUID DEFAULT NULL
)
RETURNS TABLE(new_rating INT, new_expertise_level VARCHAR) AS $$
DECLARE
  v_new_rating INT;
  v_new_expertise_level VARCHAR(20);
BEGIN
  -- Insert into points ledger
  INSERT INTO points_ledger (user_id, identification_id, observation_id, points_amount, reason)
  VALUES (p_user_id, p_identification_id, p_observation_id, p_points, p_reason);

  -- Calculate total points
  v_new_rating := COALESCE((SELECT SUM(points_amount) FROM points_ledger WHERE user_id = p_user_id), 0);

  -- Determine expertise level
  v_new_expertise_level := CASE
    WHEN v_new_rating < 100 THEN 'Novice'
    WHEN v_new_rating < 300 THEN 'Amateur'
    WHEN v_new_rating < 700 THEN 'Intermediate'
    WHEN v_new_rating < 1500 THEN 'Expert'
    ELSE 'Specialist'
  END;

  -- Update rating system
  UPDATE rating_systems
  SET 
    current_rating = v_new_rating,
    expertise_level = v_new_expertise_level,
    updated_at = CURRENT_TIMESTAMP
  WHERE user_id = p_user_id;

  -- Return new values
  RETURN QUERY SELECT v_new_rating, v_new_expertise_level;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Check and unlock achievements
-- ============================================================================
CREATE OR REPLACE FUNCTION check_achievements(p_user_id UUID)
RETURNS TABLE(achievement_id UUID, achievement_name VARCHAR, points_reward INT) AS $$
BEGIN
  RETURN QUERY
  WITH user_stats AS (
    SELECT 
      COALESCE((SELECT COUNT(*) FROM observations WHERE user_id = p_user_id), 0) as obs_count,
      COALESCE((SELECT COUNT(*) FROM identifications WHERE user_id = p_user_id AND is_verified = true), 0) as verified_ids,
      COALESCE((SELECT COUNT(DISTINCT species) FROM identifications WHERE user_id = p_user_id AND is_verified = true), 0) as unique_species,
      COALESCE((SELECT current_rating FROM rating_systems WHERE user_id = p_user_id), 0) as total_rating
  ),
  unlockable_achievements AS (
    SELECT a.id, a.name, a.points_reward
    FROM achievements a, user_stats
    WHERE 
      -- Not already unlocked
      a.id NOT IN (SELECT achievement_id FROM user_achievements WHERE user_id = p_user_id)
      -- And meets requirement
      AND (
        (a.requirement_type = 'observations_count' AND user_stats.obs_count >= a.requirement_value)
        OR (a.requirement_type = 'identifications_verified' AND user_stats.verified_ids >= a.requirement_value)
        OR (a.requirement_type = 'species_documented' AND user_stats.unique_species >= a.requirement_value)
        OR (a.requirement_type = 'rating_threshold' AND user_stats.total_rating >= a.requirement_value)
      )
  )
  SELECT ua.id, ua.name, ua.points_reward FROM unlockable_achievements ua;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Auto-unlock achievements
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_unlock_achievements()
RETURNS TRIGGER AS $$
DECLARE
  v_achievement RECORD;
BEGIN
  FOR v_achievement IN 
    SELECT * FROM check_achievements(NEW.user_id)
  LOOP
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (NEW.user_id, v_achievement.achievement_id)
    ON CONFLICT DO NOTHING;

    -- Award bonus points for achievement
    PERFORM award_points(
      NEW.user_id,
      v_achievement.points_reward,
      'bonus_achievement',
      NULL,
      NULL
    );
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_unlock_achievements
AFTER UPDATE ON identifications
FOR EACH ROW
WHEN (NEW.is_verified AND NOT OLD.is_verified)
EXECUTE FUNCTION auto_unlock_achievements();

-- ============================================================================
-- DONE
-- ============================================================================
-- Migration 005 complete: Points system, achievements, and user statistics

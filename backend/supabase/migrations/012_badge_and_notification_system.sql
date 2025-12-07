-- Add new columns to existing notifications table for badge and achievement tracking
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS related_badge_id UUID NULL,
ADD COLUMN IF NOT EXISTS related_achievement_id UUID NULL,
ADD COLUMN IF NOT EXISTS title VARCHAR(255) NULL;

-- Add foreign key constraints for new columns
ALTER TABLE public.notifications
ADD CONSTRAINT IF NOT EXISTS notifications_related_achievement_id_fkey 
  FOREIGN KEY (related_achievement_id) REFERENCES achievements (id) ON DELETE SET NULL;

ALTER TABLE public.notifications
ADD CONSTRAINT IF NOT EXISTS notifications_related_badge_id_fkey 
  FOREIGN KEY (related_badge_id) REFERENCES achievements (id) ON DELETE SET NULL;

-- Update type check constraint to include new notification types
-- Note: This drops and recreates the constraint to add new types
ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check CHECK (
  (type)::text = ANY (
    ARRAY[
      'new_comment'::character varying,
      'identification_suggested'::character varying,
      'identification_verified'::character varying,
      'identification_rejected'::character varying,
      'points_awarded'::character varying,
      'rating_increased'::character varying,
      'new_follower'::character varying,
      'observation_liked'::character varying,
      'badge_elevation'::character varying,
      'achievement_unlocked'::character varying,
      'comment_helpful'::character varying,
      'rating_milestone'::character varying
    ]
  )::text[]
);

-- Add index for badge notifications
CREATE INDEX IF NOT EXISTS idx_notifications_related_achievement_id ON public.notifications USING BTREE (related_achievement_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_notifications_related_badge_id ON public.notifications USING BTREE (related_badge_id) TABLESPACE pg_default;

-- Create badge_thresholds table to define points ranges for each badge level
CREATE TABLE IF NOT EXISTS public.badge_thresholds (
  id UUID NOT NULL DEFAULT gen_random_uuid (),
  level VARCHAR(20) NOT NULL UNIQUE,
  min_points INTEGER NOT NULL,
  max_points INTEGER NULL,
  description TEXT,
  color VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT badge_thresholds_pkey PRIMARY KEY (id),
  CONSTRAINT badge_thresholds_level_key UNIQUE (level)
) TABLESPACE pg_default;

-- Insert badge threshold data
INSERT INTO public.badge_thresholds (level, min_points, max_points, description, color) VALUES
  ('Novice', 0, 99, 'Getting started with the community', 'gray'),
  ('Amateur', 100, 249, 'Contributed consistently', 'yellow'),
  ('Intermediate', 250, 499, 'Recognized contributor', 'green'),
  ('Expert', 500, 999, 'Advanced expertise', 'blue'),
  ('Specialist', 1000, NULL, 'Master contributor', 'purple')
ON CONFLICT (level) DO NOTHING;

-- Add column to track previous badge for detecting upgrades
ALTER TABLE public.rating_systems
ADD COLUMN IF NOT EXISTS previous_expertise_level VARCHAR(20);

-- Function to check and award achievements based on user stats
CREATE OR REPLACE FUNCTION public.check_and_award_achievements(p_user_id UUID)
RETURNS TABLE (achievement_id UUID, achievement_name VARCHAR, is_new BOOLEAN)
LANGUAGE plpgsql
AS $$
DECLARE
  v_observations_count INTEGER;
  v_verified_identifications INTEGER;
  v_species_documented INTEGER;
  v_current_rating INTEGER;
  v_achievement_record RECORD;
  v_already_has BOOLEAN;
BEGIN
  -- Get user statistics
  SELECT 
    COALESCE(COUNT(DISTINCT o.id), 0),
    COALESCE(COUNT(DISTINCT CASE WHEN i.is_verified = true THEN i.id END), 0),
    COALESCE(COUNT(DISTINCT i.species), 0),
    COALESCE(rs.current_rating, 0)
  INTO v_observations_count, v_verified_identifications, v_species_documented, v_current_rating
  FROM observations o
  LEFT JOIN identifications i ON o.id = i.observation_id AND i.user_id = p_user_id
  LEFT JOIN rating_systems rs ON rs.user_id = p_user_id
  WHERE o.user_id = p_user_id;

  -- Check each achievement
  FOR v_achievement_record IN
    SELECT a.id, a.name, a.requirement_type, a.requirement_value
    FROM public.achievements a
  LOOP
    v_already_has := EXISTS (
      SELECT 1 FROM public.user_achievements 
      WHERE user_id = p_user_id AND achievement_id = v_achievement_record.id
    );

    IF NOT v_already_has THEN
      -- Check if requirement is met
      IF (v_achievement_record.requirement_type = 'observations_count' AND v_observations_count >= v_achievement_record.requirement_value) OR
         (v_achievement_record.requirement_type = 'identifications_verified' AND v_verified_identifications >= v_achievement_record.requirement_value) OR
         (v_achievement_record.requirement_type = 'species_documented' AND v_species_documented >= v_achievement_record.requirement_value) OR
         (v_achievement_record.requirement_type = 'rating_threshold' AND v_current_rating >= v_achievement_record.requirement_value)
      THEN
        -- Award the achievement
        INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
        VALUES (p_user_id, v_achievement_record.id, CURRENT_TIMESTAMP)
        ON CONFLICT DO NOTHING;

        -- Create notification for achievement unlock using existing notifications table structure
        INSERT INTO public.notifications (user_id, type, title, message, related_achievement_id, is_read)
        VALUES (
          p_user_id,
          'achievement_unlocked',
          'Achievement Unlocked: ' || v_achievement_record.name,
          'Congratulations! You''ve earned the ' || v_achievement_record.name || ' achievement!',
          v_achievement_record.id,
          FALSE
        );

        RETURN QUERY SELECT v_achievement_record.id, v_achievement_record.name::VARCHAR, TRUE::BOOLEAN;
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Function to handle badge level changes and create notifications
CREATE OR REPLACE FUNCTION public.check_and_update_badge_level(p_user_id UUID)
RETURNS TABLE (previous_level VARCHAR, new_level VARCHAR, badge_elevated BOOLEAN)
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_points INTEGER;
  v_new_badge_level VARCHAR;
  v_old_badge_level VARCHAR;
  v_badge_elevated BOOLEAN := FALSE;
BEGIN
  -- Calculate total points for user
  SELECT COALESCE(SUM(points_amount), 0)
  INTO v_total_points
  FROM public.points_ledger
  WHERE user_id = p_user_id;

  -- Determine new badge level based on points
  SELECT level INTO v_new_badge_level
  FROM public.badge_thresholds
  WHERE v_total_points >= min_points AND (max_points IS NULL OR v_total_points <= max_points)
  LIMIT 1;

  -- If no match (shouldn't happen), default to Novice
  IF v_new_badge_level IS NULL THEN
    v_new_badge_level := 'Novice';
  END IF;

  -- Get current badge level from rating_systems
  SELECT COALESCE(expertise_level, 'Novice')
  INTO v_old_badge_level
  FROM public.rating_systems
  WHERE user_id = p_user_id;

  -- Check if badge level has changed
  IF v_old_badge_level IS DISTINCT FROM v_new_badge_level THEN
    v_badge_elevated := TRUE;

    -- Update rating_systems with new badge level
    UPDATE public.rating_systems
    SET 
      expertise_level = v_new_badge_level,
      previous_expertise_level = v_old_badge_level,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id;

    -- Create notification for badge elevation using existing notifications table structure
    INSERT INTO public.notifications (user_id, type, title, message, is_read)
    VALUES (
      p_user_id,
      'badge_elevation',
      'Badge Elevated to ' || v_new_badge_level || '!',
      'Congratulations! You''ve been promoted to the ' || v_new_badge_level || ' badge level! Keep up the great work.',
      FALSE
    );
  END IF;

  RETURN QUERY SELECT v_old_badge_level::VARCHAR, v_new_badge_level::VARCHAR, v_badge_elevated;
END;
$$;

-- Trigger function to run after points are awarded
CREATE OR REPLACE FUNCTION public.trigger_check_achievements_after_points()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check for new achievements
  PERFORM check_and_award_achievements(NEW.user_id);

  -- Check for badge level changes
  PERFORM check_and_update_badge_level(NEW.user_id);

  RETURN NEW;
END;
$$;

-- Create trigger on points_ledger to check achievements and badges
DROP TRIGGER IF EXISTS after_points_awarded ON public.points_ledger;
CREATE TRIGGER after_points_awarded
AFTER INSERT ON public.points_ledger
FOR EACH ROW
EXECUTE FUNCTION public.trigger_check_achievements_after_points();

-- Function to mark notifications as read (compatible with existing schema)
CREATE OR REPLACE FUNCTION public.mark_notification_as_read(p_notification_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.notifications
  SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
  WHERE id = p_notification_id;
END;
$$;

-- Function to get unread notification count for a user
CREATE OR REPLACE FUNCTION public.get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.notifications
  WHERE user_id = p_user_id AND is_read = FALSE;
  
  RETURN v_count;
END;
$$;

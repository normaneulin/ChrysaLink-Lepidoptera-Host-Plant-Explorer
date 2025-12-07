-- Fix check_and_award_achievements function - replace i.status with i.is_verified and i.species_id with i.species
CREATE OR REPLACE FUNCTION public.check_and_award_achievements(p_user_id uuid)
RETURNS TABLE(achievement_id uuid, achievement_name character varying, is_new boolean)
LANGUAGE plpgsql
AS $function$
DECLARE
  v_observations_count INTEGER;
  v_verified_identifications INTEGER;
  v_species_documented INTEGER;
  v_current_rating INTEGER;
  v_achievement_record RECORD;
  v_already_has BOOLEAN;
BEGIN
  -- Get user statistics - use subqueries to avoid GROUP BY issues
  SELECT 
    COALESCE(COUNT(DISTINCT id), 0)
  INTO v_observations_count
  FROM observations
  WHERE user_id = p_user_id;

  SELECT 
    COALESCE(COUNT(DISTINCT id), 0)
  INTO v_verified_identifications
  FROM identifications
  WHERE user_id = p_user_id AND is_verified = true;

  SELECT 
    COALESCE(COUNT(DISTINCT species), 0)
  INTO v_species_documented
  FROM identifications
  WHERE user_id = p_user_id AND is_verified = true;

  SELECT 
    COALESCE(current_rating, 0)
  INTO v_current_rating
  FROM rating_systems
  WHERE user_id = p_user_id;

  -- Check each achievement
  FOR v_achievement_record IN
    SELECT a.id, a.name, a.requirement_type, a.requirement_value
    FROM public.achievements a
  LOOP
    v_already_has := EXISTS (
      SELECT 1 FROM public.user_achievements ua
      WHERE ua.user_id = p_user_id AND ua.achievement_id = v_achievement_record.id
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

        RETURN QUERY SELECT v_achievement_record.id, v_achievement_record.name::VARCHAR, TRUE::BOOLEAN;
      END IF;
    END IF;
  END LOOP;
END;
$function$;

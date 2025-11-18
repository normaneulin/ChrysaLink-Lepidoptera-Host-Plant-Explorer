auto_unlock_achievements

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


award_points

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


check_achievements

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

current_user_id

BEGIN
  RETURN auth.uid();
END;


handle_new_user


BEGIN
  INSERT INTO public.profiles (id, username, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email
  );
  RETURN new;
END;


update_observation_counts_on_verification


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


update_updated_at_column


BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;


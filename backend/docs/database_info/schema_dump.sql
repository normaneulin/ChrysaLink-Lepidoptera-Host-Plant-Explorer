

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."auto_unlock_achievements"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."auto_unlock_achievements"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_points"("p_user_id" "uuid", "p_points" integer, "p_reason" character varying, "p_identification_id" "uuid" DEFAULT NULL::"uuid", "p_observation_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("new_rating" integer, "new_expertise_level" character varying)
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."award_points"("p_user_id" "uuid", "p_points" integer, "p_reason" character varying, "p_identification_id" "uuid", "p_observation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_achievements"("p_user_id" "uuid") RETURNS TABLE("achievement_id" "uuid", "achievement_name" character varying, "points_reward" integer)
    LANGUAGE "plpgsql"
    AS $$
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
            -- Not already unlocked (qualify column to avoid PL/pgSQL variable ambiguity)
            a.id NOT IN (SELECT ua2.achievement_id FROM user_achievements ua2 WHERE ua2.user_id = p_user_id)
      -- And meets requirement
      AND (
        (a.requirement_type = 'observations_count' AND user_stats.obs_count >= a.requirement_value)
        OR (a.requirement_type = 'identifications_verified' AND user_stats.verified_ids >= a.requirement_value)
        OR (a.requirement_type = 'species_documented' AND user_stats.unique_species >= a.requirement_value)
        OR (a.requirement_type = 'rating_threshold' AND user_stats.total_rating >= a.requirement_value)
      )
  )
    SELECT ua.id AS achievement_id, ua.name AS achievement_name, ua.points_reward AS points_reward FROM unlockable_achievements ua;
END;
$$;


ALTER FUNCTION "public"."check_achievements"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN auth.uid();
END;
$$;


ALTER FUNCTION "public"."current_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_username TEXT;
BEGIN
  -- Extract username from raw_user_meta_data
  v_username := new.raw_user_meta_data->>'username';
  
  -- Log for debugging
  RAISE NOTICE 'Creating profile - ID: %, Username: %, Email: %', 
    new.id, v_username, new.email;
  
  -- Insert new profile
  INSERT INTO public.profiles (id, username, email, name)
  VALUES (new.id, v_username, new.email, '')
  ON CONFLICT (id) DO NOTHING;
  
  RAISE NOTICE 'Profile created successfully for user: %', new.id;
  RETURN new;
  
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating profile for user % with username %. Error: %', 
    new.id, v_username, SQLERRM;
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_observation_counts_on_verification"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."update_observation_counts_on_verification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."achievements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text" NOT NULL,
    "icon_url" "text",
    "points_reward" integer DEFAULT 0,
    "requirement_type" character varying(50) NOT NULL,
    "requirement_value" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "achievements_requirement_type_check" CHECK ((("requirement_type")::"text" = ANY ((ARRAY['observations_count'::character varying, 'identifications_verified'::character varying, 'species_documented'::character varying, 'rating_threshold'::character varying, 'streak_days'::character varying, 'community_contribution'::character varying])::"text"[])))
);


ALTER TABLE "public"."achievements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "observation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."identifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "observation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "species" "text" NOT NULL,
    "scientific_name" "text",
    "caption" "text",
    "confidence_score" numeric(3,2) DEFAULT NULL::numeric,
    "is_verified" boolean DEFAULT false,
    "is_auto_suggested" boolean DEFAULT false,
    "points_awarded" integer DEFAULT 0,
    "verified_at" timestamp with time zone,
    "verified_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "identifications_confidence_score_check" CHECK ((("confidence_score" IS NULL) OR (("confidence_score" >= (0)::numeric) AND ("confidence_score" <= (1)::numeric))))
);


ALTER TABLE "public"."identifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kv_store_b55216b3" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL
);


ALTER TABLE "public"."kv_store_b55216b3" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lepidoptera_taxonomy" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "division" "text" NOT NULL,
    "family" "text",
    "genus" "text",
    "specific_epithet" "text",
    "common_name" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "scientific_name" "text",
    "subfamily" "text",
    "tribe" "text",
    "author" "text",
    "year_of_publication" integer,
    "subspecific_epithet" "text"
);


ALTER TABLE "public"."lepidoptera_taxonomy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "observation_id" "uuid",
    "identification_id" "uuid",
    "comment_id" "uuid",
    "type" character varying(50) NOT NULL,
    "message" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['new_comment'::character varying, 'identification_suggested'::character varying, 'identification_verified'::character varying, 'identification_rejected'::character varying, 'points_awarded'::character varying, 'rating_increased'::character varying, 'new_follower'::character varying, 'observation_liked'::character varying])::"text"[])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."observation_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "observation_id" "uuid" NOT NULL,
    "image_type" "text",
    "image_url" "text" NOT NULL,
    "storage_path" "text",
    "uploaded_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "observation_images_image_type_check" CHECK (("image_type" = ANY (ARRAY['lepidoptera'::"text", 'plant'::"text", 'general'::"text"])))
);


ALTER TABLE "public"."observation_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."observations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "lepidoptera_id" "uuid",
    "plant_id" "uuid",
    "location" "text" NOT NULL,
    "latitude" numeric(10,8) NOT NULL,
    "longitude" numeric(11,8) NOT NULL,
    "observation_date" "date" NOT NULL,
    "notes" "text",
    "is_public" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "at_least_one_species" CHECK ((("lepidoptera_id" IS NOT NULL) OR ("plant_id" IS NOT NULL)))
);


ALTER TABLE "public"."observations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plant_taxonomy" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "division" "text" NOT NULL,
    "family" "text",
    "genus" "text",
    "specific_epithet" "text",
    "common_name" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "scientific_name" "text",
    "author" "text",
    "year_of_publication" integer,
    "subspecific_epithet" "text"
);


ALTER TABLE "public"."plant_taxonomy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."points_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "identification_id" "uuid",
    "observation_id" "uuid",
    "points_amount" integer NOT NULL,
    "reason" character varying(100) NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "points_ledger_reason_check" CHECK ((("reason")::"text" = ANY ((ARRAY['identification_verified'::character varying, 'identification_accepted'::character varying, 'observation_created'::character varying, 'comment_helpful'::character varying, 'bonus_achievement'::character varying])::"text"[])))
);


ALTER TABLE "public"."points_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "bio" "text",
    "followers" integer DEFAULT 0,
    "following" integer DEFAULT 0,
    "observation_count" integer DEFAULT 0,
    "validated_species" integer DEFAULT 0,
    "validated_identifications" integer DEFAULT 0,
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "username" "text",
    "email" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rating_systems" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "current_rating" integer DEFAULT 0,
    "expertise_level" character varying(20) DEFAULT 'Novice'::character varying,
    "verified_identification_count" integer DEFAULT 0,
    "points_awarded_total" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rating_systems_expertise_level_check" CHECK ((("expertise_level")::"text" = ANY ((ARRAY['Novice'::character varying, 'Amateur'::character varying, 'Intermediate'::character varying, 'Expert'::character varying, 'Specialist'::character varying])::"text"[])))
);


ALTER TABLE "public"."rating_systems" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."relationships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lepidoptera_id" "uuid" NOT NULL,
    "plant_id" "uuid" NOT NULL,
    "relationship_type" character varying(50) DEFAULT 'host_plant'::character varying,
    "observation_count" integer DEFAULT 0,
    "verified_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "relationships_relationship_type_check" CHECK ((("relationship_type")::"text" = ANY ((ARRAY['host_plant'::character varying, 'alternate_host'::character varying, 'occasional_host'::character varying, 'preferred_host'::character varying])::"text"[])))
);


ALTER TABLE "public"."relationships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."taxonomy_divisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "division_name" "text" NOT NULL,
    "common_name" "text",
    "description" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."taxonomy_divisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_achievements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "achievement_id" "uuid" NOT NULL,
    "unlocked_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."user_achievements" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_statistics" AS
 SELECT "u"."id" AS "user_id",
    "p"."name",
    "p"."avatar_url",
    "rs"."current_rating",
    "rs"."expertise_level",
    COALESCE(( SELECT "count"(*) AS "count"
           FROM "public"."observations"
          WHERE ("observations"."user_id" = "u"."id")), (0)::bigint) AS "total_observations",
    COALESCE(( SELECT "count"(*) AS "count"
           FROM "public"."observations"
          WHERE (("observations"."user_id" = "u"."id") AND ("observations"."created_at" >= ("now"() - '7 days'::interval)))), (0)::bigint) AS "observations_this_week",
    COALESCE(( SELECT "count"(*) AS "count"
           FROM "public"."identifications"
          WHERE (("identifications"."user_id" = "u"."id") AND ("identifications"."is_verified" = true))), (0)::bigint) AS "verified_identifications",
    COALESCE(( SELECT "count"(DISTINCT "identifications"."species") AS "count"
           FROM "public"."identifications"
          WHERE (("identifications"."user_id" = "u"."id") AND ("identifications"."is_verified" = true))), (0)::bigint) AS "unique_species_identified",
    COALESCE(( SELECT "count"(*) AS "count"
           FROM "public"."comments"
          WHERE ("comments"."user_id" = "u"."id")), (0)::bigint) AS "total_comments",
    COALESCE(( SELECT "count"(*) AS "count"
           FROM "public"."user_achievements"
          WHERE ("user_achievements"."user_id" = "u"."id")), (0)::bigint) AS "achievements_unlocked",
    "p"."followers",
    "p"."following",
    "rs"."verified_identification_count",
    COALESCE(( SELECT "sum"("points_ledger"."points_amount") AS "sum"
           FROM "public"."points_ledger"
          WHERE ("points_ledger"."user_id" = "u"."id")), (0)::bigint) AS "lifetime_points",
    "p"."created_at" AS "member_since"
   FROM (("auth"."users" "u"
     LEFT JOIN "public"."profiles" "p" ON (("u"."id" = "p"."id")))
     LEFT JOIN "public"."rating_systems" "rs" ON (("u"."id" = "rs"."user_id")));


ALTER VIEW "public"."user_statistics" OWNER TO "postgres";


ALTER TABLE ONLY "public"."achievements"
    ADD CONSTRAINT "achievements_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."achievements"
    ADD CONSTRAINT "achievements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."identifications"
    ADD CONSTRAINT "identifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kv_store_b55216b3"
    ADD CONSTRAINT "kv_store_b55216b3_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."lepidoptera_taxonomy"
    ADD CONSTRAINT "lepidoptera_taxonomy_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."observation_images"
    ADD CONSTRAINT "observation_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."observations"
    ADD CONSTRAINT "observations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plant_taxonomy"
    ADD CONSTRAINT "plant_taxonomy_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."points_ledger"
    ADD CONSTRAINT "points_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."rating_systems"
    ADD CONSTRAINT "rating_systems_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rating_systems"
    ADD CONSTRAINT "rating_systems_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."relationships"
    ADD CONSTRAINT "relationships_lepidoptera_id_plant_id_key" UNIQUE ("lepidoptera_id", "plant_id");



ALTER TABLE ONLY "public"."relationships"
    ADD CONSTRAINT "relationships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."relationships"
    ADD CONSTRAINT "relationships_unique" UNIQUE ("lepidoptera_id", "plant_id");



ALTER TABLE ONLY "public"."taxonomy_divisions"
    ADD CONSTRAINT "taxonomy_divisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."relationships"
    ADD CONSTRAINT "unique_lepidoptera_plant" UNIQUE ("lepidoptera_id", "plant_id");



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_unique" UNIQUE ("user_id", "achievement_id");



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_user_id_achievement_id_key" UNIQUE ("user_id", "achievement_id");



CREATE INDEX "idx_comments_created_at" ON "public"."comments" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_comments_observation_id" ON "public"."comments" USING "btree" ("observation_id");



CREATE INDEX "idx_comments_user_id" ON "public"."comments" USING "btree" ("user_id");



CREATE INDEX "idx_identifications_created_at" ON "public"."identifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_identifications_is_verified" ON "public"."identifications" USING "btree" ("is_verified");



CREATE INDEX "idx_identifications_observation_id" ON "public"."identifications" USING "btree" ("observation_id");



CREATE INDEX "idx_identifications_user_id" ON "public"."identifications" USING "btree" ("user_id");



CREATE INDEX "idx_lepidoptera_common_name" ON "public"."lepidoptera_taxonomy" USING "btree" ("common_name");



CREATE INDEX "idx_lepidoptera_division" ON "public"."lepidoptera_taxonomy" USING "btree" ("division");



CREATE INDEX "idx_lepidoptera_family" ON "public"."lepidoptera_taxonomy" USING "btree" ("family");



CREATE INDEX "idx_lepidoptera_genus" ON "public"."lepidoptera_taxonomy" USING "btree" ("genus");



CREATE INDEX "idx_lepidoptera_scientific_name" ON "public"."lepidoptera_taxonomy" USING "btree" ("scientific_name");



CREATE INDEX "idx_lepidoptera_subfamily" ON "public"."lepidoptera_taxonomy" USING "btree" ("subfamily");



CREATE INDEX "idx_lepidoptera_tribe" ON "public"."lepidoptera_taxonomy" USING "btree" ("tribe");



CREATE INDEX "idx_notifications_created_at" ON "public"."notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_notifications_is_read" ON "public"."notifications" USING "btree" ("is_read");



CREATE INDEX "idx_notifications_type" ON "public"."notifications" USING "btree" ("type");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_observations_created_at" ON "public"."observations" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_observations_date" ON "public"."observations" USING "btree" ("observation_date");



CREATE INDEX "idx_observations_is_public" ON "public"."observations" USING "btree" ("is_public");



CREATE INDEX "idx_observations_lepidoptera_id" ON "public"."observations" USING "btree" ("lepidoptera_id");



CREATE INDEX "idx_observations_location" ON "public"."observations" USING "btree" ("location");



CREATE INDEX "idx_observations_plant_id" ON "public"."observations" USING "btree" ("plant_id");



CREATE INDEX "idx_observations_user_date" ON "public"."observations" USING "btree" ("user_id", "observation_date" DESC);



CREATE INDEX "idx_observations_user_id" ON "public"."observations" USING "btree" ("user_id");



CREATE INDEX "idx_plant_common_name" ON "public"."plant_taxonomy" USING "btree" ("common_name");



CREATE INDEX "idx_plant_division" ON "public"."plant_taxonomy" USING "btree" ("division");



CREATE INDEX "idx_plant_family" ON "public"."plant_taxonomy" USING "btree" ("family");



CREATE INDEX "idx_plant_genus" ON "public"."plant_taxonomy" USING "btree" ("genus");



CREATE INDEX "idx_plant_scientific_name" ON "public"."plant_taxonomy" USING "btree" ("scientific_name");



CREATE INDEX "idx_points_ledger_created_at" ON "public"."points_ledger" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_points_ledger_user_id" ON "public"."points_ledger" USING "btree" ("user_id");



CREATE INDEX "idx_profiles_created_at" ON "public"."profiles" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "idx_profiles_username" ON "public"."profiles" USING "btree" ("username");



CREATE INDEX "idx_rating_systems_current_rating" ON "public"."rating_systems" USING "btree" ("current_rating" DESC);



CREATE INDEX "idx_rating_systems_expertise_level" ON "public"."rating_systems" USING "btree" ("expertise_level");



CREATE INDEX "idx_rating_systems_user_id" ON "public"."rating_systems" USING "btree" ("user_id");



CREATE INDEX "idx_relationships_lepidoptera_id" ON "public"."relationships" USING "btree" ("lepidoptera_id");



CREATE INDEX "idx_relationships_plant_id" ON "public"."relationships" USING "btree" ("plant_id");



CREATE INDEX "idx_relationships_relationship_type" ON "public"."relationships" USING "btree" ("relationship_type");



CREATE INDEX "idx_taxonomy_divisions_name" ON "public"."taxonomy_divisions" USING "btree" ("division_name");



CREATE INDEX "idx_taxonomy_divisions_type" ON "public"."taxonomy_divisions" USING "btree" ("type");



CREATE INDEX "idx_user_achievements_achievement_id" ON "public"."user_achievements" USING "btree" ("achievement_id");



CREATE INDEX "idx_user_achievements_user_id" ON "public"."user_achievements" USING "btree" ("user_id");



CREATE INDEX "kv_store_b55216b3_key_idx" ON "public"."kv_store_b55216b3" USING "btree" ("key" "text_pattern_ops");



CREATE OR REPLACE TRIGGER "trigger_auto_unlock_achievements" AFTER UPDATE ON "public"."identifications" FOR EACH ROW WHEN (("new"."is_verified" AND (NOT "old"."is_verified"))) EXECUTE FUNCTION "public"."auto_unlock_achievements"();



CREATE OR REPLACE TRIGGER "trigger_update_counts_on_verification" AFTER UPDATE ON "public"."identifications" FOR EACH ROW EXECUTE FUNCTION "public"."update_observation_counts_on_verification"();



CREATE OR REPLACE TRIGGER "update_comments_updated_at" BEFORE UPDATE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_identifications_updated_at" BEFORE UPDATE ON "public"."identifications" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_observations_updated_at" BEFORE UPDATE ON "public"."observations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_rating_systems_updated_at" BEFORE UPDATE ON "public"."rating_systems" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_relationships_updated_at" BEFORE UPDATE ON "public"."relationships" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "public"."observations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."identifications"
    ADD CONSTRAINT "identifications_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "public"."observations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."identifications"
    ADD CONSTRAINT "identifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."identifications"
    ADD CONSTRAINT "identifications_verified_by_user_id_fkey" FOREIGN KEY ("verified_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_identification_id_fkey" FOREIGN KEY ("identification_id") REFERENCES "public"."identifications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "public"."observations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."observation_images"
    ADD CONSTRAINT "observation_images_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "public"."observations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."observations"
    ADD CONSTRAINT "observations_lepidoptera_id_fkey" FOREIGN KEY ("lepidoptera_id") REFERENCES "public"."lepidoptera_taxonomy"("id");



ALTER TABLE ONLY "public"."observations"
    ADD CONSTRAINT "observations_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "public"."plant_taxonomy"("id");



ALTER TABLE ONLY "public"."observations"
    ADD CONSTRAINT "observations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."points_ledger"
    ADD CONSTRAINT "points_ledger_identification_id_fkey" FOREIGN KEY ("identification_id") REFERENCES "public"."identifications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."points_ledger"
    ADD CONSTRAINT "points_ledger_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "public"."observations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."points_ledger"
    ADD CONSTRAINT "points_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rating_systems"
    ADD CONSTRAINT "rating_systems_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."relationships"
    ADD CONSTRAINT "relationships_lepidoptera_id_fkey" FOREIGN KEY ("lepidoptera_id") REFERENCES "public"."lepidoptera_taxonomy"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."relationships"
    ADD CONSTRAINT "relationships_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "public"."plant_taxonomy"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow public insert" ON "public"."lepidoptera_taxonomy" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert" ON "public"."plant_taxonomy" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public read" ON "public"."lepidoptera_taxonomy" FOR SELECT USING (true);



CREATE POLICY "Allow public read" ON "public"."plant_taxonomy" FOR SELECT USING (true);



CREATE POLICY "Allow public update" ON "public"."lepidoptera_taxonomy" FOR UPDATE USING (true);



CREATE POLICY "Allow public update" ON "public"."plant_taxonomy" FOR UPDATE USING (true);



CREATE POLICY "Anyone can view relationships" ON "public"."relationships" FOR SELECT USING (true);



CREATE POLICY "Only service can insert notifications" ON "public"."notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can create comments" ON "public"."comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create identifications" ON "public"."identifications" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create observations" ON "public"."observations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own comments" ON "public"."comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own observations" ON "public"."observations" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own comments" ON "public"."comments" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own identifications" ON "public"."identifications" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own observations" ON "public"."observations" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own rating system" ON "public"."rating_systems" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view all comments" ON "public"."comments" FOR SELECT USING (true);



CREATE POLICY "Users can view all identifications" ON "public"."identifications" FOR SELECT USING (true);



CREATE POLICY "Users can view all profiles" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Users can view all rating systems" ON "public"."rating_systems" FOR SELECT USING (true);



CREATE POLICY "Users can view public observations or their own" ON "public"."observations" FOR SELECT USING (("is_public" OR ("auth"."uid"() = "user_id")));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."achievements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."identifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kv_store_b55216b3" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lepidoptera_taxonomy" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plant_taxonomy" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."points_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rating_systems" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."relationships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."taxonomy_divisions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_achievements" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."auto_unlock_achievements"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_unlock_achievements"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_unlock_achievements"() TO "service_role";



GRANT ALL ON FUNCTION "public"."award_points"("p_user_id" "uuid", "p_points" integer, "p_reason" character varying, "p_identification_id" "uuid", "p_observation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."award_points"("p_user_id" "uuid", "p_points" integer, "p_reason" character varying, "p_identification_id" "uuid", "p_observation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."award_points"("p_user_id" "uuid", "p_points" integer, "p_reason" character varying, "p_identification_id" "uuid", "p_observation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_achievements"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_achievements"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_achievements"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_observation_counts_on_verification"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_observation_counts_on_verification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_observation_counts_on_verification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."achievements" TO "anon";
GRANT ALL ON TABLE "public"."achievements" TO "authenticated";
GRANT ALL ON TABLE "public"."achievements" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."identifications" TO "anon";
GRANT ALL ON TABLE "public"."identifications" TO "authenticated";
GRANT ALL ON TABLE "public"."identifications" TO "service_role";



GRANT ALL ON TABLE "public"."kv_store_b55216b3" TO "anon";
GRANT ALL ON TABLE "public"."kv_store_b55216b3" TO "authenticated";
GRANT ALL ON TABLE "public"."kv_store_b55216b3" TO "service_role";



GRANT ALL ON TABLE "public"."lepidoptera_taxonomy" TO "anon";
GRANT ALL ON TABLE "public"."lepidoptera_taxonomy" TO "authenticated";
GRANT ALL ON TABLE "public"."lepidoptera_taxonomy" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."observation_images" TO "anon";
GRANT ALL ON TABLE "public"."observation_images" TO "authenticated";
GRANT ALL ON TABLE "public"."observation_images" TO "service_role";



GRANT ALL ON TABLE "public"."observations" TO "anon";
GRANT ALL ON TABLE "public"."observations" TO "authenticated";
GRANT ALL ON TABLE "public"."observations" TO "service_role";



GRANT ALL ON TABLE "public"."plant_taxonomy" TO "anon";
GRANT ALL ON TABLE "public"."plant_taxonomy" TO "authenticated";
GRANT ALL ON TABLE "public"."plant_taxonomy" TO "service_role";



GRANT ALL ON TABLE "public"."points_ledger" TO "anon";
GRANT ALL ON TABLE "public"."points_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."points_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."rating_systems" TO "anon";
GRANT ALL ON TABLE "public"."rating_systems" TO "authenticated";
GRANT ALL ON TABLE "public"."rating_systems" TO "service_role";



GRANT ALL ON TABLE "public"."relationships" TO "anon";
GRANT ALL ON TABLE "public"."relationships" TO "authenticated";
GRANT ALL ON TABLE "public"."relationships" TO "service_role";



GRANT ALL ON TABLE "public"."taxonomy_divisions" TO "anon";
GRANT ALL ON TABLE "public"."taxonomy_divisions" TO "authenticated";
GRANT ALL ON TABLE "public"."taxonomy_divisions" TO "service_role";



GRANT ALL ON TABLE "public"."user_achievements" TO "anon";
GRANT ALL ON TABLE "public"."user_achievements" TO "authenticated";
GRANT ALL ON TABLE "public"."user_achievements" TO "service_role";



GRANT ALL ON TABLE "public"."user_statistics" TO "anon";
GRANT ALL ON TABLE "public"."user_statistics" TO "authenticated";
GRANT ALL ON TABLE "public"."user_statistics" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































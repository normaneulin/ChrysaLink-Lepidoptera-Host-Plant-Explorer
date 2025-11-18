-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.achievements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL UNIQUE,
  description text NOT NULL,
  icon_url text,
  points_reward integer DEFAULT 0,
  requirement_type character varying NOT NULL CHECK (requirement_type::text = ANY (ARRAY['observations_count'::character varying, 'identifications_verified'::character varying, 'species_documented'::character varying, 'rating_threshold'::character varying, 'streak_days'::character varying, 'community_contribution'::character varying]::text[])),
  requirement_value integer NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT achievements_pkey PRIMARY KEY (id)
);
CREATE TABLE public.comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  observation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  text text NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT comments_pkey PRIMARY KEY (id),
  CONSTRAINT comments_observation_id_fkey FOREIGN KEY (observation_id) REFERENCES public.observations(id),
  CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.identifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  observation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  species text NOT NULL,
  scientific_name text,
  caption text,
  confidence_score numeric DEFAULT NULL::numeric CHECK (confidence_score IS NULL OR confidence_score >= 0::numeric AND confidence_score <= 1::numeric),
  is_verified boolean DEFAULT false,
  is_auto_suggested boolean DEFAULT false,
  points_awarded integer DEFAULT 0,
  verified_at timestamp with time zone,
  verified_by_user_id uuid,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT identifications_pkey PRIMARY KEY (id),
  CONSTRAINT identifications_observation_id_fkey FOREIGN KEY (observation_id) REFERENCES public.observations(id),
  CONSTRAINT identifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT identifications_verified_by_user_id_fkey FOREIGN KEY (verified_by_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.kv_store_b55216b3 (
  key text NOT NULL,
  value jsonb NOT NULL,
  CONSTRAINT kv_store_b55216b3_pkey PRIMARY KEY (key)
);
CREATE TABLE public.lepidoptera_taxonomy (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  division text NOT NULL,
  family text,
  genus text,
  specific_epithet text,
  common_name text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  scientific_name text,
  subfamily text,
  tribe text,
  author text,
  year_of_publication integer,
  subspecific_epithet text,
  CONSTRAINT lepidoptera_taxonomy_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  observation_id uuid,
  identification_id uuid,
  comment_id uuid,
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['new_comment'::character varying, 'identification_suggested'::character varying, 'identification_verified'::character varying, 'identification_rejected'::character varying, 'points_awarded'::character varying, 'rating_increased'::character varying, 'new_follower'::character varying, 'observation_liked'::character varying]::text[])),
  message text NOT NULL,
  is_read boolean DEFAULT false,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_identification_id_fkey FOREIGN KEY (identification_id) REFERENCES public.identifications(id),
  CONSTRAINT notifications_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT notifications_observation_id_fkey FOREIGN KEY (observation_id) REFERENCES public.observations(id)
);
CREATE TABLE public.observations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lepidoptera_id uuid,
  plant_id uuid,
  location text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  observation_date date NOT NULL,
  notes text,
  image_url text,
  image_storage_path text,
  is_public boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT observations_pkey PRIMARY KEY (id),
  CONSTRAINT observations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT observations_lepidoptera_id_fkey FOREIGN KEY (lepidoptera_id) REFERENCES public.lepidoptera_taxonomy(id),
  CONSTRAINT observations_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES public.plant_taxonomy(id)
);
CREATE TABLE public.plant_taxonomy (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  division text NOT NULL,
  family text,
  genus text,
  specific_epithet text,
  common_name text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  scientific_name text,
  author text,
  year_of_publication integer,
  subspecific_epithet text,
  CONSTRAINT plant_taxonomy_pkey PRIMARY KEY (id)
);
CREATE TABLE public.points_ledger (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  identification_id uuid,
  observation_id uuid,
  points_amount integer NOT NULL,
  reason character varying NOT NULL CHECK (reason::text = ANY (ARRAY['identification_verified'::character varying, 'identification_accepted'::character varying, 'observation_created'::character varying, 'comment_helpful'::character varying, 'bonus_achievement'::character varying]::text[])),
  description text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT points_ledger_pkey PRIMARY KEY (id),
  CONSTRAINT points_ledger_observation_id_fkey FOREIGN KEY (observation_id) REFERENCES public.observations(id),
  CONSTRAINT points_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT points_ledger_identification_id_fkey FOREIGN KEY (identification_id) REFERENCES public.identifications(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  name text,
  bio text,
  followers integer DEFAULT 0,
  following integer DEFAULT 0,
  observation_count integer DEFAULT 0,
  validated_species integer DEFAULT 0,
  validated_identifications integer DEFAULT 0,
  avatar_url text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  username text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.rating_systems (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  current_rating integer DEFAULT 0,
  expertise_level character varying DEFAULT 'Novice'::character varying CHECK (expertise_level::text = ANY (ARRAY['Novice'::character varying, 'Amateur'::character varying, 'Intermediate'::character varying, 'Expert'::character varying, 'Specialist'::character varying]::text[])),
  verified_identification_count integer DEFAULT 0,
  points_awarded_total integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT rating_systems_pkey PRIMARY KEY (id),
  CONSTRAINT rating_systems_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.relationships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lepidoptera_id uuid NOT NULL,
  plant_id uuid NOT NULL,
  relationship_type character varying DEFAULT 'host_plant'::character varying CHECK (relationship_type::text = ANY (ARRAY['host_plant'::character varying, 'alternate_host'::character varying, 'occasional_host'::character varying, 'preferred_host'::character varying]::text[])),
  observation_count integer DEFAULT 0,
  verified_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT relationships_pkey PRIMARY KEY (id),
  CONSTRAINT relationships_lepidoptera_id_fkey FOREIGN KEY (lepidoptera_id) REFERENCES public.lepidoptera_taxonomy(id),
  CONSTRAINT relationships_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES public.plant_taxonomy(id)
);
CREATE TABLE public.taxonomy_divisions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL,
  division_name text NOT NULL,
  common_name text,
  description text,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT taxonomy_divisions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_achievements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  achievement_id uuid NOT NULL,
  unlocked_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_achievements_pkey PRIMARY KEY (id),
  CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievements(id),
  CONSTRAINT user_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
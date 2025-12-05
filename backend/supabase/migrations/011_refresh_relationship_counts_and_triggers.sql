-- Migration: refresh_relationship_counts function and triggers
-- Recomputes observation_count and verified_count for relationships

BEGIN;

-- Function: refresh_relationship_counts(rel_id uuid)
CREATE OR REPLACE FUNCTION public.refresh_relationship_counts(_rel_id uuid)
RETURNS void LANGUAGE plpgsql AS
$$
DECLARE
  v_obs_count int;
  v_verified_count int;
BEGIN
  IF _rel_id IS NULL THEN
    RETURN;
  END IF;

  -- Count linked observations
  SELECT COUNT(*) INTO v_obs_count
  FROM public.relationship_links rl
  WHERE rl.relationship_id = _rel_id;

  -- Sum verified identifications for linked observations
  SELECT COALESCE(SUM(CASE WHEN i.is_verified THEN 1 ELSE 0 END), 0) INTO v_verified_count
  FROM public.relationship_links rl
  LEFT JOIN public.identifications i ON i.observation_id = rl.observation_id
  WHERE rl.relationship_id = _rel_id;

  -- Update the relationships row using unambiguous variable names
  UPDATE public.relationships
  SET observation_count = v_obs_count,
      verified_count = v_verified_count,
      updated_at = now()
  WHERE id = _rel_id;

  -- Optionally remove empty relationship rows (no linked observations and no verified evidence)
  DELETE FROM public.relationships
  WHERE id = _rel_id
    AND observation_count = 0
    AND verified_count = 0;
END;
$$;

-- Trigger: after insert on relationship_links
CREATE OR REPLACE FUNCTION public.trg_rl_after_insert()
RETURNS trigger LANGUAGE plpgsql AS
$$
BEGIN
  PERFORM public.refresh_relationship_counts(NEW.relationship_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS relationship_links_after_insert ON public.relationship_links;
CREATE TRIGGER relationship_links_after_insert
AFTER INSERT ON public.relationship_links
FOR EACH ROW EXECUTE FUNCTION public.trg_rl_after_insert();

-- Trigger: after delete on relationship_links
CREATE OR REPLACE FUNCTION public.trg_rl_after_delete()
RETURNS trigger LANGUAGE plpgsql AS
$$
BEGIN
  PERFORM public.refresh_relationship_counts(OLD.relationship_id);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS relationship_links_after_delete ON public.relationship_links;
CREATE TRIGGER relationship_links_after_delete
AFTER DELETE ON public.relationship_links
FOR EACH ROW EXECUTE FUNCTION public.trg_rl_after_delete();

-- Trigger: when identification's is_verified changes, refresh relationships linked to that observation
CREATE OR REPLACE FUNCTION public.trg_identifications_verified_change()
RETURNS trigger LANGUAGE plpgsql AS
$$
DECLARE
  rel_rec RECORD;
BEGIN
  -- Only act when is_verified inserted or changed
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.is_verified IS DISTINCT FROM NEW.is_verified)) THEN
    FOR rel_rec IN
      SELECT rl.relationship_id FROM public.relationship_links rl WHERE rl.observation_id = COALESCE(NEW.observation_id, OLD.observation_id)
    LOOP
      PERFORM public.refresh_relationship_counts(rel_rec.relationship_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS identifications_after_upsert_verified ON public.identifications;
CREATE TRIGGER identifications_after_upsert_verified
AFTER INSERT OR UPDATE OF is_verified ON public.identifications
FOR EACH ROW EXECUTE FUNCTION public.trg_identifications_verified_change();

COMMIT;

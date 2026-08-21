-- The academy `base` row is the contractual/organizational root only.
-- Sporting rosters live exclusively in u15/u17/u18/u20 (or first_team for professionals).

WITH root_relations AS (
  SELECT
    r.player_id,
    r.relation,
    r.rivalry,
    r.chemistry,
    r.updated_at,
    root.name,
    root.primary_position,
    st.club_id AS current_club_id
  FROM public.player_teammate_relations r
  JOIN public.base_ai_players root ON root.id=r.teammate_id
  JOIN public.base_clubs root_club ON root_club.id=root.club_id
  JOIN public.player_career_state st ON st.player_id=r.player_id
  WHERE root_club.club_level='academy'
    AND root_club.squad_level='base'
), exact_map AS (
  SELECT rr.*,
         (
           SELECT ai.id
           FROM public.base_ai_players ai
           WHERE ai.club_id=rr.current_club_id
             AND ai.name=rr.name
             AND ai.primary_position=rr.primary_position
           LIMIT 1
         ) AS target_id
  FROM root_relations rr
  WHERE (
    SELECT count(*)
    FROM public.base_ai_players ai
    WHERE ai.club_id=rr.current_club_id
      AND ai.name=rr.name
      AND ai.primary_position=rr.primary_position
  )=1
)
INSERT INTO public.player_teammate_relations(
  player_id,teammate_id,relation,rivalry,chemistry,updated_at
)
SELECT player_id,target_id,relation,rivalry,chemistry,updated_at
FROM exact_map
WHERE target_id IS NOT NULL
ON CONFLICT(player_id,teammate_id) DO UPDATE SET
  relation=CASE
    WHEN excluded.updated_at>=public.player_teammate_relations.updated_at THEN excluded.relation
    ELSE public.player_teammate_relations.relation
  END,
  rivalry=CASE
    WHEN excluded.updated_at>=public.player_teammate_relations.updated_at THEN excluded.rivalry
    ELSE public.player_teammate_relations.rivalry
  END,
  chemistry=CASE
    WHEN excluded.updated_at>=public.player_teammate_relations.updated_at THEN excluded.chemistry
    ELSE public.player_teammate_relations.chemistry
  END,
  updated_at=greatest(public.player_teammate_relations.updated_at,excluded.updated_at);

DELETE FROM public.player_teammate_relations r
USING public.base_ai_players ai,public.base_clubs c
WHERE r.teammate_id=ai.id
  AND c.id=ai.club_id
  AND c.club_level='academy'
  AND c.squad_level='base';

DELETE FROM public.base_ai_players ai
USING public.base_clubs c
WHERE c.id=ai.club_id
  AND c.club_level='academy'
  AND c.squad_level='base';

DO $block$
DECLARE p record;
BEGIN
  FOR p IN SELECT player_id FROM public.player_career_state LOOP
    PERFORM private.ensure_teammate_relations(p.player_id);
  END LOOP;
END
$block$;

CREATE OR REPLACE FUNCTION private.guard_base_ai_player_sporting_roster()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_level text;
  v_club_level text;
BEGIN
  SELECT squad_level,club_level
    INTO v_level,v_club_level
  FROM public.base_clubs
  WHERE id=NEW.club_id;

  IF v_club_level='academy' AND v_level='base' THEN
    RAISE EXCEPTION 'A raiz organizacional da base não possui elenco esportivo. Use Sub-15, Sub-17, Sub-18 ou Sub-20.';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_guard_base_ai_player_sporting_roster ON public.base_ai_players;
CREATE TRIGGER trg_guard_base_ai_player_sporting_roster
BEFORE INSERT OR UPDATE OF club_id ON public.base_ai_players
FOR EACH ROW
EXECUTE FUNCTION private.guard_base_ai_player_sporting_roster();

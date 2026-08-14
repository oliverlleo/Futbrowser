CREATE OR REPLACE FUNCTION private.career_match_competition_label(p_player uuid, p_club uuid, p_date date)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
SELECT coalesce(
  (
    SELECT d.name
    FROM public.career_competition_fixtures f
    JOIN public.career_competition_seasons s ON s.id=f.season_id
    JOIN public.competition_definitions d ON d.code=s.competition_code
    WHERE s.player_id=p_player
      AND f.match_date=p_date
      AND p_club IN(f.home_club_id,f.away_club_id)
    ORDER BY CASE WHEN s.competition_code LIKE '%CUP%' THEN 0 ELSE 1 END
    LIMIT 1
  ),
  (
    SELECT CASE
      WHEN c.squad_level='first_team' THEN 'Liga Nacional'
      WHEN c.squad_level IN('u15','u17','u18','u20') THEN 'Liga Nacional Sub-'||substring(c.squad_level from 2)
      ELSE 'Competição'
    END
    FROM public.player_career_state st
    JOIN public.base_clubs c ON c.id=st.club_id
    WHERE st.player_id=p_player
  )
)
$function$;

CREATE OR REPLACE FUNCTION private.sponsor_tier_for_player(p_player_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v record;c record;t int:=1;exposure_matches int:=0;historical_tier int:=0;
BEGIN
  SELECT * INTO v FROM public.player_career_state WHERE player_id=p_player_id;
  SELECT * INTO c FROM public.base_clubs WHERE id=v.club_id;
  IF v.player_id IS NULL OR c.id IS NULL THEN RETURN 1; END IF;

  IF c.squad_level NOT IN('u15','u17','u18','u20','first_team') THEN
    RAISE EXCEPTION 'Categoria esportiva inválida para patrocínio: %',coalesce(c.squad_level,'NULL');
  END IF;

  SELECT count(*) INTO exposure_matches
  FROM public.player_match_history h
  WHERE h.player_id=p_player_id
    AND h.match_date BETWEEN v.career_date-90 AND v.career_date
    AND (h.context='national' OR h.metadata ? 'competition_result' OR coalesce(h.rating,0)>=7.5);

  IF c.squad_level IN('u15','u17') THEN RETURN 1; END IF;
  IF c.squad_level='u18' THEN
    t:=CASE WHEN coalesce(c.reputation,0)>=4 AND coalesce(v.fame,0)>=30 AND coalesce(v.fanbase,0)>=1200 AND exposure_matches>=1 THEN 2 ELSE 1 END;
  ELSIF c.squad_level='u20' THEN
    t:=CASE WHEN coalesce(c.reputation,0)>=4 AND coalesce(v.fame,0)>=28 AND exposure_matches>=1 THEN 2 ELSE 1 END;
  ELSIF c.squad_level='first_team' THEN
    t:=CASE
      WHEN coalesce(c.reputation,0)<=3 OR coalesce(c.division_level,4)>=4 THEN 2
      WHEN coalesce(c.reputation,0)<=5 OR coalesce(c.division_level,3)=3 THEN 3
      ELSE 4 END;
    IF coalesce(v.fame,0)<20 THEN t:=least(t,2); END IF;
    IF coalesce(v.fame,0)<45 OR coalesce(v.fanbase,0)<8000 THEN t:=least(t,3); END IF;
    IF t>=4 AND exposure_matches<2 THEN t:=3; END IF;
    IF coalesce(v.fame,0)>=80 AND coalesce(v.fanbase,0)>=150000 AND coalesce(c.reputation,0)>=8
       AND coalesce(c.division_level,1)<=1 AND exposure_matches>=5 THEN t:=5; END IF;
  END IF;

  SELECT coalesce(max(brand_tier),0) INTO historical_tier FROM (
    SELECT brand_tier FROM public.player_sponsor_contracts WHERE player_id=p_player_id
    UNION ALL
    SELECT brand_tier FROM public.player_sponsor_opportunities
    WHERE player_id=p_player_id AND status IN('completed','expired','declined')
  ) z;
  IF historical_tier>0 THEN t:=least(t,historical_tier+1); END IF;
  RETURN greatest(1,least(5,t));
END
$function$;

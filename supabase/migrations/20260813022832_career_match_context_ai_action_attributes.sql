CREATE OR REPLACE FUNCTION public.get_career_match_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
 v_user uuid:=auth.uid();v_player record;v_state record;v_contract record;v_club record;v_opp record;v_team jsonb;v_hub jsonb;v_advice jsonb;v_home_players jsonb;v_away_players jsonb;v_selection jsonb;v_session record;v_opp_id uuid;v_competition text;v_seed bigint;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado.';END IF;
 SELECT * INTO v_player FROM public.jogadores WHERE user_id=v_user LIMIT 1;IF v_player.id IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.';END IF;
 PERFORM private.ensure_career_initialized(v_player.id);PERFORM private.ensure_match_selection_if_due(v_player.id);
 SELECT * INTO v_state FROM public.player_career_state WHERE player_id=v_player.id;
 SELECT * INTO v_contract FROM public.player_contracts WHERE player_id=v_player.id AND status='active' ORDER BY signed_at DESC LIMIT 1;IF v_contract.id IS NULL THEN RAISE EXCEPTION 'Contrato ativo não encontrado.';END IF;
 SELECT * INTO v_club FROM public.base_clubs WHERE id=v_state.club_id;
 IF v_club.id IS NULL OR v_club.squad_level='base' THEN RAISE EXCEPTION 'Você ainda não foi promovido para uma equipe de competição.';END IF;
 IF v_state.next_match_date IS NULL OR v_state.career_date<v_state.next_match_date OR v_state.day_period<1 THEN RAISE EXCEPTION 'A partida ainda não está disponível.';END IF;
 v_team:=public.get_career_team_profile();v_hub:=public.get_career_hub();v_advice:=public.get_career_gameplay_advice();v_selection:=coalesce(v_team->'player_projection',v_hub->'selection');
 v_opp_id:=private.career_match_opponent(v_player.id,v_club.id,v_state.career_date);SELECT * INTO v_opp FROM public.base_clubs WHERE id=v_opp_id;IF v_opp.id IS NULL THEN RAISE EXCEPTION 'Adversário não encontrado.';END IF;
 v_competition:=private.career_match_competition_label(v_player.id,v_club.id,v_state.career_date);v_seed:=abs(('x'||substr(md5(v_player.id::text||':'||v_state.career_date::text||':'||v_opp.id::text),1,16))::bit(64)::bigint);
 SELECT coalesce(jsonb_agg(x.obj ORDER BY x.starter DESC,x.ovr DESC),'[]'::jsonb) INTO v_home_players FROM(
  SELECT coalesce((e->>'probable_starter')::boolean,false) starter,coalesce((e->>'ovr')::integer,50) ovr,jsonb_build_object('id',e->>'id','name',e->>'name','position',e->>'position','secondary_position',e->>'secondary_position','ovr',coalesce((e->>'ovr')::integer,50),'attributes',coalesce(e->'attributes','{}'::jsonb),'number',nullif(e->>'number','')::integer,'chemistry',coalesce((e->>'chemistry')::integer,50),'relation_score',coalesce((e->>'relation_score')::integer,50),'rivalry',coalesce((e->>'rivalry')::boolean,false),'probable_starter',coalesce((e->>'probable_starter')::boolean,false)) obj
  FROM jsonb_array_elements(coalesce(v_team->'roster','[]'::jsonb)) e
  WHERE coalesce(e->>'availability_status','available')<>'out' AND coalesce(nullif(e->>'age','')::integer,99)<=private.current_fixture_max_age(v_player.id,v_state.career_date,v_club.id)
  ORDER BY coalesce((e->>'probable_starter')::boolean,false) DESC,coalesce((e->>'ovr')::integer,50) DESC LIMIT 18
 )x;
 WITH ranked AS(SELECT ai.*,row_number() OVER(ORDER BY ai.is_starter DESC,ai.ovr DESC,ai.age ASC,ai.name) rn FROM public.base_ai_players ai WHERE ai.club_id=v_opp.id AND ai.age<=private.current_fixture_max_age(v_player.id,v_state.career_date,v_club.id))
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'position',r.primary_position,'secondary_position',r.secondary_position,'ovr',r.ovr,'attributes',private.ai_player_attributes_json(r.id),'number',r.squad_number,'archetype',r.archetype,'squad_role',r.squad_role,'probable_starter',(r.rn<=11)) ORDER BY r.rn),'[]'::jsonb) INTO v_away_players FROM ranked r WHERE r.rn<=18;
 SELECT * INTO v_session FROM private.career_match_sessions WHERE player_id=v_player.id AND match_date=v_state.career_date AND status='active' LIMIT 1;
 IF v_session.id IS NULL THEN
  INSERT INTO private.career_match_sessions(player_id,match_date,club_id,opponent_club_id,competition,selection_status,seed,metadata)
  VALUES(v_player.id,v_state.career_date,v_club.id,v_opp.id,v_competition,coalesce(v_selection->>'status','out'),v_seed,jsonb_build_object('home_formation',v_club.formation,'away_formation',v_opp.formation,'career_stage',v_state.career_stage,'squad_level',v_club.squad_level)) RETURNING * INTO v_session;
 END IF;
 RETURN jsonb_build_object('session_id',v_session.id,'seed',v_session.seed,'matchDate',v_state.career_date,'competition',v_competition,'selection',v_selection,
 'player',jsonb_build_object('id',v_player.id,'name',v_player.nome,'nickname',v_player.apelido,'avatar',v_player.avatar,'position',v_player.posicao,'ovr',public.calculate_player_ovr(v_player.atributos),'attributes',v_player.atributos,'shirt_number',(SELECT number FROM public.player_squad_numbers WHERE player_id=v_player.id AND club_id=v_club.id AND active ORDER BY assigned_at DESC LIMIT 1),'skills',coalesce(v_hub->'skills','[]'::jsonb)),
 'state',v_hub->'state','performance',coalesce(v_advice->'performance',v_advice->'current_performance_context','{}'::jsonb),'coach_focus',v_advice->'coach_focus',
 'club',jsonb_build_object('id',v_club.id,'name',v_club.name,'formation',v_club.formation,'play_style',v_club.play_style,'shield_url',v_club.shield_url,'squad_level',v_club.squad_level),
 'home',jsonb_build_object('id',v_club.id,'name',v_club.name,'formation',v_club.formation,'play_style',v_club.play_style,'crest',v_club.shield_url,'players',v_home_players),
 'away',jsonb_build_object('id',v_opp.id,'name',v_opp.name,'formation',v_opp.formation,'play_style',v_opp.play_style,'crest',v_opp.shield_url,'players',v_away_players));
END $function$;
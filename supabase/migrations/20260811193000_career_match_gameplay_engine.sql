BEGIN;

CREATE TABLE IF NOT EXISTS private.career_match_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,
  match_date date NOT NULL,
  club_id uuid NOT NULL REFERENCES public.base_clubs(id) ON DELETE CASCADE,
  opponent_club_id uuid REFERENCES public.base_clubs(id) ON DELETE SET NULL,
  competition text NOT NULL DEFAULT 'Liga de Base',
  selection_status text NOT NULL CHECK (selection_status IN ('starter','bench','out')),
  seed bigint NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','abandoned')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_career_match_session_active
  ON private.career_match_sessions(player_id,match_date) WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_career_match_sessions_player_date
  ON private.career_match_sessions(player_id,match_date DESC);

CREATE OR REPLACE FUNCTION private.career_match_opponent(p_player_id uuid,p_club_id uuid,p_match_date date)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
  SELECT c.id
  FROM public.base_clubs c
  WHERE c.id<>p_club_id
  ORDER BY md5(p_player_id::text||':'||p_match_date::text||':'||c.id::text)
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_career_match_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_user uuid:=auth.uid();
  v_player record;
  v_state record;
  v_contract record;
  v_club record;
  v_opp record;
  v_team jsonb;
  v_hub jsonb;
  v_advice jsonb;
  v_home_players jsonb;
  v_away_players jsonb;
  v_selection jsonb;
  v_session record;
  v_opp_id uuid;
  v_competition text;
  v_seed bigint;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT * INTO v_player FROM public.jogadores WHERE user_id=v_user LIMIT 1;
  IF v_player.id IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;

  PERFORM private.ensure_career_initialized(v_player.id);
  PERFORM private.ensure_match_selection_if_due(v_player.id);

  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=v_player.id;
  SELECT * INTO v_contract FROM public.player_contracts WHERE player_id=v_player.id AND status='active' ORDER BY signed_at DESC LIMIT 1;
  IF v_contract.id IS NULL THEN RAISE EXCEPTION 'Contrato ativo não encontrado.'; END IF;
  SELECT * INTO v_club FROM public.base_clubs WHERE id=v_contract.club_id;

  IF v_state.next_match_date IS NULL OR v_state.career_date<v_state.next_match_date OR v_state.day_period<1 THEN
    RAISE EXCEPTION 'A partida ainda não está disponível.';
  END IF;

  v_team:=public.get_career_team_profile();
  v_hub:=public.get_career_hub();
  v_advice:=public.get_career_gameplay_advice();
  v_selection:=COALESCE(v_team->'player_projection',v_hub->'selection');

  v_opp_id:=private.career_match_opponent(v_player.id,v_club.id,v_state.career_date);
  SELECT * INTO v_opp FROM public.base_clubs WHERE id=v_opp_id;
  IF v_opp.id IS NULL THEN RAISE EXCEPTION 'Adversário não encontrado.'; END IF;

  v_competition:=CASE WHEN COALESCE(v_state.career_stage,'academy')='professional' THEN 'Campeonato Profissional' ELSE 'Liga de Base' END;
  v_seed:=abs(('x'||substr(md5(v_player.id::text||':'||v_state.career_date::text||':'||v_opp.id::text),1,16))::bit(64)::bigint);

  SELECT COALESCE(jsonb_agg(x.obj ORDER BY x.starter DESC,x.ovr DESC),'[]'::jsonb)
  INTO v_home_players
  FROM (
    SELECT
      COALESCE((e->>'probable_starter')::boolean,false) starter,
      COALESCE((e->>'ovr')::integer,50) ovr,
      jsonb_build_object(
        'id',e->>'id','name',e->>'name','position',e->>'position','secondary_position',e->>'secondary_position',
        'ovr',COALESCE((e->>'ovr')::integer,50),'number',NULLIF(e->>'number','')::integer,
        'chemistry',COALESCE((e->>'chemistry')::integer,50),'relation_score',COALESCE((e->>'relation_score')::integer,50),
        'rivalry',COALESCE((e->>'rivalry')::boolean,false),'probable_starter',COALESCE((e->>'probable_starter')::boolean,false)
      ) obj
    FROM jsonb_array_elements(COALESCE(v_team->'roster','[]'::jsonb)) e
    WHERE COALESCE(e->>'availability_status','available')<>'out'
    ORDER BY COALESCE((e->>'probable_starter')::boolean,false) DESC,COALESCE((e->>'ovr')::integer,50) DESC
    LIMIT 18
  ) x;

  WITH ranked AS (
    SELECT ai.*,
      row_number() OVER (ORDER BY ai.is_starter DESC,ai.ovr DESC,ai.age ASC,ai.name) rn
    FROM public.base_ai_players ai
    WHERE ai.club_id=v_opp.id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',r.id,'name',r.name,'position',r.primary_position,'secondary_position',r.secondary_position,
    'ovr',r.ovr,'number',r.squad_number,'archetype',r.archetype,'squad_role',r.squad_role,'probable_starter',(r.rn<=11)
  ) ORDER BY r.rn),'[]'::jsonb)
  INTO v_away_players
  FROM ranked r WHERE r.rn<=18;

  SELECT * INTO v_session
  FROM private.career_match_sessions
  WHERE player_id=v_player.id AND match_date=v_state.career_date AND status='active'
  LIMIT 1;

  IF v_session.id IS NULL THEN
    INSERT INTO private.career_match_sessions(player_id,match_date,club_id,opponent_club_id,competition,selection_status,seed,metadata)
    VALUES(
      v_player.id,v_state.career_date,v_club.id,v_opp.id,v_competition,
      COALESCE(v_selection->>'status','out'),v_seed,
      jsonb_build_object('home_formation',v_club.formation,'away_formation',v_opp.formation,'career_stage',v_state.career_stage)
    ) RETURNING * INTO v_session;
  END IF;

  RETURN jsonb_build_object(
    'session_id',v_session.id,
    'seed',v_session.seed,
    'matchDate',v_state.career_date,
    'competition',v_competition,
    'selection',v_selection,
    'player',jsonb_build_object(
      'id',v_player.id,'name',v_player.nome,'nickname',v_player.apelido,'avatar',v_player.avatar,
      'position',v_player.posicao,'ovr',public.calculate_player_ovr(v_player.atributos),'attributes',v_player.atributos,
      'shirt_number',(SELECT number FROM public.player_squad_numbers WHERE player_id=v_player.id AND active ORDER BY assigned_at DESC LIMIT 1),
      'skills',COALESCE(v_hub->'skills','[]'::jsonb)
    ),
    'state',v_hub->'state',
    'performance',COALESCE(v_advice->'performance',v_advice->'current_performance_context','{}'::jsonb),
    'coach_focus',v_advice->'coach_focus',
    'club',jsonb_build_object('id',v_club.id,'name',v_club.name,'formation',v_club.formation,'play_style',v_club.play_style,'shield_url',v_club.shield_url),
    'home',jsonb_build_object('id',v_club.id,'name',v_club.name,'formation',v_club.formation,'play_style',v_club.play_style,'crest',v_club.shield_url,'players',v_home_players),
    'away',jsonb_build_object('id',v_opp.id,'name',v_opp.name,'formation',v_opp.formation,'play_style',v_opp.play_style,'crest',v_opp.shield_url,'players',v_away_players)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_career_match_context() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_career_match_context() TO authenticated;

CREATE OR REPLACE FUNCTION public.record_career_match_gameplay(
  p_opponent text,
  p_competition text,
  p_played boolean,
  p_started boolean,
  p_minutes integer,
  p_goals integer,
  p_assists integer,
  p_rating numeric,
  p_team_goals integer,
  p_opponent_goals integer,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_user uuid:=auth.uid();
  v_player uuid;
  v_state record;
  v_session record;
  v_result jsonb;
  v_match_id uuid;
  v_metadata jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT id INTO v_player FROM public.jogadores WHERE user_id=v_user LIMIT 1;
  IF v_player IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=v_player;

  SELECT * INTO v_session
  FROM private.career_match_sessions
  WHERE player_id=v_player AND match_date=v_state.career_date AND status='active'
  FOR UPDATE LIMIT 1;
  IF v_session.id IS NULL THEN RAISE EXCEPTION 'Sessão de partida ativa não encontrada.'; END IF;

  IF COALESCE(length(p_metadata::text),0)>30000 THEN RAISE EXCEPTION 'Dados da partida excedem o limite permitido.'; END IF;
  IF p_started AND v_session.selection_status<>'starter' THEN RAISE EXCEPTION 'Escalação inconsistente com a sessão de partida.'; END IF;
  IF NOT p_played AND (p_minutes<>0 OR p_goals<>0 OR p_assists<>0) THEN RAISE EXCEPTION 'Estatísticas incompatíveis com jogador sem participação.'; END IF;

  v_result:=public.record_career_match_result(
    p_opponent,p_competition,p_played,p_started,p_minutes,p_goals,p_assists,p_rating,p_team_goals,p_opponent_goals
  );
  v_match_id:=(v_result->>'match_id')::uuid;

  v_metadata:=COALESCE(p_metadata,'{}'::jsonb)||jsonb_build_object(
    'engine','career-match-v1','session_id',v_session.id,'seed',v_session.seed,
    'opponent_club_id',v_session.opponent_club_id,'selection_status',v_session.selection_status
  );
  UPDATE public.player_match_history SET metadata=metadata||v_metadata WHERE id=v_match_id AND player_id=v_player;
  UPDATE private.career_match_sessions SET status='completed',completed_at=now(),metadata=metadata||jsonb_build_object('match_id',v_match_id) WHERE id=v_session.id;

  UPDATE public.player_career_state
  SET energy=private.career_clamp(energy-GREATEST(8,LEAST(28,ROUND(COALESCE(p_minutes,0)*0.22)::integer))),
      fatigue=private.career_clamp(fatigue+GREATEST(5,LEAST(24,ROUND(COALESCE(p_minutes,0)*0.18)::integer))),
      pressure=private.career_clamp(pressure+CASE WHEN COALESCE(p_rating,6)>=8 THEN -3 WHEN COALESCE(p_rating,6)<5.5 THEN 3 ELSE 0 END),
      updated_at=now()
  WHERE player_id=v_player AND p_played;

  RETURN v_result||jsonb_build_object('session_id',v_session.id,'metadata_saved',true);
END;
$$;
REVOKE ALL ON FUNCTION public.record_career_match_gameplay(text,text,boolean,boolean,integer,integer,integer,numeric,integer,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_career_match_gameplay(text,text,boolean,boolean,integer,integer,integer,numeric,integer,integer,jsonb) TO authenticated;

COMMIT;

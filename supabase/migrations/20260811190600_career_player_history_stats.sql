BEGIN;

ALTER TABLE public.player_career_state
  ADD COLUMN IF NOT EXISTS career_stage text NOT NULL DEFAULT 'academy'
    CHECK (career_stage IN ('academy','professional')),
  ADD COLUMN IF NOT EXISTS last_national_team_check date;

CREATE TABLE IF NOT EXISTS public.player_match_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,
  club_id uuid REFERENCES public.base_clubs(id) ON DELETE SET NULL,
  context text NOT NULL DEFAULT 'club' CHECK (context IN ('club','national_team')),
  career_stage text NOT NULL CHECK (career_stage IN ('academy','professional','national')),
  national_level text CHECK (national_level IS NULL OR national_level IN ('u15','u17','u20','senior')),
  season_label text NOT NULL,
  competition text NOT NULL,
  opponent text NOT NULL,
  match_date date NOT NULL,
  selection_status text CHECK (selection_status IS NULL OR selection_status IN ('starter','bench','out')),
  appeared boolean NOT NULL DEFAULT true,
  started boolean NOT NULL DEFAULT false,
  minutes integer NOT NULL DEFAULT 0 CHECK (minutes BETWEEN 0 AND 130),
  goals integer NOT NULL DEFAULT 0 CHECK (goals BETWEEN 0 AND 20),
  assists integer NOT NULL DEFAULT 0 CHECK (assists BETWEEN 0 AND 20),
  rating numeric(3,1) CHECK (rating IS NULL OR rating BETWEEN 0 AND 10),
  team_goals integer NOT NULL DEFAULT 0 CHECK (team_goals BETWEEN 0 AND 30),
  opponent_goals integer NOT NULL DEFAULT 0 CHECK (opponent_goals BETWEEN 0 AND 30),
  result text NOT NULL CHECK (result IN ('W','D','L')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(player_id,context,match_date,competition)
);
CREATE INDEX IF NOT EXISTS idx_player_match_history_player_date ON public.player_match_history(player_id,match_date DESC);
CREATE INDEX IF NOT EXISTS idx_player_match_history_player_stage ON public.player_match_history(player_id,career_stage,context);
CREATE INDEX IF NOT EXISTS idx_player_match_history_club ON public.player_match_history(club_id) WHERE club_id IS NOT NULL;
ALTER TABLE public.player_match_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner Match History Select" ON public.player_match_history;
CREATE POLICY "Owner Match History Select" ON public.player_match_history FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.jogadores j WHERE j.id=player_id AND j.user_id=(SELECT auth.uid())));
REVOKE ALL ON public.player_match_history FROM anon,authenticated;
GRANT SELECT ON public.player_match_history TO authenticated;

CREATE TABLE IF NOT EXISTS public.player_honours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,
  club_id uuid REFERENCES public.base_clubs(id) ON DELETE SET NULL,
  honour_type text NOT NULL CHECK (honour_type IN ('team_title','individual_award')),
  career_stage text NOT NULL CHECK (career_stage IN ('academy','professional','national')),
  national_level text CHECK (national_level IS NULL OR national_level IN ('u15','u17','u20','senior')),
  title text NOT NULL,
  competition text,
  season_label text,
  awarded_on date NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_player_honours_player_date ON public.player_honours(player_id,awarded_on DESC);
CREATE INDEX IF NOT EXISTS idx_player_honours_club ON public.player_honours(club_id) WHERE club_id IS NOT NULL;
ALTER TABLE public.player_honours ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner Honours Select" ON public.player_honours;
CREATE POLICY "Owner Honours Select" ON public.player_honours FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.jogadores j WHERE j.id=player_id AND j.user_id=(SELECT auth.uid())));
REVOKE ALL ON public.player_honours FROM anon,authenticated;
GRANT SELECT ON public.player_honours TO authenticated;

CREATE TABLE IF NOT EXISTS public.player_national_callups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('u15','u17','u20','senior')),
  callup_date date NOT NULL,
  release_date date,
  competition text,
  reason text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','declined','withdrawn')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_player_national_callups_player_date ON public.player_national_callups(player_id,callup_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_player_national_callup_active_level
  ON public.player_national_callups(player_id,level) WHERE status='active';
ALTER TABLE public.player_national_callups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner National Callups Select" ON public.player_national_callups;
CREATE POLICY "Owner National Callups Select" ON public.player_national_callups FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.jogadores j WHERE j.id=player_id AND j.user_id=(SELECT auth.uid())));
REVOKE ALL ON public.player_national_callups FROM anon,authenticated;
GRANT SELECT ON public.player_national_callups TO authenticated;

CREATE OR REPLACE FUNCTION private.career_match_stats(
  p_player_id uuid,
  p_stage text DEFAULT NULL,
  p_context text DEFAULT NULL,
  p_level text DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path=''
AS $$
  SELECT jsonb_build_object(
    'games', count(*) FILTER (WHERE appeared),
    'starts', count(*) FILTER (WHERE appeared AND started),
    'goals', coalesce(sum(goals) FILTER (WHERE appeared),0),
    'assists', coalesce(sum(assists) FILTER (WHERE appeared),0),
    'wins', count(*) FILTER (WHERE appeared AND result='W'),
    'draws', count(*) FILTER (WHERE appeared AND result='D'),
    'losses', count(*) FILTER (WHERE appeared AND result='L'),
    'minutes', coalesce(sum(minutes) FILTER (WHERE appeared),0),
    'avg_rating', round(avg(rating) FILTER (WHERE appeared AND rating IS NOT NULL),1)
  )
  FROM public.player_match_history
  WHERE player_id=p_player_id
    AND (p_stage IS NULL OR career_stage=p_stage)
    AND (p_context IS NULL OR context=p_context)
    AND (p_level IS NULL OR national_level=p_level);
$$;

CREATE OR REPLACE FUNCTION private.current_season_label(p_date date)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT extract(year from p_date)::int::text;
$$;

CREATE OR REPLACE FUNCTION private.player_history_payload(p_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_stage text;
  v_honours jsonb;
  v_callups jsonb;
  v_seasons jsonb;
BEGIN
  SELECT career_stage INTO v_stage FROM public.player_career_state WHERE player_id=p_player_id;
  v_stage:=coalesce(v_stage,'academy');

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',h.id,'honour_type',h.honour_type,'career_stage',h.career_stage,
    'level',h.national_level,'title',h.title,'competition',h.competition,
    'season_label',h.season_label,'awarded_on',h.awarded_on,'club_name',c.name
  ) ORDER BY h.awarded_on DESC),'[]'::jsonb)
  INTO v_honours
  FROM public.player_honours h
  LEFT JOIN public.base_clubs c ON c.id=h.club_id
  WHERE h.player_id=p_player_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',n.id,'level',n.level,'callup_date',n.callup_date,'release_date',n.release_date,
    'competition',n.competition,'reason',n.reason,'status',n.status
  ) ORDER BY n.callup_date DESC),'[]'::jsonb)
  INTO v_callups
  FROM public.player_national_callups n
  WHERE n.player_id=p_player_id;

  SELECT coalesce(jsonb_agg(x.row_data ORDER BY x.sort_date DESC),'[]'::jsonb)
  INTO v_seasons
  FROM (
    SELECT max(m.match_date) sort_date,
           jsonb_build_object(
             'season_label',m.season_label,'career_stage',m.career_stage,
             'context',m.context,'level',m.national_level,'club_name',max(c.name),
             'games',count(*) FILTER (WHERE m.appeared),
             'goals',coalesce(sum(m.goals) FILTER (WHERE m.appeared),0),
             'assists',coalesce(sum(m.assists) FILTER (WHERE m.appeared),0)
           ) row_data
    FROM public.player_match_history m
    LEFT JOIN public.base_clubs c ON c.id=m.club_id
    WHERE m.player_id=p_player_id
    GROUP BY m.season_label,m.career_stage,m.context,m.national_level
  ) x;

  RETURN jsonb_build_object(
    'current_stage',v_stage,
    'stages',jsonb_build_object(
      'academy',private.career_match_stats(p_player_id,'academy','club',NULL),
      'professional',private.career_match_stats(p_player_id,'professional','club',NULL)
    ),
    'national',jsonb_build_object(
      'u15',private.career_match_stats(p_player_id,'national','national_team','u15'),
      'u17',private.career_match_stats(p_player_id,'national','national_team','u17'),
      'u20',private.career_match_stats(p_player_id,'national','national_team','u20'),
      'senior',private.career_match_stats(p_player_id,'national','national_team','senior')
    ),
    'national_total',private.career_match_stats(p_player_id,'national','national_team',NULL),
    'honours',v_honours,
    'callups',v_callups,
    'seasons',v_seasons
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_player_career_history()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_player uuid;
BEGIN
  SELECT id INTO v_player FROM public.jogadores WHERE user_id=(SELECT auth.uid()) LIMIT 1;
  IF v_player IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;
  RETURN private.player_history_payload(v_player);
END;
$$;
REVOKE ALL ON FUNCTION public.get_player_career_history() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.get_player_career_history() TO authenticated;

-- Recebe o resultado vindo do futuro motor da partida. O registro já separa base/profissional.
CREATE OR REPLACE FUNCTION public.record_career_match_result(
  p_opponent text,
  p_competition text,
  p_played boolean,
  p_started boolean,
  p_minutes integer,
  p_goals integer,
  p_assists integer,
  p_rating numeric,
  p_team_goals integer,
  p_opponent_goals integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_player uuid; v_club uuid; v_date date; v_stage text; v_selection text;
  v_result text; v_match_id uuid; v_fame_gain int; v_fan_gain int;
BEGIN
  SELECT j.id INTO v_player FROM public.jogadores j WHERE j.user_id=(SELECT auth.uid()) LIMIT 1;
  IF v_player IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;
  SELECT pcs.career_date,pcs.career_stage,pc.club_id
    INTO v_date,v_stage,v_club
  FROM public.player_career_state pcs
  JOIN public.player_contracts pc ON pc.player_id=pcs.player_id AND pc.status='active'
  WHERE pcs.player_id=v_player ORDER BY pc.signed_at DESC LIMIT 1;
  IF v_date IS NULL OR v_club IS NULL THEN RAISE EXCEPTION 'Carreira ativa não encontrada.'; END IF;

  SELECT selection_status INTO v_selection FROM public.player_match_selections
  WHERE player_id=v_player AND match_date=v_date LIMIT 1;
  IF v_selection='out' THEN RAISE EXCEPTION 'Você não foi relacionado para esta partida.'; END IF;
  IF p_started AND v_selection IS DISTINCT FROM 'starter' THEN RAISE EXCEPTION 'Escalação inconsistente com a decisão do treinador.'; END IF;
  IF NOT p_played AND (p_minutes<>0 OR p_goals<>0 OR p_assists<>0) THEN RAISE EXCEPTION 'Jogador sem entrada em campo não pode registrar estatísticas.'; END IF;
  IF p_minutes<0 OR p_minutes>130 OR p_goals<0 OR p_goals>20 OR p_assists<0 OR p_assists>20 THEN RAISE EXCEPTION 'Estatísticas inválidas.'; END IF;
  IF p_rating IS NOT NULL AND (p_rating<0 OR p_rating>10) THEN RAISE EXCEPTION 'Nota inválida.'; END IF;
  IF p_team_goals<0 OR p_opponent_goals<0 THEN RAISE EXCEPTION 'Placar inválido.'; END IF;

  v_result:=CASE WHEN p_team_goals>p_opponent_goals THEN 'W' WHEN p_team_goals=p_opponent_goals THEN 'D' ELSE 'L' END;

  INSERT INTO public.player_match_history(
    player_id,club_id,context,career_stage,national_level,season_label,competition,opponent,
    match_date,selection_status,appeared,started,minutes,goals,assists,rating,team_goals,opponent_goals,result
  ) VALUES(
    v_player,v_club,'club',coalesce(v_stage,'academy'),NULL,private.current_season_label(v_date),
    left(coalesce(nullif(trim(p_competition),''),'Competição'),100),left(coalesce(nullif(trim(p_opponent),''),'Adversário'),100),
    v_date,v_selection,coalesce(p_played,false),coalesce(p_started,false),p_minutes,p_goals,p_assists,p_rating,p_team_goals,p_opponent_goals,v_result
  ) RETURNING id INTO v_match_id;

  IF p_played THEN
    v_fame_gain:=greatest(0,coalesce(p_goals,0)+coalesce(p_assists,0)+CASE WHEN coalesce(p_rating,0)>=8 THEN 2 WHEN coalesce(p_rating,0)>=7 THEN 1 ELSE 0 END);
    v_fan_gain:=greatest(0,8 + v_fame_gain*12 + CASE WHEN v_result='W' THEN 8 ELSE 0 END);
    UPDATE public.player_career_state
    SET debut_completed=true,
        form=greatest(0,least(100,form + CASE WHEN coalesce(p_rating,6)>=8 THEN 4 WHEN coalesce(p_rating,6)>=7 THEN 2 WHEN coalesce(p_rating,6)<5.5 THEN -3 ELSE 0 END)),
        fame=greatest(0,least(100,fame+v_fame_gain)),
        fanbase=greatest(0,fanbase+v_fan_gain)
    WHERE player_id=v_player;
  END IF;

  RETURN jsonb_build_object('match_id',v_match_id,'result',v_result,'history',private.player_history_payload(v_player));
END;
$$;
REVOKE ALL ON FUNCTION public.record_career_match_result(text,text,boolean,boolean,integer,integer,integer,numeric,integer,integer) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.record_career_match_result(text,text,boolean,boolean,integer,integer,integer,numeric,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_national_team_match_result(
  p_level text,
  p_opponent text,
  p_competition text,
  p_played boolean,
  p_started boolean,
  p_minutes integer,
  p_goals integer,
  p_assists integer,
  p_rating numeric,
  p_team_goals integer,
  p_opponent_goals integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_player uuid; v_date date; v_result text; v_match_id uuid;
BEGIN
  IF p_level NOT IN ('u15','u17','u20','senior') THEN RAISE EXCEPTION 'Categoria de seleção inválida.'; END IF;
  SELECT j.id INTO v_player FROM public.jogadores j WHERE j.user_id=(SELECT auth.uid()) LIMIT 1;
  SELECT career_date INTO v_date FROM public.player_career_state WHERE player_id=v_player;
  IF NOT EXISTS(SELECT 1 FROM public.player_national_callups WHERE player_id=v_player AND level=p_level AND status='active') THEN
    RAISE EXCEPTION 'Não há convocação ativa para esta categoria.';
  END IF;
  IF NOT p_played AND (p_minutes<>0 OR p_goals<>0 OR p_assists<>0) THEN RAISE EXCEPTION 'Estatísticas inválidas.'; END IF;
  IF p_minutes<0 OR p_minutes>130 OR p_goals<0 OR p_assists<0 OR p_rating<0 OR p_rating>10 THEN RAISE EXCEPTION 'Estatísticas inválidas.'; END IF;
  v_result:=CASE WHEN p_team_goals>p_opponent_goals THEN 'W' WHEN p_team_goals=p_opponent_goals THEN 'D' ELSE 'L' END;
  INSERT INTO public.player_match_history(player_id,context,career_stage,national_level,season_label,competition,opponent,match_date,appeared,started,minutes,goals,assists,rating,team_goals,opponent_goals,result)
  VALUES(v_player,'national_team','national',p_level,private.current_season_label(v_date),left(p_competition,100),left(p_opponent,100),v_date,p_played,p_started,p_minutes,p_goals,p_assists,p_rating,p_team_goals,p_opponent_goals,v_result)
  RETURNING id INTO v_match_id;
  RETURN jsonb_build_object('match_id',v_match_id,'result',v_result,'history',private.player_history_payload(v_player));
END;
$$;
REVOKE ALL ON FUNCTION public.record_national_team_match_result(text,text,text,boolean,boolean,integer,integer,integer,numeric,integer,integer) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.record_national_team_match_result(text,text,text,boolean,boolean,integer,integer,integer,numeric,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION private.add_player_honour(
  p_player_id uuid,p_type text,p_stage text,p_title text,p_competition text,p_season text,p_date date,p_club uuid DEFAULT NULL,p_level text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.player_honours(player_id,club_id,honour_type,career_stage,national_level,title,competition,season_label,awarded_on)
  VALUES(p_player_id,p_club,p_type,p_stage,p_level,p_title,p_competition,p_season,p_date) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.promote_player_to_professional(p_player_id uuid,p_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_club uuid;
BEGIN
  UPDATE public.player_career_state SET career_stage='professional' WHERE player_id=p_player_id AND career_stage<>'professional';
  SELECT club_id INTO v_club FROM public.player_contracts WHERE player_id=p_player_id AND status='active' ORDER BY signed_at DESC LIMIT 1;
  IF FOUND AND NOT EXISTS(SELECT 1 FROM public.player_messages WHERE player_id=p_player_id AND metadata->>'kind'='professional_promotion') THEN
    INSERT INTO public.player_messages(player_id,club_id,message_type,subject,body,metadata)
    VALUES(p_player_id,v_club,'career','Você subiu para o profissional','Seu ciclo na base foi preservado no histórico. A partir de agora, jogos, gols, assistências, resultados, títulos e prêmios passam a contar separadamente na carreira profissional.',jsonb_build_object('kind','professional_promotion','date',p_date));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.maybe_youth_national_callup(p_player_id uuid,p_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_age int; v_level text; v_last date; v_ovr numeric; v_fame int; v_form int;
  v_games int; v_contrib int; v_avg numeric; v_chance numeric; v_roll numeric;
  v_nationality text; v_label text;
BEGIN
  SELECT j.idade,j.nacionalidade,pcs.last_national_team_check,pcs.fame,pcs.form,
         (SELECT avg((value)::numeric) FROM jsonb_each_text(coalesce(j.atributos,'{}'::jsonb)))
  INTO v_age,v_nationality,v_last,v_fame,v_form,v_ovr
  FROM public.jogadores j JOIN public.player_career_state pcs ON pcs.player_id=j.id
  WHERE j.id=p_player_id;
  IF v_age IS NULL THEN RETURN; END IF;
  IF v_last IS NOT NULL AND p_date < v_last + 7 THEN RETURN; END IF;
  UPDATE public.player_career_state SET last_national_team_check=p_date WHERE player_id=p_player_id;

  v_level:=CASE WHEN v_age<=15 THEN 'u15' WHEN v_age<=17 THEN 'u17' WHEN v_age<=20 THEN 'u20' ELSE 'senior' END;
  IF EXISTS(SELECT 1 FROM public.player_national_callups WHERE player_id=p_player_id AND level=v_level AND status='active') THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM public.player_national_callups WHERE player_id=p_player_id AND callup_date>=p_date-30) THEN RETURN; END IF;

  SELECT count(*) FILTER(WHERE appeared),coalesce(sum(goals+assists) FILTER(WHERE appeared),0),coalesce(avg(rating) FILTER(WHERE appeared AND rating IS NOT NULL),6)
  INTO v_games,v_contrib,v_avg
  FROM public.player_match_history
  WHERE player_id=p_player_id AND context='club' AND match_date>=p_date-90;

  v_chance:=least(0.55,
    0.005 + greatest(0,coalesce(v_ovr,50)-48)*0.008 + coalesce(v_fame,0)*0.0015 +
    greatest(0,coalesce(v_form,50)-50)*0.002 + coalesce(v_games,0)*0.006 + coalesce(v_contrib,0)*0.012 +
    greatest(0,coalesce(v_avg,6)-6)*0.04
  );
  v_roll:=random();
  IF v_roll>v_chance THEN RETURN; END IF;

  v_label:=CASE v_level WHEN 'u15' THEN 'Sub-15' WHEN 'u17' THEN 'Sub-17' WHEN 'u20' THEN 'Sub-20' ELSE 'Principal' END;
  INSERT INTO public.player_national_callups(player_id,level,callup_date,competition,reason,status)
  VALUES(p_player_id,v_level,p_date,'Período de seleção','Seu desempenho recente chamou a atenção da comissão nacional.','active');
  INSERT INTO public.player_messages(player_id,message_type,subject,body,metadata)
  VALUES(p_player_id,'career','Convocação para a Seleção '||v_label,
    'Você foi convocado para a '||coalesce(nullif(trim(v_nationality),''),'seleção nacional')||' '||v_label||'. Seus jogos, gols, assistências, títulos e prêmios pela seleção serão registrados separadamente no perfil.',
    jsonb_build_object('kind','national_callup','level',v_level,'date',p_date));
END;
$$;

CREATE OR REPLACE FUNCTION private.career_history_daily_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.career_date IS DISTINCT FROM OLD.career_date THEN
    PERFORM private.maybe_youth_national_callup(NEW.player_id,NEW.career_date);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_career_history_daily ON public.player_career_state;
CREATE TRIGGER trg_career_history_daily AFTER UPDATE OF career_date ON public.player_career_state
FOR EACH ROW WHEN (NEW.career_date IS DISTINCT FROM OLD.career_date)
EXECUTE FUNCTION private.career_history_daily_trigger();

-- Quem já está em clube de base começa explicitamente na base.
UPDATE public.player_career_state pcs
SET career_stage=CASE WHEN c.name ILIKE '%Sub-%' THEN 'academy' ELSE career_stage END
FROM public.player_contracts pc JOIN public.base_clubs c ON c.id=pc.club_id
WHERE pc.player_id=pcs.player_id AND pc.status='active';

COMMIT;

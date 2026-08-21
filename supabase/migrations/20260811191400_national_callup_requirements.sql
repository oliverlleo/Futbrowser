BEGIN;

CREATE OR REPLACE FUNCTION private.maybe_youth_national_callup(p_player_id uuid,p_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_age int; v_level text; v_last date; v_ovr numeric; v_fame int; v_form int;
  v_games int; v_contrib int; v_avg numeric; v_chance numeric;
  v_nationality text; v_label text;
BEGIN
  SELECT j.idade,j.nacionalidade,pcs.last_national_team_check,pcs.fame,pcs.form,
         (SELECT avg((value)::numeric) FROM jsonb_each_text(coalesce(j.atributos,'{}'::jsonb)))
  INTO v_age,v_nationality,v_last,v_fame,v_form,v_ovr
  FROM public.jogadores j
  JOIN public.player_career_state pcs ON pcs.player_id=j.id
  WHERE j.id=p_player_id;

  IF v_age IS NULL OR nullif(trim(v_nationality),'') IS NULL THEN RETURN; END IF;
  IF v_last IS NOT NULL AND p_date<v_last+7 THEN RETURN; END IF;
  UPDATE public.player_career_state SET last_national_team_check=p_date WHERE player_id=p_player_id;

  v_level:=CASE WHEN v_age<=15 THEN 'u15' WHEN v_age<=17 THEN 'u17' WHEN v_age<=20 THEN 'u20' ELSE 'senior' END;
  IF EXISTS(SELECT 1 FROM public.player_national_callups WHERE player_id=p_player_id AND level=v_level AND status='active') THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM public.player_national_callups WHERE player_id=p_player_id AND callup_date>=p_date-30) THEN RETURN; END IF;

  SELECT count(*) FILTER(WHERE appeared),
         coalesce(sum(goals+assists) FILTER(WHERE appeared),0),
         coalesce(avg(rating) FILTER(WHERE appeared AND rating IS NOT NULL),6)
  INTO v_games,v_contrib,v_avg
  FROM public.player_match_history
  WHERE player_id=p_player_id AND context='club' AND match_date>=p_date-90;

  -- A convocação deve nascer do que aconteceu em campo, não só do OVR inicial.
  IF coalesce(v_games,0)<3 THEN RETURN; END IF;

  v_chance:=least(0.55,
      0.01
      + greatest(0,coalesce(v_ovr,50)-50)*0.006
      + coalesce(v_fame,0)*0.0015
      + greatest(0,coalesce(v_form,50)-50)*0.002
      + least(0.10,coalesce(v_games,0)*0.008)
      + least(0.16,coalesce(v_contrib,0)*0.018)
      + greatest(0,coalesce(v_avg,6)-6)*0.05
  );
  IF random()>v_chance THEN RETURN; END IF;

  v_label:=CASE v_level WHEN 'u15' THEN 'Sub-15' WHEN 'u17' THEN 'Sub-17' WHEN 'u20' THEN 'Sub-20' ELSE 'Principal' END;
  INSERT INTO public.player_national_callups(player_id,level,callup_date,competition,reason,status)
  VALUES(p_player_id,v_level,p_date,'Período de seleção','Seu desempenho recente chamou a atenção da comissão nacional.','active');

  INSERT INTO public.player_messages(player_id,message_type,subject,body,metadata)
  VALUES(
    p_player_id,'career','Convocação para a Seleção '||v_label,
    'Você foi convocado para representar '||trim(v_nationality)||' na Seleção '||v_label||'. Seus jogos, gols, assistências, títulos e prêmios pela seleção serão registrados separadamente no perfil.',
    jsonb_build_object('kind','national_callup','level',v_level,'nationality',trim(v_nationality),'date',p_date)
  );
END;
$$;

COMMIT;

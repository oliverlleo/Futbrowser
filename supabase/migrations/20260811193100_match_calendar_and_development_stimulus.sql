BEGIN;

CREATE OR REPLACE FUNCTION private.match_maintenance_skills(p_position text,p_minutes integer)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path=''
AS $$
DECLARE
  v_pos text:=upper(trim(COALESCE(p_position,'')));
  v_base text[]:=ARRAY['positioning','tactical_awareness','short_pass'];
BEGIN
  IF COALESCE(p_minutes,0)<=0 THEN RETURN ARRAY[]::text[]; END IF;

  IF v_pos IN ('GOL','GK','GOLEIRO') THEN
    RETURN v_base;
  ELSIF v_pos IN ('ZAG','CB','ZAGUEIRO') THEN
    RETURN v_base||ARRAY['marking','heading','strength','stamina'];
  ELSIF v_pos IN ('LD','LE','RB','LB','LATERAL DIREITO','LATERAL ESQUERDO') THEN
    RETURN v_base||ARRAY['marking','stamina','sprint','crossing','dribbling'];
  ELSIF v_pos IN ('VOL','CDM','VOLANTE') THEN
    RETURN v_base||ARRAY['marking','stamina','strength','long_pass'];
  ELSIF v_pos IN ('MC','CM','MEIO-CAMPISTA','MEIO CAMPISTA') THEN
    RETURN v_base||ARRAY['stamina','long_pass','dribbling'];
  ELSIF v_pos IN ('MEI','CAM','MEIA') THEN
    RETURN v_base||ARRAY['long_pass','dribbling','finishing_touch','stamina'];
  ELSIF v_pos IN ('MD','ME','PD','PE','RW','LW','PONTA DIREITA','PONTA ESQUERDA','PONTA') THEN
    RETURN v_base||ARRAY['sprint','stamina','dribbling','crossing','finishing_touch'];
  ELSIF v_pos IN ('ATA','ST','CA','CF','ATACANTE','CENTROAVANTE') THEN
    RETURN v_base||ARRAY['finishing_touch','heading','strength','sprint','stamina','dribbling'];
  END IF;

  RETURN v_base||ARRAY['stamina'];
END;
$$;

CREATE OR REPLACE FUNCTION private.apply_match_development_maintenance(
  p_player_id uuid,
  p_match_date date,
  p_minutes integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_position text;
  v_skills text[];
  v_skill text;
BEGIN
  IF COALESCE(p_minutes,0)<=0 THEN RETURN; END IF;
  SELECT posicao INTO v_position FROM public.jogadores WHERE id=p_player_id;
  v_skills:=private.match_maintenance_skills(v_position,p_minutes);

  UPDATE public.player_skill_development
  SET last_stimulated_on=CASE
        WHEN last_stimulated_on IS NULL THEN p_match_date
        ELSE GREATEST(last_stimulated_on,p_match_date)
      END,
      updated_at=now()
  WHERE player_id=p_player_id
    AND skill_key=ANY(v_skills);

  FOREACH v_skill IN ARRAY v_skills LOOP
    IF EXISTS(
      SELECT 1 FROM public.player_skill_development
      WHERE player_id=p_player_id AND skill_key=v_skill
    ) THEN
      INSERT INTO public.player_development_events(
        player_id,career_date,event_type,skill_key,amount,metadata
      ) VALUES(
        p_player_id,p_match_date,'maintenance',v_skill,0,
        jsonb_build_object(
          'source','match',
          'minutes',p_minutes,
          'position',v_position,
          'reason','Participação em partida contou como estímulo de manutenção.'
        )
      );
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION private.after_scheduled_career_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_state record;
  v_is_scheduled boolean:=false;
BEGIN
  IF NEW.context<>'club' THEN RETURN NEW; END IF;

  SELECT career_date,next_match_date
  INTO v_state
  FROM public.player_career_state
  WHERE player_id=NEW.player_id
  FOR UPDATE;

  v_is_scheduled:=v_state.next_match_date IS NOT NULL AND NEW.match_date=v_state.next_match_date;

  IF NEW.appeared AND NEW.minutes>0 THEN
    PERFORM private.apply_match_development_maintenance(NEW.player_id,NEW.match_date,NEW.minutes);
  END IF;

  IF v_is_scheduled THEN
    UPDATE public.player_career_state
    SET career_date=NEW.match_date+1,
        day_period=0,
        next_match_date=NEW.match_date+7,
        weekly_objective='{}'::jsonb,
        last_development_maintenance_date=CASE
          WHEN NEW.appeared THEN NEW.match_date
          ELSE last_development_maintenance_date
        END,
        updated_at=now()
    WHERE player_id=NEW.player_id;

    UPDATE public.player_sponsor_opportunities
    SET status='expired'
    WHERE player_id=NEW.player_id
      AND status='available'
      AND expires_on<NEW.match_date+1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_scheduled_career_match ON public.player_match_history;
CREATE TRIGGER trg_after_scheduled_career_match
AFTER INSERT ON public.player_match_history
FOR EACH ROW
EXECUTE FUNCTION private.after_scheduled_career_match();

COMMIT;

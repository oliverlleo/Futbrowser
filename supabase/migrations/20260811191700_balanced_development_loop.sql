BEGIN;

ALTER TABLE public.player_skill_development
  ADD COLUMN IF NOT EXISTS baseline_level integer,
  ADD COLUMN IF NOT EXISTS baseline_stage text,
  ADD COLUMN IF NOT EXISTS last_stimulated_on date,
  ADD COLUMN IF NOT EXISTS last_decay_on date;

ALTER TABLE public.player_attribute_development
  ADD COLUMN IF NOT EXISTS baseline_value integer,
  ADD COLUMN IF NOT EXISTS baseline_stage text;

ALTER TABLE public.player_career_state
  ADD COLUMN IF NOT EXISTS last_development_maintenance_date date;

UPDATE public.player_skill_development sd
SET baseline_level = COALESCE(sd.baseline_level, sd.level),
    baseline_stage = COALESCE(sd.baseline_stage, pcs.career_stage, 'academy'),
    last_stimulated_on = COALESCE(sd.last_stimulated_on, pcs.career_date, CURRENT_DATE),
    last_decay_on = COALESCE(sd.last_decay_on, pcs.career_date, CURRENT_DATE)
FROM public.player_career_state pcs
WHERE pcs.player_id = sd.player_id;

UPDATE public.player_attribute_development ad
SET baseline_value = COALESCE(ad.baseline_value, (j.atributos->>ad.attribute_key)::integer),
    baseline_stage = COALESCE(ad.baseline_stage, pcs.career_stage, 'academy')
FROM public.jogadores j
JOIN public.player_career_state pcs ON pcs.player_id = j.id
WHERE j.id = ad.player_id;

UPDATE public.player_career_state
SET last_development_maintenance_date = COALESCE(last_development_maintenance_date, career_date, CURRENT_DATE);

CREATE TABLE IF NOT EXISTS public.player_development_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,
  career_date date NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('gain','decay','level_up','level_down','maintenance')),
  skill_key text,
  attribute_key text,
  amount numeric(8,2) NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_player_development_events_player_date
  ON public.player_development_events(player_id, career_date DESC, created_at DESC);
ALTER TABLE public.player_development_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner Development Events Select" ON public.player_development_events;
CREATE POLICY "Owner Development Events Select" ON public.player_development_events
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.jogadores j WHERE j.id=player_id AND j.user_id=(SELECT auth.uid())));
REVOKE ALL ON public.player_development_events FROM anon, authenticated;
GRANT SELECT ON public.player_development_events TO authenticated;

CREATE OR REPLACE FUNCTION private.skill_load_group(p_skill_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path=''
AS $$
  SELECT CASE
    WHEN p_skill_key IN ('sprint','stamina','strength','heading') THEN 'physical'
    WHEN p_skill_key IN ('positioning','tactical_awareness','marking') THEN 'tactical'
    ELSE 'technical'
  END
$$;

CREATE OR REPLACE FUNCTION private.skill_decay_policy(p_skill_key text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path=''
AS $$
  SELECT CASE private.skill_load_group(p_skill_key)
    WHEN 'physical' THEN jsonb_build_object('grace_days',7,'level_loss_days',28,'daily_loss',3.2)
    WHEN 'tactical' THEN jsonb_build_object('grace_days',14,'level_loss_days',45,'daily_loss',1.6)
    ELSE jsonb_build_object('grace_days',10,'level_loss_days',35,'daily_loss',2.2)
  END
$$;

CREATE OR REPLACE FUNCTION private.skill_attribute_weights(p_player_id uuid, p_skill_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_pos text;
BEGIN
  SELECT posicao INTO v_pos FROM public.jogadores WHERE id=p_player_id;
  RETURN CASE p_skill_key
    WHEN 'dribbling' THEN '{"Velocidade":0.16,"Passe":0.12}'::jsonb
    WHEN 'free_kicks' THEN '{"Passe":0.18,"Finalização":0.10}'::jsonb
    WHEN 'penalties' THEN '{"Finalização":0.28}'::jsonb
    WHEN 'short_pass' THEN '{"Passe":0.22,"Visão de jogo":0.06}'::jsonb
    WHEN 'long_pass' THEN '{"Passe":0.18,"Visão de jogo":0.10}'::jsonb
    WHEN 'crossing' THEN '{"Passe":0.22,"Visão de jogo":0.06}'::jsonb
    WHEN 'sprint' THEN '{"Velocidade":0.22,"Físico":0.06}'::jsonb
    WHEN 'stamina' THEN '{"Físico":0.24,"Velocidade":0.04}'::jsonb
    WHEN 'strength' THEN '{"Físico":0.28}'::jsonb
    WHEN 'heading' THEN '{"Físico":0.16,"Finalização":0.12}'::jsonb
    WHEN 'finishing_touch' THEN '{"Finalização":0.28}'::jsonb
    WHEN 'marking' THEN '{"Marcação":0.22,"Visão de jogo":0.06}'::jsonb
    WHEN 'tactical_awareness' THEN '{"Visão de jogo":0.18,"Marcação":0.10}'::jsonb
    WHEN 'positioning' THEN CASE
      WHEN v_pos IN ('Goleiro','Zagueiro','Lateral Direito','Lateral Esquerdo','Volante')
        THEN '{"Visão de jogo":0.16,"Marcação":0.12}'::jsonb
      ELSE '{"Visão de jogo":0.18,"Finalização":0.10}'::jsonb
    END
    ELSE '{}'::jsonb
  END;
END;
$$;

CREATE OR REPLACE FUNCTION private.sync_development_baselines(p_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_stage text;
  v_date date;
BEGIN
  SELECT COALESCE(career_stage,'academy'), COALESCE(career_date,CURRENT_DATE)
  INTO v_stage,v_date
  FROM public.player_career_state
  WHERE player_id=p_player_id;

  UPDATE public.player_skill_development
  SET baseline_level=level,
      baseline_stage=v_stage,
      last_stimulated_on=COALESCE(last_stimulated_on,v_date),
      last_decay_on=COALESCE(last_decay_on,v_date)
  WHERE player_id=p_player_id
    AND (baseline_level IS NULL OR baseline_stage IS DISTINCT FROM v_stage);

  PERFORM private.ensure_attribute_development(p_player_id);

  UPDATE public.player_attribute_development ad
  SET baseline_value=(j.atributos->>ad.attribute_key)::integer,
      baseline_stage=v_stage
  FROM public.jogadores j
  WHERE j.id=p_player_id
    AND ad.player_id=p_player_id
    AND (ad.baseline_value IS NULL OR ad.baseline_stage IS DISTINCT FROM v_stage);
END;
$$;

CREATE OR REPLACE FUNCTION private.training_absorption_multiplier(p_player_id uuid,p_skill_key text)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_state record;
  v_group text:=private.skill_load_group(p_skill_key);
  v_energy_factor numeric:=1;
  v_fatigue_factor numeric:=1;
  v_mental_factor numeric:=1;
  v_recovery_bonus numeric:=0;
  v_load_factor numeric:=1;
  v_group_load integer:=0;
BEGIN
  SELECT energy,fatigue,morale,pressure,career_date
  INTO v_state
  FROM public.player_career_state
  WHERE player_id=p_player_id;

  IF v_state.energy>=80 THEN v_energy_factor:=1.06;
  ELSIF v_state.energy>=65 THEN v_energy_factor:=1.00;
  ELSIF v_state.energy>=50 THEN v_energy_factor:=0.88;
  ELSIF v_state.energy>=35 THEN v_energy_factor:=0.72;
  ELSE v_energy_factor:=0.55;
  END IF;

  IF v_state.fatigue>=75 THEN v_fatigue_factor:=0.58;
  ELSIF v_state.fatigue>=60 THEN v_fatigue_factor:=0.72;
  ELSIF v_state.fatigue>=45 THEN v_fatigue_factor:=0.86;
  ELSE v_fatigue_factor:=1.00;
  END IF;

  IF v_state.morale>=70 THEN v_mental_factor:=v_mental_factor+0.03;
  ELSIF v_state.morale<35 THEN v_mental_factor:=v_mental_factor-0.08;
  END IF;
  IF v_state.pressure>=75 THEN v_mental_factor:=v_mental_factor-0.12;
  ELSIF v_state.pressure>=60 THEN v_mental_factor:=v_mental_factor-0.06;
  END IF;

  SELECT COALESCE(SUM(bonus),0) INTO v_recovery_bonus
  FROM (
    SELECT DISTINCT ON (activity_key) activity_key,
      CASE activity_key
        WHEN 'nutrition_session' THEN 0.08
        WHEN 'early_sleep' THEN 0.06
        WHEN 'rest_home' THEN 0.04
        WHEN 'sports_psychologist' THEN 0.04
        WHEN 'physio' THEN 0.03
        WHEN 'sauna' THEN 0.02
        ELSE 0 END::numeric AS bonus
    FROM public.player_career_actions
    WHERE player_id=p_player_id
      AND career_date>=COALESCE(v_state.career_date,CURRENT_DATE)-1
      AND activity_key IN ('nutrition_session','early_sleep','rest_home','sports_psychologist','physio','sauna')
    ORDER BY activity_key,career_date DESC,day_period DESC
  ) x;
  v_recovery_bonus:=LEAST(0.16,v_recovery_bonus);

  SELECT COUNT(*) INTO v_group_load
  FROM public.player_career_actions a
  WHERE a.player_id=p_player_id
    AND a.career_date>=COALESCE(v_state.career_date,CURRENT_DATE)-2
    AND a.category IN ('training','team_training')
    AND EXISTS (
      SELECT 1
      FROM jsonb_object_keys(COALESCE(a.hidden_effects->'skills','{}'::jsonb)) AS k(skill_key)
      WHERE private.skill_load_group(k.skill_key)=v_group
    );

  v_load_factor:=CASE
    WHEN v_group_load<=0 THEN 1.00
    WHEN v_group_load=1 THEN 0.97
    WHEN v_group_load=2 THEN 0.92
    WHEN v_group_load=3 THEN 0.85
    ELSE 0.78 END;

  RETURN ROUND(GREATEST(0.50,LEAST(1.15,
    v_energy_factor*v_fatigue_factor*v_mental_factor*(1+v_recovery_bonus)*v_load_factor
  )),4);
END;
$$;

CREATE OR REPLACE FUNCTION private.add_attribute_progress(p_player_id uuid,p_attribute text,p_points numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_progress numeric;
  v_total numeric;
  v_gain integer;
  v_current integer;
  v_stage text;
BEGIN
  IF p_points<=0 OR p_attribute NOT IN ('Físico','Marcação','Finalização','Velocidade','Passe','Visão de jogo') THEN RETURN; END IF;
  SELECT COALESCE((atributos->>p_attribute)::integer,1) INTO v_current FROM public.jogadores WHERE id=p_player_id;
  SELECT COALESCE(career_stage,'academy') INTO v_stage FROM public.player_career_state WHERE player_id=p_player_id;

  INSERT INTO public.player_attribute_development(player_id,attribute_key,progress,baseline_value,baseline_stage)
  VALUES(p_player_id,p_attribute,0,v_current,v_stage)
  ON CONFLICT(player_id,attribute_key) DO NOTHING;

  SELECT progress INTO v_progress
  FROM public.player_attribute_development
  WHERE player_id=p_player_id AND attribute_key=p_attribute
  FOR UPDATE;

  IF v_current>=99 THEN
    UPDATE public.player_attribute_development SET progress=0,updated_at=now() WHERE player_id=p_player_id AND attribute_key=p_attribute;
    RETURN;
  END IF;

  v_total:=v_progress+p_points;
  v_gain:=LEAST(99-v_current,FLOOR(v_total/100)::integer);
  IF v_gain>0 THEN
    UPDATE public.jogadores
    SET atributos=jsonb_set(atributos,ARRAY[p_attribute],to_jsonb(v_current+v_gain),true),updated_at=now()
    WHERE id=p_player_id;
    v_total:=v_total-(v_gain*100);
  END IF;

  UPDATE public.player_attribute_development
  SET progress=CASE WHEN v_current+v_gain>=99 THEN 0 ELSE v_total END,updated_at=now()
  WHERE player_id=p_player_id AND attribute_key=p_attribute;
END;
$$;

CREATE OR REPLACE FUNCTION private.remove_attribute_progress(p_player_id uuid,p_attribute text,p_points numeric,p_allow_level_loss boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_row record;
  v_current integer;
  v_old_total numeric;
  v_floor numeric;
  v_target numeric;
  v_new_level integer;
  v_new_progress numeric;
BEGIN
  IF p_points<=0 THEN RETURN; END IF;
  SELECT ad.*,(j.atributos->>p_attribute)::integer AS current_value
  INTO v_row
  FROM public.player_attribute_development ad
  JOIN public.jogadores j ON j.id=ad.player_id
  WHERE ad.player_id=p_player_id AND ad.attribute_key=p_attribute
  FOR UPDATE OF ad;
  IF v_row.player_id IS NULL THEN RETURN; END IF;

  v_current:=COALESCE(v_row.current_value,1);
  v_old_total:=v_current*100+COALESCE(v_row.progress,0);
  v_floor:=CASE WHEN p_allow_level_loss THEN COALESCE(v_row.baseline_value,v_current)*100 ELSE v_current*100 END;
  v_target:=GREATEST(v_floor,v_old_total-p_points);
  v_new_level:=LEAST(99,GREATEST(COALESCE(v_row.baseline_value,1),FLOOR(v_target/100)::integer));
  v_new_progress:=CASE WHEN v_new_level>=99 THEN 0 ELSE MOD(v_target,100) END;

  IF v_new_level<>v_current THEN
    UPDATE public.jogadores
    SET atributos=jsonb_set(atributos,ARRAY[p_attribute],to_jsonb(v_new_level),true),updated_at=now()
    WHERE id=p_player_id;
  END IF;
  UPDATE public.player_attribute_development
  SET progress=v_new_progress,updated_at=now()
  WHERE player_id=p_player_id AND attribute_key=p_attribute;
END;
$$;

CREATE OR REPLACE FUNCTION private.remove_skill_progress(p_player_id uuid,p_skill_key text,p_points numeric,p_allow_level_loss boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_row record;
  v_old_total numeric;
  v_floor numeric;
  v_target numeric;
  v_new_level integer;
  v_new_progress numeric;
  v_actual_loss numeric;
  v_weights jsonb;
  v_pair record;
  v_date date;
BEGIN
  IF p_points<=0 THEN RETURN; END IF;
  PERFORM private.sync_development_baselines(p_player_id);
  SELECT * INTO v_row FROM public.player_skill_development
  WHERE player_id=p_player_id AND skill_key=p_skill_key FOR UPDATE;
  IF v_row.player_id IS NULL THEN RETURN; END IF;
  SELECT COALESCE(career_date,CURRENT_DATE) INTO v_date FROM public.player_career_state WHERE player_id=p_player_id;

  v_old_total:=v_row.level*100+v_row.progress;
  v_floor:=CASE WHEN p_allow_level_loss THEN COALESCE(v_row.baseline_level,v_row.level)*100 ELSE v_row.level*100 END;
  v_target:=GREATEST(v_floor,v_old_total-p_points);
  v_actual_loss:=v_old_total-v_target;
  IF v_actual_loss<=0 THEN RETURN; END IF;

  v_new_level:=LEAST(99,GREATEST(COALESCE(v_row.baseline_level,1),FLOOR(v_target/100)::integer));
  v_new_progress:=CASE WHEN v_new_level>=99 THEN 0 ELSE MOD(v_target,100) END;
  UPDATE public.player_skill_development
  SET level=v_new_level,progress=v_new_progress,last_decay_on=v_date,updated_at=now()
  WHERE player_id=p_player_id AND skill_key=p_skill_key;

  v_weights:=private.skill_attribute_weights(p_player_id,p_skill_key);
  FOR v_pair IN SELECT key,value FROM jsonb_each_text(v_weights) LOOP
    PERFORM private.remove_attribute_progress(
      p_player_id,
      v_pair.key,
      v_actual_loss*v_pair.value::numeric*0.35,
      p_allow_level_loss
    );
  END LOOP;

  INSERT INTO public.player_development_events(player_id,career_date,event_type,skill_key,amount,metadata)
  VALUES(p_player_id,v_date,CASE WHEN v_new_level<v_row.level THEN 'level_down' ELSE 'decay' END,p_skill_key,-v_actual_loss,
    jsonb_build_object('from_level',v_row.level,'to_level',v_new_level,'baseline_level',v_row.baseline_level));
END;
$$;

CREATE OR REPLACE FUNCTION private.add_skill_progress(p_player_id uuid,p_skill_key text,p_points numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_row record;
  v_state record;
  v_total numeric;
  v_gain integer;
  v_bonus numeric:=0;
  v_quality numeric:=1;
  v_adjusted numeric;
  v_weights jsonb;
  v_pair record;
  v_modifier_key text;
  v_old_level integer;
BEGIN
  IF p_points<=0 THEN RETURN; END IF;
  PERFORM private.sync_development_baselines(p_player_id);
  SELECT * INTO v_row FROM public.player_skill_development
  WHERE player_id=p_player_id AND skill_key=p_skill_key FOR UPDATE;
  IF v_row.player_id IS NULL OR v_row.level>=99 THEN RETURN; END IF;
  SELECT career_date,evolution_modifiers INTO v_state FROM public.player_career_state WHERE player_id=p_player_id;

  v_modifier_key:=CASE
    WHEN p_skill_key='sprint' THEN 'speed_pct'
    WHEN p_skill_key IN ('stamina','strength','heading') THEN 'physical_pct'
    WHEN p_skill_key IN ('positioning','tactical_awareness','marking') THEN 'tactical_pct'
    ELSE 'technical_pct' END;
  v_bonus:=COALESCE((v_state.evolution_modifiers->>v_modifier_key)::numeric,0);
  v_quality:=private.training_absorption_multiplier(p_player_id,p_skill_key);
  v_adjusted:=GREATEST(0.10,p_points*(1+(v_bonus/100.0))*v_quality);

  v_old_level:=v_row.level;
  v_total:=v_row.progress+v_adjusted;
  v_gain:=FLOOR(v_total/100)::integer;
  v_row.level:=LEAST(99,v_row.level+v_gain);
  v_row.progress:=CASE WHEN v_row.level>=99 THEN 0 ELSE MOD(v_total,100) END;

  UPDATE public.player_skill_development
  SET level=v_row.level,
      progress=v_row.progress,
      last_stimulated_on=COALESCE(v_state.career_date,CURRENT_DATE),
      updated_at=now()
  WHERE player_id=p_player_id AND skill_key=p_skill_key;

  v_weights:=private.skill_attribute_weights(p_player_id,p_skill_key);
  FOR v_pair IN SELECT key,value FROM jsonb_each_text(v_weights) LOOP
    PERFORM private.add_attribute_progress(p_player_id,v_pair.key,v_adjusted*v_pair.value::numeric);
  END LOOP;

  INSERT INTO public.player_development_events(player_id,career_date,event_type,skill_key,amount,metadata)
  VALUES(p_player_id,COALESCE(v_state.career_date,CURRENT_DATE),CASE WHEN v_row.level>v_old_level THEN 'level_up' ELSE 'gain' END,p_skill_key,v_adjusted,
    jsonb_build_object('quality',v_quality,'evolution_bonus_pct',v_bonus,'raw_points',p_points,'from_level',v_old_level,'to_level',v_row.level));
END;
$$;

CREATE OR REPLACE FUNCTION private.apply_daily_development_maintenance(p_player_id uuid,p_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_state record;
  v_day date;
  v_skill record;
  v_policy jsonb;
  v_days_idle integer;
  v_grace integer;
  v_level_loss_days integer;
  v_daily_loss numeric;
  v_loss numeric;
BEGIN
  PERFORM private.sync_development_baselines(p_player_id);
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=p_player_id FOR UPDATE;
  IF p_date IS NULL THEN RETURN; END IF;
  IF COALESCE(v_state.last_development_maintenance_date,p_date)>=p_date THEN RETURN; END IF;

  FOR v_day IN
    SELECT d::date FROM generate_series((COALESCE(v_state.last_development_maintenance_date,p_date-1)+1)::timestamp,p_date::timestamp,interval '1 day') d
  LOOP
    FOR v_skill IN SELECT * FROM public.player_skill_development WHERE player_id=p_player_id LOOP
      v_policy:=private.skill_decay_policy(v_skill.skill_key);
      v_grace:=(v_policy->>'grace_days')::integer;
      v_level_loss_days:=(v_policy->>'level_loss_days')::integer;
      v_daily_loss:=(v_policy->>'daily_loss')::numeric;
      v_days_idle:=GREATEST(0,v_day-COALESCE(v_skill.last_stimulated_on,v_day));
      IF v_days_idle>v_grace THEN
        v_loss:=v_daily_loss*LEAST(1.50,1+((v_days_idle-v_grace)*0.025));
        PERFORM private.remove_skill_progress(p_player_id,v_skill.skill_key,v_loss,v_days_idle>=v_level_loss_days);
      END IF;
    END LOOP;
    UPDATE public.player_career_state SET last_development_maintenance_date=v_day WHERE player_id=p_player_id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION private.after_career_date_development_maintenance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  IF NEW.career_date IS DISTINCT FROM OLD.career_date THEN
    PERFORM private.apply_daily_development_maintenance(NEW.player_id,NEW.career_date);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_career_date_development_maintenance ON public.player_career_state;
CREATE TRIGGER trg_career_date_development_maintenance
AFTER UPDATE OF career_date ON public.player_career_state
FOR EACH ROW
WHEN (OLD.career_date IS DISTINCT FROM NEW.career_date)
EXECUTE FUNCTION private.after_career_date_development_maintenance();

COMMIT;

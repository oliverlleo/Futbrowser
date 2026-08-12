BEGIN;

ALTER TABLE public.player_career_state
  ADD COLUMN IF NOT EXISTS career_started_date date,
  ADD COLUMN IF NOT EXISTS career_start_age integer NOT NULL DEFAULT 16 CHECK (career_start_age BETWEEN 12 AND 45);

UPDATE public.player_career_state pcs
SET career_started_date=coalesce(pcs.career_started_date,pcs.career_date,current_date),
    career_start_age=coalesce(j.idade,16)
FROM public.jogadores j
WHERE j.id=pcs.player_id;

CREATE OR REPLACE FUNCTION private.sync_career_age(p_player_id uuid,p_date date)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_start date; v_start_age int; v_age int; v_level text;
BEGIN
  SELECT career_started_date,career_start_age INTO v_start,v_start_age
  FROM public.player_career_state WHERE player_id=p_player_id;
  IF v_start IS NULL THEN
    v_start:=p_date;
    UPDATE public.player_career_state SET career_started_date=v_start WHERE player_id=p_player_id;
  END IF;
  v_age:=least(45,greatest(12,v_start_age + floor((p_date-v_start)/365.2425)::int));
  UPDATE public.jogadores SET idade=v_age WHERE id=p_player_id AND idade IS DISTINCT FROM v_age;

  v_level:=CASE WHEN v_age<=15 THEN 'u15' WHEN v_age<=17 THEN 'u17' WHEN v_age<=20 THEN 'u20' ELSE 'senior' END;
  UPDATE public.player_national_callups
  SET status='completed',release_date=coalesce(release_date,p_date)
  WHERE player_id=p_player_id AND status='active' AND level<>v_level;
  RETURN v_age;
END;
$$;

CREATE OR REPLACE FUNCTION private.sync_career_stage_from_active_contract(p_player_id uuid,p_date date DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_name text; v_stage text; v_old text;
BEGIN
  SELECT c.name INTO v_name
  FROM public.player_contracts pc JOIN public.base_clubs c ON c.id=pc.club_id
  WHERE pc.player_id=p_player_id AND pc.status='active'
  ORDER BY pc.signed_at DESC LIMIT 1;
  IF v_name IS NULL THEN RETURN NULL; END IF;
  v_stage:=CASE WHEN v_name ILIKE '%Sub-%' THEN 'academy' ELSE 'professional' END;
  SELECT career_stage INTO v_old FROM public.player_career_state WHERE player_id=p_player_id;
  UPDATE public.player_career_state SET career_stage=v_stage WHERE player_id=p_player_id AND career_stage IS DISTINCT FROM v_stage;

  IF v_old='academy' AND v_stage='professional' THEN
    INSERT INTO public.player_messages(player_id,message_type,subject,body,metadata)
    SELECT p_player_id,'career','Você chegou ao profissional',
      'O ciclo da base foi encerrado sem apagar nada. Jogos, gols, assistências, vitórias, empates, derrotas, títulos e prêmios conquistados na base continuam no seu histórico. A partir daqui começa uma nova linha estatística profissional.',
      jsonb_build_object('kind','professional_promotion','date',coalesce(p_date,current_date))
    WHERE NOT EXISTS(
      SELECT 1 FROM public.player_messages WHERE player_id=p_player_id AND metadata->>'kind'='professional_promotion'
    );
  END IF;
  RETURN v_stage;
END;
$$;

CREATE OR REPLACE FUNCTION private.career_contract_stage_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.status='active' THEN
    PERFORM private.sync_career_stage_from_active_contract(NEW.player_id,(SELECT career_date FROM public.player_career_state WHERE player_id=NEW.player_id));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_career_contract_stage ON public.player_contracts;
CREATE TRIGGER trg_career_contract_stage AFTER INSERT OR UPDATE OF status,club_id ON public.player_contracts
FOR EACH ROW EXECUTE FUNCTION private.career_contract_stage_trigger();

CREATE OR REPLACE FUNCTION private.career_history_daily_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.career_date IS DISTINCT FROM OLD.career_date THEN
    PERFORM private.sync_career_age(NEW.player_id,NEW.career_date);
    PERFORM private.sync_career_stage_from_active_contract(NEW.player_id,NEW.career_date);
    PERFORM private.maybe_youth_national_callup(NEW.player_id,NEW.career_date);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_career_history_daily ON public.player_career_state;
CREATE TRIGGER trg_career_history_daily AFTER UPDATE OF career_date ON public.player_career_state
FOR EACH ROW WHEN (NEW.career_date IS DISTINCT FROM OLD.career_date)
EXECUTE FUNCTION private.career_history_daily_trigger();

COMMIT;

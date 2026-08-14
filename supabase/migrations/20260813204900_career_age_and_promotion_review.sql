ALTER TABLE public.player_market_state ADD COLUMN IF NOT EXISTS last_age_year integer;

CREATE OR REPLACE FUNCTION private.career_sync_player_age(p_player_id uuid,p_date date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_year int:=extract(year FROM p_date)::int;v_last int;v_age int;
BEGIN
 INSERT INTO public.player_market_state(player_id,last_age_year) VALUES(p_player_id,v_year) ON CONFLICT(player_id) DO NOTHING;
 SELECT last_age_year INTO v_last FROM public.player_market_state WHERE player_id=p_player_id FOR UPDATE;
 IF v_last IS NULL THEN
   UPDATE public.player_market_state SET last_age_year=v_year,updated_at=now() WHERE player_id=p_player_id;
 ELSIF v_year>v_last THEN
   UPDATE public.jogadores SET idade=idade+(v_year-v_last),updated_at=now() WHERE id=p_player_id;
   UPDATE public.player_market_state SET last_age_year=v_year,updated_at=now() WHERE player_id=p_player_id;
 END IF;
 SELECT idade INTO v_age FROM public.jogadores WHERE id=p_player_id;
 RETURN v_age;
END $$;

CREATE OR REPLACE FUNCTION public.review_career_promotion()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_player uuid;v_date date;
BEGIN
 SELECT j.id,st.career_date INTO v_player,v_date FROM public.jogadores j JOIN public.player_career_state st ON st.player_id=j.id WHERE j.user_id=auth.uid();
 IF v_player IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.';END IF;
 PERFORM private.career_sync_player_age(v_player,v_date);
 RETURN private.career_evaluate_youth_promotion(v_player,v_date,false);
END $$;

GRANT EXECUTE ON FUNCTION public.review_career_promotion() TO authenticated;

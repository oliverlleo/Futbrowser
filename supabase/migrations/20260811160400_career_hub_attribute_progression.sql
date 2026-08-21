CREATE TABLE IF NOT EXISTS public.player_attribute_development (
  player_id UUID NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,
  attribute_key TEXT NOT NULL,
  progress NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress < 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, attribute_key),
  CHECK (attribute_key IN ('Físico','Marcação','Finalização','Velocidade','Passe','Visão de jogo'))
);
ALTER TABLE public.player_attribute_development ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.player_attribute_development FROM anon, authenticated;
GRANT SELECT ON TABLE public.player_attribute_development TO authenticated;
DROP POLICY IF EXISTS "Owner Attribute Development Select" ON public.player_attribute_development;
CREATE POLICY "Owner Attribute Development Select" ON public.player_attribute_development FOR SELECT TO authenticated USING (public.is_player_owner(player_id));

CREATE OR REPLACE FUNCTION private.add_attribute_progress(p_player_id UUID,p_attribute TEXT,p_points NUMERIC) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_progress NUMERIC;v_total NUMERIC;v_gain INT;v_current INT;
BEGIN IF p_points<=0 OR p_attribute NOT IN('Físico','Marcação','Finalização','Velocidade','Passe','Visão de jogo')THEN RETURN;END IF;INSERT INTO public.player_attribute_development(player_id,attribute_key,progress)VALUES(p_player_id,p_attribute,0)ON CONFLICT(player_id,attribute_key)DO NOTHING;SELECT progress INTO v_progress FROM public.player_attribute_development WHERE player_id=p_player_id AND attribute_key=p_attribute FOR UPDATE;SELECT COALESCE((atributos->>p_attribute)::INT,1)INTO v_current FROM public.jogadores WHERE id=p_player_id;IF v_current>=99 THEN UPDATE public.player_attribute_development SET progress=0,updated_at=now()WHERE player_id=p_player_id AND attribute_key=p_attribute;RETURN;END IF;v_total:=v_progress+p_points;v_gain:=LEAST(99-v_current,FLOOR(v_total/100)::INT);IF v_gain>0 THEN UPDATE public.jogadores SET atributos=jsonb_set(atributos,ARRAY[p_attribute],to_jsonb(v_current+v_gain),true),updated_at=now()WHERE id=p_player_id;v_total:=v_total-(v_gain*100);END IF;UPDATE public.player_attribute_development SET progress=CASE WHEN v_current+v_gain>=99 THEN 0 ELSE v_total END,updated_at=now()WHERE player_id=p_player_id AND attribute_key=p_attribute;END;$$;

CREATE OR REPLACE FUNCTION private.add_skill_progress(p_player_id UUID,p_skill_key TEXT,p_points NUMERIC) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_level INT;v_progress NUMERIC;v_total NUMERIC;v_gain INT;v_parent TEXT;v_modifiers JSONB;v_bonus NUMERIC:=0;v_adjusted NUMERIC;
BEGIN IF p_points<=0 THEN RETURN;END IF;SELECT level,progress,parent_attribute INTO v_level,v_progress,v_parent FROM public.player_skill_development WHERE player_id=p_player_id AND skill_key=p_skill_key FOR UPDATE;IF v_level IS NULL OR v_level>=99 THEN RETURN;END IF;SELECT evolution_modifiers INTO v_modifiers FROM public.player_career_state WHERE player_id=p_player_id;IF v_modifiers?v_parent THEN v_bonus:=COALESCE((v_modifiers->>v_parent)::NUMERIC,0);ELSIF v_parent='Velocidade' THEN v_bonus:=COALESCE((v_modifiers->>'speed_pct')::NUMERIC,0);ELSIF v_parent='Físico' THEN v_bonus:=COALESCE((v_modifiers->>'physical_pct')::NUMERIC,0);ELSIF v_parent IN('Passe','Finalização')THEN v_bonus:=COALESCE((v_modifiers->>'technical_pct')::NUMERIC,0);ELSE v_bonus:=COALESCE((v_modifiers->>'tactical_pct')::NUMERIC,0);END IF;v_adjusted:=GREATEST(.25,p_points*(1+(v_bonus/100.0)));v_total:=v_progress+v_adjusted;v_gain:=FLOOR(v_total/100)::INT;v_level:=LEAST(99,v_level+v_gain);v_progress:=CASE WHEN v_level>=99 THEN 0 ELSE MOD(v_total,100)END;UPDATE public.player_skill_development SET level=v_level,progress=v_progress,updated_at=now()WHERE player_id=p_player_id AND skill_key=p_skill_key;PERFORM private.add_attribute_progress(p_player_id,v_parent,v_adjusted*.28);END;$$;

CREATE OR REPLACE FUNCTION private.ensure_attribute_development(p_player_id UUID) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN INSERT INTO public.player_attribute_development(player_id,attribute_key,progress)SELECT p_player_id,x,0 FROM unnest(ARRAY['Físico','Marcação','Finalização','Velocidade','Passe','Visão de jogo'])x ON CONFLICT(player_id,attribute_key)DO NOTHING;END;$$;

CREATE OR REPLACE FUNCTION public.get_career_attribute_progress() RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user UUID:=auth.uid();v_player UUID;v_result JSONB;
BEGIN IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado.';END IF;SELECT id INTO v_player FROM public.jogadores WHERE user_id=v_user;IF v_player IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.';END IF;PERFORM private.ensure_attribute_development(v_player);SELECT COALESCE(jsonb_object_agg(attribute_key,ROUND(progress,0)),'{}'::jsonb)INTO v_result FROM public.player_attribute_development WHERE player_id=v_player;RETURN v_result;END;$$;
REVOKE EXECUTE ON FUNCTION public.get_career_attribute_progress() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_career_attribute_progress() TO authenticated;

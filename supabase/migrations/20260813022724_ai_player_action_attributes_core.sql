CREATE TABLE IF NOT EXISTS private.base_ai_player_attributes (
  ai_player_id uuid PRIMARY KEY REFERENCES public.base_ai_players(id) ON DELETE CASCADE,
  pace integer NOT NULL CHECK (pace BETWEEN 20 AND 99),
  passing integer NOT NULL CHECK (passing BETWEEN 20 AND 99),
  finishing integer NOT NULL CHECK (finishing BETWEEN 20 AND 99),
  physical integer NOT NULL CHECK (physical BETWEEN 20 AND 99),
  vision integer NOT NULL CHECK (vision BETWEEN 20 AND 99),
  marking integer NOT NULL CHECK (marking BETWEEN 20 AND 99),
  source text NOT NULL DEFAULT 'generated',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION private.ai_player_attribute_value(p_id uuid,p_ovr integer,p_position text,p_archetype text,p_key text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO ''
AS $function$
DECLARE
  v_position text:=lower(coalesce(p_position,''));
  v_archetype text:=lower(coalesce(p_archetype,''));
  v_role_mod integer:=0;
  v_arch_mod integer:=0;
  v_noise integer:=0;
BEGIN
  IF p_key='pace' THEN
    v_role_mod:=CASE WHEN v_position LIKE '%goleiro%' THEN -10 WHEN v_position LIKE '%zagueiro%' THEN -4 WHEN v_position LIKE '%lateral%' THEN 5 WHEN v_position LIKE '%meia%' THEN 2 WHEN v_position LIKE '%ponta%' THEN 7 WHEN v_position LIKE '%atacante%' THEN 4 ELSE 0 END;
    IF v_archetype ~ 'driblador' THEN v_arch_mod:=v_arch_mod+3; END IF;
    IF v_archetype ~ '(velocista|móvel|movel|infiltrador)' THEN v_arch_mod:=v_arch_mod+5; END IF;
    IF v_archetype ~ '(parede|pivô|pivo)' THEN v_arch_mod:=v_arch_mod-2; END IF;
    IF v_archetype ~ '(defensor|marcador|defensivo|destruidor|xerife|líbero|libero)' THEN v_arch_mod:=v_arch_mod-1; END IF;
  ELSIF p_key='passing' THEN
    v_role_mod:=CASE WHEN v_position LIKE '%goleiro%' THEN -5 WHEN v_position LIKE '%zagueiro%' THEN -3 WHEN v_position LIKE '%volante%' THEN 1 WHEN v_position LIKE '%meio-campo%' THEN 4 WHEN v_position LIKE '%meia%' THEN 4 WHEN v_position LIKE '%ponta%' THEN 2 WHEN v_position LIKE '%atacante%' THEN -2 ELSE 0 END;
    IF v_archetype ~ 'driblador' THEN v_arch_mod:=v_arch_mod+2; END IF;
    IF v_archetype ~ '(técnico|tecnico|maestro|organizador|clássico|classico)' THEN v_arch_mod:=v_arch_mod+4; END IF;
    IF v_archetype ~ '(apoiador|motorzinho)' THEN v_arch_mod:=v_arch_mod+2; END IF;
  ELSIF p_key='finishing' THEN
    v_role_mod:=CASE WHEN v_position LIKE '%goleiro%' THEN -20 WHEN v_position LIKE '%zagueiro%' THEN -10 WHEN v_position LIKE '%lateral%' THEN -5 WHEN v_position LIKE '%volante%' THEN -5 WHEN v_position LIKE '%meia%' THEN 1 WHEN v_position LIKE '%ponta%' THEN 2 WHEN v_position LIKE '%atacante%' THEN 7 ELSE 0 END;
    IF v_archetype ~ '(finalizador|matador)' THEN v_arch_mod:=v_arch_mod+5; END IF;
    IF v_archetype ~ '(parede|pivô|pivo)' THEN v_arch_mod:=v_arch_mod+2; END IF;
  ELSIF p_key='physical' THEN
    v_role_mod:=CASE WHEN v_position LIKE '%goleiro%' THEN 2 WHEN v_position LIKE '%zagueiro%' THEN 7 WHEN v_position LIKE '%lateral%' THEN 2 WHEN v_position LIKE '%volante%' THEN 4 WHEN v_position LIKE '%meia%' THEN -2 WHEN v_position LIKE '%ponta%' THEN -4 WHEN v_position LIKE '%atacante%' THEN 2 ELSE 0 END;
    IF v_archetype ~ '(defensor|marcador|defensivo|destruidor|xerife|líbero|libero)' THEN v_arch_mod:=v_arch_mod+3; END IF;
    IF v_archetype ~ 'driblador' THEN v_arch_mod:=v_arch_mod-1; END IF;
    IF v_archetype ~ '(técnico|tecnico|maestro|organizador|clássico|classico)' THEN v_arch_mod:=v_arch_mod-2; END IF;
    IF v_archetype ~ '(apoiador|motorzinho)' THEN v_arch_mod:=v_arch_mod+1; END IF;
    IF v_archetype ~ '(parede|pivô|pivo)' THEN v_arch_mod:=v_arch_mod+5; END IF;
  ELSIF p_key='vision' THEN
    v_role_mod:=CASE WHEN v_position LIKE '%goleiro%' THEN -2 WHEN v_position LIKE '%zagueiro%' THEN -2 WHEN v_position LIKE '%volante%' THEN 2 WHEN v_position LIKE '%meio-campo%' THEN 4 WHEN v_position LIKE '%meia%' THEN 5 WHEN v_position LIKE '%ponta%' THEN 1 ELSE 0 END;
    IF v_archetype ~ '(técnico|tecnico|maestro|organizador|clássico|classico)' THEN v_arch_mod:=v_arch_mod+5; END IF;
    IF v_archetype ~ '(apoiador|motorzinho)' THEN v_arch_mod:=v_arch_mod+2; END IF;
  ELSIF p_key='marking' THEN
    v_role_mod:=CASE WHEN v_position LIKE '%goleiro%' THEN -4 WHEN v_position LIKE '%zagueiro%' THEN 9 WHEN v_position LIKE '%lateral%' THEN 5 WHEN v_position LIKE '%volante%' THEN 6 WHEN v_position LIKE '%meia%' THEN -3 WHEN v_position LIKE '%ponta%' THEN -7 WHEN v_position LIKE '%atacante%' THEN -9 ELSE 0 END;
    IF v_archetype ~ '(defensor|marcador|defensivo|destruidor|xerife|líbero|libero)' THEN v_arch_mod:=v_arch_mod+5; END IF;
    IF v_archetype ~ 'driblador' THEN v_arch_mod:=v_arch_mod-4; END IF;
    IF v_archetype ~ '(finalizador|matador)' THEN v_arch_mod:=v_arch_mod-3; END IF;
    IF v_archetype ~ '(velocista|móvel|movel|infiltrador)' THEN v_arch_mod:=v_arch_mod-2; END IF;
  ELSE
    RAISE EXCEPTION 'Chave de atributo inválida.';
  END IF;
  v_noise:=round((get_byte(decode(md5(p_id::text||':'||p_key),'hex'),0)::numeric/255.0)*6.0-3.0)::integer;
  RETURN greatest(20,least(99,coalesce(p_ovr,50)+v_role_mod+v_arch_mod+v_noise));
END;
$function$;
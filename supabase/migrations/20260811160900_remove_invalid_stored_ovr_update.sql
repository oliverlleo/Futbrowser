-- jogadores does not store OVR as a column; OVR is derived from atributos.
-- Restore attribute progression so an attribute level-up cannot fail on a nonexistent column.
CREATE OR REPLACE FUNCTION private.add_attribute_progress(
  p_player_id uuid,
  p_attribute text,
  p_points numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_progress numeric;
  v_total numeric;
  v_gain int;
  v_current int;
BEGIN
  IF p_points <= 0 OR p_attribute NOT IN ('Físico','Marcação','Finalização','Velocidade','Passe','Visão de jogo') THEN
    RETURN;
  END IF;

  INSERT INTO public.player_attribute_development(player_id,attribute_key,progress)
  VALUES(p_player_id,p_attribute,0)
  ON CONFLICT(player_id,attribute_key) DO NOTHING;

  SELECT progress INTO v_progress
  FROM public.player_attribute_development
  WHERE player_id=p_player_id AND attribute_key=p_attribute
  FOR UPDATE;

  SELECT COALESCE((atributos->>p_attribute)::int,1) INTO v_current
  FROM public.jogadores
  WHERE id=p_player_id;

  IF v_current >= 99 THEN
    UPDATE public.player_attribute_development
    SET progress=0,updated_at=now()
    WHERE player_id=p_player_id AND attribute_key=p_attribute;
    RETURN;
  END IF;

  v_total:=v_progress+p_points;
  v_gain:=LEAST(99-v_current,FLOOR(v_total/100)::int);

  IF v_gain>0 THEN
    UPDATE public.jogadores
    SET atributos=jsonb_set(atributos,ARRAY[p_attribute],to_jsonb(v_current+v_gain),true),
        updated_at=now()
    WHERE id=p_player_id;
    v_total:=v_total-(v_gain*100);
  END IF;

  UPDATE public.player_attribute_development
  SET progress=CASE WHEN v_current+v_gain>=99 THEN 0 ELSE v_total END,
      updated_at=now()
  WHERE player_id=p_player_id AND attribute_key=p_attribute;
END;
$function$;

REVOKE ALL ON FUNCTION private.add_attribute_progress(uuid,text,numeric) FROM PUBLIC, anon, authenticated;

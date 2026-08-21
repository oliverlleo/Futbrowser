BEGIN;

-- Reorganiza números dos jogadores-base para que 7/8/9/10/11 não fiquem
-- artificialmente vazios esperando o usuário.
DO $$
DECLARE
  v_club uuid;
  r record;
  candidates integer[];
  candidate integer;
  chosen integer;
BEGIN
  FOR v_club IN SELECT id FROM public.base_clubs LOOP
    UPDATE public.base_ai_players SET squad_number=NULL WHERE club_id=v_club;

    FOR r IN
      SELECT * FROM public.base_ai_players
      WHERE club_id=v_club
      ORDER BY is_starter DESC,ovr DESC,id
    LOOP
      candidates:=CASE
        WHEN r.primary_position='Goleiro' THEN ARRAY[1,12,22,30,31,32,33,34,35,36,37,38,39]
        WHEN r.primary_position='Lateral Direito' THEN ARRAY[2,13,23,32,14,24,33,34,35,36,37,38,39]
        WHEN r.primary_position='Lateral Esquerdo' THEN ARRAY[6,16,26,35,13,23,34,36,37,38,39]
        WHEN r.primary_position='Zagueiro' THEN ARRAY[3,4,13,14,23,24,33,34,15,25,35,36,37,38,39]
        WHEN r.primary_position='Volante' THEN ARRAY[5,8,15,18,25,28,35,36,37,38,39]
        WHEN r.primary_position IN ('Meio-Campo','Meia','Meia Direita','Meia Esquerda') THEN ARRAY[8,10,18,20,28,30,14,16,24,26,34,36,37,38,39]
        WHEN r.primary_position IN ('Ponta Direita') THEN ARRAY[7,17,27,19,29,37,38,39]
        WHEN r.primary_position IN ('Ponta Esquerda') THEN ARRAY[11,19,29,17,27,37,38,39]
        WHEN r.primary_position IN ('Atacante','Centroavante') THEN ARRAY[9,10,19,20,29,30,18,28,38,39]
        ELSE ARRAY[12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39]
      END;
      chosen:=NULL;
      FOREACH candidate IN ARRAY candidates LOOP
        IF NOT EXISTS(SELECT 1 FROM public.base_ai_players x WHERE x.club_id=v_club AND x.squad_number=candidate)
           AND NOT EXISTS(SELECT 1 FROM public.player_squad_numbers ps WHERE ps.club_id=v_club AND ps.number=candidate AND ps.active)
        THEN chosen:=candidate; EXIT; END IF;
      END LOOP;
      IF chosen IS NULL THEN
        SELECT n INTO chosen FROM generate_series(40,99) n
        WHERE NOT EXISTS(SELECT 1 FROM public.base_ai_players x WHERE x.club_id=v_club AND x.squad_number=n)
          AND NOT EXISTS(SELECT 1 FROM public.player_squad_numbers ps WHERE ps.club_id=v_club AND ps.number=n AND ps.active)
        ORDER BY n LIMIT 1;
      END IF;
      UPDATE public.base_ai_players SET squad_number=chosen WHERE id=r.id;
    END LOOP;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION private.available_squad_numbers(p_player_id uuid)
RETURNS integer[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_club uuid; v_role text; v_pos text; v_fame int; v_numbers integer[];
BEGIN
  SELECT pc.club_id,pc.squad_role,j.posicao,coalesce(pcs.fame,0)
  INTO v_club,v_role,v_pos,v_fame
  FROM public.player_contracts pc
  JOIN public.jogadores j ON j.id=pc.player_id
  LEFT JOIN public.player_career_state pcs ON pcs.player_id=j.id
  WHERE pc.player_id=p_player_id AND pc.status='active'
  ORDER BY pc.signed_at DESC LIMIT 1;
  IF v_club IS NULL THEN RETURN ARRAY[]::integer[]; END IF;

  SELECT coalesce(array_agg(n ORDER BY n),ARRAY[]::integer[])
  INTO v_numbers
  FROM generate_series(1,39) n
  WHERE NOT EXISTS(SELECT 1 FROM public.base_ai_players ai WHERE ai.club_id=v_club AND ai.squad_number=n)
    AND NOT EXISTS(SELECT 1 FROM public.player_squad_numbers psn WHERE psn.club_id=v_club AND psn.number=n AND psn.active)
    AND (n<>1 OR v_pos='Goleiro')
    AND CASE v_role
      WHEN 'Promessa' THEN n>=20
      WHEN 'Reserva' THEN n>=14
      WHEN 'Rotação' THEN n>=12
      WHEN 'Titular' THEN (
        n NOT IN (7,8,9,10,11)
        OR (
          v_fame>=30
          AND (
            (n=9 AND v_pos='Atacante') OR
            (n=10 AND v_pos IN ('Atacante','Meia')) OR
            (n IN (7,11) AND v_pos IN ('Atacante','Meia')) OR
            (n=8 AND v_pos='Meia')
          )
        )
      )
      WHEN 'Estrela' THEN (
        n NOT IN (7,8,9,10,11)
        OR (n=9 AND v_pos='Atacante')
        OR (n=10 AND v_pos IN ('Atacante','Meia'))
        OR (n IN (7,11) AND v_pos IN ('Atacante','Meia'))
        OR (n=8 AND v_pos='Meia')
      )
      ELSE n>=14
    END;
  RETURN v_numbers;
END;
$$;

COMMIT;

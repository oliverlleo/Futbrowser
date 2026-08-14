CREATE OR REPLACE FUNCTION private.career_youth_squad_for_age(p_age integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN coalesce(p_age,16) <= 15 THEN 'u15'
    WHEN p_age <= 17 THEN 'u17'
    WHEN p_age = 18 THEN 'u18'
    ELSE 'u20'
  END
$function$;

CREATE OR REPLACE FUNCTION private.career_contract_root_club(p_club_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN c.club_level='academy' AND c.squad_level='base' THEN c.id
    WHEN c.club_level='academy' THEN c.academy_base_id
    ELSE c.id
  END
  FROM public.base_clubs c
  WHERE c.id=p_club_id
$function$;

CREATE OR REPLACE FUNCTION private.build_offer_context(p_player_id uuid, p_club_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_player record;v_input record;v_org record;v_sport record;v_coach record;
  v_player_ovr int;v_club_ovr int;v_position text;v_slots int;v_competitor_count int;v_starters_competing int;v_subs_competing int;v_lowest_starter_ovr int;
  v_comp_score int;v_position_score int;v_coach_score int;v_style_score int;v_archetype_score int;v_level_fit int;v_interest int;
  v_tolerance_modifier int;v_internal_tolerance int;v_chance text;v_hierarchy text;v_competition_level text;v_target_level text;
  v_positive jsonb:='[]'::jsonb;v_negative jsonb:='[]'::jsonb;
BEGIN
  SELECT * INTO v_player FROM public.jogadores WHERE id=p_player_id;
  IF v_player.id IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.';END IF;
  SELECT * INTO v_input FROM public.base_clubs WHERE id=p_club_id AND is_active;
  IF v_input.id IS NULL THEN RAISE EXCEPTION 'Clube não encontrado.';END IF;
  IF v_input.club_level='academy' THEN
    IF v_input.squad_level='base' THEN
      v_org:=v_input;v_target_level:=private.career_youth_squad_for_age(v_player.idade);
      SELECT * INTO v_sport FROM public.base_clubs WHERE academy_base_id=v_org.id AND squad_level=v_target_level AND is_active LIMIT 1;
    ELSE
      v_sport:=v_input;v_target_level:=v_sport.squad_level;
      SELECT * INTO v_org FROM public.base_clubs WHERE id=v_sport.academy_base_id AND squad_level='base' LIMIT 1;
    END IF;
  ELSE
    v_org:=v_input;v_sport:=v_input;v_target_level:='first_team';
  END IF;
  IF v_sport.id IS NULL OR v_org.id IS NULL THEN RAISE EXCEPTION 'Estrutura esportiva do clube incompleta.';END IF;
  SELECT * INTO v_coach FROM public.base_coaches WHERE id=v_sport.coach_id;
  v_player_ovr:=public.calculate_player_ovr(v_player.atributos);
  SELECT coalesce(round(avg(p.ovr))::int,50) INTO v_club_ovr FROM public.base_ai_players p WHERE p.club_id=v_sport.id;
  v_position:=v_player.posicao;v_slots:=private.formation_slots(v_sport.formation,v_position);
  IF v_slots=0 AND v_player.posicao_secundaria IS NOT NULL AND private.formation_slots(v_sport.formation,v_player.posicao_secundaria)>0 THEN
    v_position:=v_player.posicao_secundaria;v_slots:=private.formation_slots(v_sport.formation,v_position);v_positive:=v_positive||to_jsonb('Sua posição secundária encaixa na formação'::text);
  END IF;
  SELECT count(*) INTO v_competitor_count FROM public.base_ai_players p WHERE p.club_id=v_sport.id AND (p.primary_position=v_position OR p.secondary_position=v_position);
  IF v_slots>0 THEN SELECT min(x.ovr) INTO v_lowest_starter_ovr FROM (SELECT p.ovr FROM public.base_ai_players p WHERE p.club_id=v_sport.id AND (p.primary_position=v_position OR p.secondary_position=v_position) ORDER BY p.ovr DESC,p.id LIMIT v_slots)x;END IF;
  v_starters_competing:=least(greatest(v_slots,0),v_competitor_count);v_subs_competing:=greatest(0,v_competitor_count-v_starters_competing);v_lowest_starter_ovr:=coalesce(v_lowest_starter_ovr,v_player_ovr);
  IF v_slots=0 THEN v_comp_score:=10;v_position_score:=10;v_negative:=v_negative||to_jsonb('Sua posição não tem vaga natural no esquema'::text);
  ELSE v_comp_score:=greatest(10,least(100,100-(greatest(0,v_lowest_starter_ovr-v_player_ovr)*4)));v_position_score:=CASE WHEN v_competitor_count<v_slots THEN 100 WHEN v_competitor_count=v_slots THEN 80 WHEN v_competitor_count=v_slots+1 THEN 65 ELSE 45 END;END IF;
  v_coach_score:=45;
  IF v_coach.impacts->>'preferred_archetype'=v_player.arquetipo THEN v_coach_score:=v_coach_score+35;v_positive:=v_positive||to_jsonb('Arquétipo preferido do treinador'::text);ELSE v_negative:=v_negative||to_jsonb('Arquétipo fora da preferência do treinador'::text);END IF;
  IF v_coach.impacts->>'preferred_style'=v_sport.play_style THEN v_coach_score:=v_coach_score+10;END IF;IF v_coach.impacts->>'preferred_formation'=v_sport.formation THEN v_coach_score:=v_coach_score+10;END IF;v_coach_score:=least(100,v_coach_score);
  v_style_score:=CASE v_player.arquetipo WHEN 'Driblador' THEN CASE v_sport.play_style WHEN 'Pelas alas' THEN 95 WHEN 'Posse de bola' THEN 90 WHEN 'Ofensivo' THEN 85 WHEN 'Contra-ataque' THEN 80 WHEN 'Equilibrado' THEN 70 ELSE 60 END WHEN 'Finalizador' THEN CASE v_sport.play_style WHEN 'Ofensivo' THEN 100 WHEN 'Contra-ataque' THEN 90 WHEN 'Equilibrado' THEN 80 WHEN 'Pelas alas' THEN 75 WHEN 'Posse de bola' THEN 70 ELSE 60 END WHEN 'Criador' THEN CASE v_sport.play_style WHEN 'Posse de bola' THEN 100 WHEN 'Equilibrado' THEN 90 WHEN 'Pelas alas' THEN 85 WHEN 'Ofensivo' THEN 80 WHEN 'Contra-ataque' THEN 65 ELSE 60 END WHEN 'Raçudo' THEN CASE v_sport.play_style WHEN 'Equilibrado' THEN 95 WHEN 'Contra-ataque' THEN 85 WHEN 'Ofensivo' THEN 85 WHEN 'Pelas alas' THEN 75 WHEN 'Posse de bola' THEN 70 ELSE 60 END ELSE 60 END;
  IF v_position LIKE 'Ponta%' OR v_position LIKE 'Lateral%' THEN IF v_sport.play_style='Pelas alas' THEN v_style_score:=least(100,v_style_score+5);END IF;ELSIF v_position='Atacante' THEN IF v_sport.play_style IN('Ofensivo','Contra-ataque') THEN v_style_score:=least(100,v_style_score+5);END IF;ELSIF v_position IN('Meia','Meio-Campo') THEN IF v_sport.play_style='Posse de bola' THEN v_style_score:=least(100,v_style_score+5);END IF;END IF;
  IF v_style_score>=85 THEN v_positive:=v_positive||to_jsonb('Estilo de jogo favorece seu perfil'::text);ELSIF v_style_score<=70 THEN v_negative:=v_negative||to_jsonb('Estilo de jogo pouco favorável ao seu perfil'::text);END IF;
  v_archetype_score:=round((v_coach_score+v_style_score)/2.0)::int;v_level_fit:=greatest(20,least(100,100-(abs(v_club_ovr-v_player_ovr)*5)));
  v_interest:=round((v_comp_score*.25)+(v_position_score*.20)+(v_coach_score*.20)+(v_style_score*.20)+(v_level_fit*.15)+((6-least(5,greatest(1,v_org.reputation)))*4))::int;v_interest:=greatest(20,least(100,v_interest));
  IF v_slots=0 THEN v_chance:='Baixa';ELSIF v_player_ovr>=v_lowest_starter_ovr THEN v_chance:='Alta';ELSIF v_player_ovr>=v_lowest_starter_ovr-8 THEN v_chance:='Média';ELSE v_chance:='Baixa';END IF;
  v_hierarchy:=CASE v_chance WHEN 'Alta' THEN CASE WHEN v_interest>=75 THEN 'Titular' ELSE 'Rotação' END WHEN 'Média' THEN 'Rotação' ELSE 'Reserva' END;
  v_competition_level:=CASE WHEN v_slots=0 THEN 'Alta' WHEN v_competitor_count>=v_slots+2 THEN 'Alta' WHEN v_competitor_count=v_slots+1 THEN 'Média' ELSE 'Baixa' END;
  IF v_chance='Alta' THEN v_positive:=v_positive||to_jsonb('Chance imediata de disputar titularidade'::text);ELSIF v_chance='Baixa' THEN v_negative:=v_negative||to_jsonb('Concorrência inicial acima do seu nível'::text);END IF;
  v_tolerance_modifier:=CASE v_coach.impacts->>'tolerance_to_bad_games' WHEN 'high' THEN 15 WHEN 'medium' THEN 5 WHEN 'low' THEN -10 ELSE 0 END;
  v_internal_tolerance:=round((v_interest*.45)+(v_org.flexibility*.70)+v_tolerance_modifier)::int;v_internal_tolerance:=greatest(15,least(90,v_internal_tolerance));
  RETURN jsonb_build_object('internal_tolerance',v_internal_tolerance,'compatibility_breakdown',jsonb_build_object('total',v_interest,'compatibility_total',v_interest,'interest_score',v_interest,'competition_score',v_comp_score,'position_score',v_position_score,'archetype_score',v_archetype_score,'coach_score',v_coach_score,'style_score',v_style_score,'level_fit_score',v_level_fit,'positive_factors',v_positive,'negative_factors',v_negative),'snapshot_data',jsonb_build_object('club_overall',v_club_ovr,'club_ovr',v_club_ovr,'player_ovr',v_player_ovr,'formation',v_sport.formation,'effective_position',v_position,'slots_needed',v_slots,'starters_competing',v_starters_competing,'subs_competing',v_subs_competing,'lowest_starter_ovr',v_lowest_starter_ovr,'estimated_hierarchy',v_hierarchy,'chance_of_play',v_chance,'competition_level',v_competition_level,'interest_score',v_interest,'sporting_club_id',v_sport.id,'contract_club_id',v_org.id,'target_squad_level',v_target_level));
END
$function$;

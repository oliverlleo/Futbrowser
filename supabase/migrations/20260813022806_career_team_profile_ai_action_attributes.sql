CREATE OR REPLACE FUNCTION public.get_career_team_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
 v_user uuid:=auth.uid();v_player record;v_state record;v_contract record;v_club record;v_contract_club record;v_coach record;
 v_proj jsonb;v_locked jsonb;v_roster jsonb;v_replace uuid;v_user_starter boolean;v_club_ovr int;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado.';END IF;
 SELECT * INTO v_player FROM public.jogadores WHERE user_id=v_user;IF v_player.id IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.';END IF;
 PERFORM private.ensure_career_initialized(v_player.id);PERFORM private.ensure_teammate_relations(v_player.id);PERFORM private.ensure_match_selection_if_due(v_player.id);
 SELECT * INTO v_state FROM public.player_career_state WHERE player_id=v_player.id;
 SELECT * INTO v_contract FROM public.player_contracts WHERE player_id=v_player.id AND status='active' ORDER BY signed_at DESC LIMIT 1;
 SELECT * INTO v_contract_club FROM public.base_clubs WHERE id=v_contract.club_id;
 SELECT * INTO v_club FROM public.base_clubs WHERE id=v_state.club_id;
 SELECT * INTO v_coach FROM public.base_coaches WHERE id=coalesce(v_state.coach_id,v_club.coach_id);
 SELECT round(avg(ovr))::int INTO v_club_ovr FROM public.base_ai_players WHERE club_id=v_club.id;
 v_proj:=private.calculate_selection_projection(v_player.id);
 SELECT jsonb_build_object('status',selection_status,'score',score,'reason',reason,'locked',true,'match_date',match_date,'is_debut',is_debut,'shirt_number',shirt_number) INTO v_locked FROM public.player_match_selections WHERE player_id=v_player.id AND match_date=v_state.next_match_date;
 v_user_starter:=coalesce(v_locked->>'status',v_proj->>'status')='starter';
 IF v_user_starter THEN
  SELECT ai.id INTO v_replace FROM public.base_ai_players ai WHERE ai.club_id=v_club.id AND ai.is_starter AND ai.primary_position=v_player.posicao AND NOT EXISTS(SELECT 1 FROM private.career_squad_availability av WHERE av.player_id=v_player.id AND av.ai_player_id=ai.id AND av.match_date=v_state.next_match_date AND av.status='out') ORDER BY ai.ovr ASC LIMIT 1;
  IF v_replace IS NULL THEN SELECT ai.id INTO v_replace FROM public.base_ai_players ai WHERE ai.club_id=v_club.id AND ai.is_starter AND NOT EXISTS(SELECT 1 FROM private.career_squad_availability av WHERE av.player_id=v_player.id AND av.ai_player_id=ai.id AND av.match_date=v_state.next_match_date AND av.status='out') ORDER BY ai.ovr ASC LIMIT 1;END IF;
 END IF;
 WITH roster_base AS(
  SELECT ai.*,coalesce(av.status,'available') availability_status,av.reason availability_reason,coalesce(r.relation,50) relation_score,coalesce(r.chemistry,50) chemistry,coalesce(r.rivalry,false) rivalry
  FROM public.base_ai_players ai
  LEFT JOIN private.career_squad_availability av ON av.player_id=v_player.id AND av.ai_player_id=ai.id AND av.match_date=v_state.next_match_date
  LEFT JOIN public.player_teammate_relations r ON r.teammate_id=ai.id AND r.player_id=v_player.id
  WHERE ai.club_id=v_club.id
 ),promoted AS(
  SELECT rb.id FROM roster_base rb WHERE NOT rb.is_starter AND rb.availability_status<>'out' AND EXISTS(SELECT 1 FROM roster_base missing WHERE missing.is_starter AND missing.availability_status='out' AND missing.primary_position=rb.primary_position AND NOT(v_user_starter AND missing.primary_position=v_player.posicao)) AND rb.id=(SELECT cand.id FROM roster_base cand WHERE NOT cand.is_starter AND cand.availability_status<>'out' AND cand.primary_position=rb.primary_position ORDER BY cand.ovr DESC,cand.age ASC LIMIT 1)
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',rb.id,'name',rb.name,'age',rb.age,'position',rb.primary_position,'secondary_position',rb.secondary_position,'ovr',rb.ovr,'attributes',private.ai_player_attributes_json(rb.id),'archetype',rb.archetype,'squad_role',rb.squad_role,'number',rb.squad_number,'base_starter',rb.is_starter,'availability_status',rb.availability_status,'availability_reason',rb.availability_reason,'probable_starter',((rb.is_starter AND rb.availability_status<>'out' AND rb.id IS DISTINCT FROM v_replace) OR EXISTS(SELECT 1 FROM promoted pr WHERE pr.id=rb.id)),'relation_score',rb.relation_score,'relation',private.career_relation_label(rb.relation_score),'chemistry',rb.chemistry,'rivalry',rb.rivalry) ORDER BY ((rb.is_starter AND rb.availability_status<>'out' AND rb.id IS DISTINCT FROM v_replace) OR EXISTS(SELECT 1 FROM promoted pr WHERE pr.id=rb.id)) DESC,rb.primary_position,rb.ovr DESC),'[]'::jsonb) INTO v_roster FROM roster_base rb;
 RETURN jsonb_build_object(
  'club',jsonb_build_object('id',v_club.id,'name',v_club.name,'city',v_club.city,'formation',v_club.formation,'play_style',v_club.play_style,'reputation',v_club.reputation,'ovr',v_club_ovr,'shield_url',v_club.shield_url,'squad_level',v_club.squad_level,'family_code',v_club.family_code),
  'contract_club',jsonb_build_object('id',v_contract_club.id,'name',v_contract_club.name,'squad_level',v_contract_club.squad_level),
  'coach',jsonb_build_object('id',v_coach.id,'name',v_coach.name,'profile',v_coach.profile,'impacts',v_coach.impacts,'relation_score',v_state.trust,'relation',private.career_relation_label(v_state.trust)),
  'player_projection',coalesce(v_locked,v_proj||jsonb_build_object('locked',false,'match_date',v_state.next_match_date)),
  'roster',v_roster,
  'player',jsonb_build_object('id',v_player.id,'name',v_player.apelido,'position',v_player.posicao,'ovr',public.calculate_player_ovr(v_player.atributos),'shirt_number',(SELECT number FROM public.player_squad_numbers WHERE player_id=v_player.id AND club_id=v_club.id AND active LIMIT 1))
 );
END $function$;
-- Correção: uma oferta aceita ainda aguarda assinatura e não deve gerar novas ofertas.

CREATE OR REPLACE FUNCTION public.get_career_onboarding_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid:=auth.uid();v_player_count int:=0;v_player_id uuid;v_has_player boolean:=false;v_offers_generated boolean:=false;v_active_offers int:=0;v_contract_signed boolean:=false;v_onboarding_completed boolean:=false;v_generated_offer_clubs int:=0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado';END IF;
  SELECT count(*) INTO v_player_count FROM public.jogadores WHERE user_id=v_user_id;
  IF v_player_count>1 THEN RAISE EXCEPTION 'Duplicidade de jogador detectada para este usuário.';ELSIF v_player_count=1 THEN v_has_player:=true;SELECT j.id INTO v_player_id FROM public.jogadores j WHERE j.user_id=v_user_id;END IF;
  IF v_has_player THEN
    SELECT count(*) INTO v_active_offers FROM public.player_offers WHERE player_id=v_player_id AND offer_type='initial' AND status IN('new','reviewed','negotiating','countered','accepted');
    SELECT count(distinct po.club_id) INTO v_generated_offer_clubs FROM public.player_offers po JOIN public.base_clubs c ON c.id=po.club_id WHERE po.player_id=v_player_id AND po.offer_type='initial' AND po.status IN('new','reviewed','negotiating','countered','accepted') AND c.club_level='academy' AND c.squad_level='base';
    SELECT EXISTS(SELECT 1 FROM public.player_contracts WHERE player_id=v_player_id AND status='active') INTO v_contract_signed;
    SELECT coalesce(pcs.onboarding_completed,false) INTO v_onboarding_completed FROM public.player_career_state pcs WHERE pcs.player_id=v_player_id;
    v_onboarding_completed:=coalesce(v_onboarding_completed,false);
    v_offers_generated:=v_contract_signed OR v_onboarding_completed OR v_active_offers>0;
  END IF;
  RETURN jsonb_build_object('has_player',v_has_player,'offers_generated',v_offers_generated,'generated_offer_clubs',v_generated_offer_clubs,'expected_offer_clubs',5,'active_offers',v_active_offers,'contract_signed',v_contract_signed,'onboarding_completed',v_onboarding_completed);
END
$function$
;

REVOKE EXECUTE ON FUNCTION public.get_career_onboarding_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_career_onboarding_state() TO authenticated;

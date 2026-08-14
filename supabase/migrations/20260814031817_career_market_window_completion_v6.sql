CREATE OR REPLACE FUNCTION public.review_career_offer_expiry()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_player uuid;
  v_date date;
  v_count int;
BEGIN
  SELECT j.id,st.career_date INTO v_player,v_date
  FROM public.jogadores j
  JOIN public.player_career_state st ON st.player_id=j.id
  WHERE j.user_id=auth.uid();
  IF v_player IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;

  UPDATE public.player_offers po
  SET effective_on=CASE
    WHEN po.offer_type='professional_transfer' OR po.target_squad_level='first_team'
      THEN private.career_next_registration_date(v_date)
    WHEN po.offer_type='academy_transfer'
      THEN v_date
    ELSE po.effective_on
  END
  WHERE po.player_id=v_player
    AND po.offer_type IN('academy_transfer','professional_transfer')
    AND po.status IN('new','reviewed','negotiating','countered');

  UPDATE public.player_offers
  SET status='expired'
  WHERE player_id=v_player
    AND offer_type<>'initial'
    AND status IN('new','reviewed','negotiating','countered')
    AND career_expires_on<v_date;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END
$function$;

CREATE OR REPLACE FUNCTION public.accept_career_market_offer(p_offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_offer record;
  v_player uuid;
  v_date date;
  v_effective date;
  v_pending uuid;
BEGIN
  SELECT po.*,j.id player_key INTO v_offer
  FROM public.player_offers po
  JOIN public.jogadores j ON j.id=po.player_id
  WHERE po.id=p_offer_id AND j.user_id=auth.uid() AND po.offer_type<>'initial'
  FOR UPDATE OF po;
  IF v_offer.id IS NULL THEN RAISE EXCEPTION 'Proposta não encontrada.'; END IF;
  IF v_offer.status NOT IN('new','reviewed','negotiating','countered') THEN RAISE EXCEPTION 'Proposta indisponível.'; END IF;

  v_player:=v_offer.player_key;
  PERFORM private.career_validate_transfer_offer_lineage(v_offer.id,v_player);

  SELECT career_date INTO v_date
  FROM public.player_career_state
  WHERE player_id=v_player;
  IF v_date IS NULL THEN RAISE EXCEPTION 'Data da carreira indisponível.'; END IF;

  IF v_offer.offer_type IN('academy_transfer','professional_transfer') THEN
    IF v_offer.offer_type='professional_transfer' OR coalesce(v_offer.target_squad_level,'')='first_team' THEN
      v_effective:=private.career_next_registration_date(v_date);
    ELSE
      v_effective:=v_date;
    END IF;

    UPDATE public.player_offers SET effective_on=v_effective WHERE id=v_offer.id;

    IF v_effective>v_date THEN
      INSERT INTO public.player_transfer_agreements(
        player_id,offer_id,source_club_id,target_contract_club_id,target_squad_level,
        agreed_on,effective_on,transfer_fee,status,metadata
      )
      VALUES(
        v_player,v_offer.id,v_offer.source_club_id,v_offer.club_id,
        coalesce(v_offer.target_squad_level,'first_team'),v_date,v_effective,
        coalesce(v_offer.transfer_fee,0),'pending',
        jsonb_build_object('offer_type',v_offer.offer_type,'transfer_bid_id',v_offer.snapshot_data->>'transfer_bid_id','window_recalculated_on_signing',true)
      ) RETURNING id INTO v_pending;

      UPDATE public.player_offers SET status='accepted' WHERE id=v_offer.id;
      UPDATE public.player_offers SET status='withdrawn'
      WHERE player_id=v_player AND id<>v_offer.id AND offer_type<>'initial'
        AND status IN('new','reviewed','negotiating','countered');

      INSERT INTO public.player_messages(player_id,club_id,offer_id,message_type,subject,body,metadata)
      VALUES(v_player,v_offer.club_id,v_offer.id,'career','Acordo assinado — aguardando registro',
        'Você acertou com o novo clube. Até a próxima janela válida de registro, sua rotina e seus jogos continuam normalmente na equipe atual.',
        jsonb_build_object('kind','market_move_pending','effective_on',v_effective,'offer_id',v_offer.id));
      RETURN jsonb_build_object('status','pending_registration','effective_on',v_effective,'agreement_id',v_pending);
    END IF;
  END IF;

  PERFORM private.career_apply_market_offer(v_player,v_offer.id,v_date);
  RETURN jsonb_build_object('status','completed','effective_on',v_date);
END
$function$;

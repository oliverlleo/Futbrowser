CREATE OR REPLACE FUNCTION private.after_career_offer_history_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_offer record;
  v_subject text;
  v_body text;
BEGIN
  SELECT po.* INTO v_offer
  FROM public.player_offers po
  WHERE po.id=NEW.offer_id;

  IF v_offer.id IS NULL
     OR v_offer.offer_type NOT IN('academy_transfer','professional_transfer','professional_promotion') THEN
    RETURN NEW;
  END IF;

  v_subject:=CASE NEW.response_action
    WHEN 'accepted' THEN 'Contraproposta aceita — revise e assine'
    WHEN 'countered' THEN 'O clube respondeu à sua contraproposta'
    WHEN 'withdrawn' THEN 'Negociação encerrada'
    ELSE 'Atualização da negociação'
  END;

  v_body:=CASE NEW.response_action
    WHEN 'accepted' THEN 'O clube aceitou os termos que você pediu. Revise o contrato final antes de assinar.'
    WHEN 'countered' THEN 'A diretoria não aceitou todos os seus termos e enviou uma contraproposta. Compare as condições antes de decidir se negocia novamente ou assina.'
    WHEN 'withdrawn' THEN 'A diretoria encerrou as conversas após a última rodada. Esta proposta não pode mais ser assinada.'
    ELSE 'Há uma nova resposta do clube sobre sua negociação contratual.'
  END;

  INSERT INTO public.player_messages(
    player_id,club_id,offer_id,message_type,subject,body,metadata
  ) VALUES(
    v_offer.player_id,
    v_offer.club_id,
    v_offer.id,
    'negotiation_response',
    v_subject,
    v_body,
    jsonb_build_object(
      'kind','career_market_negotiation_response',
      'offer_id',v_offer.id,
      'offer_type',v_offer.offer_type,
      'round',NEW.round,
      'response_action',NEW.response_action,
      'requested_terms',coalesce(NEW.requested_terms,'{}'::jsonb),
      'club_response_terms',coalesce(NEW.club_response_terms,'{}'::jsonb),
      'previous_terms',coalesce(NEW.previous_terms,'{}'::jsonb)
    )
  );

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_after_career_offer_history_message ON public.player_offer_history;
CREATE TRIGGER trg_after_career_offer_history_message
AFTER INSERT ON public.player_offer_history
FOR EACH ROW
EXECUTE FUNCTION private.after_career_offer_history_message();

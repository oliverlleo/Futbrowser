BEGIN;

CREATE TABLE IF NOT EXISTS public.player_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,
  offer_id UUID REFERENCES public.player_offers(id) ON DELETE CASCADE,
  club_id UUID REFERENCES public.base_clubs(id) ON DELETE SET NULL,
  source_history_id UUID UNIQUE REFERENCES public.player_offer_history(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL DEFAULT 'system' CHECK (message_type IN ('negotiation_response','offer','system')),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_messages_player_created
  ON public.player_messages(player_id, created_at DESC);

ALTER TABLE public.player_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS player_messages_select_own ON public.player_messages;
CREATE POLICY player_messages_select_own
  ON public.player_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.jogadores j
      WHERE j.id = player_messages.player_id
        AND j.user_id = (SELECT auth.uid())
    )
  );

REVOKE ALL ON TABLE public.player_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.player_messages TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_player_message_read(p_message_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_updated INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  UPDATE public.player_messages pm
  SET is_read = TRUE
  FROM public.jogadores j
  WHERE pm.id = p_message_id
    AND j.id = pm.player_id
    AND j.user_id = v_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_player_message_read(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_player_message_read(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_negotiation_response_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_offer public.player_offers%ROWTYPE;
  v_club_name TEXT;
  v_subject TEXT;
  v_body TEXT;
BEGIN
  SELECT * INTO v_offer
  FROM public.player_offers
  WHERE id = NEW.offer_id;

  IF v_offer.id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_club_name
  FROM public.base_clubs
  WHERE id = v_offer.club_id;

  v_club_name := COALESCE(v_club_name, 'Clube');

  v_subject := CASE NEW.response_action
    WHEN 'accepted' THEN v_club_name || ' aceitou seus termos'
    WHEN 'withdrawn' THEN v_club_name || ' encerrou a negociação'
    ELSE 'Contraproposta do ' || v_club_name
  END;

  v_body := CASE NEW.response_action
    WHEN 'accepted' THEN
      'A diretoria analisou sua contraproposta e aceitou os termos. A proposta atual já reflete o acordo; revise os valores e assine o contrato para concluir.'
    WHEN 'withdrawn' THEN
      'A diretoria considerou as exigências acima do limite do clube e decidiu encerrar as negociações desta proposta.'
    ELSE
      'A diretoria analisou sua contraproposta. O clube ainda quer contar com você, mas não aceitou todos os termos. Uma nova condição foi enviada e ainda existe margem para continuar negociando.'
  END;

  INSERT INTO public.player_messages (
    player_id, offer_id, club_id, source_history_id, message_type,
    subject, body, metadata, is_read, created_at
  ) VALUES (
    v_offer.player_id,
    v_offer.id,
    v_offer.club_id,
    NEW.id,
    'negotiation_response',
    v_subject,
    v_body,
    jsonb_build_object(
      'round', NEW.round,
      'response_action', NEW.response_action,
      'requested_terms', COALESCE(NEW.requested_terms, '{}'::JSONB),
      'response_terms', COALESCE(NEW.club_response_terms, '{}'::JSONB),
      'negotiation_cost', NEW.negotiation_cost,
      'remaining_flexibility', NEW.remaining_flexibility
    ),
    FALSE,
    COALESCE(NEW.created_at, NOW())
  )
  ON CONFLICT (source_history_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_negotiation_response_email() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_negotiation_response_email ON public.player_offer_history;
CREATE TRIGGER trg_negotiation_response_email
AFTER INSERT ON public.player_offer_history
FOR EACH ROW
EXECUTE FUNCTION public.create_negotiation_response_email();

INSERT INTO public.player_messages (
  player_id, offer_id, club_id, source_history_id, message_type,
  subject, body, metadata, is_read, created_at
)
SELECT
  po.player_id,
  po.id,
  po.club_id,
  poh.id,
  'negotiation_response',
  CASE poh.response_action
    WHEN 'accepted' THEN c.name || ' aceitou seus termos'
    WHEN 'withdrawn' THEN c.name || ' encerrou a negociação'
    ELSE 'Contraproposta do ' || c.name
  END,
  CASE poh.response_action
    WHEN 'accepted' THEN 'A diretoria analisou sua contraproposta e aceitou os termos. A proposta atual já reflete o acordo; revise os valores e assine o contrato para concluir.'
    WHEN 'withdrawn' THEN 'A diretoria considerou as exigências acima do limite do clube e decidiu encerrar as negociações desta proposta.'
    ELSE 'A diretoria analisou sua contraproposta. O clube ainda quer contar com você, mas não aceitou todos os termos. Uma nova condição foi enviada e ainda existe margem para continuar negociando.'
  END,
  jsonb_build_object(
    'round', poh.round,
    'response_action', poh.response_action,
    'requested_terms', COALESCE(poh.requested_terms, '{}'::JSONB),
    'response_terms', COALESCE(poh.club_response_terms, '{}'::JSONB),
    'negotiation_cost', poh.negotiation_cost,
    'remaining_flexibility', poh.remaining_flexibility
  ),
  FALSE,
  poh.created_at
FROM public.player_offer_history poh
JOIN public.player_offers po ON po.id = poh.offer_id
JOIN public.base_clubs c ON c.id = po.club_id
ON CONFLICT (source_history_id) DO NOTHING;

COMMIT;

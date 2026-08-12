CREATE OR REPLACE FUNCTION private.send_contract_welcome_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_club_name text;
  v_coach_name text;
  v_player_name text;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT c.name, co.name
    INTO v_club_name, v_coach_name
  FROM public.base_clubs c
  LEFT JOIN public.base_coaches co ON co.id = c.coach_id
  WHERE c.id = NEW.club_id;

  SELECT COALESCE(NULLIF(j.apelido, ''), j.nome)
    INTO v_player_name
  FROM public.jogadores j
  WHERE j.id = NEW.player_id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.player_messages pm
    WHERE pm.player_id = NEW.player_id
      AND pm.message_type = 'career'
      AND pm.metadata->>'event' = 'club_welcome'
      AND pm.metadata->>'contract_id' = NEW.id::text
  ) THEN
    INSERT INTO public.player_messages (
      player_id, club_id, message_type, subject, body, metadata, is_read
    ) VALUES (
      NEW.player_id,
      NEW.club_id,
      'career',
      'Bem-vindo ao ' || COALESCE(v_club_name, 'clube'),
      'Olá, ' || COALESCE(v_player_name, 'jogador') || '. Seu contrato está assinado e agora você faz parte do nosso elenco. '
        || CASE WHEN v_coach_name IS NOT NULL THEN 'O treinador ' || v_coach_name || ' já foi informado da sua chegada. ' ELSE '' END
        || 'Sua rotina começa no centro de treinamento. Observe o ambiente, cuide da sua preparação e conquiste seu espaço dentro do grupo.',
      jsonb_build_object(
        'event', 'club_welcome',
        'contract_id', NEW.id,
        'squad_role', NEW.squad_role,
        'monthly_wage', NEW.monthly_wage,
        'coach_name', v_coach_name
      ),
      false
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_send_contract_welcome_message ON public.player_contracts;
CREATE TRIGGER trg_send_contract_welcome_message
AFTER INSERT OR UPDATE OF status ON public.player_contracts
FOR EACH ROW
WHEN (NEW.status = 'active')
EXECUTE FUNCTION private.send_contract_welcome_message();

INSERT INTO public.player_messages (player_id, club_id, message_type, subject, body, metadata, is_read)
SELECT
  pc.player_id,
  pc.club_id,
  'career',
  'Bem-vindo ao ' || bc.name,
  'Olá, ' || COALESCE(NULLIF(j.apelido, ''), j.nome) || '. Seu contrato está assinado e agora você faz parte do nosso elenco. '
    || CASE WHEN co.name IS NOT NULL THEN 'O treinador ' || co.name || ' já foi informado da sua chegada. ' ELSE '' END
    || 'Sua rotina começa no centro de treinamento. Observe o ambiente, cuide da sua preparação e conquiste seu espaço dentro do grupo.',
  jsonb_build_object(
    'event', 'club_welcome',
    'contract_id', pc.id,
    'squad_role', pc.squad_role,
    'monthly_wage', pc.monthly_wage,
    'coach_name', co.name
  ),
  false
FROM public.player_contracts pc
JOIN public.jogadores j ON j.id = pc.player_id
JOIN public.base_clubs bc ON bc.id = pc.club_id
LEFT JOIN public.base_coaches co ON co.id = bc.coach_id
WHERE pc.status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM public.player_messages pm
    WHERE pm.player_id = pc.player_id
      AND pm.message_type = 'career'
      AND pm.metadata->>'event' = 'club_welcome'
      AND pm.metadata->>'contract_id' = pc.id::text
  );

REVOKE ALL ON FUNCTION private.send_contract_welcome_message() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.player_messages
  DROP CONSTRAINT IF EXISTS player_messages_message_type_check;

ALTER TABLE public.player_messages
  ADD CONSTRAINT player_messages_message_type_check
  CHECK (message_type IN ('negotiation_response','offer','system','career'));

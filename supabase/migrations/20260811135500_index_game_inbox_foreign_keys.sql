BEGIN;
CREATE INDEX IF NOT EXISTS idx_player_messages_offer_id ON public.player_messages(offer_id);
CREATE INDEX IF NOT EXISTS idx_player_messages_club_id ON public.player_messages(club_id);
COMMIT;

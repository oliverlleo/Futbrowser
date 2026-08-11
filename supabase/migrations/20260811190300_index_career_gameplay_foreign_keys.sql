CREATE INDEX IF NOT EXISTS idx_career_squad_availability_ai_player ON private.career_squad_availability(ai_player_id);
CREATE INDEX IF NOT EXISTS idx_player_match_selections_club ON public.player_match_selections(club_id);
CREATE INDEX IF NOT EXISTS idx_player_teammate_relations_teammate ON public.player_teammate_relations(teammate_id);

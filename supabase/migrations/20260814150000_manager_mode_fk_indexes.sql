CREATE INDEX IF NOT EXISTS idx_manager_squad_base_player ON public.manager_squad_state(base_player_id);
CREATE INDEX IF NOT EXISTS idx_manager_squad_club ON public.manager_squad_state(club_id);

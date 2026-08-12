-- Futbrowser — endurecimento de segurança e performance
-- Data: 2026-08-11

CREATE INDEX IF NOT EXISTS idx_jogadores_user_id ON public.jogadores(user_id);
CREATE INDEX IF NOT EXISTS idx_player_career_state_club_id ON public.player_career_state(club_id);
CREATE INDEX IF NOT EXISTS idx_player_career_state_coach_id ON public.player_career_state(coach_id);
CREATE INDEX IF NOT EXISTS idx_player_contracts_club_id ON public.player_contracts(club_id);

DROP POLICY IF EXISTS "Usuários podem ver seus próprios dados" ON public.usuarios;
CREATE POLICY "Usuários podem ver seus próprios dados"
ON public.usuarios FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios dados" ON public.usuarios;
CREATE POLICY "Usuários podem atualizar seus próprios dados"
ON public.usuarios FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = id)
WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Usuários podem ver seus próprios jogadores" ON public.jogadores;
CREATE POLICY "Usuários podem ver seus próprios jogadores"
ON public.jogadores FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.base_academy_profiles FROM anon, authenticated;
REVOKE ALL ON TABLE public.base_ai_players FROM anon, authenticated;
REVOKE ALL ON TABLE public.base_clubs FROM anon, authenticated;
REVOKE ALL ON TABLE public.base_coaches FROM anon, authenticated;
GRANT SELECT ON TABLE public.base_academy_profiles TO authenticated;
GRANT SELECT ON TABLE public.base_ai_players TO authenticated;
GRANT SELECT ON TABLE public.base_clubs TO authenticated;
GRANT SELECT ON TABLE public.base_coaches TO authenticated;

REVOKE ALL ON TABLE public.player_offers FROM anon, authenticated;
REVOKE ALL ON TABLE public.player_offer_history FROM anon, authenticated;
REVOKE ALL ON TABLE public.player_contracts FROM anon, authenticated;
REVOKE ALL ON TABLE public.player_career_state FROM anon, authenticated;
GRANT SELECT ON TABLE public.player_offers TO authenticated;
GRANT SELECT ON TABLE public.player_offer_history TO authenticated;
GRANT SELECT ON TABLE public.player_contracts TO authenticated;
GRANT SELECT ON TABLE public.player_career_state TO authenticated;

REVOKE ALL ON TABLE public.usuarios FROM anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.usuarios TO authenticated;

REVOKE ALL ON TABLE public.jogadores FROM anon, authenticated;
GRANT SELECT ON TABLE public.jogadores TO authenticated;

ALTER FUNCTION public.calculate_player_attributes(text,text,text,text) SET search_path = public, pg_temp;
ALTER FUNCTION public.distribute_points(integer, public.attribute_weight[]) SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_player_ovr(jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.is_player_owner(uuid) SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.secure_player_attributes() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.accept_offer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_offer(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_player(text,text,text,text,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_player(text,text,text,text,text,text,text,text,text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_initial_offers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_initial_offers() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_career_onboarding_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_career_onboarding_state() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_offer_details(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_offer_details(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_player_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_player_owner(uuid) TO authenticated;

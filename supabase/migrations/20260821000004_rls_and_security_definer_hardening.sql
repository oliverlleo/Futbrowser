-- Endurecimento das tabelas públicas identificadas pelo advisor.
ALTER TABLE public.competition_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_sponsor_performance_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS competition_definitions_read_active ON public.competition_definitions;
CREATE POLICY competition_definitions_read_active
  ON public.competition_definitions
  FOR SELECT TO authenticated
  USING (is_active IS TRUE);

DROP POLICY IF EXISTS sponsor_performance_rewards_read_owner ON public.player_sponsor_performance_rewards;
CREATE POLICY sponsor_performance_rewards_read_owner
  ON public.player_sponsor_performance_rewards
  FOR SELECT TO authenticated
  USING (is_player_owner(player_id));

REVOKE INSERT, UPDATE, DELETE
  ON public.competition_definitions, public.player_sponsor_performance_rewards
  FROM anon, authenticated;

-- Nenhuma rotina de manutenção deve ser invocável por cliente anônimo ou autenticado.
REVOKE EXECUTE ON FUNCTION public.review_career_club_bids() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.review_career_market_interest() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.review_career_market_interest_core() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.review_career_offer_expiry() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.review_career_pending_move() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.review_career_promotion() FROM PUBLIC, anon, authenticated;

-- Funções de ação permanecem disponíveis somente para usuários autenticados.
REVOKE EXECUTE ON FUNCTION public.accept_career_market_offer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_career_market_offer(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_career_sponsor_deliverable(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_career_sponsor_deliverable(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_career_market_offer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_career_market_offer(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.respond_career_sponsor_proposal(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_career_sponsor_proposal(uuid, text, uuid) TO authenticated;

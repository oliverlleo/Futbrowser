BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'usuarios_caminho_domain_check'
      AND conrelid = 'public.usuarios'::regclass
  ) THEN
    ALTER TABLE public.usuarios
      ADD CONSTRAINT usuarios_caminho_domain_check
      CHECK (caminho IS NULL OR caminho IN ('jogador', 'manager', 'tecnico', 'presidente'));
  END IF;
END;
$$;

ALTER TABLE public.competition_definitions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.competition_definitions FROM anon, public;
GRANT SELECT ON TABLE public.competition_definitions TO authenticated;
DROP POLICY IF EXISTS competition_definitions_authenticated_select ON public.competition_definitions;
CREATE POLICY competition_definitions_authenticated_select
  ON public.competition_definitions
  FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE public.player_sponsor_performance_rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.player_sponsor_performance_rewards FROM anon, public;
GRANT SELECT ON TABLE public.player_sponsor_performance_rewards TO authenticated;
DROP POLICY IF EXISTS player_sponsor_performance_rewards_owner_select ON public.player_sponsor_performance_rewards;
CREATE POLICY player_sponsor_performance_rewards_owner_select
  ON public.player_sponsor_performance_rewards
  FOR SELECT
  TO authenticated
  USING (public.is_player_owner(player_id));

REVOKE ALL ON FUNCTION public.calculate_player_ovr(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_player_ovr(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.distribute_points(integer, public.attribute_weight[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.distribute_points(integer, public.attribute_weight[]) TO authenticated;

COMMIT;

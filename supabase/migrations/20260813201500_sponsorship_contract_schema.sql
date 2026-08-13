-- Futbrowser: fictional career-mode sponsorship economy only.
BEGIN;

ALTER TABLE private.career_sponsor_brand_catalog
  ADD COLUMN IF NOT EXISTS tier smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'sportswear',
  ADD COLUMN IF NOT EXISTS min_club_reputation integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contract_weight numeric(5,2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS campaign_weight numeric(5,2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_weekly_deliveries integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS exclusivity_default boolean NOT NULL DEFAULT false;

ALTER TABLE public.player_sponsor_opportunities
  ADD COLUMN IF NOT EXISTS offer_kind text NOT NULL DEFAULT 'campaign',
  ADD COLUMN IF NOT EXISTS brand_tier smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS contract_days integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS monthly_fee integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signing_bonus integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS per_delivery_fee integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_weekly_deliveries integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS exclusivity_category text,
  ADD COLUMN IF NOT EXISTS termination_penalty integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS missed_delivery_penalty integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS response_deadline date,
  ADD COLUMN IF NOT EXISTS negotiation_round integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS message_id uuid,
  ADD COLUMN IF NOT EXISTS terms jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.player_sponsor_opportunities SET status='expired' WHERE status='available';

CREATE TABLE IF NOT EXISTS public.player_sponsor_contracts(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES public.player_sponsor_opportunities(id) ON DELETE SET NULL,
  brand text NOT NULL,
  brand_tier smallint NOT NULL DEFAULT 1,
  brand_profile text,
  category text NOT NULL,
  contract_kind text NOT NULL CHECK(contract_kind IN('main','campaign')),
  started_on date NOT NULL,
  ends_on date NOT NULL,
  monthly_fee integer NOT NULL DEFAULT 0,
  per_delivery_fee integer NOT NULL DEFAULT 0,
  signing_bonus integer NOT NULL DEFAULT 0,
  max_weekly_deliveries integer NOT NULL DEFAULT 1 CHECK(max_weekly_deliveries BETWEEN 1 AND 3),
  exclusivity boolean NOT NULL DEFAULT false,
  exclusivity_category text,
  termination_penalty integer NOT NULL DEFAULT 0,
  missed_delivery_penalty integer NOT NULL DEFAULT 0,
  trust integer NOT NULL DEFAULT 75 CHECK(trust BETWEEN 0 AND 100),
  strikes integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK(status IN('active','completed','terminated')),
  last_payment_on date,
  total_earned integer NOT NULL DEFAULT 0,
  total_penalties integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sponsor_contracts_player_status ON public.player_sponsor_contracts(player_id,status,ends_on);

CREATE TABLE IF NOT EXISTS public.player_sponsor_deliverables(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.player_sponsor_contracts(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,
  brand text NOT NULL,
  week_start date NOT NULL,
  sequence_no smallint NOT NULL,
  deliverable_kind text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  assigned_on date NOT NULL,
  due_on date NOT NULL,
  scheduled_on date,
  scheduled_period smallint CHECK(scheduled_period IS NULL OR scheduled_period BETWEEN 0 AND 2),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','completed','missed','cancelled')),
  payout integer NOT NULL DEFAULT 0,
  penalty integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  resolved_on date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contract_id,week_start,sequence_no)
);
CREATE INDEX IF NOT EXISTS idx_sponsor_deliverables_player_status ON public.player_sponsor_deliverables(player_id,status,due_on,scheduled_on);

CREATE TABLE IF NOT EXISTS public.player_sponsor_transactions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.player_sponsor_contracts(id) ON DELETE SET NULL,
  deliverable_id uuid REFERENCES public.player_sponsor_deliverables(id) ON DELETE SET NULL,
  tx_type text NOT NULL,
  amount integer NOT NULL,
  career_date date NOT NULL,
  description text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sponsor_transactions_player_date ON public.player_sponsor_transactions(player_id,career_date DESC,created_at DESC);

ALTER TABLE public.player_sponsor_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_sponsor_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_sponsor_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sponsor_contracts_select_own ON public.player_sponsor_contracts;
CREATE POLICY sponsor_contracts_select_own ON public.player_sponsor_contracts FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.jogadores j WHERE j.id=player_id AND j.user_id=auth.uid()));
DROP POLICY IF EXISTS sponsor_deliverables_select_own ON public.player_sponsor_deliverables;
CREATE POLICY sponsor_deliverables_select_own ON public.player_sponsor_deliverables FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.jogadores j WHERE j.id=player_id AND j.user_id=auth.uid()));
DROP POLICY IF EXISTS sponsor_transactions_select_own ON public.player_sponsor_transactions;
CREATE POLICY sponsor_transactions_select_own ON public.player_sponsor_transactions FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.jogadores j WHERE j.id=player_id AND j.user_id=auth.uid()));

COMMIT;

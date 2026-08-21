BEGIN;

ALTER TABLE public.player_offers ADD COLUMN IF NOT EXISTS offer_type text NOT NULL DEFAULT 'initial';
ALTER TABLE public.player_offers ADD COLUMN IF NOT EXISTS source_club_id uuid REFERENCES public.base_clubs(id) ON DELETE SET NULL;
ALTER TABLE public.player_offers ADD COLUMN IF NOT EXISTS target_squad_level text;
ALTER TABLE public.player_offers ADD COLUMN IF NOT EXISTS effective_on date;
ALTER TABLE public.player_offers ADD COLUMN IF NOT EXISTS transfer_fee integer NOT NULL DEFAULT 0;
ALTER TABLE public.player_offers ADD COLUMN IF NOT EXISTS generated_reason text;
ALTER TABLE public.player_offers ADD COLUMN IF NOT EXISTS window_code text;

DO $$ BEGIN
  ALTER TABLE public.player_offers ADD CONSTRAINT player_offers_offer_type_check CHECK(offer_type IN ('initial','academy_transfer','professional_transfer','professional_promotion'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.player_offers ADD CONSTRAINT player_offers_target_squad_check CHECK(target_squad_level IS NULL OR target_squad_level IN ('base','u15','u17','u18','u20','first_team'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.player_contracts ADD COLUMN IF NOT EXISTS contract_kind text;
ALTER TABLE public.player_contracts ADD COLUMN IF NOT EXISTS starts_on date;
ALTER TABLE public.player_contracts ADD COLUMN IF NOT EXISTS ends_on date;
ALTER TABLE public.player_contracts ADD COLUMN IF NOT EXISTS source_offer_id uuid REFERENCES public.player_offers(id) ON DELETE SET NULL;

UPDATE public.player_contracts pc
SET contract_kind=COALESCE(contract_kind,CASE WHEN c.club_level='professional' THEN 'professional' ELSE 'academy' END),
    starts_on=COALESCE(starts_on,pc.signed_at::date),
    ends_on=COALESCE(ends_on,(pc.signed_at::date+(pc.duration_seasons||' years')::interval)::date)
FROM public.base_clubs c
WHERE c.id=pc.club_id;

DO $$ BEGIN
  ALTER TABLE public.player_contracts ADD CONSTRAINT player_contracts_kind_check CHECK(contract_kind IS NULL OR contract_kind IN ('academy','professional'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.player_transfer_agreements(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 player_id uuid NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,
 offer_id uuid NOT NULL UNIQUE REFERENCES public.player_offers(id) ON DELETE CASCADE,
 source_club_id uuid REFERENCES public.base_clubs(id) ON DELETE SET NULL,
 target_contract_club_id uuid NOT NULL REFERENCES public.base_clubs(id) ON DELETE RESTRICT,
 target_squad_level text NOT NULL CHECK(target_squad_level IN ('base','u15','u17','u18','u20','first_team')),
 agreed_on date NOT NULL,
 effective_on date NOT NULL,
 transfer_fee integer NOT NULL DEFAULT 0 CHECK(transfer_fee>=0),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','cancelled')),
 completed_at timestamptz,
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.player_market_state(
 player_id uuid PRIMARY KEY REFERENCES public.jogadores(id) ON DELETE CASCADE,
 last_interest_check date,
 last_offer_date date,
 last_promotion_review date,
 last_promotion_date date,
 market_reputation integer NOT NULL DEFAULT 50 CHECK(market_reputation BETWEEN 0 AND 100),
 updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.player_promotion_reviews(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 player_id uuid NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,
 reviewed_on date NOT NULL,
 from_squad text,
 recommended_squad text,
 score integer NOT NULL CHECK(score BETWEEN 0 AND 100),
 outcome text NOT NULL CHECK(outcome IN ('stay','promoted','professional_offer','age_transition')),
 snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(player_id,reviewed_on)
);

ALTER TABLE public.player_transfer_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_market_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_promotion_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transfer_agreements_read_own ON public.player_transfer_agreements;
CREATE POLICY transfer_agreements_read_own ON public.player_transfer_agreements FOR SELECT USING(EXISTS(SELECT 1 FROM public.jogadores j WHERE j.id=player_id AND j.user_id=auth.uid()));
DROP POLICY IF EXISTS market_state_read_own ON public.player_market_state;
CREATE POLICY market_state_read_own ON public.player_market_state FOR SELECT USING(EXISTS(SELECT 1 FROM public.jogadores j WHERE j.id=player_id AND j.user_id=auth.uid()));
DROP POLICY IF EXISTS promotion_reviews_read_own ON public.player_promotion_reviews;
CREATE POLICY promotion_reviews_read_own ON public.player_promotion_reviews FOR SELECT USING(EXISTS(SELECT 1 FROM public.jogadores j WHERE j.id=player_id AND j.user_id=auth.uid()));

CREATE OR REPLACE FUNCTION private.career_transfer_window_status(p_date date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE y int:=extract(year FROM p_date)::int; w1s date;w1e date;w2s date;w2e date;open_now boolean;code text;next_open date;days_to int;
BEGIN
 w1s:=make_date(y,1,5);w1e:=make_date(y,3,3);w2s:=make_date(y,7,20);w2e:=make_date(y,9,11);
 IF p_date BETWEEN w1s AND w1e THEN open_now:=true;code:='JAN_MAR';next_open:=p_date;
 ELSIF p_date BETWEEN w2s AND w2e THEN open_now:=true;code:='JUL_SEP';next_open:=p_date;
 ELSIF p_date<w1s THEN open_now:=false;code:='CLOSED';next_open:=w1s;
 ELSIF p_date<w2s THEN open_now:=false;code:='CLOSED';next_open:=w2s;
 ELSE open_now:=false;code:='CLOSED';next_open:=make_date(y+1,1,5);END IF;
 days_to:=GREATEST(0,next_open-p_date);
 RETURN jsonb_build_object('is_open',open_now,'code',code,'date',p_date,'first_window',jsonb_build_object('starts_on',w1s,'ends_on',w1e),'second_window',jsonb_build_object('starts_on',w2s,'ends_on',w2e),'next_open',next_open,'days_to_next',days_to);
END $$;

CREATE OR REPLACE FUNCTION private.career_next_registration_date(p_date date)
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT ((private.career_transfer_window_status(p_date))->>'next_open')::date
$$;

COMMIT;

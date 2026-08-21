-- Canonical reproducible sponsorship state for the live migrations
-- sponsorship_schema_live_v3 + sponsorship_full_gameplay_v5 + later refinements.
-- IMPORTANT: missed-delivery penalties are tracked contractually and through
-- trust/strikes/reputation. This migration does not directly subtract a missed
-- delivery fine from the player's current cash balance.
BEGIN;

ALTER TABLE public.player_sponsor_opportunities
  ADD COLUMN IF NOT EXISTS offer_kind text NOT NULL DEFAULT 'campaign',
  ADD COLUMN IF NOT EXISTS brand_tier smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS contract_days integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS monthly_fee integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signing_bonus integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS per_delivery_fee integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_weekly_deliveries integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS exclusivity_category text,
  ADD COLUMN IF NOT EXISTS response_deadline date,
  ADD COLUMN IF NOT EXISTS negotiation_round integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS message_id uuid,
  ADD COLUMN IF NOT EXISTS terms jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid='public.player_sponsor_opportunities'::regclass
      AND contype='c' AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP EXECUTE format('ALTER TABLE public.player_sponsor_opportunities DROP CONSTRAINT %I',r.conname); END LOOP;
END $$;
ALTER TABLE public.player_sponsor_opportunities
  ADD CONSTRAINT player_sponsor_opportunities_status_check
  CHECK(status IN('proposed','available','declined','completed','expired'));

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

CREATE TABLE IF NOT EXISTS public.player_sponsor_performance_rewards(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.player_sponsor_contracts(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,
  match_history_id uuid NOT NULL REFERENCES public.player_match_history(id) ON DELETE CASCADE,
  amount integer NOT NULL DEFAULT 0 CHECK(amount>=0),
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contract_id,match_history_id)
);

CREATE INDEX IF NOT EXISTS idx_sponsor_contract_player ON public.player_sponsor_contracts(player_id,status,ends_on);
CREATE INDEX IF NOT EXISTS idx_sponsor_delivery_player ON public.player_sponsor_deliverables(player_id,status,due_on);
CREATE INDEX IF NOT EXISTS idx_sponsor_performance_player ON public.player_sponsor_performance_rewards(player_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_player_sponsor_exclusive_category
  ON public.player_sponsor_contracts(player_id,exclusivity_category)
  WHERE status='active' AND exclusivity=true AND exclusivity_category IS NOT NULL;

ALTER TABLE private.career_sponsor_brand_catalog
  ADD COLUMN IF NOT EXISTS tier smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS min_club_reputation integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_weekly_deliveries integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS exclusivity_default boolean NOT NULL DEFAULT false;

INSERT INTO private.career_sponsor_brand_catalog(
  brand,profile,profile_label,base_reward,reward_multiplier,min_fame,min_fanbase,min_image,min_form,min_discipline,exposure_risk,description,tier,category,min_club_reputation,max_weekly_deliveries,exclusivity_default
) VALUES
('Linha de Fundo','community','Comunidade',260,1.00,3,140,52,42,40,1,'Prefere atletas acessíveis e conectados ao público local.',1,'sportswear',0,1,false),
('Arena+','community','Comunidade',300,1.05,4,180,55,45,42,1,'Investe em ações locais, torcida e presença em eventos.',1,'media',0,1,false),
('Oficina 12 Sports','performance','Desempenho',310,1.08,5,180,48,52,45,1,'Marca esportiva local focada em atletas em desenvolvimento.',1,'sportswear',0,1,false),
('Litoral Fit','wellness','Bem-estar',290,1.05,4,160,55,48,52,1,'Academia regional que busca atletas disciplinados e próximos da comunidade.',1,'fitness',0,1,false),
('Giro Local','community','Comunidade',280,1.04,3,150,50,44,42,1,'Aplicativo local de mobilidade que aposta em jovens do esporte.',1,'mobility',0,1,false),
('Estação 90','lifestyle','Estilo',300,1.07,5,190,50,46,43,1,'Rede local de alimentação e convivência ligada ao futebol de base.',1,'food',0,1,false),
('Norte Sports','performance','Desempenho',520,1.18,18,900,50,55,48,2,'Marca regional de material esportivo que procura evolução consistente.',2,'sportswear',4,1,false),
('Ritmo Nutrition','wellness','Bem-estar',540,1.20,20,1000,58,55,60,2,'Empresa regional de nutrição esportiva exigente com disciplina e imagem.',2,'nutrition',4,1,true),
('Costa Norte Bank','professional','Profissional',650,1.22,28,1500,60,50,55,2,'Banco regional que valoriza estabilidade, imagem pública e profissionalismo.',2,'finance',4,1,true),
('Placar One','media','Mídia',610,1.18,25,1300,52,55,48,2,'Plataforma esportiva regional que busca atletas em ascensão.',2,'media',4,1,false),
('Eleven Wear','performance','Desempenho',950,1.28,42,8000,58,62,55,3,'Marca nacional de vestuário esportivo com campanhas de desempenho.',3,'sportswear',5,2,true),
('Pulso Tech','technology','Tecnologia',980,1.30,45,10000,58,58,50,3,'Empresa nacional de tecnologia e wearables esportivos.',3,'technology',5,2,true),
('Movi+','lifestyle','Estilo',900,1.24,40,7000,60,55,50,3,'Plataforma nacional de mobilidade e estilo de vida.',3,'mobility',5,2,false),
('Atlas Gear','performance','Desempenho',1050,1.32,48,12000,60,63,58,3,'Fornecedor nacional de equipamentos para atletas de alto rendimento.',3,'sportswear',5,2,true),
('Nexo Play','media','Mídia',920,1.26,43,9000,55,58,50,3,'Serviço nacional de entretenimento esportivo e conteúdo digital.',3,'media',5,2,false),
('Sprint Mobile','technology','Tecnologia',1800,1.40,62,40000,65,62,58,4,'Operadora premium que trabalha com atletas de grande alcance nacional.',4,'technology',7,2,true),
('Vértice Energy','performance','Desempenho',1900,1.42,65,45000,62,66,60,4,'Marca premium de energia e performance com forte exposição.',4,'beverage',7,2,true),
('Prime Eleven','lifestyle','Estilo',2050,1.45,68,55000,68,62,60,4,'Marca premium de moda esportiva e campanhas de imagem.',4,'sportswear',7,2,true),
('Orbe Telecom','technology','Tecnologia',2100,1.44,70,65000,65,60,58,4,'Grupo de telecomunicações com campanhas de alcance nacional.',4,'technology',7,2,true),
('Apex World','global','Global',4200,1.65,80,150000,72,68,65,5,'Marca global que trabalha apenas com atletas de enorme alcance e clubes de elite.',5,'sportswear',8,3,true),
('NovaSphere','global','Global',4500,1.70,84,200000,75,70,68,5,'Empresa global de tecnologia e entretenimento com campanhas internacionais.',5,'technology',8,3,true)
ON CONFLICT(brand) DO UPDATE SET
  profile=excluded.profile,profile_label=excluded.profile_label,base_reward=excluded.base_reward,reward_multiplier=excluded.reward_multiplier,
  min_fame=excluded.min_fame,min_fanbase=excluded.min_fanbase,min_image=excluded.min_image,min_form=excluded.min_form,min_discipline=excluded.min_discipline,
  exposure_risk=excluded.exposure_risk,description=excluded.description,tier=excluded.tier,category=excluded.category,min_club_reputation=excluded.min_club_reputation,
  max_weekly_deliveries=excluded.max_weekly_deliveries,exclusivity_default=excluded.exclusivity_default;

CREATE OR REPLACE FUNCTION private.sponsor_tier_for_player(p_player_id uuid)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v record;c record;t int:=1;
BEGIN
  SELECT * INTO v FROM public.player_career_state WHERE player_id=p_player_id;
  SELECT * INTO c FROM public.base_clubs WHERE id=v.club_id;
  IF v.player_id IS NULL OR c.id IS NULL THEN RETURN 1;END IF;
  IF c.squad_level IN('base','u15','u17') THEN RETURN 1;END IF;
  IF c.squad_level='u18' THEN RETURN CASE WHEN coalesce(c.reputation,0)>=4 AND coalesce(v.fame,0)>=30 AND coalesce(v.fanbase,0)>=1200 THEN 2 ELSE 1 END;END IF;
  IF c.squad_level='u20' THEN RETURN CASE WHEN coalesce(c.reputation,0)>=4 AND coalesce(v.fame,0)>=28 THEN 2 ELSE 1 END;END IF;
  IF c.squad_level<>'first_team' THEN RETURN 1;END IF;
  t:=CASE WHEN coalesce(c.reputation,0)<=3 OR coalesce(c.division_level,4)>=4 THEN 2 WHEN coalesce(c.reputation,0)<=5 OR coalesce(c.division_level,3)=3 THEN 3 ELSE 4 END;
  IF coalesce(v.fame,0)<20 THEN t:=least(t,2);END IF;
  IF coalesce(v.fame,0)<45 OR coalesce(v.fanbase,0)<8000 THEN t:=least(t,3);END IF;
  IF coalesce(v.fame,0)>=80 AND coalesce(v.fanbase,0)>=150000 AND coalesce(c.reputation,0)>=8 AND coalesce(c.division_level,1)<=1 THEN t:=5;END IF;
  RETURN greatest(1,least(5,t));
END $$;

CREATE OR REPLACE FUNCTION private.sponsor_fixed_slot(p_player_id uuid,p_from date,p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE st record;cl record;co record;d date;per smallint;
BEGIN
  SELECT * INTO st FROM public.player_career_state WHERE player_id=p_player_id;
  SELECT * INTO cl FROM public.base_clubs WHERE id=st.club_id;
  SELECT * INTO co FROM public.base_coaches WHERE id=coalesce(st.coach_id,cl.coach_id);
  FOR d IN SELECT x::date FROM generate_series(p_from::timestamp,p_to::timestamp,interval '1 day')x LOOP
    IF st.next_match_date=d OR EXISTS(SELECT 1 FROM public.career_competition_fixtures f WHERE f.match_date=d AND(f.home_club_id=st.club_id OR f.away_club_id=st.club_id) AND coalesce(f.status,'scheduled') NOT IN('cancelled','void')) THEN CONTINUE;END IF;
    FOR per IN 0..2 LOOP
      IF d=st.career_date AND per<st.day_period THEN CONTINUE;END IF;
      IF private.team_session_for_period(d,per,co.profile) IS NOT NULL THEN CONTINUE;END IF;
      IF EXISTS(SELECT 1 FROM public.player_sponsor_deliverables sd WHERE sd.player_id=p_player_id AND sd.status='pending' AND sd.scheduled_on=d AND sd.scheduled_period=per) THEN CONTINUE;END IF;
      RETURN jsonb_build_object('date',d,'period',per);
    END LOOP;
  END LOOP;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION private.ensure_career_sponsor_deliverables(p_player_id uuid,p_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE wk date;we date;c record;total int;existing int;target int;seq int;k int;ttl text;descr text;fixed boolean;slot jsonb;pay int;pen int;
BEGIN
  wk:=(p_date-(extract(isodow from p_date)::int-1))::date;we:=wk+6;
  SELECT count(*) INTO total FROM public.player_sponsor_deliverables WHERE player_id=p_player_id AND week_start=wk AND status<>'cancelled';
  IF total>=3 THEN RETURN;END IF;
  FOR c IN SELECT * FROM public.player_sponsor_contracts WHERE player_id=p_player_id AND status='active' AND started_on<=we AND ends_on>=p_date ORDER BY CASE WHEN contract_kind='main' THEN 0 ELSE 1 END,created_at LOOP
    SELECT count(*) INTO existing FROM public.player_sponsor_deliverables WHERE contract_id=c.id AND week_start=wk AND status<>'cancelled';
    target:=least(c.max_weekly_deliveries,CASE WHEN c.contract_kind='main' THEN 2 ELSE 1 END);
    WHILE existing<target AND total<3 LOOP
      seq:=existing+1;k:=(total+seq+extract(day from p_date)::int)%6;fixed:=k IN(1,2,4,5);
      IF k=0 THEN ttl:='Postagem patrocinada';descr:='Publicar o conteúdo combinado com a marca.';
      ELSIF k=1 THEN ttl:='Ensaio fotográfico';descr:='Participar da sessão de fotos da campanha.';
      ELSIF k=2 THEN ttl:='Evento com fãs';descr:='Comparecer a uma ação presencial com torcedores.';
      ELSIF k=3 THEN ttl:='Conteúdo com produto';descr:='Produzir um conteúdo curto usando o produto da marca.';
      ELSIF k=4 THEN ttl:='Gravação de comercial';descr:='Reservar o período para a gravação principal da campanha.';
      ELSE ttl:='Ação social da marca';descr:='Participar de uma atividade comunitária apoiada pelo patrocinador.';END IF;
      slot:=CASE WHEN fixed THEN private.sponsor_fixed_slot(p_player_id,greatest(p_date,c.started_on),least(we,c.ends_on)) ELSE NULL END;
      IF fixed AND slot IS NULL THEN fixed:=false;END IF;
      pay:=greatest(0,c.per_delivery_fee);pen:=greatest(0,round(pay*.50)::int);
      INSERT INTO public.player_sponsor_deliverables(contract_id,player_id,brand,week_start,sequence_no,deliverable_kind,title,description,assigned_on,due_on,scheduled_on,scheduled_period,payout,penalty,metadata)
      VALUES(c.id,p_player_id,c.brand,wk,seq,CASE k WHEN 0 THEN 'social_post' WHEN 1 THEN 'photo_shoot' WHEN 2 THEN 'fan_event' WHEN 3 THEN 'product_content' WHEN 4 THEN 'video_ad' ELSE 'charity_event' END,ttl,descr,p_date,least(we,c.ends_on),CASE WHEN fixed THEN(slot->>'date')::date END,CASE WHEN fixed THEN(slot->>'period')::smallint END,pay,pen,jsonb_build_object('fixed',fixed,'image',CASE WHEN k=5 THEN 3 ELSE 1 END,'fans',CASE WHEN k IN(2,5) THEN 12 ELSE 5 END,'pressure',CASE WHEN k IN(2,4) THEN 2 ELSE 1 END));
      existing:=existing+1;total:=total+1;
    END LOOP;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION private.review_career_sponsorship_player(p_player_id uuid,p_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d record;c record;m record;newtrust int;newstrikes int;months_due int;payment int;bonus int;reward_id uuid;breakdown jsonb;renewal_id uuid;renewal_message uuid;
BEGIN
  UPDATE public.player_sponsor_opportunities SET status='expired' WHERE player_id=p_player_id AND status='proposed' AND coalesce(response_deadline,expires_on)<p_date;
  FOR d IN SELECT * FROM public.player_sponsor_deliverables WHERE player_id=p_player_id AND status='pending' AND due_on<p_date FOR UPDATE LOOP
    UPDATE public.player_sponsor_deliverables SET status='missed',resolved_on=p_date WHERE id=d.id;
    SELECT * INTO c FROM public.player_sponsor_contracts WHERE id=d.contract_id FOR UPDATE;
    newtrust:=greatest(0,c.trust-CASE WHEN c.strikes=0 THEN 15 ELSE 22 END);newstrikes:=c.strikes+1;
    UPDATE public.player_sponsor_contracts SET trust=newtrust,strikes=newstrikes,total_penalties=total_penalties+greatest(0,d.penalty),updated_at=now() WHERE id=c.id;
    PERFORM private.apply_career_effects(p_player_id,jsonb_build_object('image',-2,'fans',-2,'pressure',3));
    IF newstrikes>=3 OR newtrust<=30 THEN
      UPDATE public.player_sponsor_contracts SET status='terminated',updated_at=now(),metadata=metadata||jsonb_build_object('termination_reason','missed_deliverables','terminated_on',p_date) WHERE id=c.id;
      UPDATE public.player_sponsor_deliverables SET status='cancelled',resolved_on=p_date WHERE contract_id=c.id AND status='pending';
      INSERT INTO public.player_messages(player_id,message_type,subject,body,metadata)VALUES(p_player_id,'career','Contrato de patrocínio encerrado',c.brand||' encerrou o contrato após repetidos compromissos não cumpridos.',jsonb_build_object('kind','sponsor_contract_terminated','contract_id',c.id,'brand',c.brand));
    END IF;
  END LOOP;
  FOR c IN SELECT * FROM public.player_sponsor_contracts WHERE player_id=p_player_id AND status='active' AND monthly_fee>0 FOR UPDATE LOOP
    months_due:=floor((least(p_date,c.ends_on)-coalesce(c.last_payment_on,c.started_on))/30.0)::int;
    IF months_due>0 THEN
      payment:=months_due*c.monthly_fee;PERFORM private.apply_career_effects(p_player_id,jsonb_build_object('cash',payment));
      UPDATE public.player_sponsor_contracts SET last_payment_on=coalesce(last_payment_on,started_on)+(months_due*30),total_earned=total_earned+payment,updated_at=now() WHERE id=c.id;
      INSERT INTO public.player_messages(player_id,message_type,subject,body,metadata)VALUES(p_player_id,'career','Pagamento de patrocínio — '||c.brand,'A mensalidade do contrato foi creditada: R$ '||payment||'.',jsonb_build_object('kind','sponsor_monthly_payment','contract_id',c.id,'brand',c.brand,'amount',payment,'cycles',months_due));
    END IF;
  END LOOP;
  FOR c IN SELECT * FROM public.player_sponsor_contracts WHERE player_id=p_player_id AND status='active' LOOP
    FOR m IN SELECT h.* FROM public.player_match_history h WHERE h.player_id=p_player_id AND h.match_date BETWEEN c.started_on AND least(p_date,c.ends_on) AND NOT EXISTS(SELECT 1 FROM public.player_sponsor_performance_rewards r WHERE r.contract_id=c.id AND r.match_history_id=h.id) ORDER BY h.match_date,h.id LOOP
      bonus:=0;breakdown:='{}'::jsonb;
      IF m.appeared THEN bonus:=bonus+greatest(25,round(c.per_delivery_fee*.10)::int);breakdown:=breakdown||jsonb_build_object('appearance',greatest(25,round(c.per_delivery_fee*.10)::int));END IF;
      IF m.goals>0 THEN bonus:=bonus+(m.goals*greatest(50,round(c.per_delivery_fee*.25)::int));breakdown:=breakdown||jsonb_build_object('goals',m.goals);END IF;
      IF m.assists>0 THEN bonus:=bonus+(m.assists*greatest(35,round(c.per_delivery_fee*.15)::int));breakdown:=breakdown||jsonb_build_object('assists',m.assists);END IF;
      IF coalesce(m.rating,0)>=8 THEN bonus:=bonus+greatest(50,round(c.per_delivery_fee*.20)::int);breakdown:=breakdown||jsonb_build_object('rating_bonus',m.rating);END IF;
      IF m.context='national' AND m.appeared THEN bonus:=bonus+greatest(75,round(c.per_delivery_fee*.25)::int);breakdown:=breakdown||jsonb_build_object('national_team',true);END IF;
      IF coalesce(m.metadata->'competition_result'->>'stage','') IN('final','finals') AND m.metadata->'competition_result'->>'winner_club_id'=m.club_id::text THEN bonus:=bonus+greatest(150,round(c.per_delivery_fee*.75)::int);breakdown:=breakdown||jsonb_build_object('title_bonus',true);END IF;
      INSERT INTO public.player_sponsor_performance_rewards(contract_id,player_id,match_history_id,amount,breakdown)VALUES(c.id,p_player_id,m.id,bonus,breakdown)ON CONFLICT(contract_id,match_history_id)DO NOTHING RETURNING id INTO reward_id;
      IF reward_id IS NOT NULL AND bonus>0 THEN
        PERFORM private.apply_career_effects(p_player_id,jsonb_build_object('cash',bonus,'image',CASE WHEN m.goals>0 OR coalesce(m.rating,0)>=8 THEN 1 ELSE 0 END));
        UPDATE public.player_sponsor_contracts SET total_earned=total_earned+bonus,updated_at=now() WHERE id=c.id;
        INSERT INTO public.player_messages(player_id,message_type,subject,body,metadata)VALUES(p_player_id,'career','Bônus esportivo — '||c.brand,'Seu desempenho gerou um bônus contratual de R$ '||bonus||'.',jsonb_build_object('kind','sponsor_performance_bonus','contract_id',c.id,'brand',c.brand,'amount',bonus,'match_id',m.id,'breakdown',breakdown));
      END IF;reward_id:=NULL;
    END LOOP;
  END LOOP;
  FOR c IN SELECT * FROM public.player_sponsor_contracts WHERE player_id=p_player_id AND status='active' AND ends_on<p_date FOR UPDATE LOOP
    UPDATE public.player_sponsor_contracts SET status='completed',updated_at=now() WHERE id=c.id;
    IF c.contract_kind='main' AND c.trust>=65 AND c.strikes<=1 AND NOT EXISTS(SELECT 1 FROM public.player_sponsor_opportunities o WHERE o.player_id=p_player_id AND o.brand=c.brand AND o.status='proposed') THEN
      INSERT INTO public.player_sponsor_opportunities(player_id,brand,title,reward,status,available_from,expires_on,brand_profile,requirements,profile_data,fit_score,risk_level,offer_kind,brand_tier,contract_days,monthly_fee,signing_bonus,per_delivery_fee,max_weekly_deliveries,exclusivity_category,response_deadline,negotiation_round,terms)
      VALUES(p_player_id,c.brand,'Renovação com '||c.brand,greatest(1,round(c.per_delivery_fee*1.08)::int),'proposed',p_date,p_date+5,c.brand_profile,jsonb_build_object('renewal_of',c.id),jsonb_build_object('label','Renovação','description','A marca quer prolongar a parceria após o bom cumprimento do contrato.'),least(100,c.trust),1,'main',c.brand_tier,greatest(90,(c.ends_on-c.started_on)),round(c.monthly_fee*1.08)::int,round(c.monthly_fee*.50)::int,round(c.per_delivery_fee*1.08)::int,c.max_weekly_deliveries,CASE WHEN c.exclusivity THEN c.exclusivity_category END,p_date+5,0,jsonb_build_object('renewal_of',c.id,'monthly_fee',round(c.monthly_fee*1.08)::int,'signing_bonus',round(c.monthly_fee*.50)::int,'per_delivery_fee',round(c.per_delivery_fee*1.08)::int,'contract_days',greatest(90,(c.ends_on-c.started_on)),'max_weekly_deliveries',c.max_weekly_deliveries,'exclusivity',c.exclusivity,'category',c.category,'brand_tier',c.brand_tier))RETURNING id INTO renewal_id;
      INSERT INTO public.player_messages(player_id,message_type,subject,body,metadata)VALUES(p_player_id,'career','Proposta de renovação — '||c.brand,c.brand||' quer renovar o patrocínio. A renovação só acontece se você aceitar esta nova proposta.',jsonb_build_object('kind','sponsor_contract_proposal','opportunity_id',renewal_id,'brand',c.brand,'offer_kind','main','brand_tier',c.brand_tier,'response_deadline',p_date+5,'renewal',true))RETURNING id INTO renewal_message;
      UPDATE public.player_sponsor_opportunities SET message_id=renewal_message WHERE id=renewal_id;
    END IF;
  END LOOP;
  PERFORM private.ensure_career_sponsor_deliverables(p_player_id,p_date);
END $$;

CREATE OR REPLACE FUNCTION private.maybe_generate_sponsor_opportunity(p_player_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v record;cl record;b record;score numeric;chance numeric;oid uuid;mid uuid;reward int;fit int;discipline int;tier_cap int;kind text;days int;monthly int;signing int;perfee int;weekly int;exclusive boolean;cat text;
BEGIN
  SELECT * INTO v FROM public.player_career_state WHERE player_id=p_player_id FOR UPDATE;IF v.player_id IS NULL THEN RETURN NULL;END IF;
  SELECT * INTO cl FROM public.base_clubs WHERE id=v.club_id;PERFORM private.review_career_sponsorship_player(p_player_id,v.career_date);
  IF EXISTS(SELECT 1 FROM public.player_sponsor_opportunities WHERE player_id=p_player_id AND status='proposed' AND coalesce(response_deadline,expires_on)>=v.career_date) THEN RETURN NULL;END IF;
  IF EXISTS(SELECT 1 FROM public.player_sponsor_contracts WHERE player_id=p_player_id AND status='active' AND contract_kind='main')AND random()<.70 THEN RETURN NULL;END IF;
  discipline:=coalesce((v.personality->>'discipline')::int,50);score:=coalesce(v.fame,0)+(coalesce(v.fanbase,0)/100.0)+(coalesce(v.form,50)/4.0)+(greatest(0,coalesce(v.public_image,50)-45)/2.0);IF score<35 THEN RETURN NULL;END IF;
  chance:=least(.28,.012+coalesce(v.fame,0)*.002+coalesce(v.fanbase,0)/55000.0+greatest(0,coalesce(v.form,50)-60)*.0015+greatest(0,coalesce(v.agent_relation,50)-60)*.0007);IF random()>=chance THEN RETURN NULL;END IF;
  tier_cap:=private.sponsor_tier_for_player(p_player_id);
  SELECT * INTO b FROM private.career_sponsor_brand_catalog x WHERE x.tier<=tier_cap AND coalesce(cl.reputation,0)>=x.min_club_reputation AND coalesce(v.fame,0)>=x.min_fame AND coalesce(v.fanbase,0)>=x.min_fanbase AND coalesce(v.public_image,50)>=x.min_image AND coalesce(v.form,50)>=x.min_form AND discipline>=x.min_discipline ORDER BY(x.tier=tier_cap)DESC,x.tier DESC,random() LIMIT 1;
  IF b.brand IS NULL THEN RETURN NULL;END IF;
  fit:=least(100,greatest(35,50+(coalesce(v.public_image,50)-b.min_image)/2+(coalesce(v.form,50)-b.min_form)/2+(discipline-b.min_discipline)/3+least(15,(coalesce(v.fanbase,0)-b.min_fanbase)/greatest(100,b.min_fanbase/5+1))));
  reward:=least(30000,round(b.base_reward*b.reward_multiplier*(.75+fit/100.0)+coalesce(v.fame,0)*12+coalesce(v.fanbase,0)/40.0)::int);
  kind:=CASE WHEN b.tier>=3 AND random()<.60 THEN 'main' WHEN b.tier=2 AND random()<.30 THEN 'main' ELSE 'campaign' END;days:=CASE WHEN kind='main' THEN 60+(b.tier*30) ELSE 7+(b.tier*4) END;monthly:=CASE WHEN kind='main' THEN greatest(reward*2,700*b.tier) ELSE 0 END;signing:=CASE WHEN kind='main' THEN reward ELSE 0 END;perfee:=CASE WHEN kind='main' THEN greatest(150,round(reward*.40)::int) ELSE reward END;weekly:=least(3,greatest(1,b.max_weekly_deliveries));exclusive:=kind='main' AND b.exclusivity_default;cat:=coalesce(b.category,'general');
  INSERT INTO public.player_sponsor_opportunities(player_id,brand,title,reward,status,available_from,expires_on,brand_profile,requirements,profile_data,fit_score,risk_level,offer_kind,brand_tier,contract_days,monthly_fee,signing_bonus,per_delivery_fee,max_weekly_deliveries,exclusivity_category,response_deadline,negotiation_round,terms)
  VALUES(p_player_id,b.brand,CASE WHEN kind='main' THEN 'Contrato de patrocínio com ' ELSE 'Campanha com ' END||b.brand,reward,'proposed',v.career_date,v.career_date+3,b.profile,jsonb_build_object('tier',b.tier,'club_reputation',b.min_club_reputation),jsonb_build_object('label',b.profile_label,'description',b.description),fit,b.exposure_risk,kind,b.tier,days,monthly,signing,perfee,weekly,CASE WHEN exclusive THEN cat END,v.career_date+3,0,jsonb_build_object('monthly_fee',monthly,'signing_bonus',signing,'per_delivery_fee',perfee,'contract_days',days,'max_weekly_deliveries',weekly,'exclusivity',exclusive,'category',cat,'brand_tier',b.tier))RETURNING id INTO oid;
  INSERT INTO public.player_messages(player_id,club_id,message_type,subject,body,metadata)VALUES(p_player_id,v.club_id,'career','Proposta de patrocínio — '||b.brand,b.brand||' enviou uma proposta formal. Você decide se aceita, recusa ou pede ao empresário para negociar antes de assinar.',jsonb_build_object('kind','sponsor_contract_proposal','opportunity_id',oid,'brand',b.brand,'offer_kind',kind,'brand_tier',b.tier,'response_deadline',v.career_date+3))RETURNING id INTO mid;
  UPDATE public.player_sponsor_opportunities SET message_id=mid WHERE id=oid;RETURN oid;
END $$;

CREATE OR REPLACE FUNCTION public.respond_career_sponsor_proposal(p_opportunity_id uuid,p_action text,p_message_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid();pid uuid;o record;st record;mid uuid;c_id uuid;factor numeric;contract_category text;contract_exclusive boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.';END IF;SELECT j.id INTO pid FROM public.jogadores j WHERE j.user_id=uid;
  SELECT * INTO o FROM public.player_sponsor_opportunities WHERE id=p_opportunity_id AND player_id=pid FOR UPDATE;IF o.id IS NULL THEN RAISE EXCEPTION 'Proposta não encontrada.';END IF;IF o.status<>'proposed' THEN RAISE EXCEPTION 'Esta proposta não está mais disponível.';END IF;
  SELECT * INTO st FROM public.player_career_state WHERE player_id=pid;IF coalesce(o.response_deadline,o.expires_on)<st.career_date THEN UPDATE public.player_sponsor_opportunities SET status='expired' WHERE id=o.id;RAISE EXCEPTION 'A proposta expirou.';END IF;
  IF o.message_id IS DISTINCT FROM p_message_id OR NOT EXISTS(SELECT 1 FROM public.player_messages m WHERE m.id=p_message_id AND m.player_id=pid) THEN RAISE EXCEPTION 'Abra a versão atual da proposta na Caixa de Entrada.';END IF;
  IF p_action='decline' THEN UPDATE public.player_sponsor_opportunities SET status='declined' WHERE id=o.id;RETURN jsonb_build_object('status','declined');
  ELSIF p_action='negotiate' THEN
    IF o.negotiation_round>=2 THEN RAISE EXCEPTION 'O empresário já usou as duas rodadas de negociação.';END IF;factor:=1.04+greatest(0,least(.10,(coalesce(st.agent_relation,50)-45)/500.0));
    UPDATE public.player_sponsor_opportunities SET negotiation_round=negotiation_round+1,monthly_fee=round(monthly_fee*factor)::int,signing_bonus=round(signing_bonus*factor)::int,per_delivery_fee=round(per_delivery_fee*factor)::int,terms=terms||jsonb_build_object('monthly_fee',round(monthly_fee*factor)::int,'signing_bonus',round(signing_bonus*factor)::int,'per_delivery_fee',round(per_delivery_fee*factor)::int,'negotiated_by_agent',true,'round',negotiation_round+1) WHERE id=o.id;
    INSERT INTO public.player_messages(player_id,club_id,message_type,subject,body,metadata)VALUES(pid,st.club_id,'career','Contraproposta de patrocínio — '||o.brand,'Seu empresário voltou da negociação com novos valores. Esta nova mensagem substitui a proposta anterior.',jsonb_build_object('kind','sponsor_contract_proposal','opportunity_id',o.id,'brand',o.brand,'negotiated',true,'round',o.negotiation_round+1,'response_deadline',o.response_deadline))RETURNING id INTO mid;UPDATE public.player_sponsor_opportunities SET message_id=mid WHERE id=o.id;RETURN jsonb_build_object('status','negotiated','message_id',mid);
  ELSIF p_action='accept' THEN
    contract_category:=coalesce(o.terms->>'category',o.exclusivity_category,o.brand_profile,'general');contract_exclusive:=coalesce((o.terms->>'exclusivity')::boolean,o.exclusivity_category IS NOT NULL);
    IF contract_exclusive AND EXISTS(SELECT 1 FROM public.player_sponsor_contracts c WHERE c.player_id=pid AND c.status='active' AND c.exclusivity=true AND c.exclusivity_category=contract_category) THEN RAISE EXCEPTION 'Você já possui contrato exclusivo nesta categoria.';END IF;
    INSERT INTO public.player_sponsor_contracts(player_id,proposal_id,brand,brand_tier,brand_profile,category,contract_kind,started_on,ends_on,monthly_fee,per_delivery_fee,signing_bonus,max_weekly_deliveries,exclusivity,exclusivity_category,trust,strikes,status,last_payment_on,total_earned,total_penalties,metadata)
    VALUES(pid,o.id,o.brand,o.brand_tier,o.brand_profile,contract_category,o.offer_kind,st.career_date,st.career_date+o.contract_days,o.monthly_fee,o.per_delivery_fee,o.signing_bonus,o.max_weekly_deliveries,contract_exclusive,CASE WHEN contract_exclusive THEN contract_category END,75,0,'active',st.career_date,o.signing_bonus,0,jsonb_build_object('accepted_message_id',p_message_id,'negotiation_round',o.negotiation_round))RETURNING id INTO c_id;
    UPDATE public.player_sponsor_opportunities SET status='completed',completed_at=now() WHERE id=o.id;IF o.signing_bonus>0 THEN PERFORM private.apply_career_effects(pid,jsonb_build_object('cash',o.signing_bonus,'image',1));END IF;PERFORM private.ensure_career_sponsor_deliverables(pid,st.career_date);
    INSERT INTO public.player_messages(player_id,club_id,message_type,subject,body,metadata)VALUES(pid,st.club_id,'career','Patrocínio assinado — '||o.brand,'Contrato assinado. A partir de agora os compromissos da marca passam a aparecer na sua carreira.',jsonb_build_object('kind','sponsor_contract_signed','contract_id',c_id,'brand',o.brand));RETURN jsonb_build_object('status','accepted','contract_id',c_id);
  ELSE RAISE EXCEPTION 'Ação inválida.';END IF;
END $$;

CREATE OR REPLACE FUNCTION public.complete_career_sponsor_deliverable(p_deliverable_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid();pid uuid;d record;st record;effects jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.';END IF;SELECT id INTO pid FROM public.jogadores WHERE user_id=uid;
  SELECT * INTO d FROM public.player_sponsor_deliverables WHERE id=p_deliverable_id AND player_id=pid FOR UPDATE;IF d.id IS NULL THEN RAISE EXCEPTION 'Compromisso não encontrado.';END IF;IF d.status<>'pending' THEN RAISE EXCEPTION 'Este compromisso já foi resolvido.';END IF;
  SELECT * INTO st FROM public.player_career_state WHERE player_id=pid;IF d.due_on<st.career_date THEN RAISE EXCEPTION 'O prazo deste compromisso já terminou.';END IF;IF d.scheduled_on IS NOT NULL AND(d.scheduled_on<>st.career_date OR d.scheduled_period<>st.day_period)THEN RAISE EXCEPTION 'Este compromisso tem horário marcado para outro período.';END IF;
  IF st.next_match_date=st.career_date OR EXISTS(SELECT 1 FROM public.career_competition_fixtures f WHERE f.match_date=st.career_date AND(f.home_club_id=st.club_id OR f.away_club_id=st.club_id)AND coalesce(f.status,'scheduled')NOT IN('cancelled','void'))THEN RAISE EXCEPTION 'Compromisso comercial não pode ser realizado em dia de jogo.';END IF;
  effects:=jsonb_build_object('cash',d.payout,'image',coalesce((d.metadata->>'image')::int,1),'fans',coalesce((d.metadata->>'fans')::int,5),'pressure',coalesce((d.metadata->>'pressure')::int,1));PERFORM private.apply_career_effects(pid,effects);
  UPDATE public.player_sponsor_deliverables SET status='completed',completed_at=now(),resolved_on=st.career_date WHERE id=d.id;UPDATE public.player_sponsor_contracts SET trust=least(100,trust+4),total_earned=total_earned+d.payout,updated_at=now() WHERE id=d.contract_id;
  INSERT INTO public.player_messages(player_id,message_type,subject,body,metadata)VALUES(pid,'career','Ação concluída — '||d.brand,d.title||' foi concluída. A marca registrou a entrega e o pagamento da ação.',jsonb_build_object('kind','sponsor_delivery_completed','deliverable_id',d.id,'brand',d.brand,'payout',d.payout));RETURN jsonb_build_object('status','completed','payout',d.payout);
END $$;

CREATE OR REPLACE FUNCTION public.get_career_sponsorship_state()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid();pid uuid;d date;proposal jsonb;contracts jsonb;deliveries jsonb;
BEGIN
  SELECT j.id INTO pid FROM public.jogadores j WHERE j.user_id=uid;IF pid IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.';END IF;SELECT career_date INTO d FROM public.player_career_state WHERE player_id=pid;PERFORM private.review_career_sponsorship_player(pid,d);
  SELECT to_jsonb(x)INTO proposal FROM(SELECT id,brand,title,reward,status,offer_kind,brand_tier,contract_days,monthly_fee,signing_bonus,per_delivery_fee,max_weekly_deliveries,exclusivity_category,response_deadline,negotiation_round,message_id,terms,profile_data FROM public.player_sponsor_opportunities WHERE player_id=pid AND status='proposed' ORDER BY created_at DESC LIMIT 1)x;
  SELECT coalesce(jsonb_agg(to_jsonb(x)ORDER BY x.created_at DESC),'[]'::jsonb)INTO contracts FROM(SELECT id,brand,brand_tier,brand_profile,category,contract_kind,started_on,ends_on,monthly_fee,per_delivery_fee,signing_bonus,max_weekly_deliveries,exclusivity,exclusivity_category,trust,strikes,status,total_earned,total_penalties,created_at FROM public.player_sponsor_contracts WHERE player_id=pid ORDER BY created_at DESC LIMIT 12)x;
  SELECT coalesce(jsonb_agg(to_jsonb(x)ORDER BY coalesce(x.scheduled_on,x.due_on),x.sequence_no),'[]'::jsonb)INTO deliveries FROM(SELECT id,contract_id,brand,week_start,sequence_no,deliverable_kind,title,description,assigned_on,due_on,scheduled_on,scheduled_period,status,payout,penalty,metadata FROM public.player_sponsor_deliverables WHERE player_id=pid AND status='pending' ORDER BY coalesce(scheduled_on,due_on),sequence_no LIMIT 12)x;
  RETURN jsonb_build_object('career_date',d,'proposal',proposal,'contracts',contracts,'deliverables',deliveries,'tier_cap',private.sponsor_tier_for_player(pid));
END $$;

-- Legacy one-click sponsor opportunities become formal proposals requiring a current inbox message.
DO $$
DECLARE o record;st record;mid uuid;
BEGIN
  FOR o IN SELECT * FROM public.player_sponsor_opportunities WHERE status='available' LOOP
    SELECT * INTO st FROM public.player_career_state WHERE player_id=o.player_id;
    UPDATE public.player_sponsor_opportunities SET status='proposed',offer_kind=coalesce(nullif(offer_kind,''),'campaign'),brand_tier=greatest(1,coalesce(brand_tier,1)),contract_days=greatest(7,coalesce(contract_days,14)),per_delivery_fee=CASE WHEN coalesce(per_delivery_fee,0)=0 THEN reward ELSE per_delivery_fee END,max_weekly_deliveries=greatest(1,least(3,coalesce(max_weekly_deliveries,1))),response_deadline=greatest(coalesce(response_deadline,expires_on),st.career_date+1),terms=coalesce(terms,'{}'::jsonb)||jsonb_build_object('per_delivery_fee',CASE WHEN coalesce(per_delivery_fee,0)=0 THEN reward ELSE per_delivery_fee END,'contract_days',greatest(7,coalesce(contract_days,14)),'max_weekly_deliveries',greatest(1,least(3,coalesce(max_weekly_deliveries,1)))) WHERE id=o.id;
    INSERT INTO public.player_messages(player_id,club_id,message_type,subject,body,metadata)VALUES(o.player_id,st.club_id,'career','Proposta de patrocínio — '||o.brand,o.brand||' enviou uma proposta formal. A ação não fica ativa até você aceitar. Abra esta mensagem para aceitar, negociar com seu empresário ou recusar.',jsonb_build_object('kind','sponsor_contract_proposal','opportunity_id',o.id,'brand',o.brand,'offer_kind','campaign','brand_tier',greatest(1,coalesce(o.brand_tier,1)),'response_deadline',greatest(coalesce(o.response_deadline,o.expires_on),st.career_date+1)))RETURNING id INTO mid;
    UPDATE public.player_sponsor_opportunities SET message_id=mid WHERE id=o.id;
  END LOOP;
END $$;

COMMIT;

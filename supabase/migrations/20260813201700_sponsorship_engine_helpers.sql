-- Futbrowser: fictional sponsor scheduling and career-market helpers.
BEGIN;

CREATE OR REPLACE FUNCTION private.sponsor_market_tier(p_player_id uuid)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_state record;v_club record;v_tier integer:=1;
BEGIN
 SELECT * INTO v_state FROM public.player_career_state WHERE player_id=p_player_id;
 SELECT * INTO v_club FROM public.base_clubs WHERE id=v_state.club_id;
 IF v_state.player_id IS NULL OR v_club.id IS NULL THEN RETURN 1; END IF;
 IF v_club.squad_level IN('base','u15','u17') THEN RETURN 1; END IF;
 IF v_club.squad_level='u18' THEN
   RETURN CASE WHEN COALESCE(v_club.reputation,0)>=4 AND COALESCE(v_state.fame,0)>=30 AND COALESCE(v_state.fanbase,0)>=1200 THEN 2 ELSE 1 END;
 END IF;
 IF v_club.squad_level='u20' THEN
   RETURN CASE WHEN COALESCE(v_club.reputation,0)>=4 AND COALESCE(v_state.fame,0)>=28 THEN 2 ELSE 1 END;
 END IF;
 IF v_club.squad_level<>'first_team' THEN RETURN 1; END IF;
 v_tier:=CASE
   WHEN COALESCE(v_club.reputation,0)<=3 OR COALESCE(v_club.division_level,4)>=4 THEN 2
   WHEN COALESCE(v_club.reputation,0)<=5 OR COALESCE(v_club.division_level,3)=3 THEN 3
   WHEN COALESCE(v_club.reputation,0)<=7 OR COALESCE(v_club.division_level,2)=2 THEN 4
   ELSE 4 END;
 IF COALESCE(v_state.fame,0)<20 THEN v_tier:=LEAST(v_tier,2); END IF;
 IF COALESCE(v_state.fame,0)<45 OR COALESCE(v_state.fanbase,0)<8000 THEN v_tier:=LEAST(v_tier,3); END IF;
 IF COALESCE(v_state.fame,0)<65 OR COALESCE(v_state.fanbase,0)<40000 THEN v_tier:=LEAST(v_tier,4); END IF;
 IF COALESCE(v_state.fame,0)>=80 AND COALESCE(v_state.fanbase,0)>=150000 AND COALESCE(v_club.reputation,0)>=8 AND COALESCE(v_club.division_level,1)<=1 THEN v_tier:=5; END IF;
 RETURN GREATEST(1,LEAST(5,v_tier));
END $$;

CREATE OR REPLACE FUNCTION private.sponsor_market_label(p_tier integer)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE GREATEST(1,LEAST(5,COALESCE(p_tier,1))) WHEN 1 THEN 'Local' WHEN 2 THEN 'Regional' WHEN 3 THEN 'Nacional' WHEN 4 THEN 'Premium' ELSE 'Global' END
$$;

CREATE OR REPLACE FUNCTION private.sponsor_is_match_day(p_player_id uuid,p_date date)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_state record;
BEGIN
 SELECT * INTO v_state FROM public.player_career_state WHERE player_id=p_player_id;
 IF v_state.next_match_date=p_date THEN RETURN true; END IF;
 RETURN EXISTS(SELECT 1 FROM public.career_competition_fixtures f WHERE f.match_date=p_date AND (f.home_club_id=v_state.club_id OR f.away_club_id=v_state.club_id) AND COALESCE(f.status,'')<>'cancelled');
END $$;

CREATE OR REPLACE FUNCTION private.sponsor_post_transaction(p_player_id uuid,p_contract_id uuid,p_deliverable_id uuid,p_type text,p_amount integer,p_date date,p_description text,p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 IF COALESCE(p_amount,0)=0 THEN RETURN NULL; END IF;
 UPDATE public.player_career_state SET cash_balance=cash_balance+p_amount,updated_at=now() WHERE player_id=p_player_id;
 INSERT INTO public.player_sponsor_transactions(player_id,contract_id,deliverable_id,tx_type,amount,career_date,description,metadata)
 VALUES(p_player_id,p_contract_id,p_deliverable_id,p_type,p_amount,p_date,p_description,COALESCE(p_metadata,'{}'::jsonb)) RETURNING id INTO v_id;
 IF p_contract_id IS NOT NULL THEN
   UPDATE public.player_sponsor_contracts SET total_earned=total_earned+GREATEST(0,p_amount),total_penalties=total_penalties+GREATEST(0,-p_amount),updated_at=now() WHERE id=p_contract_id;
 END IF;
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION private.next_sponsor_slot(p_player_id uuid,p_from date,p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_state record;v_club record;v_coach record;v_day date;v_period smallint;
BEGIN
 SELECT * INTO v_state FROM public.player_career_state WHERE player_id=p_player_id;
 SELECT * INTO v_club FROM public.base_clubs WHERE id=v_state.club_id;
 SELECT * INTO v_coach FROM public.base_coaches WHERE id=COALESCE(v_state.coach_id,v_club.coach_id);
 FOR v_day IN SELECT d::date FROM generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d LOOP
   IF private.sponsor_is_match_day(p_player_id,v_day) THEN CONTINUE; END IF;
   FOR v_period IN 0..2 LOOP
     IF v_day=v_state.career_date AND v_period<v_state.day_period THEN CONTINUE; END IF;
     IF private.team_session_for_period(v_day,v_period,v_coach.profile) IS NOT NULL THEN CONTINUE; END IF;
     IF EXISTS(SELECT 1 FROM public.player_sponsor_deliverables d WHERE d.player_id=p_player_id AND d.status='pending' AND d.scheduled_on=v_day AND d.scheduled_period=v_period) THEN CONTINUE; END IF;
     RETURN jsonb_build_object('date',v_day,'period',v_period);
   END LOOP;
 END LOOP;
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION private.sponsor_delivery_template(p_seed integer)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SET search_path='' AS $$
DECLARE v integer:=COALESCE(p_seed,FLOOR(random()*9)::int)%9;
BEGIN
 RETURN CASE v
  WHEN 0 THEN jsonb_build_object('kind','social_post','title','Postagem patrocinada','description','Preparar e publicar o conteúdo combinado com a marca.','fixed',false,'energy',0,'pressure',1,'image',1,'fans',8)
  WHEN 1 THEN jsonb_build_object('kind','photo_shoot','title','Ensaio fotográfico','description','Participar da sessão de fotos da campanha.','fixed',true,'energy',-3,'pressure',1,'image',2,'fans',6)
  WHEN 2 THEN jsonb_build_object('kind','store_visit','title','Visita à loja','description','Comparecer a uma ação presencial com clientes e torcedores.','fixed',true,'energy',-4,'pressure',1,'image',2,'fans',12)
  WHEN 3 THEN jsonb_build_object('kind','brand_interview','title','Entrevista da campanha','description','Gravar uma entrevista curta para os canais da marca.','fixed',false,'energy',-1,'pressure',1,'image',1,'fans',8)
  WHEN 4 THEN jsonb_build_object('kind','fan_event','title','Evento com fãs','description','Participar de uma ação promocional com presença de público.','fixed',true,'energy',-5,'pressure',2,'image',2,'fans',18)
  WHEN 5 THEN jsonb_build_object('kind','video_ad','title','Gravação de comercial','description','Reservar o período para gravar o material principal da campanha.','fixed',true,'energy',-5,'pressure',2,'image',2,'fans',10)
  WHEN 6 THEN jsonb_build_object('kind','product_content','title','Conteúdo com produto','description','Produzir o conteúdo de uso do produto previsto no contrato.','fixed',false,'energy',-1,'pressure',1,'image',1,'fans',9)
  WHEN 7 THEN jsonb_build_object('kind','charity_event','title','Ação social da marca','description','Participar de uma atividade comunitária apoiada pelo patrocinador.','fixed',true,'energy',-4,'pressure',0,'image',3,'fans',20)
  ELSE jsonb_build_object('kind','launch_event','title','Lançamento de campanha','description','Marcar presença no lançamento de uma nova ação da marca.','fixed',true,'energy',-4,'pressure',2,'image',2,'fans',14)
 END;
END $$;

CREATE OR REPLACE FUNCTION private.ensure_sponsor_deliverables(p_player_id uuid,p_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_week date;v_end date;v_contract record;v_total integer;v_existing integer;v_target integer;v_i integer;v_tpl jsonb;v_slot jsonb;v_fixed boolean;v_payout integer;
BEGIN
 v_week:=(p_date-(EXTRACT(ISODOW FROM p_date)::int-1))::date;v_end:=v_week+6;
 SELECT COUNT(*) INTO v_total FROM public.player_sponsor_deliverables WHERE player_id=p_player_id AND week_start=v_week AND status<>'cancelled';
 IF v_total>=3 THEN RETURN; END IF;
 FOR v_contract IN SELECT * FROM public.player_sponsor_contracts WHERE player_id=p_player_id AND status='active' AND started_on<=v_end AND ends_on>=p_date ORDER BY CASE WHEN contract_kind='main' THEN 0 ELSE 1 END,created_at LOOP
   SELECT COUNT(*) INTO v_existing FROM public.player_sponsor_deliverables WHERE contract_id=v_contract.id AND week_start=v_week AND status<>'cancelled';
   v_target:=LEAST(v_contract.max_weekly_deliveries,CASE WHEN v_contract.contract_kind='main' THEN 2 ELSE 1 END);
   WHILE v_existing<v_target AND v_total<3 LOOP
     v_i:=v_existing+1;v_tpl:=private.sponsor_delivery_template(FLOOR(random()*9)::int+v_i+v_total);v_fixed:=COALESCE((v_tpl->>'fixed')::boolean,false);
     v_slot:=CASE WHEN v_fixed THEN private.next_sponsor_slot(p_player_id,GREATEST(p_date,v_contract.started_on),LEAST(v_end,v_contract.ends_on)) ELSE NULL END;
     IF v_fixed AND v_slot IS NULL THEN v_tpl:=private.sponsor_delivery_template(0);v_fixed:=false;END IF;
     v_payout:=GREATEST(0,v_contract.per_delivery_fee);
     INSERT INTO public.player_sponsor_deliverables(contract_id,player_id,brand,week_start,sequence_no,deliverable_kind,title,description,assigned_on,due_on,scheduled_on,scheduled_period,payout,penalty,metadata)
     VALUES(v_contract.id,p_player_id,v_contract.brand,v_week,v_i,v_tpl->>'kind',v_tpl->>'title',v_tpl->>'description',p_date,LEAST(v_end,v_contract.ends_on),CASE WHEN v_fixed THEN (v_slot->>'date')::date ELSE NULL END,CASE WHEN v_fixed THEN (v_slot->>'period')::smallint ELSE NULL END,v_payout,v_contract.missed_delivery_penalty,jsonb_build_object('energy',COALESCE((v_tpl->>'energy')::int,0),'pressure',COALESCE((v_tpl->>'pressure')::int,0),'image',COALESCE((v_tpl->>'image')::int,0),'fans',COALESCE((v_tpl->>'fans')::int,0),'reminder_sent',false));
     v_existing:=v_existing+1;v_total:=v_total+1;
   END LOOP;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION private.create_sponsor_email(p_player_id uuid,p_club_id uuid,p_subject text,p_body text,p_metadata jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 INSERT INTO public.player_messages(player_id,club_id,message_type,subject,body,metadata) VALUES(p_player_id,p_club_id,'career',p_subject,p_body,p_metadata) RETURNING id INTO v_id;RETURN v_id;
END $$;

COMMIT;

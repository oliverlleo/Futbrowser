CREATE OR REPLACE FUNCTION private.sponsor_reschedule_conflicts(p_player_id uuid,p_date date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE d record;c record;st record;slot jsonb;moved int:=0;new_due date;
BEGIN
  SELECT * INTO st FROM public.player_career_state WHERE player_id=p_player_id;
  IF st.player_id IS NULL THEN RETURN 0; END IF;
  FOR d IN
    SELECT sd.* FROM public.player_sponsor_deliverables sd
    WHERE sd.player_id=p_player_id AND sd.status='pending' AND sd.scheduled_on IS NOT NULL
      AND EXISTS(SELECT 1 FROM public.career_competition_fixtures f WHERE f.match_date=sd.scheduled_on AND (f.home_club_id=st.club_id OR f.away_club_id=st.club_id) AND coalesce(f.status,'scheduled') NOT IN('cancelled','void'))
    FOR UPDATE
  LOOP
    SELECT * INTO c FROM public.player_sponsor_contracts WHERE id=d.contract_id;
    new_due:=least(c.ends_on,greatest(d.due_on,p_date+7));
    slot:=private.sponsor_fixed_slot(p_player_id,greatest(p_date,d.assigned_on),new_due);
    IF slot IS NOT NULL THEN
      UPDATE public.player_sponsor_deliverables
      SET scheduled_on=(slot->>'date')::date,scheduled_period=(slot->>'period')::smallint,
          due_on=greatest(d.due_on,(slot->>'date')::date),
          metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('rescheduled_reason','match_rescheduled','rescheduled_on',p_date,'previous_scheduled_on',d.scheduled_on,'previous_scheduled_period',d.scheduled_period,'player_fault',false)
      WHERE id=d.id;
      INSERT INTO public.player_messages(player_id,message_type,subject,body,metadata)
      VALUES(p_player_id,'career','Publicidade remarcada — '||d.brand,d.title||' foi remarcada porque um jogo passou a ocupar o horário original. Isso não conta como falha sua.',jsonb_build_object('kind','sponsor_delivery_rescheduled','deliverable_id',d.id,'brand',d.brand,'new_date',(slot->>'date')::date,'new_period',(slot->>'period')::smallint));
    ELSE
      UPDATE public.player_sponsor_deliverables SET status='cancelled',resolved_on=p_date,metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('cancelled_reason','match_rescheduled_no_slot','player_fault',false) WHERE id=d.id;
      INSERT INTO public.player_messages(player_id,message_type,subject,body,metadata)
      VALUES(p_player_id,'career','Ação comercial cancelada — '||d.brand,d.title||' foi cancelada porque a mudança do calendário não deixou horário disponível. Não há penalidade para você.',jsonb_build_object('kind','sponsor_delivery_cancelled_schedule','deliverable_id',d.id,'brand',d.brand));
    END IF;
    moved:=moved+1;
  END LOOP;
  RETURN moved;
END
$function$;

CREATE OR REPLACE FUNCTION private.ensure_career_sponsor_deliverables(p_player_id uuid,p_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  wk date;we date;c record;total int;existing int;target int;seq int;k int;ttl text;descr text;kind text;fixed boolean;slot jsonb;pay int;pen int;
  energy_cost int;fatigue_gain int;img int;fans int;press int;first_pct int;
BEGIN
  wk:=(p_date-(extract(isodow from p_date)::int-1))::date;we:=wk+6;
  SELECT count(*) INTO total FROM public.player_sponsor_deliverables WHERE player_id=p_player_id AND week_start=wk AND status<>'cancelled';
  IF total>=3 THEN RETURN; END IF;
  FOR c IN SELECT * FROM public.player_sponsor_contracts WHERE player_id=p_player_id AND status='active' AND started_on<=we AND ends_on>=p_date ORDER BY CASE WHEN contract_kind='main' THEN 0 ELSE 1 END,created_at LOOP
    SELECT count(*) INTO existing FROM public.player_sponsor_deliverables WHERE contract_id=c.id AND week_start=wk AND status<>'cancelled';
    target:=least(3,c.max_weekly_deliveries,CASE WHEN c.contract_kind='main' THEN 2 ELSE 1 END);
    WHILE existing<target AND total<3 LOOP
      seq:=existing+1;k:=abs(hashtext(c.id::text||wk::text||seq::text))%12;
      kind:=CASE k WHEN 0 THEN 'sponsored_post' WHEN 1 THEN 'photo_shoot' WHEN 2 THEN 'short_video' WHEN 3 THEN 'fan_event' WHEN 4 THEN 'launch_event' WHEN 5 THEN 'campaign_interview' WHEN 6 THEN 'autograph_session' WHEN 7 THEN 'store_visit' WHEN 8 THEN 'branded_content' WHEN 9 THEN 'charity_brand_event' WHEN 10 THEN 'vip_appearance' ELSE 'commercial_shoot' END;
      ttl:=CASE k WHEN 0 THEN 'Postagem patrocinada' WHEN 1 THEN 'Ensaio fotográfico' WHEN 2 THEN 'Vídeo curto da campanha' WHEN 3 THEN 'Evento com fãs' WHEN 4 THEN 'Lançamento da marca' WHEN 5 THEN 'Entrevista de campanha' WHEN 6 THEN 'Sessão de autógrafos' WHEN 7 THEN 'Visita à loja' WHEN 8 THEN 'Conteúdo de marca' WHEN 9 THEN 'Ação social da marca' WHEN 10 THEN 'Aparição VIP' ELSE 'Gravação de comercial' END;
      descr:=CASE k WHEN 0 THEN 'Publicar o conteúdo combinado até o prazo.' WHEN 1 THEN 'Participar da sessão de fotos da campanha.' WHEN 2 THEN 'Gravar um vídeo curto seguindo o briefing da marca.' WHEN 3 THEN 'Comparecer a uma ação presencial com torcedores.' WHEN 4 THEN 'Participar do lançamento de um produto ou campanha.' WHEN 5 THEN 'Dar uma entrevista curta ligada à campanha.' WHEN 6 THEN 'Participar de uma sessão de autógrafos organizada pela marca.' WHEN 7 THEN 'Fazer uma visita promocional a uma unidade da marca.' WHEN 8 THEN 'Produzir conteúdo integrado com o produto da marca.' WHEN 9 THEN 'Participar de uma atividade comunitária apoiada pelo patrocinador.' WHEN 10 THEN 'Comparecer a uma ação VIP da campanha.' ELSE 'Reservar o período para a gravação principal do comercial.' END;
      fixed:=k NOT IN(0,2,8);
      slot:=CASE WHEN fixed THEN private.sponsor_fixed_slot(p_player_id,greatest(p_date,c.started_on),least(we,c.ends_on)) ELSE NULL END;
      IF fixed AND slot IS NULL THEN fixed:=false; END IF;
      pay:=greatest(0,c.per_delivery_fee);first_pct:=coalesce((c.metadata->'penalty_policy'->>'first_miss_percent')::int,25);pen:=greatest(0,round(pay*first_pct/100.0)::int);
      energy_cost:=CASE k WHEN 0 THEN 1 WHEN 2 THEN 2 WHEN 8 THEN 2 WHEN 1 THEN 4 WHEN 5 THEN 3 WHEN 10 THEN 5 WHEN 11 THEN 6 ELSE 4 END;
      fatigue_gain:=greatest(1,round(energy_cost*.65)::int);img:=CASE WHEN k IN(9,10) THEN 3 WHEN k IN(3,4,6,7) THEN 2 ELSE 1 END;fans:=CASE WHEN k IN(3,6,9,10) THEN 12 WHEN k IN(0,2,8) THEN 7 ELSE 5 END;press:=CASE WHEN k IN(4,10,11) THEN 3 WHEN fixed THEN 2 ELSE 1 END;
      INSERT INTO public.player_sponsor_deliverables(contract_id,player_id,brand,week_start,sequence_no,deliverable_kind,title,description,assigned_on,due_on,scheduled_on,scheduled_period,payout,penalty,metadata)
      VALUES(c.id,p_player_id,c.brand,wk,seq,kind,ttl,descr,p_date,least(we,c.ends_on),CASE WHEN fixed THEN (slot->>'date')::date END,CASE WHEN fixed THEN (slot->>'period')::smallint END,pay,pen,jsonb_build_object('fixed',fixed,'image',img,'fans',fans,'pressure',press,'energy_cost',energy_cost,'fatigue_gain',fatigue_gain,'exposure_gain',img+least(3,fans/5),'time_impact',CASE WHEN fixed THEN 'scheduled_period' ELSE 'flexible_deadline' END));
      existing:=existing+1;total:=total+1;
    END LOOP;
  END LOOP;
END
$function$;

CREATE OR REPLACE FUNCTION private.sponsor_delivery_resolution_effects()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE energy_cost int;fatigue_gain int;c record;
BEGIN
  IF OLD.status='pending' AND NEW.status='completed' THEN
    energy_cost:=coalesce((NEW.metadata->>'energy_cost')::int,2);fatigue_gain:=coalesce((NEW.metadata->>'fatigue_gain')::int,1);
    UPDATE public.player_career_state SET energy=greatest(0,energy-energy_cost),fatigue=least(100,fatigue+fatigue_gain),acute_load=least(100,coalesce(acute_load,0)+greatest(1,energy_cost/2)),updated_at=now() WHERE player_id=NEW.player_id;
  ELSIF OLD.status='pending' AND NEW.status='missed' THEN
    SELECT * INTO c FROM public.player_sponsor_contracts WHERE id=NEW.contract_id;
    INSERT INTO public.player_messages(player_id,message_type,subject,body,metadata)
    VALUES(NEW.player_id,'career','Aviso de patrocínio — '||NEW.brand,NEW.title||' passou do prazo. Você perdeu o pagamento desta ação; a marca registrou a falta e reincidências aumentam a multa e podem encerrar o contrato.',jsonb_build_object('kind','sponsor_delivery_missed','contract_id',NEW.contract_id,'deliverable_id',NEW.id,'brand',NEW.brand,'base_penalty',NEW.penalty,'bonus_lost',NEW.payout));
  END IF;
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS trg_sponsor_delivery_resolution_effects ON public.player_sponsor_deliverables;
CREATE TRIGGER trg_sponsor_delivery_resolution_effects AFTER UPDATE OF status ON public.player_sponsor_deliverables FOR EACH ROW EXECUTE FUNCTION private.sponsor_delivery_resolution_effects();

CREATE OR REPLACE FUNCTION private.sponsor_progressive_breach_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE step_pct int;extra int;termination_fee int;
BEGIN
  IF NEW.strikes>OLD.strikes THEN
    step_pct:=coalesce((NEW.metadata->'penalty_policy'->>'repeat_step_percent')::int,25);
    extra:=greatest(0,round(coalesce(NEW.per_delivery_fee,0)*step_pct*greatest(0,NEW.strikes-1)/100.0)::int);
    NEW.total_penalties:=coalesce(NEW.total_penalties,0)+extra;
    NEW.metadata:=coalesce(NEW.metadata,'{}'::jsonb)||jsonb_build_object('last_breach_strike',NEW.strikes,'last_breach_extra_penalty',extra,'progressive_penalty',true);
  END IF;
  IF OLD.status='active' AND NEW.status='terminated' THEN
    termination_fee:=greatest(coalesce(NEW.monthly_fee,0)/2,coalesce(NEW.per_delivery_fee,0)*2,250*greatest(1,NEW.brand_tier));
    NEW.total_penalties:=coalesce(NEW.total_penalties,0)+termination_fee;
    NEW.metadata:=coalesce(NEW.metadata,'{}'::jsonb)||jsonb_build_object('termination_penalty',termination_fee);
  END IF;
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS trg_sponsor_progressive_breach_guard ON public.player_sponsor_contracts;
CREATE TRIGGER trg_sponsor_progressive_breach_guard BEFORE UPDATE ON public.player_sponsor_contracts FOR EACH ROW EXECUTE FUNCTION private.sponsor_progressive_breach_guard();

CREATE OR REPLACE FUNCTION private.sponsor_fixture_reschedule_hook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE p record;
BEGIN
  IF TG_OP='INSERT' THEN
    FOR p IN SELECT player_id,career_date FROM public.player_career_state WHERE club_id IN(NEW.home_club_id,NEW.away_club_id) LOOP PERFORM private.sponsor_reschedule_conflicts(p.player_id,p.career_date); END LOOP;
  ELSE
    FOR p IN SELECT player_id,career_date FROM public.player_career_state WHERE club_id IN(NEW.home_club_id,NEW.away_club_id,OLD.home_club_id,OLD.away_club_id) LOOP PERFORM private.sponsor_reschedule_conflicts(p.player_id,p.career_date); END LOOP;
  END IF;
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS trg_sponsor_fixture_insert_reschedule ON public.career_competition_fixtures;
CREATE TRIGGER trg_sponsor_fixture_insert_reschedule AFTER INSERT ON public.career_competition_fixtures FOR EACH ROW EXECUTE FUNCTION private.sponsor_fixture_reschedule_hook();
DROP TRIGGER IF EXISTS trg_sponsor_fixture_update_reschedule ON public.career_competition_fixtures;
CREATE TRIGGER trg_sponsor_fixture_update_reschedule AFTER UPDATE OF match_date,status,home_club_id,away_club_id ON public.career_competition_fixtures FOR EACH ROW EXECUTE FUNCTION private.sponsor_fixture_reschedule_hook();

UPDATE public.player_sponsor_deliverables d
SET penalty=greatest(0,round(d.payout*coalesce((c.metadata->'penalty_policy'->>'first_miss_percent')::int,25)/100.0)::int)
FROM public.player_sponsor_contracts c
WHERE c.id=d.contract_id AND d.status='pending';

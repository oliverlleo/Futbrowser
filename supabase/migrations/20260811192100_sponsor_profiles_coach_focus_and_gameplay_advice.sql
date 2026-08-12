BEGIN;

ALTER TABLE public.player_sponsor_opportunities
  ADD COLUMN IF NOT EXISTS brand_profile text,
  ADD COLUMN IF NOT EXISTS requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS profile_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fit_score integer,
  ADD COLUMN IF NOT EXISTS risk_level integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS private.career_sponsor_brand_catalog (
  brand text PRIMARY KEY,
  profile text NOT NULL,
  profile_label text NOT NULL,
  base_reward integer NOT NULL,
  reward_multiplier numeric(5,2) NOT NULL DEFAULT 1,
  min_fame integer NOT NULL DEFAULT 0,
  min_fanbase integer NOT NULL DEFAULT 0,
  min_image integer NOT NULL DEFAULT 0,
  min_form integer NOT NULL DEFAULT 0,
  min_discipline integer NOT NULL DEFAULT 0,
  exposure_risk integer NOT NULL DEFAULT 1,
  description text NOT NULL
);

INSERT INTO private.career_sponsor_brand_catalog
(brand,profile,profile_label,base_reward,reward_multiplier,min_fame,min_fanbase,min_image,min_form,min_discipline,exposure_risk,description)
VALUES
('Norte Sports','performance','Desempenho',320,1.15,5,150,45,55,45,1,'Valoriza evolução, forma e profissionalismo.'),
('Eleven Wear','performance','Desempenho',380,1.22,8,220,48,58,48,2,'Procura atletas em crescimento e com boa fase esportiva.'),
('Arena+','community','Comunidade',300,1.05,4,180,55,45,42,1,'Valoriza proximidade com torcida e boa imagem pública.'),
('Linha de Fundo','community','Comunidade',260,1.00,3,140,52,42,40,1,'Prefere atletas acessíveis e conectados ao público local.'),
('Pulso Tech','digital','Alcance digital',420,1.28,12,450,50,48,40,3,'Busca alcance, crescimento de público e presença digital.'),
('Sprint Mobile','digital','Alcance digital',450,1.30,15,600,52,50,42,3,'Paga mais por exposição, mas aumenta a pressão pública.'),
('Ritmo Nutrition','discipline','Disciplina',350,1.18,6,200,58,52,58,1,'Valoriza rotina, disciplina e imagem profissional.'),
('Vértice Energy','ambition','Ambição',400,1.25,10,320,50,60,50,2,'Procura atletas ambiciosos, em boa forma e crescendo rápido.')
ON CONFLICT(brand) DO UPDATE SET
  profile=EXCLUDED.profile,profile_label=EXCLUDED.profile_label,base_reward=EXCLUDED.base_reward,reward_multiplier=EXCLUDED.reward_multiplier,
  min_fame=EXCLUDED.min_fame,min_fanbase=EXCLUDED.min_fanbase,min_image=EXCLUDED.min_image,min_form=EXCLUDED.min_form,
  min_discipline=EXCLUDED.min_discipline,exposure_risk=EXCLUDED.exposure_risk,description=EXCLUDED.description;

CREATE OR REPLACE FUNCTION private.maybe_generate_sponsor_opportunity(p_player_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v record; v_brand record; v_score numeric; v_chance numeric; v_id uuid; v_reward integer; v_fit integer; v_discipline integer;
BEGIN
  SELECT * INTO v FROM public.player_career_state WHERE player_id=p_player_id FOR UPDATE;
  IF v.player_id IS NULL THEN RETURN NULL; END IF;
  UPDATE public.player_sponsor_opportunities SET status='expired' WHERE player_id=p_player_id AND status='available' AND expires_on<v.career_date;
  IF EXISTS(SELECT 1 FROM public.player_sponsor_opportunities WHERE player_id=p_player_id AND status='available' AND expires_on>=v.career_date) THEN RETURN NULL; END IF;
  v_discipline:=COALESCE((v.personality->>'discipline')::integer,50);
  v_score:=COALESCE(v.fame,0)+(COALESCE(v.fanbase,0)/100.0)+(COALESCE(v.form,50)/4.0)+(GREATEST(0,COALESCE(v.public_image,50)-45)/2.0);
  IF v_score<35 THEN RETURN NULL; END IF;
  v_chance:=LEAST(0.24,0.01+COALESCE(v.fame,0)*0.002+COALESCE(v.fanbase,0)/50000.0+GREATEST(0,COALESCE(v.form,50)-60)*0.0015);
  IF random()>=v_chance THEN RETURN NULL; END IF;

  SELECT * INTO v_brand
  FROM private.career_sponsor_brand_catalog b
  WHERE COALESCE(v.fame,0)>=b.min_fame
    AND COALESCE(v.fanbase,0)>=b.min_fanbase
    AND COALESCE(v.public_image,50)>=b.min_image
    AND COALESCE(v.form,50)>=b.min_form
    AND v_discipline>=b.min_discipline
  ORDER BY random() LIMIT 1;
  IF v_brand.brand IS NULL THEN RETURN NULL; END IF;

  v_fit:=LEAST(100,GREATEST(35,
    50 + (COALESCE(v.public_image,50)-v_brand.min_image)/2 + (COALESCE(v.form,50)-v_brand.min_form)/2
    + (v_discipline-v_brand.min_discipline)/3 + LEAST(15,(COALESCE(v.fanbase,0)-v_brand.min_fanbase)/100)
  ));
  v_reward:=LEAST(5000,ROUND(v_brand.base_reward*v_brand.reward_multiplier*(0.75+v_fit/100.0)+COALESCE(v.fame,0)*12+COALESCE(v.fanbase,0)/40.0)::integer);

  INSERT INTO public.player_sponsor_opportunities(player_id,brand,title,reward,status,available_from,expires_on,brand_profile,requirements,profile_data,fit_score,risk_level)
  VALUES(
    p_player_id,v_brand.brand,'Ação com '||v_brand.brand,v_reward,'available',v.career_date,v.career_date+3,v_brand.profile,
    jsonb_build_object('min_fame',v_brand.min_fame,'min_fanbase',v_brand.min_fanbase,'min_image',v_brand.min_image,'min_form',v_brand.min_form,'min_discipline',v_brand.min_discipline),
    jsonb_build_object('label',v_brand.profile_label,'description',v_brand.description),v_fit,v_brand.exposure_risk
  ) RETURNING id INTO v_id;

  INSERT INTO public.player_messages(player_id,club_id,message_type,subject,body,metadata)
  SELECT p_player_id,club_id,'career','Nova oportunidade de patrocinador',
    v_brand.brand||' procurou você. Perfil da marca: '||v_brand.profile_label||'. '||v_brand.description||' A ação fica disponível por poucos dias e pode render R$ '||v_reward||'.',
    jsonb_build_object('kind','sponsor_opportunity','opportunity_id',v_id,'brand',v_brand.brand,'reward',v_reward,'profile',v_brand.profile,'profile_label',v_brand.profile_label,'fit_score',v_fit,'risk_level',v_brand.exposure_risk,'expires_on',v.career_date+3)
  FROM public.player_contracts WHERE player_id=p_player_id AND status='active' ORDER BY signed_at DESC LIMIT 1;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.after_sponsor_profile_effect()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_opp record; v_extra_fans integer:=0;
BEGIN
  IF NEW.activity_key<>'sponsor_event' THEN RETURN NEW; END IF;
  SELECT * INTO v_opp FROM public.player_sponsor_opportunities
  WHERE player_id=NEW.player_id AND status='completed' AND completed_at IS NOT NULL
  ORDER BY completed_at DESC LIMIT 1;
  IF v_opp.id IS NULL THEN RETURN NEW; END IF;
  IF v_opp.brand_profile='performance' THEN
    UPDATE public.player_career_state SET public_image=private.career_clamp(public_image+2),trust=private.career_clamp(trust+1),fanbase=fanbase+20 WHERE player_id=NEW.player_id;
  ELSIF v_opp.brand_profile='community' THEN
    UPDATE public.player_career_state SET fan_relation=private.career_clamp(fan_relation+3),public_image=private.career_clamp(public_image+2),board_relation=private.career_clamp(board_relation+1),fanbase=fanbase+30 WHERE player_id=NEW.player_id;
  ELSIF v_opp.brand_profile='digital' THEN
    v_extra_fans:=GREATEST(30,COALESCE(v_opp.fit_score,50));
    UPDATE public.player_career_state SET fame=LEAST(100,fame+1),fanbase=fanbase+v_extra_fans,pressure=private.career_clamp(pressure+CASE WHEN v_opp.risk_level>=3 THEN 2 ELSE 1 END) WHERE player_id=NEW.player_id;
  ELSIF v_opp.brand_profile='discipline' THEN
    UPDATE public.player_career_state SET board_relation=private.career_clamp(board_relation+2),public_image=private.career_clamp(public_image+3),pressure=private.career_clamp(pressure-1) WHERE player_id=NEW.player_id;
  ELSIF v_opp.brand_profile='ambition' THEN
    UPDATE public.player_career_state SET agent_relation=private.career_clamp(agent_relation+2),public_image=private.career_clamp(public_image+2),pressure=private.career_clamp(pressure+1),personality=personality||jsonb_build_object('ambition',private.career_clamp(COALESCE((personality->>'ambition')::integer,50)+2)) WHERE player_id=NEW.player_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_zzz_sponsor_profile_effect ON public.player_career_actions;
CREATE TRIGGER trg_zzz_sponsor_profile_effect AFTER INSERT ON public.player_career_actions FOR EACH ROW EXECUTE FUNCTION private.after_sponsor_profile_effect();

CREATE OR REPLACE FUNCTION private.skill_recommended_activity(p_skill_key text)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT CASE p_skill_key
    WHEN 'dribbling' THEN jsonb_build_object('key','dribble_session','label','Treino de drible')
    WHEN 'free_kicks' THEN jsonb_build_object('key','free_kicks','label','Bolas paradas')
    WHEN 'penalties' THEN jsonb_build_object('key','penalty_practice','label','Treino de pênaltis')
    WHEN 'short_pass' THEN jsonb_build_object('key','passing','label','Passe e criação')
    WHEN 'long_pass' THEN jsonb_build_object('key','passing','label','Passe e criação')
    WHEN 'crossing' THEN jsonb_build_object('key','passing','label','Passe e criação')
    WHEN 'positioning' THEN jsonb_build_object('key','tactical_study','label','Estudo tático')
    WHEN 'tactical_awareness' THEN jsonb_build_object('key','tactical_study','label','Estudo tático')
    WHEN 'sprint' THEN jsonb_build_object('key','sprint','label','Sprint e explosão')
    WHEN 'stamina' THEN jsonb_build_object('key','endurance','label','Resistência')
    WHEN 'strength' THEN jsonb_build_object('key','strength','label','Força na academia')
    WHEN 'heading' THEN jsonb_build_object('key','heading_session','label','Cabeceio e jogo aéreo')
    WHEN 'finishing_touch' THEN jsonb_build_object('key','finishing','label','Finalização')
    WHEN 'marking' THEN jsonb_build_object('key','defensive_session','label','Marcação e duelos')
    ELSE jsonb_build_object('key','watch_match_analysis','label','Analisar futebol') END
$$;

CREATE OR REPLACE FUNCTION private.coach_development_focus(p_player_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_player record; v_state record; v_contract record; v_coach record; v_skill record; v_status jsonb; v_best record;
  v_score numeric; v_best_score numeric:=-999; v_relevance numeric; v_gap integer:=0; v_profile_bonus numeric; v_activity jsonb; v_reason text;
BEGIN
  SELECT * INTO v_player FROM public.jogadores WHERE id=p_player_id;
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=p_player_id;
  SELECT * INTO v_contract FROM public.player_contracts WHERE player_id=p_player_id AND status='active' ORDER BY signed_at DESC LIMIT 1;
  SELECT c.* INTO v_coach FROM public.base_coaches c WHERE c.id=v_state.coach_id;
  SELECT GREATEST(0,COALESCE(MAX(ovr),public.calculate_player_ovr(v_player.atributos))-public.calculate_player_ovr(v_player.atributos)) INTO v_gap
  FROM public.base_ai_players WHERE club_id=v_contract.club_id AND primary_position=v_player.posicao;

  FOR v_skill IN SELECT * FROM public.player_skill_development WHERE player_id=p_player_id LOOP
    v_status:=private.skill_status_payload(p_player_id,v_skill.skill_key,v_state.career_date);
    v_relevance:=private.position_skill_development_multiplier(p_player_id,v_skill.skill_key);
    v_profile_bonus:=CASE
      WHEN v_coach.profile='Rígido' AND private.skill_load_group(v_skill.skill_key)='physical' THEN 5
      WHEN v_coach.profile='Técnico' AND private.skill_load_group(v_skill.skill_key)='technical' THEN 5
      WHEN v_coach.profile='Teórico' AND private.skill_load_group(v_skill.skill_key)='tactical' THEN 6
      WHEN v_coach.profile='Equilibrado' THEN 2
      ELSE 0 END;
    v_score:=(100-v_skill.level)*0.12 + COALESCE((v_status->>'days_since_stimulus')::numeric,0)*1.5 + (v_relevance-0.9)*35 + v_profile_bonus + v_gap*0.8
      + CASE v_status->>'code' WHEN 'losing_rhythm' THEN 20 WHEN 'low_stimulus' THEN 12 WHEN 'recovering' THEN 5 ELSE 0 END;
    IF v_score>v_best_score THEN v_best_score:=v_score; v_best:=v_skill; END IF;
  END LOOP;
  IF v_best.player_id IS NULL THEN RETURN NULL; END IF;
  v_status:=private.skill_status_payload(p_player_id,v_best.skill_key,v_state.career_date);
  v_activity:=private.skill_recommended_activity(v_best.skill_key);
  v_reason:=CASE
    WHEN v_status->>'code'='losing_rhythm' THEN 'Essa capacidade está perdendo ritmo e a comissão quer recuperar o estímulo.'
    WHEN v_status->>'code'='low_stimulus' THEN 'Essa capacidade está recebendo pouco estímulo na sua rotina recente.'
    WHEN v_gap>=3 THEN 'A concorrência na sua posição está acima do seu OVR e esse foco ajuda a atacar uma necessidade relevante.'
    WHEN v_coach.profile='Rígido' THEN 'O perfil rígido do treinador está cobrando mais consistência física e disciplina de treino.'
    WHEN v_coach.profile='Técnico' THEN 'O treinador técnico identificou uma área que pode melhorar sua execução com bola.'
    WHEN v_coach.profile='Teórico' THEN 'O treinador teórico está priorizando leitura e entendimento do jogo.'
    ELSE 'É uma área relevante para sua posição e para o momento atual da carreira.' END;
  RETURN jsonb_build_object('skill_key',v_best.skill_key,'skill_label',v_best.label,'status',v_status->>'label','activity',v_activity,'reason',v_reason,'competitor_gap',v_gap,'coach_profile',v_coach.profile,'advisory_only',true);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_career_gameplay_advice()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid(); v_player uuid; v_state record; v_sponsor jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT id INTO v_player FROM public.jogadores WHERE user_id=v_user;
  IF v_player IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;
  PERFORM private.ensure_career_initialized(v_player);
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=v_player;
  SELECT jsonb_build_object('id',o.id,'brand',o.brand,'title',o.title,'reward',o.reward,'expires_on',o.expires_on,'profile',o.brand_profile,'requirements',o.requirements,'profile_data',o.profile_data,'fit_score',o.fit_score,'risk_level',o.risk_level)
  INTO v_sponsor FROM public.player_sponsor_opportunities o WHERE o.player_id=v_player AND o.status='available' AND o.available_from<=v_state.career_date AND o.expires_on>=v_state.career_date ORDER BY o.created_at LIMIT 1;
  RETURN jsonb_build_object(
    'coach_focus',private.coach_development_focus(v_player),
    'performance',private.current_performance_context(v_player),
    'recovery',jsonb_build_object(
      'next_day_energy_boost',v_state.next_day_energy_boost,'next_day_fatigue_recovery',v_state.next_day_fatigue_recovery,
      'injury_prevention_active',v_state.injury_prevention_until IS NOT NULL AND v_state.injury_prevention_until>=v_state.career_date,
      'mental_stability_active',v_state.mental_stability_until IS NOT NULL AND v_state.mental_stability_until>=v_state.career_date,
      'nutrition_active',v_state.nutrition_boost_until IS NOT NULL AND v_state.nutrition_boost_until>=v_state.career_date
    ),
    'sponsor_opportunity',v_sponsor,
    'match_engine_hooks',jsonb_build_object('ready',true,'note','Contexto físico e mental preparado para o futuro motor de partida; nenhuma simulação de jogo foi inventada.')
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_career_gameplay_advice() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_career_gameplay_advice() TO authenticated;

COMMIT;

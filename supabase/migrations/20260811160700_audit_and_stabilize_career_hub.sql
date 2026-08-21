-- Career Hub full audit/stabilization

-- Real crest assets already present in the repository.
UPDATE public.base_clubs SET shield_url = 'img/clubs/academia_aurora_sub_18.png' WHERE name = 'Academia Aurora Sub-18';
UPDATE public.base_clubs SET shield_url = 'img/clubs/atletico_do_vale_sub_18.png' WHERE name = 'Atlético do Vale Sub-18';
UPDATE public.base_clubs SET shield_url = 'img/clubs/ferroviario_central_sub_18.png' WHERE name = 'Ferroviário Central Sub-18';
UPDATE public.base_clubs SET shield_url = 'img/clubs/real_horizonte_sub_18.png' WHERE name = 'Real Horizonte Sub-18';
UPDATE public.base_clubs SET shield_url = 'img/clubs/uniao_litoranea_sub_18.png' WHERE name = 'União Litorânea Sub-18';

-- Direct/in-person conversations include a private character reply.
UPDATE private.career_event_templates
SET choices = $choices$[
  {"key":"humble","label":"“Vim para aprender e ajudar no que precisarem.”","result":"A postura tranquila foi bem recebida no primeiro contato.","reply_speaker":"Capitão","reply":"Boa. Chega junto, trabalha e o grupo vai te ajudar. Aqui ninguém ganha espaço só pelo nome.","effects":{"coach":2,"image":1,"locker":5,"ambition":-1}},
  {"key":"confident","label":"“Quero conquistar meu espaço o mais rápido possível.”","result":"Sua confiança chamou atenção — para o bem e para o mal.","reply_speaker":"Capitão","reply":"Gosto de confiança. Só lembra que aqui todo mundo quer jogar. Mostra isso no treino.","effects":{"ego":2,"fans":2,"coach":1,"image":3,"locker":-1,"ambition":4}},
  {"key":"quiet","label":"“Prefiro mostrar no campo.”","result":"Você manteve distância e deixou a primeira impressão em aberto.","reply_speaker":"Capitão","reply":"Justo. Então mostra. Só não fica isolado do grupo — aqui a gente precisa um do outro.","effects":{"coach":1,"media":-1,"locker":-2,"discipline":2}}
]$choices$::jsonb
WHERE event_key = 'arrival_dressing_room';

UPDATE private.career_event_templates
SET choices = $choices$[
  {"key":"minutes","label":"“Quero jogar. Não adianta ir para um clube maior e ficar no banco.”","result":"Seu empresário entendeu que minutos terão prioridade nas próximas conversas.","reply_speaker":"Empresário","reply":"Fechado. Vou priorizar projetos em que você tenha caminho real para jogar.","effects":{"fans":2,"agent":3,"board":1,"ambition":-1,"professionalism":2}},
  {"key":"big_club","label":"“Se aparecer um clube grande, quero saber na hora.”","result":"Seu empresário vai trabalhar sua exposição de forma mais agressiva.","reply_speaker":"Empresário","reply":"Entendi. Se um clube grande se mexer, você vai saber antes de todo mundo.","effects":{"fans":-3,"agent":5,"board":-3,"image":2,"media":3,"ambition":5,"pressure":3}},
  {"key":"money","label":"“Quero valorizar meu contrato. A parte financeira importa.”","result":"A conversa ficou mais comercial e objetiva.","reply_speaker":"Empresário","reply":"Certo. Vou usar seu desempenho para aumentar seu valor e proteger seu lado financeiro.","effects":{"ego":2,"fans":-4,"agent":4,"board":-2,"image":1,"ambition":3}},
  {"key":"stay","label":"“Não quero pensar em sair agora.”","result":"A mensagem de estabilidade tende a repercutir bem internamente.","reply_speaker":"Empresário","reply":"Perfeito. Então nada de alimentar rumor por enquanto. Foco total aqui.","effects":{"fans":5,"agent":-1,"board":4,"coach":2,"locker":2,"pressure":-2}}
]$choices$::jsonb
WHERE event_key = 'career_ambition';

UPDATE private.career_event_templates
SET choices = $choices$[
  {"key":"team_first","label":"“O mais importante é o time. Meu espaço vai chegar com trabalho.”","result":"A resposta passou segurança e espírito de grupo.","reply_speaker":"Repórter","reply":"Uma resposta bem segura para quem está chegando. Obrigado, vamos acompanhar seu começo por aqui.","effects":{"fans":3,"coach":2,"image":1,"media":1,"locker":3}},
  {"key":"ambitious","label":"“Eu vim para jogar. Quero mostrar que mereço ser titular.”","result":"A declaração ganhou manchetes e aumentou a expectativa sobre você.","reply_speaker":"Repórter","reply":"Então você já chega mirando a titularidade. Isso certamente vai virar assunto — obrigado pela franqueza.","effects":{"fans":2,"agent":3,"board":-1,"coach":-2,"image":4,"media":6,"locker":-2,"ambition":4,"pressure":6}},
  {"key":"direct","label":"“Se eu estiver melhor, espero jogar. Futebol é rendimento.”","result":"A sinceridade dividiu opiniões dentro e fora do clube.","reply_speaker":"Repórter","reply":"Direto ao ponto. Imagino que essa frase vá repercutir bastante no clube hoje.","effects":{"ego":3,"fans":4,"coach":-4,"image":3,"media":5,"locker":-3,"pressure":4}},
  {"key":"no_comment","label":"“Ainda é cedo. Prefiro não criar expectativa.”","result":"Você evitou a manchete, mas também não alimentou entusiasmo.","reply_speaker":"Repórter","reply":"Sem problema. Vamos deixar o campo falar primeiro então.","effects":{"fans":-1,"coach":1,"image":-1,"media":-3,"pressure":-2}}
]$choices$::jsonb
WHERE event_key = 'media_adaptation';

UPDATE private.career_event_templates
SET choices = $choices$[
  {"key":"normal","label":"“Era meu tempo livre. Estou totalmente comprometido com o clube.”","result":"Você tratou o assunto como parte normal da vida fora do futebol.","reply_speaker":"Jornalista","reply":"Entendido. Sua explicação vai entrar na matéria junto com a foto.","effects":{"fans":1,"board":-1,"coach":-1,"image":1,"media":2}},
  {"key":"apologize","label":"“Talvez não tenha sido o melhor momento. Vou cuidar melhor disso.”","result":"A postura reduziu a polêmica, mas reforçou que havia algo a explicar.","reply_speaker":"Jornalista","reply":"Obrigado por responder. A postura de reconhecer o momento também vai ser registrada.","effects":{"fans":1,"board":3,"coach":3,"image":-1,"media":-1,"discipline":3}},
  {"key":"attack_press","label":"“Estão procurando problema onde não existe.”","result":"A resposta aumentou a temperatura da história e dividiu a torcida.","reply_speaker":"Jornalista","reply":"Certo. Então fica registrada sua crítica à cobertura. Imagino que isso ainda renda discussão.","effects":{"ego":4,"fans":3,"board":-3,"coach":-2,"image":3,"media":-6,"pressure":5}}
]$choices$::jsonb
WHERE event_key = 'night_out_spotted';

UPDATE private.career_event_templates
SET choices = $choices$[
  {"key":"team","label":"“Semana de trabalho com o grupo. Seguimos juntos.”","result":"A publicação reforçou uma imagem ligada ao coletivo.","reply_speaker":"Assessor de imagem","reply":"Boa. Vou publicar essa versão. Ela mantém o foco no grupo e evita transformar você no centro da história.","effects":{"fans":2,"board":2,"image":1,"media":-1,"locker":3}},
  {"key":"ambitious","label":"“Trabalhando em silêncio. Meu objetivo é chegar ao topo.”","result":"A mensagem aumentou a atenção sobre sua ambição pessoal.","reply_speaker":"Assessor de imagem","reply":"Fechado. É uma mensagem forte e mais pessoal. Pode esperar mais atenção em cima do seu nome.","effects":{"fans":1,"agent":2,"image":4,"media":3,"locker":-1,"ambition":2,"pressure":3}},
  {"key":"provocative","label":"“Podem falar. Eu sei o que sou capaz de fazer.”","result":"A frase ganhou repercussão e dividiu a reação em torno do seu nome.","reply_speaker":"Assessor de imagem","reply":"Vou publicar, mas essa é daquelas frases que fogem do nosso controle quando começam a circular.","effects":{"ego":3,"fans":4,"board":-2,"coach":-2,"image":5,"media":6,"locker":-2,"pressure":5}},
  {"key":"simple","label":"“Mais um dia. 🙏”","result":"A publicação passou quase sem ruído e manteve sua exposição controlada.","reply_speaker":"Assessor de imagem","reply":"Perfeito. Simples, sem alimentar nenhuma narrativa desnecessária.","effects":{"fans":1,"image":1,"media":-1,"pressure":-1}}
]$choices$::jsonb
WHERE event_key = 'social_media_tone';

UPDATE private.career_event_templates
SET choices = $choices$[
  {"key":"club","label":"“Representar este clube é uma responsabilidade enorme.”","result":"A publicação reforçou sua ligação com o clube.","reply_speaker":"Equipe de comunicação","reply":"Ótimo. Essa frase conecta bem a campanha com o clube. Vamos usar essa.","effects":{"fans":4,"board":4,"image":3,"media":1,"locker":1}},
  {"key":"personal","label":"“É só o começo. Quero que todos lembrem do meu nome.”","result":"A frase chamou atenção e fortaleceu sua marca pessoal.","reply_speaker":"Equipe de comunicação","reply":"Tem personalidade. É mais ousada, mas vai chamar atenção para a campanha — e para você.","effects":{"ego":3,"fans":1,"board":-1,"image":7,"media":4,"locker":-2,"ambition":3,"pressure":4}},
  {"key":"simple","label":"“Feliz pela oportunidade. Obrigado a todos que acompanham.”","result":"A mensagem foi segura e evitou qualquer ruído.","reply_speaker":"Equipe de comunicação","reply":"Perfeito. É limpa, positiva e funciona para a campanha sem criar ruído.","effects":{"fans":2,"board":2,"image":2,"media":0}}
]$choices$::jsonb
WHERE event_key = 'sponsor_quote';

CREATE OR REPLACE FUNCTION public.resolve_career_event(p_event_id uuid, p_choice_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_player record;
  v_event record;
  v_template record;
  v_choice jsonb;
  v_effects jsonb;
  v_result text;
  v_reply text;
  v_reply_speaker text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT * INTO v_player FROM public.jogadores WHERE user_id = v_user;
  IF v_player.id IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;
  SELECT * INTO v_event FROM public.player_career_events
  WHERE id = p_event_id AND player_id = v_player.id AND status = 'pending' FOR UPDATE;
  IF v_event.id IS NULL THEN RAISE EXCEPTION 'Decisão não encontrada ou já resolvida.'; END IF;
  SELECT * INTO v_template FROM private.career_event_templates WHERE event_key = v_event.event_key;
  SELECT e INTO v_choice FROM jsonb_array_elements(v_template.choices) e WHERE e->>'key' = p_choice_key LIMIT 1;
  IF v_choice IS NULL THEN RAISE EXCEPTION 'Opção inválida.'; END IF;
  v_effects := COALESCE(v_choice->'effects', '{}'::jsonb);
  v_result := COALESCE(v_choice->>'result', 'Sua decisão foi registrada.');
  v_reply_speaker := COALESCE(v_choice->>'reply_speaker', v_event.source, 'Carreira');
  v_reply := COALESCE(v_choice->>'reply', v_result);
  PERFORM private.apply_career_effects(v_player.id, v_effects);
  UPDATE public.player_career_events SET status='resolved',chosen_key=p_choice_key,result_text=v_result,resolved_at=now() WHERE id=p_event_id;
  RETURN jsonb_build_object('success',true,'result',v_result,'reply_speaker',v_reply_speaker,'reply',v_reply,'event_key',v_event.event_key);
END;
$function$;
REVOKE ALL ON FUNCTION public.resolve_career_event(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_career_event(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION private.advance_career_clock(p_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_state record;
  v_new_date date;
  v_new_period smallint;
  v_contract record;
  v_recovery integer;
  v_energy_gain integer;
  v_fatigue_drop integer;
BEGIN
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=p_player_id FOR UPDATE;
  v_new_date:=v_state.career_date;
  v_new_period:=v_state.day_period+1;
  IF v_new_period>2 THEN
    v_new_period:=0;
    v_new_date:=v_state.career_date+1;
    v_recovery:=COALESCE(v_state.recovery_modifier,0);
    v_energy_gain:=GREATEST(7,12+ROUND(v_recovery*0.40)::int);
    v_fatigue_drop:=GREATEST(2,4+ROUND(v_recovery*0.25)::int);
    UPDATE public.player_career_state SET
      energy=private.career_clamp(energy+v_energy_gain),
      fatigue=private.career_clamp(fatigue-v_fatigue_drop),
      pressure=private.career_clamp(pressure-2),
      injury_days=GREATEST(0,injury_days-1),
      injury_status=CASE WHEN injury_days-1<=0 THEN 'healthy' ELSE injury_status END,
      injury_label=CASE WHEN injury_days-1<=0 THEN NULL ELSE injury_label END
    WHERE player_id=p_player_id;
    SELECT * INTO v_contract FROM public.player_contracts WHERE player_id=p_player_id AND status='active' ORDER BY signed_at DESC LIMIT 1;
    IF v_state.last_salary_date IS NOT NULL AND v_new_date>=v_state.last_salary_date+30 THEN
      UPDATE public.player_career_state SET cash_balance=cash_balance+COALESCE(v_contract.monthly_wage,0),last_salary_date=v_new_date WHERE player_id=p_player_id;
      INSERT INTO public.player_messages(player_id,club_id,message_type,subject,body,metadata)
      VALUES(p_player_id,v_contract.club_id,'career','Salário recebido','O pagamento mensal do seu contrato foi depositado na sua conta.',jsonb_build_object('kind','salary','amount',COALESCE(v_contract.monthly_wage,0)));
    END IF;
  END IF;
  UPDATE public.player_career_state SET career_date=v_new_date,day_period=v_new_period,updated_at=now() WHERE player_id=p_player_id;
END;
$function$;
REVOKE ALL ON FUNCTION private.advance_career_clock(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.perform_career_activity(p_activity_key text,p_intensity text DEFAULT 'normal'::text,p_duration integer DEFAULT 60)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid:=auth.uid(); v_player record; v_state record; v_contract record; v_club record; v_coach record;
  v_session jsonb; v_session_key text; v_activity record; v_effects jsonb;
  v_duration_mult numeric:=1; v_gain_mult numeric:=1; v_cost_mult numeric:=1; v_repeat_count int:=0; v_repeat_mult numeric:=1;
  v_skill jsonb:='{}'::jsonb; v_base_skill jsonb:='{}'::jsonb; v_pair record; v_risk numeric:=0;
  v_base_energy int:=0; v_base_fatigue int:=0; v_base_morale int:=0; v_base_coach int:=0; v_base_locker int:=0; v_base_pressure int:=0; v_base_form int:=0;
  v_team_gain numeric:=1; v_team_cost numeric:=1; v_injured boolean:=false; v_title text; v_summary text; v_category text; v_event_id uuid; v_roll numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT * INTO v_player FROM public.jogadores WHERE user_id=v_user;
  IF v_player.id IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;
  PERFORM private.ensure_career_initialized(v_player.id);
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=v_player.id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.player_career_events WHERE player_id=v_player.id AND status='pending') THEN RAISE EXCEPTION 'Você tem uma conversa ou decisão pendente. Resolva antes de seguir a rotina.'; END IF;
  SELECT * INTO v_contract FROM public.player_contracts WHERE player_id=v_player.id AND status='active' ORDER BY signed_at DESC LIMIT 1;
  SELECT * INTO v_club FROM public.base_clubs WHERE id=v_contract.club_id;
  SELECT * INTO v_coach FROM public.base_coaches WHERE id=v_club.coach_id;
  IF v_state.career_date>=v_state.next_match_date AND v_state.day_period>=1 THEN RAISE EXCEPTION 'Você chegou ao horário do jogo. A mecânica de partida ainda será definida.'; END IF;
  v_session:=private.team_session_for_period(v_state.career_date,v_state.day_period,v_coach.profile);

  IF v_session IS NOT NULL THEN
    IF p_activity_key NOT IN ('team_training_light','team_training_normal','team_training_intense','team_training_skip') THEN RAISE EXCEPTION 'Há um treino coletivo agendado neste período. Escolha como participar.'; END IF;
    IF v_state.injury_days>0 AND p_activity_key IN ('team_training_normal','team_training_intense') THEN RAISE EXCEPTION 'A equipe médica liberou apenas carga reduzida ou recuperação neste treino coletivo.'; END IF;
    v_title:=v_session->>'title'; v_category:='team_training'; v_session_key:=v_session->>'key';
    IF p_activity_key='team_training_skip' THEN
      v_effects:='{"energy":10,"fatigue":-5,"morale":2,"coach":-10,"locker":-3,"board":-1,"pressure":2,"discipline":-4}'::jsonb;
      v_summary:='Você não participou do treino coletivo e priorizou sua condição física.'; v_risk:=0;
      INSERT INTO public.player_messages(player_id,club_id,message_type,subject,body,metadata)
      VALUES(v_player.id,v_club.id,'career','Ausência no treino coletivo',v_coach.name||' registrou sua ausência na atividade do grupo. A decisão pode pesar na forma como o treinador enxerga seu comprometimento.',jsonb_build_object('kind','coach_reaction','activity','team_training_skip'));
    ELSE
      CASE v_session_key
        WHEN 'team_physical' THEN v_base_energy:=-15;v_base_fatigue:=8;v_base_morale:=0;v_base_coach:=4;v_base_locker:=2;v_base_pressure:=1;v_base_form:=1;v_risk:=5;v_base_skill:='{"stamina":8,"strength":6,"sprint":4}'::jsonb;v_summary:='Você completou o trabalho físico com o grupo e sentiu a carga da sessão.';
        WHEN 'team_tactical' THEN v_base_energy:=-9;v_base_fatigue:=3;v_base_morale:=1;v_base_coach:=4;v_base_locker:=2;v_base_pressure:=-1;v_base_form:=1;v_risk:=1;v_base_skill:='{"tactical_awareness":12,"positioning":8}'::jsonb;v_summary:='Você trabalhou posicionamento e organização tática junto do elenco.';
        WHEN 'team_collective' THEN v_base_energy:=-12;v_base_fatigue:=5;v_base_morale:=1;v_base_coach:=4;v_base_locker:=3;v_base_pressure:=0;v_base_form:=1;v_risk:=3;v_base_skill:='{"tactical_awareness":6,"positioning":5,"short_pass":5,"dribbling":3}'::jsonb;v_summary:='Você participou das situações coletivas e trabalhou decisões com companheiros.';
        WHEN 'team_setpieces' THEN v_base_energy:=-7;v_base_fatigue:=2;v_base_morale:=1;v_base_coach:=3;v_base_locker:=2;v_base_pressure:=-1;v_base_form:=1;v_risk:=1;v_base_skill:='{"free_kicks":5,"positioning":4,"tactical_awareness":4}'::jsonb;v_summary:='Você participou das rotinas de bola parada e ajustes finais do grupo.';
        WHEN 'team_activation' THEN v_base_energy:=-5;v_base_fatigue:=1;v_base_morale:=1;v_base_coach:=2;v_base_locker:=1;v_base_pressure:=-1;v_base_form:=2;v_risk:=0;v_base_skill:='{"positioning":2,"tactical_awareness":2}'::jsonb;v_summary:='Você concluiu a ativação sem transformar a véspera em uma sessão pesada.';
        ELSE v_base_energy:=-10;v_base_fatigue:=4;v_base_morale:=1;v_base_coach:=3;v_base_locker:=2;v_base_pressure:=0;v_base_form:=1;v_risk:=2;v_base_skill:='{"tactical_awareness":5,"positioning":3}'::jsonb;v_summary:='Você concluiu a atividade coletiva do clube.';
      END CASE;
      IF p_activity_key='team_training_light' THEN v_team_cost:=0.60;v_team_gain:=0.68;v_base_coach:=GREATEST(1,v_base_coach-2);v_base_locker:=GREATEST(0,v_base_locker-1);v_risk:=v_risk*0.35;v_summary:=v_summary||' Você controlou a carga e participou em ritmo reduzido.';
      ELSIF p_activity_key='team_training_intense' THEN v_team_cost:=1.45;v_team_gain:=1.35;v_base_coach:=LEAST(6,v_base_coach+1);v_base_pressure:=v_base_pressure+1;v_risk:=v_risk+8;v_summary:=v_summary||' Você puxou o ritmo acima do que estava programado.';
      ELSE v_team_cost:=1.00;v_team_gain:=1.00; END IF;
      FOR v_pair IN SELECT key,value FROM jsonb_each_text(v_base_skill) LOOP v_skill:=v_skill||jsonb_build_object(v_pair.key,ROUND(v_pair.value::numeric*v_team_gain,2)); END LOOP;
      v_effects:=jsonb_build_object('energy',ROUND(v_base_energy*v_team_cost)::int,'fatigue',ROUND(v_base_fatigue*v_team_cost)::int,'morale',v_base_morale,'coach',v_base_coach,'locker',v_base_locker,'pressure',v_base_pressure,'form',v_base_form,'skills',v_skill);
    END IF;
  ELSE
    SELECT * INTO v_activity FROM private.career_activity_catalog WHERE activity_key=p_activity_key;
    IF v_activity.activity_key IS NULL THEN RAISE EXCEPTION 'Atividade inválida.'; END IF;
    IF v_state.injury_days>0 AND p_activity_key IN ('sprint','strength','endurance','heading_session','defensive_session','teammate_extra','dribble_session','finishing') THEN RAISE EXCEPTION 'A equipe médica não liberou esta atividade durante sua recuperação.'; END IF;
    IF v_activity.cash_delta<0 AND v_state.cash_balance<ABS(v_activity.cash_delta) THEN RAISE EXCEPTION 'Saldo insuficiente para esta atividade.'; END IF;
    IF v_activity.supports_intensity THEN IF p_intensity NOT IN ('light','normal','intense') THEN RAISE EXCEPTION 'Intensidade inválida.'; END IF; ELSE p_intensity:='normal'; END IF;
    IF v_activity.supports_duration THEN IF p_duration NOT IN (30,60,90) THEN RAISE EXCEPTION 'Duração inválida.'; END IF; ELSE p_duration:=v_activity.base_duration; END IF;
    v_duration_mult:=CASE p_duration WHEN 30 THEN 0.65 WHEN 90 THEN 1.35 ELSE 1 END;
    v_gain_mult:=CASE p_intensity WHEN 'light' THEN 0.72 WHEN 'intense' THEN 1.35 ELSE 1 END;
    v_cost_mult:=CASE p_intensity WHEN 'light' THEN 0.62 WHEN 'intense' THEN 1.55 ELSE 1 END;
    SELECT COUNT(*) INTO v_repeat_count FROM public.player_career_actions WHERE player_id=v_player.id AND activity_key=p_activity_key AND career_date>=v_state.career_date-2;
    v_repeat_mult:=GREATEST(0.45,1-(v_repeat_count*0.18));
    FOR v_pair IN SELECT key,value FROM jsonb_each_text(v_activity.skill_effects) LOOP v_skill:=v_skill||jsonb_build_object(v_pair.key,ROUND(v_pair.value::numeric*v_duration_mult*v_gain_mult*v_repeat_mult,2)); END LOOP;
    v_effects:=jsonb_build_object('energy',ROUND(CASE WHEN v_activity.energy_delta<0 THEN v_activity.energy_delta*v_duration_mult*v_cost_mult ELSE v_activity.energy_delta END)::int,'fatigue',ROUND(CASE WHEN v_activity.fatigue_delta>0 THEN v_activity.fatigue_delta*v_duration_mult*v_cost_mult ELSE v_activity.fatigue_delta END)::int,'morale',v_activity.morale_delta,'coach',v_activity.trust_delta,'form',v_activity.form_delta,'media',v_activity.media_delta,'fans',v_activity.fan_delta,'locker',v_activity.locker_delta,'board',v_activity.board_delta,'agent',v_activity.agent_delta,'image',v_activity.image_delta,'personal',v_activity.personal_delta,'pressure',v_activity.pressure_delta,'cash',v_activity.cash_delta,'skills',v_skill);
    v_title:=v_activity.title;v_category:=v_activity.category;v_summary:=v_activity.result_summary;
    v_risk:=v_activity.base_injury_risk+GREATEST(0,50-v_state.energy)*0.45+GREATEST(0,v_state.fatigue-50)*0.45+CASE WHEN p_intensity='intense' THEN 10 ELSE 0 END+CASE WHEN p_duration=90 THEN 4 ELSE 0 END;
    IF v_activity.event_key IS NOT NULL THEN IF v_activity.event_key='night_out_spotted' THEN v_roll:=random();IF v_roll<0.34 THEN v_event_id:=private.spawn_career_event(v_player.id,v_activity.event_key);END IF; ELSE v_event_id:=private.spawn_career_event(v_player.id,v_activity.event_key);END IF; END IF;
  END IF;

  PERFORM private.apply_career_effects(v_player.id,v_effects);
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=v_player.id FOR UPDATE;
  IF p_activity_key='physio' AND v_state.injury_days>0 THEN
    UPDATE public.player_career_state SET injury_days=GREATEST(0,injury_days-1),injury_status=CASE WHEN injury_days-1<=0 THEN 'healthy' ELSE injury_status END,injury_label=CASE WHEN injury_days-1<=0 THEN NULL ELSE injury_label END,updated_at=now() WHERE player_id=v_player.id;
    v_summary:=v_summary||' A fisioterapia também adiantou sua recuperação médica.';
    SELECT * INTO v_state FROM public.player_career_state WHERE player_id=v_player.id FOR UPDATE;
  END IF;
  IF v_state.injury_days=0 AND v_risk>0 AND random()*100<LEAST(55,v_risk) THEN
    v_injured:=true;
    UPDATE public.player_career_state SET injury_status='minor',injury_label='Sobrecarga muscular',injury_days=2+FLOOR(random()*4)::int,fatigue=private.career_clamp(fatigue+6),energy=private.career_clamp(energy-5),updated_at=now() WHERE player_id=v_player.id;
    v_summary:=v_summary||' No fim da atividade, você sentiu uma sobrecarga e foi encaminhado para avaliação.';
    INSERT INTO public.player_messages(player_id,club_id,message_type,subject,body,metadata) VALUES(v_player.id,v_club.id,'career','Departamento médico','Você apresentou sinais de sobrecarga muscular. A equipe médica recomenda reduzir a carga até a liberação.',jsonb_build_object('kind','medical','status','minor'));
  END IF;
  INSERT INTO public.player_career_actions(player_id,career_date,day_period,activity_key,category,title,intensity,duration_minutes,result_summary,hidden_effects)
  VALUES(v_player.id,v_state.career_date,v_state.day_period,p_activity_key,v_category,v_title,CASE WHEN v_session IS NULL THEN p_intensity ELSE replace(p_activity_key,'team_training_','') END,CASE WHEN v_session IS NULL THEN p_duration ELSE NULL END,v_summary,v_effects);
  PERFORM private.advance_career_clock(v_player.id);
  RETURN jsonb_build_object('success',true,'summary',v_summary,'event_created',v_event_id IS NOT NULL,'injured',v_injured);
END;
$function$;
REVOKE ALL ON FUNCTION public.perform_career_activity(text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.perform_career_activity(text,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.advance_career_period()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_user uuid:=auth.uid();v_player record;v_state record;v_contract record;v_club record;v_coach record;v_session jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT * INTO v_player FROM public.jogadores WHERE user_id=v_user;
  IF v_player.id IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;
  PERFORM private.ensure_career_initialized(v_player.id);
  IF EXISTS(SELECT 1 FROM public.player_career_events WHERE player_id=v_player.id AND status='pending') THEN RAISE EXCEPTION 'Você tem uma conversa ou decisão pendente. Resolva antes de seguir a rotina.'; END IF;
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=v_player.id FOR UPDATE;
  SELECT * INTO v_contract FROM public.player_contracts WHERE player_id=v_player.id AND status='active' ORDER BY signed_at DESC LIMIT 1;
  SELECT * INTO v_club FROM public.base_clubs WHERE id=v_contract.club_id;
  SELECT * INTO v_coach FROM public.base_coaches WHERE id=v_club.coach_id;
  IF v_state.career_date>=v_state.next_match_date AND v_state.day_period>=1 THEN RETURN jsonb_build_object('success',false,'match_pending',true,'message','Você chegou ao horário do jogo. A partida fica parada aqui até definirmos a mecânica.'); END IF;
  v_session:=private.team_session_for_period(v_state.career_date,v_state.day_period,v_coach.profile);
  IF v_session IS NOT NULL THEN RAISE EXCEPTION 'Há um treino coletivo agendado. Escolha como participar antes de avançar.'; END IF;
  PERFORM private.apply_career_effects(v_player.id,'{"energy":4,"fatigue":-2,"pressure":-1}'::jsonb);
  INSERT INTO public.player_career_actions(player_id,career_date,day_period,activity_key,category,title,result_summary,hidden_effects)
  VALUES(v_player.id,v_state.career_date,v_state.day_period,'free_period','recovery','Período livre','Você deixou o período passar sem marcar nenhuma atividade.','{"energy":4,"fatigue":-2,"pressure":-1}'::jsonb);
  PERFORM private.advance_career_clock(v_player.id);
  RETURN jsonb_build_object('success',true,'message','Período avançado.');
END;
$function$;
REVOKE ALL ON FUNCTION public.advance_career_period() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_career_period() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_career_hub()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_user uuid:=auth.uid();v_player record;v_state record;v_contract record;v_club record;v_coach record;v_session jsonb;v_readiness int;v_actions jsonb;v_skills jsonb;v_event jsonb;v_recent jsonb;v_week jsonb;v_unread int;v_match_locked boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT * INTO v_player FROM public.jogadores WHERE user_id=v_user;
  IF v_player.id IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;
  PERFORM private.ensure_career_initialized(v_player.id);
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=v_player.id;
  SELECT * INTO v_contract FROM public.player_contracts WHERE player_id=v_player.id AND status='active' ORDER BY signed_at DESC LIMIT 1;
  SELECT * INTO v_club FROM public.base_clubs WHERE id=v_contract.club_id;
  SELECT * INTO v_coach FROM public.base_coaches WHERE id=v_club.coach_id;
  v_session:=private.team_session_for_period(v_state.career_date,v_state.day_period,v_coach.profile);
  v_match_locked:=v_state.career_date>=v_state.next_match_date AND v_state.day_period>=1;
  v_readiness:=private.career_clamp(ROUND((v_state.energy*0.45)+((100-v_state.fatigue)*0.28)+(v_state.morale*0.14)+(v_state.form*0.13)-CASE WHEN v_state.injury_days>0 THEN 25 ELSE 0 END)::int);
  SELECT COALESCE(jsonb_agg(jsonb_build_object('key',activity_key,'category',category,'title',title,'description',description,'icon',icon,'load',load_label,'supports_intensity',supports_intensity,'supports_duration',supports_duration,'base_duration',base_duration,'disabled_reason',CASE WHEN v_state.injury_days>0 AND activity_key IN ('sprint','strength','endurance','heading_session','defensive_session','teammate_extra','dribble_session','finishing') THEN 'Você está em recuperação e este trabalho físico não está liberado.' WHEN cash_delta<0 AND v_state.cash_balance<ABS(cash_delta) THEN 'Saldo insuficiente para esta atividade.' ELSE NULL END) ORDER BY category,title),'[]'::jsonb) INTO v_actions FROM private.career_activity_catalog;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('key',skill_key,'label',label,'category',category,'parent_attribute',parent_attribute,'level',level,'progress',ROUND(progress,0)) ORDER BY category,label),'[]'::jsonb) INTO v_skills FROM public.player_skill_development WHERE player_id=v_player.id;
  SELECT to_jsonb(e) INTO v_event FROM (SELECT id,event_key,source,title,body,choices,status,created_at FROM public.player_career_events WHERE player_id=v_player.id AND status='pending' ORDER BY created_at ASC LIMIT 1)e;
  SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC),'[]'::jsonb) INTO v_recent FROM (SELECT id,career_date,day_period,activity_key,category,title,intensity,duration_minutes,result_summary,created_at FROM public.player_career_actions WHERE player_id=v_player.id ORDER BY created_at DESC LIMIT 6)a;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('date',d::date,'label',to_char(d,'DD/MM'),'dow',EXTRACT(DOW FROM d)::int,'morning',private.team_session_for_period(d::date,0::smallint,v_coach.profile),'is_match_day',(d::date=v_state.next_match_date)) ORDER BY d),'[]'::jsonb) INTO v_week FROM generate_series(v_state.career_date::timestamp,(v_state.career_date+6)::timestamp,interval '1 day')d;
  SELECT COUNT(*) INTO v_unread FROM public.player_messages WHERE player_id=v_player.id AND is_read=false;
  RETURN jsonb_build_object(
    'player',jsonb_build_object('id',v_player.id,'name',v_player.nome,'nickname',v_player.apelido,'avatar',v_player.avatar,'age',v_player.idade,'position',v_player.posicao,'archetype',v_player.arquetipo,'attributes',v_player.atributos),
    'club',jsonb_build_object('id',v_club.id,'name',v_club.name,'shield_url',v_club.shield_url,'formation',v_club.formation,'play_style',v_club.play_style),
    'coach',jsonb_build_object('id',v_coach.id,'name',v_coach.name,'profile',v_coach.profile),
    'contract',jsonb_build_object('monthly_wage',v_contract.monthly_wage,'squad_role',v_contract.squad_role,'duration_seasons',v_contract.duration_seasons),
    'state',jsonb_build_object('date',v_state.career_date,'period',v_state.day_period,'next_match_date',v_state.next_match_date,'energy',v_state.energy,'fatigue',v_state.fatigue,'readiness',v_readiness,'injury_risk',private.career_risk_label(v_state.energy,v_state.fatigue,v_state.injury_days),'injury_status',v_state.injury_status,'injury_label',v_state.injury_label,'injury_days',v_state.injury_days,'morale',private.career_relation_label(v_state.morale),'trust',private.career_relation_label(v_state.trust),'form',private.career_relation_label(v_state.form),'pressure',CASE WHEN v_state.pressure>=75 THEN 'Muito alta' WHEN v_state.pressure>=55 THEN 'Alta' WHEN v_state.pressure>=35 THEN 'Moderada' ELSE 'Baixa' END,'cash',v_state.cash_balance,'hierarchy',v_state.hierarchy,'weekly_objective',v_state.weekly_objective,'environment',jsonb_build_object('coach',private.career_relation_label(v_state.trust),'locker_room',private.career_relation_label(v_state.locker_room_relation),'fans',private.career_relation_label(v_state.fan_relation),'media',private.career_relation_label(v_state.media_relation),'board',private.career_relation_label(v_state.board_relation),'agent',private.career_relation_label(v_state.agent_relation),'public_image',private.career_relation_label(v_state.public_image),'personal_life',private.career_relation_label(v_state.personal_life))),
    'current_session',v_session,'match_locked',v_match_locked,'activities',v_actions,'skills',v_skills,'pending_event',v_event,'recent_actions',v_recent,'week',v_week,'unread_messages',v_unread
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.get_career_hub() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_career_hub() TO authenticated;

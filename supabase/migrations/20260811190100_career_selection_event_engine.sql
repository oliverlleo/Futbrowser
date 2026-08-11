BEGIN;

CREATE OR REPLACE FUNCTION private.apply_career_effects(p_player_id uuid,p_effects jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_skills jsonb; v_pair record;
BEGIN
  UPDATE public.player_career_state SET
    energy=private.career_clamp(energy+COALESCE((p_effects->>'energy')::int,0)),
    fatigue=private.career_clamp(fatigue+COALESCE((p_effects->>'fatigue')::int,0)),
    morale=private.career_clamp(morale+COALESCE((p_effects->>'morale')::int,0)),
    trust=private.career_clamp(trust+COALESCE((p_effects->>'coach')::int,0)),
    form=private.career_clamp(form+COALESCE((p_effects->>'form')::int,0)),
    media_relation=private.career_clamp(media_relation+COALESCE((p_effects->>'media')::int,0)),
    fan_relation=private.career_clamp(fan_relation+COALESCE((p_effects->>'fans')::int,0)),
    locker_room_relation=private.career_clamp(locker_room_relation+COALESCE((p_effects->>'locker')::int,0)),
    board_relation=private.career_clamp(board_relation+COALESCE((p_effects->>'board')::int,0)),
    agent_relation=private.career_clamp(agent_relation+COALESCE((p_effects->>'agent')::int,0)),
    public_image=private.career_clamp(public_image+COALESCE((p_effects->>'image')::int,0)),
    personal_life=private.career_clamp(personal_life+COALESCE((p_effects->>'personal')::int,0)),
    pressure=private.career_clamp(pressure+COALESCE((p_effects->>'pressure')::int,0)),
    cash_balance=GREATEST(0,cash_balance+COALESCE((p_effects->>'cash')::int,0)),
    fame=GREATEST(0,LEAST(100,fame+COALESCE((p_effects->>'fame')::int,0))),
    fanbase=GREATEST(0,fanbase+COALESCE((p_effects->>'fanbase')::int,0)),
    personality=personality||jsonb_build_object(
      'professionalism',private.career_clamp(COALESCE((personality->>'professionalism')::int,50)+COALESCE((p_effects->>'professionalism')::int,0)),
      'ambition',private.career_clamp(COALESCE((personality->>'ambition')::int,50)+COALESCE((p_effects->>'ambition')::int,0)),
      'leadership',private.career_clamp(COALESCE((personality->>'leadership')::int,40)+COALESCE((p_effects->>'leadership')::int,0)),
      'discipline',private.career_clamp(COALESCE((personality->>'discipline')::int,50)+COALESCE((p_effects->>'discipline')::int,0)),
      'sociability',private.career_clamp(COALESCE((personality->>'sociability')::int,50)+COALESCE((p_effects->>'sociability')::int,0)),
      'ego',private.career_clamp(COALESCE((personality->>'ego')::int,45)+COALESCE((p_effects->>'ego')::int,0))
    ),updated_at=now()
  WHERE player_id=p_player_id;
  v_skills:=p_effects->'skills';
  IF v_skills IS NOT NULL AND jsonb_typeof(v_skills)='object' THEN
    FOR v_pair IN SELECT key,value FROM jsonb_each_text(v_skills) LOOP
      PERFORM private.add_skill_progress(p_player_id,v_pair.key,v_pair.value::numeric);
    END LOOP;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION private.spawn_context_event(p_player_id uuid,p_event_key text,p_metadata jsonb DEFAULT '{}'::jsonb,p_source text DEFAULT NULL,p_body text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
  IF EXISTS(SELECT 1 FROM public.player_career_events WHERE player_id=p_player_id AND status='pending') THEN RETURN NULL; END IF;
  v_id:=private.spawn_career_event(p_player_id,p_event_key);
  IF v_id IS NOT NULL THEN
    UPDATE public.player_career_events SET metadata=COALESCE(p_metadata,'{}'::jsonb),source=COALESCE(p_source,source),body=COALESCE(p_body,body) WHERE id=v_id;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION private.context_event_probability(p_player_id uuid,p_base numeric,p_pregame_bonus numeric DEFAULT 0)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v record; v_pre numeric:=0;
BEGIN
  SELECT fame,fanbase,career_date,next_match_date INTO v FROM public.player_career_state WHERE player_id=p_player_id;
  IF v.next_match_date IS NOT NULL AND v.next_match_date-v.career_date<=1 THEN v_pre:=p_pregame_bonus; END IF;
  RETURN LEAST(0.70,GREATEST(0,p_base+LEAST(0.24,COALESCE(v.fame,0)*0.0025)+LEAST(0.16,COALESCE(v.fanbase,0)/25000.0)+v_pre));
END; $$;

CREATE OR REPLACE FUNCTION private.maybe_generate_sponsor_opportunity(p_player_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v record; v_score numeric; v_chance numeric; v_id uuid; v_brand text; v_reward int;
  v_brands text[]:=ARRAY['Norte Sports','Vértice Energy','Eleven Wear','Pulso Tech','Arena+','Ritmo Nutrition','Linha de Fundo','Sprint Mobile'];
BEGIN
  SELECT * INTO v FROM public.player_career_state WHERE player_id=p_player_id FOR UPDATE;
  UPDATE public.player_sponsor_opportunities SET status='expired' WHERE player_id=p_player_id AND status='available' AND expires_on<v.career_date;
  IF EXISTS(SELECT 1 FROM public.player_sponsor_opportunities WHERE player_id=p_player_id AND status='available' AND expires_on>=v.career_date) THEN RETURN NULL; END IF;
  v_score:=COALESCE(v.fame,0)+(COALESCE(v.fanbase,0)/100.0)+(COALESCE(v.form,50)/4.0)+(GREATEST(0,COALESCE(v.public_image,50)-50)/2.0);
  IF v_score<35 THEN RETURN NULL; END IF;
  v_chance:=LEAST(0.24,0.01+COALESCE(v.fame,0)*0.002+COALESCE(v.fanbase,0)/50000.0+GREATEST(0,COALESCE(v.form,50)-60)*0.0015);
  IF random()>=v_chance THEN RETURN NULL; END IF;
  v_brand:=v_brands[1+FLOOR(random()*array_length(v_brands,1))::int];
  v_reward:=LEAST(3000,250+COALESCE(v.fame,0)*25+COALESCE(v.fanbase,0)/18);
  INSERT INTO public.player_sponsor_opportunities(player_id,brand,title,reward,available_from,expires_on)
  VALUES(p_player_id,v_brand,'Ação com '||v_brand,v_reward,v.career_date,v.career_date+3) RETURNING id INTO v_id;
  INSERT INTO public.player_messages(player_id,club_id,message_type,subject,body,metadata)
  SELECT p_player_id,club_id,'career','Nova oportunidade de patrocinador',v_brand||' quer você em uma ação comercial. A oportunidade fica disponível por poucos dias e pode render R$ '||v_reward||'. Ela apareceu por causa da sua exposição, forma e crescimento de público.',jsonb_build_object('kind','sponsor_opportunity','opportunity_id',v_id,'brand',v_brand,'reward',v_reward,'expires_on',v.career_date+3)
  FROM public.player_contracts WHERE player_id=p_player_id AND status='active' ORDER BY signed_at DESC LIMIT 1;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION private.pick_interaction_teammate(p_player_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT r.teammate_id
  FROM public.player_teammate_relations r
  JOIN public.base_ai_players ai ON ai.id=r.teammate_id
  JOIN public.jogadores j ON j.id=r.player_id
  WHERE r.player_id=p_player_id
  ORDER BY(ai.primary_position=j.posicao) DESC,r.relation ASC,random()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.roll_squad_week_event(p_player_id uuid,p_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_state record; v_contract record; v_ai record; v_status text; v_reason text; v_reasons text[]:=ARRAY['desconforto muscular','pancada no treino','quadro gripal','controle de carga','dor no tornozelo','incômodo no adutor']; v_doubt record;
BEGIN
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=p_player_id;
  SELECT * INTO v_contract FROM public.player_contracts WHERE player_id=p_player_id AND status='active' ORDER BY signed_at DESC LIMIT 1;
  IF v_contract.id IS NULL OR v_state.next_match_date IS NULL OR p_date>=v_state.next_match_date THEN RETURN; END IF;
  INSERT INTO private.career_squad_week_rolls(player_id,match_date,roll_date) VALUES(p_player_id,v_state.next_match_date,p_date) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT a.*,ai.name INTO v_doubt FROM private.career_squad_availability a JOIN public.base_ai_players ai ON ai.id=a.ai_player_id WHERE a.player_id=p_player_id AND a.match_date=v_state.next_match_date AND a.status='doubt' ORDER BY random() LIMIT 1;
  IF v_doubt.ai_player_id IS NOT NULL AND random()<0.30 THEN
    DELETE FROM private.career_squad_availability WHERE player_id=p_player_id AND ai_player_id=v_doubt.ai_player_id AND match_date=v_state.next_match_date;
    INSERT INTO public.player_messages(player_id,club_id,message_type,subject,body,metadata) VALUES(p_player_id,v_contract.club_id,'career','Atualização do elenco: '||v_doubt.name,v_doubt.name||' voltou a treinar normalmente e deixou de ser dúvida para o próximo jogo.',jsonb_build_object('kind','squad_news','ai_player_id',v_doubt.ai_player_id,'status','available','match_date',v_state.next_match_date));
  END IF;
  IF random()>=0.16 THEN RETURN; END IF;
  SELECT ai.* INTO v_ai FROM public.base_ai_players ai WHERE ai.club_id=v_contract.club_id AND NOT EXISTS(SELECT 1 FROM private.career_squad_availability a WHERE a.player_id=p_player_id AND a.ai_player_id=ai.id AND a.match_date=v_state.next_match_date) ORDER BY(CASE WHEN ai.is_starter THEN 0 ELSE 1 END),random() LIMIT 1;
  IF v_ai.id IS NULL THEN RETURN; END IF;
  v_status:=CASE WHEN random()<0.36 THEN 'out' ELSE 'doubt' END;
  v_reason:=v_reasons[1+FLOOR(random()*array_length(v_reasons,1))::int];
  INSERT INTO private.career_squad_availability(player_id,ai_player_id,match_date,status,reason,occurred_on) VALUES(p_player_id,v_ai.id,v_state.next_match_date,v_status,v_reason,p_date)
  ON CONFLICT(player_id,ai_player_id,match_date) DO UPDATE SET status=EXCLUDED.status,reason=EXCLUDED.reason,occurred_on=EXCLUDED.occurred_on,updated_at=now();
  INSERT INTO public.player_messages(player_id,club_id,message_type,subject,body,metadata)
  VALUES(p_player_id,v_contract.club_id,'career','Notícia do elenco: '||v_ai.name,CASE WHEN v_status='out' THEN v_ai.name||' teve '||v_reason||' e está fora do próximo jogo. A comissão já trabalha em uma alternativa.' ELSE v_ai.name||' apresentou '||v_reason||' e virou dúvida para o próximo jogo. A situação será reavaliada antes da lista final.' END,jsonb_build_object('kind','squad_news','ai_player_id',v_ai.id,'status',v_status,'reason',v_reason,'match_date',v_state.next_match_date));
END; $$;

CREATE OR REPLACE FUNCTION private.finalize_squad_availability(p_player_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_state record; v_contract record; v_row record; v_final text;
BEGIN
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=p_player_id;
  IF v_state.next_match_date IS NULL OR v_state.career_date<v_state.next_match_date-1 THEN RETURN; END IF;
  SELECT * INTO v_contract FROM public.player_contracts WHERE player_id=p_player_id AND status='active' ORDER BY signed_at DESC LIMIT 1;
  FOR v_row IN SELECT a.*,ai.name FROM private.career_squad_availability a JOIN public.base_ai_players ai ON ai.id=a.ai_player_id WHERE a.player_id=p_player_id AND a.match_date=v_state.next_match_date AND a.status='doubt' LOOP
    IF random()<0.45 THEN
      UPDATE private.career_squad_availability SET status='out',reason=reason||' · não liberado na avaliação final',updated_at=now() WHERE player_id=p_player_id AND ai_player_id=v_row.ai_player_id AND match_date=v_state.next_match_date;
      v_final:='fora';
    ELSE
      DELETE FROM private.career_squad_availability WHERE player_id=p_player_id AND ai_player_id=v_row.ai_player_id AND match_date=v_state.next_match_date;
      v_final:='liberado';
    END IF;
    INSERT INTO public.player_messages(player_id,club_id,message_type,subject,body,metadata) VALUES(p_player_id,v_contract.club_id,'career','Boletim final: '||v_row.name,CASE WHEN v_final='fora' THEN v_row.name||' não foi liberado e está fora do jogo.' ELSE v_row.name||' foi liberado e fica disponível para a partida.' END,jsonb_build_object('kind','squad_news_final','ai_player_id',v_row.ai_player_id,'status',CASE WHEN v_final='fora' THEN 'out' ELSE 'available' END,'match_date',v_state.next_match_date));
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION private.calculate_selection_projection(p_player_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_state record; v_player record; v_contract record; v_ovr int; v_comp int; v_score numeric; v_status text; v_reason text; v_team_normal int:=0; v_team_intense int:=0; v_team_light int:=0; v_skips int:=0; v_individual int:=0; v_pregame_nights int:=0; v_readiness int; v_role_base int; v_starter_threshold int; v_bench_threshold int; v_severe boolean:=false; v_hard_out boolean:=false;
BEGIN
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=p_player_id;
  SELECT * INTO v_player FROM public.jogadores WHERE id=p_player_id;
  SELECT * INTO v_contract FROM public.player_contracts WHERE player_id=p_player_id AND status='active' ORDER BY signed_at DESC LIMIT 1;
  IF v_contract.id IS NULL THEN RETURN jsonb_build_object('status','out','score',0,'reason','Sem contrato ativo.'); END IF;
  v_ovr:=public.calculate_player_ovr(v_player.atributos);
  SELECT COALESCE(MAX(ai.ovr),(SELECT ROUND(AVG(ai2.ovr))::int FROM public.base_ai_players ai2 WHERE ai2.club_id=v_contract.club_id)) INTO v_comp
  FROM public.base_ai_players ai WHERE ai.club_id=v_contract.club_id AND ai.primary_position=v_player.posicao AND NOT EXISTS(SELECT 1 FROM private.career_squad_availability av WHERE av.player_id=p_player_id AND av.ai_player_id=ai.id AND av.match_date=v_state.next_match_date AND av.status='out');
  SELECT COUNT(*) FILTER(WHERE activity_key='team_training_normal'),COUNT(*) FILTER(WHERE activity_key='team_training_intense'),COUNT(*) FILTER(WHERE activity_key='team_training_light'),COUNT(*) FILTER(WHERE activity_key='team_training_skip'),COUNT(*) FILTER(WHERE category='training'),COUNT(*) FILTER(WHERE activity_key='night_out' AND career_date>=v_state.next_match_date-2)
  INTO v_team_normal,v_team_intense,v_team_light,v_skips,v_individual,v_pregame_nights FROM public.player_career_actions WHERE player_id=p_player_id AND career_date>=v_state.career_date-6;
  v_readiness:=private.career_clamp(ROUND((v_state.energy*0.45)+((100-v_state.fatigue)*0.28)+(v_state.morale*0.14)+(v_state.form*0.13)-CASE WHEN v_state.injury_days>0 THEN 25 ELSE 0 END)::int);
  v_role_base:=CASE v_contract.squad_role WHEN 'Estrela' THEN 80 WHEN 'Titular' THEN 73 WHEN 'Rotação' THEN 58 WHEN 'Reserva' THEN 45 WHEN 'Promessa' THEN 38 ELSE 48 END;
  v_starter_threshold:=CASE v_contract.squad_role WHEN 'Estrela' THEN 59 WHEN 'Titular' THEN 63 WHEN 'Rotação' THEN 70 WHEN 'Reserva' THEN 77 WHEN 'Promessa' THEN 82 ELSE 72 END;
  v_bench_threshold:=CASE v_contract.squad_role WHEN 'Estrela' THEN 30 WHEN 'Titular' THEN 34 WHEN 'Rotação' THEN 45 WHEN 'Reserva' THEN 42 WHEN 'Promessa' THEN 38 ELSE 44 END;
  v_score:=v_role_base+(v_state.trust-50)*0.34+(v_state.form-50)*0.24+(v_state.locker_room_relation-50)*0.08+(v_readiness-70)*0.16+(v_ovr-COALESCE(v_comp,v_ovr))*1.35+v_team_normal*3+v_team_intense*4+v_team_light*1.5+LEAST(5,v_individual)-v_skips*14-v_pregame_nights*14;
  v_severe:=v_state.injury_days>0 OR v_skips>=2 OR v_state.trust<20 OR(v_pregame_nights>=1 AND v_state.trust<35 AND v_state.form<40);
  v_hard_out:=v_state.injury_days>0 OR v_readiness<22 OR(v_state.trust<15 AND v_state.form<30) OR(v_skips>=2 AND v_state.trust<35) OR(v_pregame_nights>=2 AND v_state.trust<30);
  IF v_state.injury_days>0 THEN v_status:='out'; v_reason:='O departamento médico não liberou você para a partida.';
  ELSIF v_contract.squad_role IN('Titular','Estrela') AND v_hard_out THEN v_status:='out'; v_reason:=CASE WHEN v_readiness<22 THEN 'Sua condição física caiu a um ponto em que a comissão decidiu preservar você completamente.' WHEN v_skips>=2 THEN 'As ausências repetidas, somadas à perda de confiança, tiraram você até do banco.' WHEN v_pregame_nights>=2 THEN 'A preparação fora de campo e a baixa confiança fizeram a comissão cortar seu nome da relação.' ELSE 'A combinação de forma muito baixa e relação deteriorada com o treinador foi grave o bastante para tirar você da relação.' END;
  ELSIF v_score>=v_starter_threshold THEN v_status:='starter'; v_reason:='Sua semana, condição, concorrência disponível e relação com a comissão sustentam uma vaga no time inicial.';
  ELSIF v_contract.squad_role IN('Titular','Estrela') AND NOT v_severe THEN v_status:='bench'; v_reason:='Você perdeu força para começar jogando, mas seu status no elenco ainda mantém você entre os relacionados.';
  ELSIF v_score>=v_bench_threshold THEN v_status:='bench'; v_reason:='Você está entre os relacionados, mas a disputa e sua semana ainda não garantem a titularidade.';
  ELSE v_status:='out'; v_reason:=CASE WHEN v_skips>=2 THEN 'As ausências em treino pesaram demais na decisão do treinador.' WHEN v_pregame_nights>0 THEN 'A preparação fora de campo pesou contra sua convocação.' WHEN v_state.trust<30 THEN 'A relação com o treinador está baixa demais para garantir lugar no banco.' ELSE 'A combinação de forma, concorrência e semana deixou você fora da relação.' END; END IF;
  RETURN jsonb_build_object('status',v_status,'score',ROUND(v_score,1),'reason',v_reason,'player_ovr',v_ovr,'competitor_ovr',v_comp,'readiness',v_readiness,'team_sessions',v_team_normal+v_team_intense+v_team_light,'missed_sessions',v_skips,'extra_training',v_individual,'pregame_nights',v_pregame_nights);
END; $$;

CREATE OR REPLACE FUNCTION private.selection_email_body(p_player_id uuid,p_status text,p_match_date date,p_is_debut boolean,p_number int)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_player text; v_coach text; v_intro text; v_line text; v_close text; v_arr text[]; v_lines text[]; v_closes text[];
BEGIN
  SELECT j.apelido,c.name INTO v_player,v_coach FROM public.jogadores j JOIN public.player_career_state s ON s.player_id=j.id JOIN public.base_coaches c ON c.id=s.coach_id WHERE j.id=p_player_id;
  IF p_is_debut THEN
    v_arr:=ARRAY['Chegou a hora da sua primeira lista com a gente.','Primeira semana concluída. Agora começa a parte que vale ponto.','Sua estreia está perto e eu fechei a relação do jogo.','Você chegou há pouco, mas já deu para observar bastante coisa.','A primeira convocação sempre pesa mais. Quero que você leia isso com calma.','Fechamos a lista para sua possível estreia.','Essa é sua primeira decisão de jogo comigo.','A semana de adaptação acabou. A lista da estreia está definida.','Primeiro jogo, primeira cobrança de verdade.','A estreia começa antes do apito: começa com a forma como você recebe essa mensagem.'];
  ELSE
    v_arr:=ARRAY['Fechei a relação para o próximo jogo.','A semana terminou e a decisão está tomada.','A lista do jogo está pronta.','Conversei com a comissão e definimos o grupo.','Terminamos a última avaliação antes da partida.','A preparação da semana já disse bastante.','Chegamos à véspera e não vou deixar dúvida sobre seu papel.','A convocação está fechada.','Depois do que vi nos últimos dias, defini sua situação.','A equipe está montada para amanhã.','O treino de hoje encerrou a disputa da semana.','Agora é jogo. A lista está definida.','A comissão fechou o plano para a partida.','Sua semana foi colocada na balança.','Terminei a análise do elenco para amanhã.','O grupo que vai para o jogo está decidido.','Chegou a mensagem que todo jogador espera na véspera.','O plano de jogo está pronto e seu nome já tem um papel definido.','Fechamos a preparação. Agora você precisa saber onde está.','A semana acabou; a decisão para o jogo não muda mais.'];
  END IF;
  v_intro:=v_arr[1+FLOOR(random()*array_length(v_arr,1))::int];
  IF p_status='starter' THEN v_lines:=ARRAY['Você começa jogando. Confiei no que vi durante a semana e quero você ligado desde o primeiro minuto.','Seu nome está entre os onze. Não é prêmio: é responsabilidade.','Você vai de titular. A vaga veio pelo conjunto da semana, agora precisa ser sustentada no jogo.','Começa jogando. Quero intensidade com cabeça, não ansiedade.','Está no time inicial. Aproveite a oportunidade sem tentar resolver tudo sozinho.'];
  ELSIF p_status='bench' THEN v_lines:=ARRAY['Você começa no banco, mas está dentro do plano. Esteja pronto porque posso precisar de você a qualquer momento.','Você foi relacionado e começa como opção. O jogo pode pedir você.','Banco amanhã. Não trate isso como castigo: quero você preparado para entrar e mudar o ritmo.','Você viaja com o grupo, começa fora dos onze e precisa estar pronto para a primeira chamada.','Está entre os relacionados, mas não começa. Sua resposta agora é preparação, não reclamação.'];
  ELSE v_lines:=ARRAY['Você não foi relacionado para esta partida. A decisão é esportiva e a próxima semana começa agora.','Seu nome ficou fora da lista. Quero reação no treino, não desânimo.','Você não vai para o banco amanhã. Há pontos da sua semana que precisam mudar.','Ficou fora da relação. Isso não fecha porta nenhuma, mas exige resposta.','Não está entre os convocados desta vez. Use isso para entender o que precisa entregar nos próximos dias.']; END IF;
  v_line:=v_lines[1+FLOOR(random()*array_length(v_lines,1))::int];
  v_closes:=ARRAY['Amanhã eu quero ver maturidade.','Chegue cedo e mantenha a cabeça no plano.','O que aconteceu nesta semana já passou; agora responda ao próximo passo.','Continue trabalhando. A hierarquia muda quando o campo dá motivo.','Se tiver dúvida, fala comigo antes do aquecimento.','Não quero teatro nem ansiedade. Quero profissionalismo.','Cada semana reabre a disputa.','Sua camisa é a '||COALESCE(p_number::text,'—')||'. Cuide dela.','A decisão vale para este jogo; sua trajetória é maior que um sábado.','Nos vemos no clube. — '||v_coach];
  v_close:=v_closes[1+FLOOR(random()*array_length(v_closes,1))::int];
  RETURN COALESCE(v_player,'Jogador')||E',\n\n'||v_intro||E'\n\n'||v_line||E'\n\nCamisa: '||COALESCE(p_number::text,'—')||' · Jogo: '||to_char(p_match_date,'DD/MM')||E'\n\n'||v_close;
END; $$;

CREATE OR REPLACE FUNCTION private.finalize_match_selection(p_player_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_state record; v_contract record; v_proj jsonb; v_num int; v_id uuid; v_debut boolean; v_body text; v_subject text;
BEGIN
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=p_player_id FOR UPDATE;
  IF v_state.next_match_date IS NULL THEN RETURN NULL; END IF;
  IF v_state.career_date<v_state.next_match_date-1 OR(v_state.career_date=v_state.next_match_date-1 AND v_state.day_period<1) THEN RETURN NULL; END IF;
  SELECT id INTO v_id FROM public.player_match_selections WHERE player_id=p_player_id AND match_date=v_state.next_match_date;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  SELECT number INTO v_num FROM public.player_squad_numbers WHERE player_id=p_player_id AND active ORDER BY assigned_at DESC LIMIT 1;
  IF v_num IS NULL THEN RETURN NULL; END IF;
  PERFORM private.finalize_squad_availability(p_player_id);
  SELECT * INTO v_contract FROM public.player_contracts WHERE player_id=p_player_id AND status='active' ORDER BY signed_at DESC LIMIT 1;
  v_proj:=private.calculate_selection_projection(p_player_id);
  v_debut:=NOT EXISTS(SELECT 1 FROM public.player_match_selections WHERE player_id=p_player_id);
  INSERT INTO public.player_match_selections(player_id,club_id,match_date,selection_status,score,reason,is_debut,shirt_number) VALUES(p_player_id,v_contract.club_id,v_state.next_match_date,v_proj->>'status',(v_proj->>'score')::numeric,v_proj->>'reason',v_debut,v_num) RETURNING id INTO v_id;
  v_subject:=CASE v_proj->>'status' WHEN 'starter' THEN 'Convocação: você começa jogando' WHEN 'bench' THEN 'Convocação: você está no banco' ELSE 'Convocação: fora da relação' END;
  v_body:=private.selection_email_body(p_player_id,v_proj->>'status',v_state.next_match_date,v_debut,v_num);
  INSERT INTO public.player_messages(player_id,club_id,message_type,subject,body,metadata) VALUES(p_player_id,v_contract.club_id,'career',v_subject,v_body,jsonb_build_object('kind','match_selection','selection_id',v_id,'status',v_proj->>'status','match_date',v_state.next_match_date,'is_debut',v_debut,'shirt_number',v_num,'reason',v_proj->>'reason'));
  UPDATE public.player_match_selections SET notified_at=now() WHERE id=v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION private.ensure_match_selection_if_due(p_player_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN PERFORM private.finalize_match_selection(p_player_id); END; $$;

CREATE OR REPLACE FUNCTION private.before_career_action_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_state record;
BEGIN
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=NEW.player_id;
  IF v_state.next_match_date IS NOT NULL AND v_state.career_date>=v_state.next_match_date-1 AND NOT EXISTS(SELECT 1 FROM public.player_squad_numbers WHERE player_id=NEW.player_id AND active) THEN RAISE EXCEPTION 'Escolha seu número de camisa antes de continuar a rotina da véspera.'; END IF;
  IF NEW.activity_key='sponsor_event' AND NOT EXISTS(SELECT 1 FROM public.player_sponsor_opportunities o WHERE o.player_id=NEW.player_id AND o.status='available' AND o.available_from<=v_state.career_date AND o.expires_on>=v_state.career_date) THEN RAISE EXCEPTION 'Nenhuma ação patrocinada está disponível agora.'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_before_career_action_guard ON public.player_career_actions;
CREATE TRIGGER trg_before_career_action_guard BEFORE INSERT ON public.player_career_actions FOR EACH ROW EXECUTE FUNCTION private.before_career_action_guard();

CREATE OR REPLACE FUNCTION private.after_career_action_engine()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_state record; v_prob numeric; v_event uuid; v_teammate uuid; v_name text; v_relation int; v_rival boolean; v_opp record; v_reward int; v_training_prob numeric;
BEGIN
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=NEW.player_id FOR UPDATE;
  IF NEW.activity_key='sponsor_event' THEN
    SELECT * INTO v_opp FROM public.player_sponsor_opportunities WHERE player_id=NEW.player_id AND status='available' AND available_from<=v_state.career_date AND expires_on>=v_state.career_date ORDER BY created_at LIMIT 1 FOR UPDATE;
    IF v_opp.id IS NOT NULL THEN v_reward:=v_opp.reward; UPDATE public.player_sponsor_opportunities SET status='completed',completed_at=now() WHERE id=v_opp.id; UPDATE public.player_career_state SET cash_balance=cash_balance+v_reward,fame=LEAST(100,fame+2),fanbase=fanbase+30 WHERE player_id=NEW.player_id; END IF;
  ELSIF NEW.activity_key='fan_meet' THEN UPDATE public.player_career_state SET fame=LEAST(100,fame+1),fanbase=fanbase+45 WHERE player_id=NEW.player_id;
  ELSIF NEW.activity_key='community_action' THEN UPDATE public.player_career_state SET fame=LEAST(100,fame+1),fanbase=fanbase+25 WHERE player_id=NEW.player_id;
  ELSIF NEW.activity_key='media_interview' THEN UPDATE public.player_career_state SET fame=LEAST(100,fame+1),fanbase=fanbase+10 WHERE player_id=NEW.player_id;
  ELSIF NEW.activity_key='social_media_post' THEN UPDATE public.player_career_state SET fanbase=fanbase+12 WHERE player_id=NEW.player_id; END IF;
  IF EXISTS(SELECT 1 FROM public.player_career_events WHERE player_id=NEW.player_id AND status='pending') THEN PERFORM private.maybe_generate_sponsor_opportunity(NEW.player_id); RETURN NEW; END IF;
  IF NEW.activity_key='night_out' THEN
    v_prob:=private.context_event_probability(NEW.player_id,0.08,0.20);
    IF random()<v_prob THEN IF v_state.next_match_date IS NOT NULL AND v_state.next_match_date-v_state.career_date<=1 THEN v_event:=private.spawn_context_event(NEW.player_id,'night_out_pregame_buzz',jsonb_build_object('activity_date',NEW.career_date)); ELSE v_event:=private.spawn_context_event(NEW.player_id,'night_out_headline',jsonb_build_object('activity_date',NEW.career_date)); END IF; END IF;
  ELSIF NEW.activity_key='team_training_skip' THEN v_prob:=private.context_event_probability(NEW.player_id,0.38,0.18); IF random()<v_prob THEN v_event:=private.spawn_context_event(NEW.player_id,'missed_training_confrontation',jsonb_build_object('activity_date',NEW.career_date)); END IF;
  ELSIF NEW.activity_key='team_training_intense' THEN IF random()<0.09 THEN v_event:=private.spawn_context_event(NEW.player_id,'coach_load_conversation',jsonb_build_object('activity_date',NEW.career_date)); END IF;
  ELSIF NEW.category='training' THEN v_training_prob:=CASE WHEN NEW.activity_key='teammate_extra' THEN 0.28 ELSE 0.07 END; IF random()<v_training_prob THEN v_event:=private.spawn_context_event(NEW.player_id,'coach_extra_training',jsonb_build_object('activity',NEW.activity_key)); END IF;
  ELSIF NEW.category='social' AND v_state.fame>=15 THEN v_prob:=private.context_event_probability(NEW.player_id,0.025,0.02); IF random()<v_prob THEN v_event:=private.spawn_context_event(NEW.player_id,'fans_spot_player_off_pitch',jsonb_build_object('activity',NEW.activity_key)); END IF; END IF;
  IF v_event IS NULL AND(v_state.last_interaction_date IS NULL OR v_state.last_interaction_date<NEW.career_date) AND random()<0.10 THEN
    IF random()<0.50 THEN v_event:=private.spawn_context_event(NEW.player_id,'coach_weekly_checkin',jsonb_build_object('kind','coach_interaction'));
    ELSE PERFORM private.ensure_teammate_relations(NEW.player_id); v_teammate:=private.pick_interaction_teammate(NEW.player_id); IF v_teammate IS NOT NULL THEN SELECT ai.name,r.relation,r.rivalry INTO v_name,v_relation,v_rival FROM public.base_ai_players ai JOIN public.player_teammate_relations r ON r.teammate_id=ai.id AND r.player_id=NEW.player_id WHERE ai.id=v_teammate; IF v_rival OR v_relation<=32 THEN v_event:=private.spawn_context_event(NEW.player_id,'rival_training_tension',jsonb_build_object('teammate_id',v_teammate,'kind','teammate_interaction'),v_name,NULL); ELSE v_event:=private.spawn_context_event(NEW.player_id,'teammate_locker_room',jsonb_build_object('teammate_id',v_teammate,'kind','teammate_interaction'),v_name,NULL); END IF; END IF; END IF;
    IF v_event IS NOT NULL THEN UPDATE public.player_career_state SET last_interaction_date=NEW.career_date WHERE player_id=NEW.player_id; END IF;
  END IF;
  PERFORM private.maybe_generate_sponsor_opportunity(NEW.player_id);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_after_career_action_engine ON public.player_career_actions;
CREATE TRIGGER trg_after_career_action_engine AFTER INSERT ON public.player_career_actions FOR EACH ROW EXECUTE FUNCTION private.after_career_action_engine();

CREATE OR REPLACE FUNCTION public.resolve_career_event(p_event_id uuid,p_choice_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid(); v_player record; v_event record; v_template record; v_choice jsonb; v_effects jsonb; v_result text; v_reply text; v_reply_speaker text; v_teammate uuid; v_rel_delta int; v_rival_delta int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT * INTO v_player FROM public.jogadores WHERE user_id=v_user; IF v_player.id IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;
  SELECT * INTO v_event FROM public.player_career_events WHERE id=p_event_id AND player_id=v_player.id AND status='pending' FOR UPDATE; IF v_event.id IS NULL THEN RAISE EXCEPTION 'Decisão não encontrada ou já resolvida.'; END IF;
  SELECT * INTO v_template FROM private.career_event_templates WHERE event_key=v_event.event_key;
  SELECT e INTO v_choice FROM jsonb_array_elements(v_template.choices)e WHERE e->>'key'=p_choice_key LIMIT 1; IF v_choice IS NULL THEN RAISE EXCEPTION 'Opção inválida.'; END IF;
  v_effects:=COALESCE(v_choice->'effects','{}'::jsonb); v_result:=COALESCE(v_choice->>'result','Sua decisão foi registrada.'); v_reply_speaker:=COALESCE(v_choice->>'reply_speaker',v_event.source,'Carreira'); v_reply:=COALESCE(v_choice->>'reply',v_result);
  PERFORM private.apply_career_effects(v_player.id,v_effects);
  v_teammate:=NULLIF(v_event.metadata->>'teammate_id','')::uuid;
  IF v_teammate IS NOT NULL THEN v_rel_delta:=COALESCE((v_effects->>'teammate_relation')::int,0); v_rival_delta:=COALESCE((v_effects->>'rivalry')::int,0); UPDATE public.player_teammate_relations SET relation=private.career_clamp(relation+v_rel_delta),chemistry=private.career_clamp(chemistry+ROUND(v_rel_delta*0.6)::int),rivalry=CASE WHEN v_rival_delta>0 OR relation+v_rel_delta<=30 THEN true WHEN v_rival_delta<0 AND relation+v_rel_delta>=45 THEN false ELSE rivalry END,updated_at=now() WHERE player_id=v_player.id AND teammate_id=v_teammate; END IF;
  UPDATE public.player_career_events SET status='resolved',chosen_key=p_choice_key,result_text=v_result,resolved_at=now() WHERE id=p_event_id;
  RETURN jsonb_build_object('success',true,'result',v_result,'reply_speaker',v_reply_speaker,'reply',v_reply,'event_key',v_event.event_key);
END; $$;

CREATE OR REPLACE FUNCTION public.choose_squad_number(p_number integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid(); v_player uuid; v_club uuid; v_available integer[]; v_choice int; v_existing int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT id INTO v_player FROM public.jogadores WHERE user_id=v_user; IF v_player IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;
  SELECT club_id INTO v_club FROM public.player_contracts WHERE player_id=v_player AND status='active' ORDER BY signed_at DESC LIMIT 1;
  SELECT number INTO v_existing FROM public.player_squad_numbers WHERE player_id=v_player AND active LIMIT 1; IF v_existing IS NOT NULL THEN RETURN jsonb_build_object('success',true,'number',v_existing,'already_chosen',true); END IF;
  v_available:=private.available_squad_numbers(v_player); IF cardinality(v_available)=0 THEN RAISE EXCEPTION 'Nenhum número elegível está livre.'; END IF;
  IF p_number IS NULL THEN SELECT n INTO v_choice FROM unnest(v_available)n ORDER BY random() LIMIT 1; ELSE IF NOT p_number=ANY(v_available) THEN RAISE EXCEPTION 'Esse número não está disponível para você neste momento.'; END IF; v_choice:=p_number; END IF;
  INSERT INTO public.player_squad_numbers(player_id,club_id,number,chosen_by) VALUES(v_player,v_club,v_choice,CASE WHEN p_number IS NULL THEN 'random' ELSE 'player' END);
  INSERT INTO public.player_messages(player_id,club_id,message_type,subject,body,metadata) VALUES(v_player,v_club,'career','Número de camisa confirmado','A rouparia confirmou: você vai usar a camisa '||v_choice||'.',jsonb_build_object('kind','shirt_number_confirmed','number',v_choice));
  PERFORM private.ensure_match_selection_if_due(v_player);
  RETURN jsonb_build_object('success',true,'number',v_choice,'already_chosen',false);
END; $$;
REVOKE ALL ON FUNCTION public.choose_squad_number(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.choose_squad_number(integer) TO authenticated;

COMMIT;

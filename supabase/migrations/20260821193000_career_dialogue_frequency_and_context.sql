BEGIN;

INSERT INTO private.career_event_templates(event_key,source,title,body,choices) VALUES
('coach_tactical_feedback','Treinador','O detalhe que muda sua função','Depois do estudo tático, o treinador chama você para comentar um movimento específico que pode mudar a forma como você participa das jogadas.',
 '[{"key":"ask_detail","label":"Pedir um exemplo claro para testar no próximo treino.","effects":{"coach":3,"professionalism":2,"pressure":1,"skills":{"tactical_awareness":3,"positioning":2}},"result":"Você saiu da conversa com uma tarefa concreta para o próximo treino.","reply_speaker":"Treinador","reply":"É isso que eu quero. Não basta entender a ideia; quero ver você reconhecer o momento certo de executá-la."},{"key":"trust","label":"Dizer que entendeu e vai aplicar sem complicar.","effects":{"coach":2,"discipline":2,"skills":{"tactical_awareness":2}},"result":"O treinador valorizou sua objetividade e espera ver a leitura aparecer em campo.","reply_speaker":"Treinador","reply":"Perfeito. O simples bem executado abre mais portas do que uma jogada inventada fora de hora."},{"key":"challenge","label":"Questionar se esse movimento combina mesmo com seu estilo.","effects":{"coach":-3,"ego":2,"ambition":2,"pressure":2},"result":"Você defendeu sua identidade, mas transformou a orientação em uma disputa de ideias.","reply_speaker":"Treinador","reply":"Ter personalidade é bom. Só não use isso como desculpa para não aprender uma função nova."}]'::jsonb),
('coach_role_expectation','Treinador','O que a comissão espera de você','A comissão percebe que seu papel no elenco ainda está indefinido e o treinador explica o que precisa ver para aumentar sua responsabilidade.',
 '[{"key":"accept_role","label":"Perguntar quais detalhes definem uma semana boa para você.","effects":{"coach":3,"professionalism":2,"ambition":1,"pressure":-1},"result":"Você transformou uma cobrança vaga em critérios que consegue perseguir.","reply_speaker":"Treinador","reply":"Constância, reação depois do erro e disponibilidade para o time. Se você entregar isso, o resto aparece."},{"key":"demand_minutes","label":"Perguntar diretamente quando terá mais minutos.","effects":{"coach":1,"ambition":3,"pressure":3},"result":"Você deixou claro que quer acelerar sua disputa por espaço.","reply_speaker":"Treinador","reply":"Minuto não vem por calendário. Vem quando eu acreditar que você sustenta a responsabilidade."},{"key":"stay_patient","label":"Dizer que aceita construir o espaço sem pressa.","effects":{"coach":2,"morale":2,"discipline":1,"ambition":-1},"result":"Sua paciência foi vista como maturidade, mas a comissão ainda espera iniciativa.","reply_speaker":"Treinador","reply":"Paciência é boa. Só não quero que ela vire acomodação."}]'::jsonb),
('medical_load_check','Fisioterapia','Seu corpo está dando um sinal','A equipe de recuperação percebe uma queda na sua disponibilidade e pede que você escolha entre preservar o corpo ou insistir na carga planejada.',
 '[{"key":"reduce","label":"Reduzir a carga e seguir o plano de recuperação.","effects":{"energy":5,"fatigue":-8,"morale":1,"discipline":2,"pressure":-2},"result":"Você recuperou parte do corpo e evitou transformar cansaço em problema maior.","reply_speaker":"Fisioterapia","reply":"Boa decisão. O objetivo não é vencer a terça-feira; é estar disponível quando o jogo pedir."},{"key":"continue","label":"Dizer que está bem e manter a rotina completa.","effects":{"energy":-3,"fatigue":5,"morale":2,"ambition":2,"pressure":2},"result":"Você manteve o plano, mas a comissão médica passou a acompanhar sua carga mais de perto.","reply_speaker":"Fisioterapia","reply":"Tudo bem, desde que você seja honesto se o sinal piorar. Não esconda dor para provar compromisso."},{"key":"ask_plan","label":"Pedir um ajuste específico sem abandonar completamente o trabalho.","effects":{"energy":2,"fatigue":-3,"professionalism":2,"discipline":1,"skills":{"stamina":2}},"result":"Você encontrou um meio-termo entre evolução e recuperação.","reply_speaker":"Fisioterapia","reply":"É assim que se trabalha. Ajustar não é desistir; é conseguir repetir o esforço amanhã."}]'::jsonb),
('matchday_briefing','Treinador','Seu papel no próximo jogo','Na preparação para o próximo compromisso, o treinador explica o tipo de decisão que pode fazer você ganhar espaço durante a partida.',
 '[{"key":"simple","label":"Dizer que vai priorizar decisões simples e cumprir a função.","effects":{"coach":3,"professionalism":2,"pressure":-2,"skills":{"decisions":2}},"result":"A comissão passou a confiar mais na sua capacidade de jogar dentro do plano.","reply_speaker":"Treinador","reply":"É isso. Quando você faz o simples no momento certo, o jogo começa a te oferecer coisas maiores."},{"key":"impact","label":"Dizer que quer entrar para mudar o ritmo do jogo.","effects":{"coach":1,"ambition":3,"pressure":3,"morale":2},"result":"Você assumiu uma postura agressiva e colocou expectativa sobre sua entrada.","reply_speaker":"Treinador","reply":"Gosto da fome. Só lembra que impacto não é fazer tudo sozinho."},{"key":"clarify","label":"Perguntar qual corredor e qual adversário exigem mais atenção.","effects":{"coach":3,"professionalism":2,"pressure":-1,"skills":{"tactical_awareness":3,"positioning":2}},"result":"Você recebeu um plano mais específico para ler o jogo antes de entrar.","reply_speaker":"Treinador","reply":"Boa pergunta. Se você enxergar o problema antes de receber, já começa um lance à frente."}]'::jsonb),
('agent_market_update','Empresário','Uma porta começou a se mexer','Seu empresário traz uma atualização sobre o mercado: ainda não existe proposta oficial, mas um clube começou a acompanhar seus minutos e seu momento.',
 '[{"key":"focus_current","label":"Pedir que ele priorize sua evolução no clube atual.","effects":{"agent":2,"board":2,"coach":1,"pressure":-2,"professionalism":1},"result":"Você deixou claro que não quer transformar qualquer rumor em distração.","reply_speaker":"Empresário","reply":"Entendido. Vou filtrar o ruído e te trazer apenas algo que realmente mude sua carreira."},{"key":"explore","label":"Pedir informações sobre o projeto e o espaço que você teria.","effects":{"agent":4,"ambition":2,"pressure":2,"fame":1},"result":"Seu empresário começou a mapear o interesse sem criar uma proposta automática.","reply_speaker":"Empresário","reply":"Vou investigar minutos, categoria e treinador. Nome de clube sozinho não significa projeto."},{"key":"push","label":"Pedir que ele pressione por uma oportunidade imediatamente.","effects":{"agent":3,"ambition":4,"board":-2,"pressure":4,"ego":1},"result":"Você acelerou a conversa, mas aumentou o risco de o vestiário perceber sua inquietação.","reply_speaker":"Empresário","reply":"Posso apertar, mas toda pressão tem custo. Se você quer sair, precisa estar pronto para sustentar essa escolha."}]'::jsonb),
('media_interview_followup','Imprensa','A pergunta que ficou de fora','Depois da entrevista, o jornalista retoma um ponto que não entrou na matéria: você se vê como promessa, concorrente ou titular do time?',
 '[{"key":"team","label":"Dizer que sua evolução precisa servir ao time.","effects":{"media":2,"fans":3,"image":2,"pressure":-1,"locker":2},"result":"A fala reforçou uma imagem coletiva sem esconder sua ambição.","reply_speaker":"Repórter","reply":"Uma resposta madura para alguém que ainda está construindo espaço. Vamos acompanhar o próximo jogo."},{"key":"claim","label":"Dizer que você já está pronto para responsabilidades maiores.","effects":{"media":5,"fans":2,"image":4,"ambition":3,"pressure":4,"coach":-1},"result":"A declaração aumentou sua exposição e também a cobrança sobre cada atuação.","reply_speaker":"Repórter","reply":"Então a próxima partida ganha uma camada extra de expectativa. Você mesmo colocou essa régua."},{"key":"avoid","label":"Dizer que prefere não criar uma narrativa antes de jogar.","effects":{"media":-2,"image":-1,"pressure":-2,"professionalism":1},"result":"Você reduziu o ruído externo, mas deixou a matéria sem uma frase de impacto.","reply_speaker":"Repórter","reply":"Tudo bem. O campo vai fornecer a próxima resposta."}]'::jsonb),
('community_reaction','Torcida','Uma ação que chegou até a arquibancada','Depois de uma atividade com a comunidade, uma família agradece sua presença e pergunta se você pretende repetir a visita.',
 '[{"key":"return","label":"Prometer que vai voltar quando a agenda permitir.","effects":{"fans":4,"fanbase":45,"fame":1,"personal":-1,"image":2},"result":"Você fortaleceu um vínculo real com a torcida, mesmo sabendo que sua agenda ficará mais apertada.","reply_speaker":"Torcida","reply":"A gente entende. Só de você ter parado para ouvir já fez diferença."},{"key":"honest","label":"Dizer que não quer prometer uma frequência que talvez não consiga cumprir.","effects":{"fans":2,"fanbase":25,"professionalism":2,"personal":1},"result":"A sinceridade foi bem recebida porque não transformou a ação em promessa vazia.","reply_speaker":"Torcida","reply":"Justo. Melhor falar assim do que aparecer uma vez e desaparecer depois."},{"key":"brand","label":"Aproveitar o momento para falar do seu crescimento e da sua imagem.","effects":{"fans":1,"fanbase":15,"image":4,"media":2,"ego":2},"result":"Você saiu com mais exposição pessoal, mas a conversa ficou mais centrada na sua marca.","reply_speaker":"Torcida","reply":"Boa sorte. A gente vai continuar olhando para o que você faz no campo também."}]'::jsonb),
('family_routine_call','Família','Uma ligação no fim do dia','Alguém da sua família liga para saber como você está lidando com a rotina, a cobrança e a distância de casa.',
 '[{"key":"open","label":"Contar como a semana realmente está sendo.","effects":{"personal":3,"morale":4,"pressure":-4,"professionalism":1},"result":"Falar sem esconder a pressão deixou a semana mais leve.","reply_speaker":"Família","reply":"Você não precisa transformar tudo em notícia boa. A gente prefere saber como você está de verdade."},{"key":"reassure","label":"Dizer que está tudo bem e tranquilizar todo mundo.","effects":{"morale":2,"personal":1,"pressure":-1,"discipline":1},"result":"Você protegeu a família da preocupação, mas continuou carregando parte do peso sozinho.","reply_speaker":"Família","reply":"Tudo bem. Só lembra que tranquilizar a gente não significa guardar tudo para você."},{"key":"short","label":"Dizer que está sem tempo e combinar outra conversa.","effects":{"personal":2,"pressure":1,"morale":-1},"result":"Você preservou a agenda, mas deixou uma conversa importante para depois.","reply_speaker":"Família","reply":"A gente entende. Só não deixa o futebol ocupar todos os espaços da sua vida."}]'::jsonb)
ON CONFLICT(event_key) DO UPDATE SET source=EXCLUDED.source,title=EXCLUDED.title,body=EXCLUDED.body,choices=EXCLUDED.choices;

CREATE OR REPLACE FUNCTION private.maybe_spawn_richer_dialogue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_state record;
  v_event uuid;
  v_key text;
  v_teammate uuid;
  v_name text;
  v_chance numeric:=0.20;
  v_roll numeric;
BEGIN
  SELECT * INTO v_state FROM public.player_career_state WHERE player_id=NEW.player_id FOR UPDATE;
  IF v_state.player_id IS NULL THEN RETURN NEW; END IF;

  IF EXISTS(SELECT 1 FROM public.player_career_events WHERE player_id=NEW.player_id AND status='pending') THEN
    UPDATE public.player_career_state
    SET last_interaction_date=GREATEST(COALESCE(last_interaction_date,NEW.career_date),NEW.career_date)
    WHERE player_id=NEW.player_id;
    RETURN NEW;
  END IF;

  IF v_state.last_interaction_date IS NOT NULL AND v_state.last_interaction_date>=NEW.career_date THEN RETURN NEW; END IF;

  IF NEW.activity_key='tactical_study' THEN
    v_key:='coach_tactical_feedback'; v_chance:=0.44;
  ELSIF NEW.activity_key='agent_meeting' THEN
    v_key:='agent_market_update'; v_chance:=0.42;
  ELSIF NEW.activity_key='media_interview' THEN
    v_key:='media_interview_followup'; v_chance:=0.38;
  ELSIF NEW.activity_key IN('community_action','fan_meet') THEN
    v_key:='community_reaction'; v_chance:=0.32;
  ELSIF NEW.category='recovery' THEN
    v_key:='medical_load_check'; v_chance:=0.30;
  ELSIF v_state.next_match_date IS NOT NULL AND v_state.next_match_date-v_state.career_date<=1 AND NEW.category='training' THEN
    v_key:='matchday_briefing'; v_chance:=0.34;
  ELSE
    v_chance:=CASE WHEN NEW.category='training' THEN 0.24 WHEN NEW.category='social' THEN 0.22 ELSE 0.18 END;
    v_roll:=random();
    IF v_roll<0.34 THEN
      v_key:='coach_weekly_checkin';
    ELSIF v_roll<0.58 THEN
      v_key:='family_routine_call';
    ELSE
      PERFORM private.ensure_teammate_relations(NEW.player_id);
      v_teammate:=private.pick_interaction_teammate(NEW.player_id);
      IF v_teammate IS NOT NULL THEN
        v_key:=private.pick_teammate_dialogue_event(NEW.player_id,v_teammate,NEW.activity_key);
        SELECT name INTO v_name FROM public.base_ai_players WHERE id=v_teammate;
      END IF;
      IF v_key IS NULL THEN v_key:='coach_weekly_checkin'; END IF;
    END IF;
  END IF;

  IF random()>=v_chance THEN RETURN NEW; END IF;

  IF v_teammate IS NOT NULL AND v_key LIKE 'mate_%' THEN
    v_event:=private.spawn_context_event(NEW.player_id,v_key,jsonb_build_object('kind','teammate_interaction','teammate_id',v_teammate,'activity',NEW.activity_key),v_name,NULL);
  ELSE
    v_event:=private.spawn_context_event(NEW.player_id,v_key,jsonb_build_object('kind','contextual_dialogue','activity',NEW.activity_key));
  END IF;

  IF v_event IS NOT NULL THEN
    UPDATE public.player_career_state SET last_interaction_date=NEW.career_date WHERE player_id=NEW.player_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zzzzzz_richer_dialogue ON public.player_career_actions;
CREATE TRIGGER trg_zzzzzz_richer_dialogue
AFTER INSERT ON public.player_career_actions
FOR EACH ROW EXECUTE FUNCTION private.maybe_spawn_richer_dialogue();

COMMIT;

-- Esta camada mantém no máximo um diálogo por dia, mas deixa de depender de um sorteio genérico de 10%.
-- Atividades com contexto forte agora têm diálogos próprios e os templates de companheiros deixam de ficar escondidos atrás de apenas duas chaves genéricas.

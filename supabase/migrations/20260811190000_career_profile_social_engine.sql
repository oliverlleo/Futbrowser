BEGIN;

ALTER TABLE public.player_career_state
  ADD COLUMN IF NOT EXISTS fame integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS fanbase integer NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS debut_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_interaction_date date,
  ADD COLUMN IF NOT EXISTS last_weekly_report_date date,
  ADD COLUMN IF NOT EXISTS last_monthly_report_date date;

ALTER TABLE public.player_career_events
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.base_ai_players
  ADD COLUMN IF NOT EXISTS squad_number integer;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY club_id
           ORDER BY is_starter DESC,
                    CASE primary_position
                      WHEN 'Goleiro' THEN 1 WHEN 'Lateral Direito' THEN 2 WHEN 'Zagueiro' THEN 3
                      WHEN 'Lateral Esquerdo' THEN 4 WHEN 'Volante' THEN 5 WHEN 'Meio-Campo' THEN 6
                      WHEN 'Meia Direita' THEN 7 WHEN 'Meia Esquerda' THEN 8
                      WHEN 'Ponta Direita' THEN 9 WHEN 'Ponta Esquerda' THEN 10 WHEN 'Atacante' THEN 11 ELSE 12 END,
                    ovr DESC,id
         ) AS rn
  FROM public.base_ai_players
), numbered AS (
  SELECT id,(ARRAY[1,2,3,4,5,6,8,12,13,14,15,16,17,18,20,21,22,23])[rn] AS num
  FROM ranked
)
UPDATE public.base_ai_players p
SET squad_number=n.num
FROM numbered n
WHERE p.id=n.id AND p.squad_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_base_ai_players_club_squad_number
  ON public.base_ai_players(club_id,squad_number) WHERE squad_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.player_squad_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.base_clubs(id) ON DELETE CASCADE,
  number integer NOT NULL CHECK(number BETWEEN 1 AND 99),
  chosen_by text NOT NULL DEFAULT 'player' CHECK(chosen_by IN ('player','random','club')),
  active boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_player_squad_numbers_active_player ON public.player_squad_numbers(player_id) WHERE active;
CREATE UNIQUE INDEX IF NOT EXISTS uq_player_squad_numbers_active_club_number ON public.player_squad_numbers(club_id,number) WHERE active;
ALTER TABLE public.player_squad_numbers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner Squad Number Select" ON public.player_squad_numbers;
CREATE POLICY "Owner Squad Number Select" ON public.player_squad_numbers FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM public.jogadores j WHERE j.id=player_id AND j.user_id=(SELECT auth.uid())));
REVOKE ALL ON public.player_squad_numbers FROM anon,authenticated;
GRANT SELECT ON public.player_squad_numbers TO authenticated;

CREATE TABLE IF NOT EXISTS public.player_teammate_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,
  teammate_id uuid NOT NULL REFERENCES public.base_ai_players(id) ON DELETE CASCADE,
  relation integer NOT NULL DEFAULT 50 CHECK(relation BETWEEN 0 AND 100),
  rivalry boolean NOT NULL DEFAULT false,
  chemistry integer NOT NULL DEFAULT 50 CHECK(chemistry BETWEEN 0 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(player_id,teammate_id)
);
CREATE INDEX IF NOT EXISTS idx_player_teammate_relations_player ON public.player_teammate_relations(player_id);
ALTER TABLE public.player_teammate_relations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner Teammate Relations Select" ON public.player_teammate_relations;
CREATE POLICY "Owner Teammate Relations Select" ON public.player_teammate_relations FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM public.jogadores j WHERE j.id=player_id AND j.user_id=(SELECT auth.uid())));
REVOKE ALL ON public.player_teammate_relations FROM anon,authenticated;
GRANT SELECT ON public.player_teammate_relations TO authenticated;

CREATE TABLE IF NOT EXISTS public.player_sponsor_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,
  brand text NOT NULL,
  title text NOT NULL,
  reward integer NOT NULL CHECK(reward>=0),
  status text NOT NULL DEFAULT 'available' CHECK(status IN ('available','completed','expired')),
  available_from date NOT NULL,
  expires_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_player_sponsor_opportunities_player_status ON public.player_sponsor_opportunities(player_id,status,expires_on);
ALTER TABLE public.player_sponsor_opportunities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner Sponsor Opportunities Select" ON public.player_sponsor_opportunities;
CREATE POLICY "Owner Sponsor Opportunities Select" ON public.player_sponsor_opportunities FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM public.jogadores j WHERE j.id=player_id AND j.user_id=(SELECT auth.uid())));
REVOKE ALL ON public.player_sponsor_opportunities FROM anon,authenticated;
GRANT SELECT ON public.player_sponsor_opportunities TO authenticated;

CREATE TABLE IF NOT EXISTS public.player_match_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.base_clubs(id) ON DELETE CASCADE,
  match_date date NOT NULL,
  selection_status text NOT NULL CHECK(selection_status IN ('starter','bench','out')),
  score numeric(6,2) NOT NULL,
  reason text NOT NULL,
  is_debut boolean NOT NULL DEFAULT false,
  shirt_number integer,
  locked_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  UNIQUE(player_id,match_date)
);
CREATE INDEX IF NOT EXISTS idx_player_match_selections_player_date ON public.player_match_selections(player_id,match_date DESC);
ALTER TABLE public.player_match_selections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner Match Selections Select" ON public.player_match_selections;
CREATE POLICY "Owner Match Selections Select" ON public.player_match_selections FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM public.jogadores j WHERE j.id=player_id AND j.user_id=(SELECT auth.uid())));
REVOKE ALL ON public.player_match_selections FROM anon,authenticated;
GRANT SELECT ON public.player_match_selections TO authenticated;

CREATE TABLE IF NOT EXISTS public.player_development_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,
  report_type text NOT NULL CHECK(report_type IN ('weekly','monthly')),
  snapshot_date date NOT NULL,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  skills jsonb NOT NULL DEFAULT '{}'::jsonb,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(player_id,report_type,snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_player_development_snapshots_player_type_date ON public.player_development_snapshots(player_id,report_type,snapshot_date DESC);
ALTER TABLE public.player_development_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner Development Snapshots Select" ON public.player_development_snapshots;
CREATE POLICY "Owner Development Snapshots Select" ON public.player_development_snapshots FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM public.jogadores j WHERE j.id=player_id AND j.user_id=(SELECT auth.uid())));
REVOKE ALL ON public.player_development_snapshots FROM anon,authenticated;
GRANT SELECT ON public.player_development_snapshots TO authenticated;

CREATE TABLE IF NOT EXISTS private.career_squad_availability (
  player_id uuid NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,
  ai_player_id uuid NOT NULL REFERENCES public.base_ai_players(id) ON DELETE CASCADE,
  match_date date NOT NULL,
  status text NOT NULL CHECK(status IN ('doubt','out')),
  reason text NOT NULL,
  occurred_on date NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(player_id,ai_player_id,match_date)
);

CREATE TABLE IF NOT EXISTS private.career_squad_week_rolls (
  player_id uuid NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,
  match_date date NOT NULL,
  roll_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(player_id,match_date,roll_date)
);

UPDATE private.career_activity_catalog SET event_key=NULL WHERE activity_key='night_out';
UPDATE private.career_activity_catalog SET cash_delta=0 WHERE activity_key='sponsor_event';

INSERT INTO private.career_event_templates(event_key,source,title,body,choices) VALUES
('night_out_pregame_buzz','Redes sociais','A saída virou assunto','Algumas fotos suas circulam na noite anterior ao jogo. A torcida começa a discutir se você está levando a estreia a sério.',
 '[{"key":"ignore","label":"Não responder e seguir a rotina.","effects":{"pressure":2,"fans":-1,"fame":1,"fanbase":12},"result":"Você não alimentou a discussão, mas o assunto continuou por algumas horas.","reply_speaker":"Redes sociais","reply":"Sem resposta oficial. Os comentários se dividiram entre quem minimizou e quem cobrou mais foco."},{"key":"explain","label":"Explicar que foi uma saída curta e que está preparado.","effects":{"media":1,"fans":1,"image":1,"pressure":1,"fame":1,"fanbase":20},"result":"Sua explicação acalmou parte da torcida, mas aumentou a exposição do caso.","reply_speaker":"Imprensa","reply":"A declaração foi repercutida como uma tentativa de encerrar o assunto antes do jogo."},{"key":"defiant","label":"Dizer que sua vida pessoal não diz respeito a ninguém.","effects":{"media":-4,"fans":-3,"image":-3,"morale":3,"ego":2,"fame":2,"fanbase":28},"result":"A resposta elevou a tensão e deu ainda mais alcance à história.","reply_speaker":"Redes sociais","reply":"A publicação explodiu em comentários. Parte gostou da personalidade; outra parte achou desnecessário."}]'::jsonb),
('night_out_headline','Notícias','Jogador é visto fora de casa','Uma página local publicou uma nota sobre sua noite fora. Com seu nome começando a circular mais, até uma saída comum pode virar notícia.',
 '[{"key":"quiet","label":"Não dar importância.","effects":{"pressure":1,"fame":1,"fanbase":10},"result":"A notícia perdeu força sem resposta.","reply_speaker":"Notícias locais","reply":"Sem novidade, o assunto saiu do destaque ao longo do dia."},{"key":"friendly","label":"Levar com bom humor.","effects":{"fans":2,"media":2,"image":1,"fame":1,"fanbase":25},"result":"Seu tom leve aproximou parte do público.","reply_speaker":"Torcida","reply":"A reação foi majoritariamente leve, com brincadeiras e mensagens de apoio."},{"key":"angry","label":"Criticar quem publicou.","effects":{"media":-4,"image":-2,"pressure":3,"fame":2,"fanbase":18},"result":"Você transformou uma nota pequena em uma discussão maior.","reply_speaker":"Imprensa","reply":"Outros perfis repercutiram sua reação, ampliando o alcance da história."}]'::jsonb),
('missed_training_confrontation','Treinador','O treinador quer uma explicação','Sua ausência no treino coletivo foi percebida. O treinador pede uma conversa antes de seguir a semana.',
 '[{"key":"own","label":"Assumir a decisão e explicar que precisava recuperar o corpo.","effects":{"coach":1,"discipline":1,"pressure":1},"result":"O treinador não gostou da ausência, mas valorizou você assumir a responsabilidade.","reply_speaker":"Treinador","reply":"Eu posso discordar da escolha, mas prefiro que você venha e fale de frente. Na próxima, alinhe comigo antes."},{"key":"challenge","label":"Dizer que sabe administrar o próprio corpo.","effects":{"coach":-5,"ego":2,"morale":2,"pressure":2},"result":"Você defendeu sua autonomia, mas criou atrito com a comissão.","reply_speaker":"Treinador","reply":"Aqui a carga é planejada para o grupo. Se cada um decidir sozinho, fica difícil confiar."},{"key":"apologize","label":"Pedir desculpas e prometer compensar no próximo treino.","effects":{"coach":2,"discipline":2,"morale":-1},"result":"O pedido reduziu o desgaste, embora a ausência continue registrada.","reply_speaker":"Treinador","reply":"Certo. Eu vou cobrar atitude no próximo trabalho, não promessa."}]'::jsonb),
('coach_extra_training','Treinador','O treinador reparou no trabalho extra','Depois do expediente do grupo, o treinador percebe que você ficou trabalhando por conta própria.',
 '[{"key":"feedback","label":"Pedir uma orientação específica para melhorar.","effects":{"coach":3,"pressure":1,"professionalism":1},"result":"Você transformou o trabalho extra em uma conversa útil com a comissão.","reply_speaker":"Treinador","reply":"Gosto da iniciativa. Mas quero qualidade, não só volume. Vou te passar um ponto para observar no próximo treino."},{"key":"independent","label":"Dizer que prefere descobrir sozinho o que funciona.","effects":{"coach":-1,"ego":1,"morale":2},"result":"O treinador respeitou sua autonomia, mas ficou menos envolvido no processo.","reply_speaker":"Treinador","reply":"Tudo bem. Só não confunda autonomia com ignorar o plano do time."},{"key":"team_first","label":"Perguntar se algum companheiro precisa de ajuda no treino extra.","effects":{"coach":2,"locker":3,"leadership":1},"result":"A iniciativa chamou atenção pelo lado coletivo.","reply_speaker":"Treinador","reply":"Boa leitura. Evoluir e puxar os outros junto vale muito aqui."}]'::jsonb),
('coach_load_conversation','Treinador','Você está puxando demais?','A comissão percebeu que você vem aumentando a intensidade além do planejado nos treinos coletivos.',
 '[{"key":"keep","label":"Dizer que quer manter esse ritmo enquanto o corpo responder.","effects":{"coach":1,"pressure":2,"ambition":2},"result":"O treinador gostou da ambição, mas deixou claro que vai observar seu desgaste.","reply_speaker":"Treinador","reply":"Eu gosto de fome, mas não quero te perder por excesso. Mostra maturidade para saber a hora de acelerar e a hora de segurar."},{"key":"listen","label":"Dizer que vai respeitar mais o planejamento da comissão.","effects":{"coach":3,"discipline":2,"morale":-1},"result":"Você reforçou confiança com o treinador ao aceitar o controle de carga.","reply_speaker":"Treinador","reply":"É isso. Intensidade é importante, mas disponibilidade no sábado vale mais."},{"key":"ask","label":"Perguntar exatamente onde ele quer que você force mais.","effects":{"coach":2,"professionalism":2,"pressure":1},"result":"A conversa ficou mais técnica e objetiva.","reply_speaker":"Treinador","reply":"Força quando a jogada pede. Não quero corrida vazia só para parecer intenso."}]'::jsonb),
('coach_weekly_checkin','Treinador','Conversa rápida no corredor','O treinador cruza com você e pergunta como está se sentindo com a rotina e com seu espaço no elenco.',
 '[{"key":"minutes","label":"Perguntar o que falta para ganhar mais minutos.","effects":{"coach":2,"ambition":2,"pressure":2},"result":"Você mostrou ambição e recebeu uma cobrança clara.","reply_speaker":"Treinador","reply":"Minuto se conquista no detalhe. Quero constância no treino e decisão boa quando a bola chegar."},{"key":"team","label":"Dizer que a prioridade é ajudar o time onde for necessário.","effects":{"coach":2,"locker":2,"ego":-1},"result":"A resposta reforçou sua imagem coletiva.","reply_speaker":"Treinador","reply":"Essa postura ajuda. Só não use humildade para esconder ambição — eu também quero ver personalidade."},{"key":"honest","label":"Dizer que ainda está tentando entender o que ele espera de você.","effects":{"coach":1,"pressure":-2,"professionalism":1},"result":"A honestidade abriu espaço para uma conversa mais direta.","reply_speaker":"Treinador","reply":"Então pergunta. Prefiro um jogador que busca clareza a um que tenta adivinhar tudo."}]'::jsonb),
('teammate_locker_room','Companheiro','Um companheiro puxa assunto','Um jogador do elenco senta ao seu lado no vestiário e comenta sobre a disputa por espaço no time.',
 '[{"key":"friendly","label":"Levar a conversa na boa e falar que a disputa melhora os dois.","effects":{"locker":2,"teammate_relation":5,"leadership":1},"result":"O clima ficou competitivo sem virar hostilidade.","reply_speaker":"Companheiro","reply":"É isso. Eu quero jogar também, mas se os dois subirem o nível o time ganha."},{"key":"competitive","label":"Dizer que você veio para tomar a vaga.","effects":{"locker":-1,"teammate_relation":-6,"ambition":2,"ego":1},"result":"A mensagem ficou clara e a disputa ganhou tensão.","reply_speaker":"Companheiro","reply":"Então mostra no campo. Eu também não vou entregar nada de graça."},{"key":"avoid","label":"Mudar de assunto e não entrar na disputa.","effects":{"teammate_relation":-1,"pressure":-1},"result":"Você evitou confronto, mas a distância permaneceu.","reply_speaker":"Companheiro","reply":"Tranquilo. A gente se entende treinando."}]'::jsonb),
('rival_training_tension','Rival','A disputa ficou pessoal','Depois de uma dividida mais forte, o jogador que compete diretamente com você reclama que você está tentando aparecer demais no treino.',
 '[{"key":"cool","label":"Diminuir a tensão e dizer que foi lance de treino.","effects":{"locker":1,"teammate_relation":4,"rivalry":-1},"result":"A discussão esfriou, embora a disputa continue.","reply_speaker":"Rival","reply":"Beleza. Só mantém limpo. A vaga a gente decide jogando."},{"key":"stand","label":"Responder que ninguém vai aliviar na disputa por posição.","effects":{"locker":-1,"teammate_relation":-8,"rivalry":1,"ambition":2},"result":"A rivalidade ficou mais evidente para o elenco.","reply_speaker":"Rival","reply":"Então fechado. Não espera facilidade de mim também."},{"key":"joke","label":"Fazer uma piada para tirar peso da situação.","effects":{"locker":2,"teammate_relation":2,"sociability":2},"result":"O clima melhorou sem eliminar a competição.","reply_speaker":"Rival","reply":"Tá, essa foi boa. Mas eu ainda quero essa vaga."}]'::jsonb),
('fans_spot_player_off_pitch','Torcida','Reconhecido fora do clube','Alguns torcedores reconheceram você durante um momento comum fora do centro de treinamento.',
 '[{"key":"stop","label":"Parar alguns minutos para fotos e conversa.","effects":{"fans":3,"image":2,"personal":-1,"fame":1,"fanbase":35},"result":"A atenção aos torcedores melhorou sua imagem pública.","reply_speaker":"Torcida","reply":"As fotos começaram a circular com comentários elogiando sua disponibilidade."},{"key":"brief","label":"Cumprimentar rapidamente e seguir.","effects":{"fans":1,"fame":1,"fanbase":15},"result":"Você foi cordial sem abrir mão do seu tempo.","reply_speaker":"Torcida","reply":"O encontro foi curto, mas positivo."},{"key":"avoid","label":"Evitar contato e sair discretamente.","effects":{"fans":-2,"personal":2},"result":"Você protegeu seu espaço pessoal, mas alguns torcedores interpretaram mal.","reply_speaker":"Torcida","reply":"Alguns comentários reclamaram da distância; outros defenderam seu direito à privacidade."}]'::jsonb)
ON CONFLICT(event_key) DO UPDATE SET source=EXCLUDED.source,title=EXCLUDED.title,body=EXCLUDED.body,choices=EXCLUDED.choices;

CREATE OR REPLACE FUNCTION private.available_squad_numbers(p_player_id uuid)
RETURNS integer[] LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_club uuid; v_role text; v_pos text; v_numbers integer[];
BEGIN
  SELECT pc.club_id,pc.squad_role,j.posicao INTO v_club,v_role,v_pos
  FROM public.player_contracts pc JOIN public.jogadores j ON j.id=pc.player_id
  WHERE pc.player_id=p_player_id AND pc.status='active' ORDER BY pc.signed_at DESC LIMIT 1;
  IF v_club IS NULL THEN RETURN ARRAY[]::integer[]; END IF;
  SELECT COALESCE(array_agg(n ORDER BY n),ARRAY[]::integer[]) INTO v_numbers
  FROM generate_series(1,39) n
  WHERE NOT EXISTS(SELECT 1 FROM public.base_ai_players ai WHERE ai.club_id=v_club AND ai.squad_number=n)
    AND NOT EXISTS(SELECT 1 FROM public.player_squad_numbers psn WHERE psn.club_id=v_club AND psn.number=n AND psn.active)
    AND(n<>1 OR v_pos='Goleiro')
    AND CASE v_role
      WHEN 'Promessa' THEN n>=20
      WHEN 'Reserva' THEN n>=14
      WHEN 'Rotação' THEN(n>=12 OR n IN(7,11,19))
      WHEN 'Titular' THEN true
      WHEN 'Estrela' THEN true
      ELSE n>=14 END;
  RETURN v_numbers;
END; $$;

CREATE OR REPLACE FUNCTION private.ensure_teammate_relations(p_player_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_club uuid; v_pos text;
BEGIN
  SELECT pc.club_id,j.posicao INTO v_club,v_pos
  FROM public.player_contracts pc JOIN public.jogadores j ON j.id=pc.player_id
  WHERE pc.player_id=p_player_id AND pc.status='active' ORDER BY pc.signed_at DESC LIMIT 1;
  IF v_club IS NULL THEN RETURN; END IF;
  INSERT INTO public.player_teammate_relations(player_id,teammate_id,relation,chemistry)
  SELECT p_player_id,ai.id,CASE WHEN ai.primary_position=v_pos THEN 45 ELSE 50 END,CASE WHEN ai.primary_position=v_pos THEN 47 ELSE 50 END
  FROM public.base_ai_players ai WHERE ai.club_id=v_club
  ON CONFLICT(player_id,teammate_id) DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION private.ensure_shirt_request(p_player_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_club uuid; v_club_name text; v_numbers integer[];
BEGIN
  IF EXISTS(SELECT 1 FROM public.player_squad_numbers WHERE player_id=p_player_id AND active) THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM public.player_messages WHERE player_id=p_player_id AND metadata->>'kind'='shirt_number_choice') THEN RETURN; END IF;
  SELECT c.id,c.name INTO v_club,v_club_name
  FROM public.player_contracts pc JOIN public.base_clubs c ON c.id=pc.club_id
  WHERE pc.player_id=p_player_id AND pc.status='active' ORDER BY pc.signed_at DESC LIMIT 1;
  IF v_club IS NULL THEN RETURN; END IF;
  v_numbers:=private.available_squad_numbers(p_player_id);
  INSERT INTO public.player_messages(player_id,club_id,message_type,subject,body,metadata)
  VALUES(p_player_id,v_club,'career','Escolha seu número de camisa',
    'A rouparia separou os números que estão realmente livres para o seu papel no elenco. Disponíveis agora: '||COALESCE(array_to_string(v_numbers,', '),'nenhum')||'. Números tradicionais só aparecem quando estão vagos e seu papel no elenco permite. Escolha no seu perfil antes da véspera do jogo.',
    jsonb_build_object('kind','shirt_number_choice','available_numbers',to_jsonb(v_numbers),'club',v_club_name));
END; $$;

CREATE OR REPLACE FUNCTION private.build_development_snapshot(p_player_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_attrs jsonb; v_skills jsonb; v_state jsonb;
BEGIN
  SELECT atributos INTO v_attrs FROM public.jogadores WHERE id=p_player_id;
  SELECT COALESCE(jsonb_object_agg(skill_key,jsonb_build_object('level',level,'progress',ROUND(progress,0))),'{}'::jsonb)
    INTO v_skills FROM public.player_skill_development WHERE player_id=p_player_id;
  SELECT jsonb_build_object('form',form,'trust',trust,'energy',energy,'fatigue',fatigue,'pressure',pressure,'fame',fame,'fanbase',fanbase,'public_image',public_image,'locker_room',locker_room_relation)
    INTO v_state FROM public.player_career_state WHERE player_id=p_player_id;
  RETURN jsonb_build_object('attributes',COALESCE(v_attrs,'{}'::jsonb),'skills',COALESCE(v_skills,'{}'::jsonb),'state',COALESCE(v_state,'{}'::jsonb));
END; $$;

CREATE OR REPLACE FUNCTION private.development_report_body(p_old jsonb,p_new jsonb,p_period text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE v_key text; v_old_n numeric; v_new_n numeric; v_up text[]:=ARRAY[]::text[]; v_down text[]:=ARRAY[]::text[]; v_skill_up text[]:=ARRAY[]::text[]; v_text text; v_old_s jsonb; v_new_s jsonb; v_delta numeric;
BEGIN
  FOR v_key IN SELECT key FROM jsonb_object_keys(COALESCE(p_new->'attributes','{}'::jsonb)) key LOOP
    v_old_n:=COALESCE((p_old->'attributes'->>v_key)::numeric,0); v_new_n:=COALESCE((p_new->'attributes'->>v_key)::numeric,0);
    IF v_new_n>v_old_n THEN v_up:=array_append(v_up,v_key||' +'||(v_new_n-v_old_n)::int); ELSIF v_new_n<v_old_n THEN v_down:=array_append(v_down,v_key||' '||(v_new_n-v_old_n)::int); END IF;
  END LOOP;
  FOR v_key IN SELECT key FROM jsonb_object_keys(COALESCE(p_new->'skills','{}'::jsonb)) key LOOP
    v_old_s:=COALESCE(p_old->'skills'->v_key,'{}'::jsonb); v_new_s:=COALESCE(p_new->'skills'->v_key,'{}'::jsonb);
    v_delta:=COALESCE((v_new_s->>'level')::numeric,0)*100+COALESCE((v_new_s->>'progress')::numeric,0)-COALESCE((v_old_s->>'level')::numeric,0)*100-COALESCE((v_old_s->>'progress')::numeric,0);
    IF v_delta>=10 THEN v_skill_up:=array_append(v_skill_up,replace(initcap(replace(v_key,'_',' ')),'Tactical Awareness','Leitura tática')||' +'||ROUND(v_delta)::int||' pts'); END IF;
  END LOOP;
  IF COALESCE((p_new->'state'->>'form')::int,50)<COALESCE((p_old->'state'->>'form')::int,50) THEN v_down:=array_append(v_down,'Forma'); END IF;
  IF COALESCE((p_new->'state'->>'trust')::int,50)<COALESCE((p_old->'state'->>'trust')::int,50) THEN v_down:=array_append(v_down,'Relação com o treinador'); END IF;
  IF COALESCE((p_new->'state'->>'energy')::int,100)+8<COALESCE((p_old->'state'->>'energy')::int,100) THEN v_down:=array_append(v_down,'Energia'); END IF;
  IF COALESCE((p_new->'state'->>'fatigue')::int,0)>COALESCE((p_old->'state'->>'fatigue')::int,0)+8 THEN v_down:=array_append(v_down,'Estafa'); END IF;
  v_text:='Relatório de desenvolvimento — '||p_period||E'\n\nAtributos que subiram: '||CASE WHEN cardinality(v_up)>0 THEN array_to_string(v_up,', ') ELSE 'nenhum atributo principal ganhou ponto neste período' END||'.';
  v_text:=v_text||E'\nEspecialidades com avanço relevante: '||CASE WHEN cardinality(v_skill_up)>0 THEN array_to_string(v_skill_up[1:LEAST(6,cardinality(v_skill_up))],', ') ELSE 'o progresso ficou distribuído sem grande salto isolado' END||'.';
  v_text:=v_text||E'\nPontos que pioraram ou exigem atenção: '||CASE WHEN cardinality(v_down)>0 THEN array_to_string(v_down,', ') ELSE 'nenhum indicador importante piorou' END||'.';
  v_text:=v_text||E'\nFama: '||COALESCE(p_new->'state'->>'fame','0')||' · Torcedores acompanhando: '||COALESCE(p_new->'state'->>'fanbase','0')||'.';
  RETURN v_text;
END; $$;

CREATE OR REPLACE FUNCTION private.maybe_send_development_reports(p_player_id uuid,p_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_snap jsonb; v_old record; v_club uuid;
BEGIN
  SELECT club_id INTO v_club FROM public.player_contracts WHERE player_id=p_player_id AND status='active' ORDER BY signed_at DESC LIMIT 1;
  v_snap:=private.build_development_snapshot(p_player_id);
  SELECT * INTO v_old FROM public.player_development_snapshots WHERE player_id=p_player_id AND report_type='weekly' ORDER BY snapshot_date DESC LIMIT 1;
  IF v_old.id IS NULL THEN
    INSERT INTO public.player_development_snapshots(player_id,report_type,snapshot_date,attributes,skills,state) VALUES(p_player_id,'weekly',p_date,v_snap->'attributes',v_snap->'skills',v_snap->'state');
    UPDATE public.player_career_state SET last_weekly_report_date=p_date WHERE player_id=p_player_id;
  ELSIF p_date>=v_old.snapshot_date+7 THEN
    INSERT INTO public.player_messages(player_id,club_id,message_type,subject,body,metadata) VALUES(p_player_id,v_club,'career','Relatório semanal de desenvolvimento',private.development_report_body(to_jsonb(v_old),v_snap,'últimos 7 dias'),jsonb_build_object('kind','development_report','period','weekly','date',p_date));
    INSERT INTO public.player_development_snapshots(player_id,report_type,snapshot_date,attributes,skills,state) VALUES(p_player_id,'weekly',p_date,v_snap->'attributes',v_snap->'skills',v_snap->'state') ON CONFLICT DO NOTHING;
    UPDATE public.player_career_state SET last_weekly_report_date=p_date WHERE player_id=p_player_id;
  END IF;
  SELECT * INTO v_old FROM public.player_development_snapshots WHERE player_id=p_player_id AND report_type='monthly' ORDER BY snapshot_date DESC LIMIT 1;
  IF v_old.id IS NULL THEN
    INSERT INTO public.player_development_snapshots(player_id,report_type,snapshot_date,attributes,skills,state) VALUES(p_player_id,'monthly',p_date,v_snap->'attributes',v_snap->'skills',v_snap->'state');
    UPDATE public.player_career_state SET last_monthly_report_date=p_date WHERE player_id=p_player_id;
  ELSIF p_date>=v_old.snapshot_date+30 THEN
    INSERT INTO public.player_messages(player_id,club_id,message_type,subject,body,metadata) VALUES(p_player_id,v_club,'career','Relatório mensal de desenvolvimento',private.development_report_body(to_jsonb(v_old),v_snap,'últimos 30 dias'),jsonb_build_object('kind','development_report','period','monthly','date',p_date));
    INSERT INTO public.player_development_snapshots(player_id,report_type,snapshot_date,attributes,skills,state) VALUES(p_player_id,'monthly',p_date,v_snap->'attributes',v_snap->'skills',v_snap->'state') ON CONFLICT DO NOTHING;
    UPDATE public.player_career_state SET last_monthly_report_date=p_date WHERE player_id=p_player_id;
  END IF;
END; $$;

COMMIT;

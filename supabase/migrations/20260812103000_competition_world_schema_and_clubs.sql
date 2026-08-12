BEGIN;

ALTER TABLE public.base_clubs
  ALTER COLUMN shield_url TYPE text,
  ADD COLUMN IF NOT EXISTS club_code text,
  ADD COLUMN IF NOT EXISTS club_level text NOT NULL DEFAULT 'academy',
  ADD COLUMN IF NOT EXISTS division_level integer,
  ADD COLUMN IF NOT EXISTS short_name text,
  ADD COLUMN IF NOT EXISTS primary_color text,
  ADD COLUMN IF NOT EXISTS secondary_color text,
  ADD COLUMN IF NOT EXISTS accent_color text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='base_clubs_club_level_check') THEN
    ALTER TABLE public.base_clubs ADD CONSTRAINT base_clubs_club_level_check CHECK (club_level IN ('academy','professional'));
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_base_clubs_club_code ON public.base_clubs(club_code) WHERE club_code IS NOT NULL;

ALTER TABLE public.base_ai_players
  DROP CONSTRAINT IF EXISTS base_ai_players_age_check,
  DROP CONSTRAINT IF EXISTS base_ai_players_ovr_check,
  DROP CONSTRAINT IF EXISTS base_ai_players_squad_role_check;
ALTER TABLE public.base_ai_players
  ADD CONSTRAINT base_ai_players_age_check CHECK (age BETWEEN 15 AND 40),
  ADD CONSTRAINT base_ai_players_ovr_check CHECK (ovr BETWEEN 35 AND 99),
  ADD CONSTRAINT base_ai_players_squad_role_check CHECK (squad_role IN ('Promessa','Reserva','Rotação','Titular','Estrela'));

CREATE OR REPLACE FUNCTION private.club_monogram(p_name text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT upper(left(regexp_replace(coalesce(p_name,'FC'),'[^[:alnum:]]','','g'),3))
$$;

CREATE OR REPLACE FUNCTION private.club_palette(p_name text,p_slot integer)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT (ARRAY['#111827','#F8FAFC','#C62828','#176B3A','#1D4ED8','#D4AF37','#7B1F35','#0F766E','#F59E0B','#6D28D9','#0F7A42','#B91C1C'])[1+mod(abs(hashtext(coalesce(p_name,'')||':'||p_slot::text)),12)]
$$;

CREATE OR REPLACE FUNCTION private.generated_club_crest(p_name text,p_primary text,p_secondary text,p_accent text,p_variant integer DEFAULT 0)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE v_svg text; v_pattern text; v_short text:=private.club_monogram(p_name);
BEGIN
  v_pattern:=CASE mod(abs(coalesce(p_variant,0)),4)
    WHEN 0 THEN format('<path d="M21 37h78v14H21zm0 28h78v14H21z" fill="%s" opacity=".96"/>',p_secondary)
    WHEN 1 THEN format('<path d="M12 82L96 19h17L28 90z" fill="%s" opacity=".95"/>',p_secondary)
    WHEN 2 THEN format('<path d="M55 15h18v82H55zM22 49h84v16H22z" fill="%s"/>',p_secondary)
    ELSE format('<path d="M18 28l92 55v16L18 45z" fill="%s" opacity=".95"/>',p_secondary) END;
  v_svg:=format('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 144"><defs><filter id="s"><feDropShadow dx="0" dy="3" stdDeviation="2" flood-opacity=".25"/></filter></defs><path filter="url(#s)" d="M64 4L116 22v52c0 31-20 52-52 66C32 126 12 105 12 74V22z" fill="%s" stroke="%s" stroke-width="5"/>%s<path d="M64 9L108 25v47c0 26-16 45-44 58-28-13-44-32-44-58V25z" fill="none" stroke="%s" stroke-width="2" opacity=".9"/><circle cx="64" cy="57" r="25" fill="%s" stroke="%s" stroke-width="3"/><text x="64" y="64" text-anchor="middle" font-family="Arial,sans-serif" font-size="19" font-weight="900" fill="%s">%s</text><path d="M45 106h38" stroke="%s" stroke-width="4" stroke-linecap="round"/></svg>',p_primary,p_accent,v_pattern,p_secondary,p_secondary,p_accent,p_primary,v_short,p_accent);
  RETURN 'data:image/svg+xml;base64,'||encode(convert_to(v_svg,'UTF8'),'base64');
END $$;

CREATE TEMP TABLE _pro_seed(division_level int,ord int,name text,city text) ON COMMIT DROP;
INSERT INTO _pro_seed
SELECT 1,ord,name,city FROM unnest(
 ARRAY['Belmiro F.C.','Parque Alviverde','República Corinthiana','Morumbi Athletic','Gávea Rubra','Cruz de São Januário','Laranjeiras Club','Estrela de General','Galo das Alterosas','Raposa Celeste','Imortal Porto-Alegrense','Colorado dos Pampas','Leão da Barra','Esquadrão do Farol','Fortaleza Imperial','Alvinegro do Ceará','Furacão da Baixada','Coxa Verde','Massa Bragantina','Leão da Ilha Recife'],
 ARRAY['Santos','São Paulo','São Paulo','São Paulo','Rio de Janeiro','Rio de Janeiro','Rio de Janeiro','Rio de Janeiro','Belo Horizonte','Belo Horizonte','Porto Alegre','Porto Alegre','Salvador','Salvador','Fortaleza','Fortaleza','Curitiba','Curitiba','Bragança Paulista','Recife']
) WITH ORDINALITY AS t(name,city,ord)
UNION ALL SELECT 2,ord,name,city FROM unnest(
 ARRAY['Dragão Goiano','Vila Central','Esmeralda Goiás','Ponte de Campinas','Guarani do Bosque','Coelho Mineiro','Pantera de Ribeirão','Tigre de Criciúma','Leão da Ilha Sul','Figueira Catarinense','Papão de Belém','Leão Azul de Belém','Dourado Cuiabano','Condá Verde','Fantasma dos Campos','Aurinegro Novo Horizonte','Leão de Mirassol','Papo da Serra','Regatas de Maceió','Onça Amazônica'],
 ARRAY['Goiânia','Goiânia','Goiânia','Campinas','Campinas','Belo Horizonte','Ribeirão Preto','Criciúma','Florianópolis','Florianópolis','Belém','Belém','Cuiabá','Chapecó','Ponta Grossa','Novo Horizonte','Mirassol','Caxias do Sul','Maceió','Manaus']
) WITH ORDINALITY AS t(name,city,ord)
UNION ALL SELECT 3,ord,name,city FROM unnest(
 ARRAY['Timbu Recife','Cobra Coral Recife','Elefante Potiguar','Mecão Natal','Belo da Paraíba','Tubarão Ferroviário','Dragão de Aracaju','Tubarão do Maranhão','Canário de Erechim','Grená da Serra','Tubarão Londrinense','Dogão Maringá','Galo de Itu','Tigre do ABC','Aço do Sul Fluminense','Saquarema Verde','Lusa do Canindé','Esquadrão de São João','Gavião de Tombos','Fênix de Camaragibe'],
 ARRAY['Recife','Recife','Natal','Natal','João Pessoa','Fortaleza','Aracaju','São Luís','Erechim','Caxias do Sul','Londrina','Maringá','Itu','São Bernardo do Campo','Volta Redonda','Saquarema','São Paulo','São João del-Rei','Tombos','Camaragibe']
) WITH ORDINALITY AS t(name,city,ord)
UNION ALL SELECT 4,ord,name,city FROM unnest(
 ARRAY['Jacaré Capital','Alviverde do Planalto','Gato Preto DF','Camaleão Goiano','Galo da Comarca','Tigre Cuiabano','Verdão de Lucas','Locomotiva Rondoniense','Gavião do Norte','Tufão Amazônico','Estrelão Acreano','Locomotiva Amapá','Águia de Marabá','Jacaré Piauiense','Galo Carijó','Dinossauro do Sertão','Galo da Borborema','Fantasma de Arapiraca','Gipão de Aracaju','Canção do Sertão'],
 ARRAY['Brasília','Brasília','Ceilândia','Aparecida de Goiânia','Anápolis','Cuiabá','Lucas do Rio Verde','Porto Velho','Manaus','Manaus','Rio Branco','Macapá','Marabá','Altos','Teresina','Sousa','Campina Grande','Arapiraca','Aracaju','Juazeiro']
) WITH ORDINALITY AS t(name,city,ord);

INSERT INTO public.base_coaches(name,profile)
SELECT 'Treinador '||private.club_monogram(name), (ARRAY['Equilibrado','Técnico','Rígido','Teórico','Amigável'])[1+mod(abs(hashtext(name)),5)]
FROM _pro_seed s WHERE NOT EXISTS(SELECT 1 FROM public.base_coaches c WHERE c.name='Treinador '||private.club_monogram(s.name));

INSERT INTO public.base_clubs(name,city,shield_url,reputation,formation,play_style,coach_id,flexibility,is_active,base_terms,club_code,club_level,division_level,short_name,primary_color,secondary_color,accent_color)
SELECT s.name,s.city,
 private.generated_club_crest(s.name,private.club_palette(s.name,1),private.club_palette(s.name,2),private.club_palette(s.name,3),s.ord+s.division_level),
 CASE s.division_level WHEN 1 THEN 5 WHEN 2 THEN 4 WHEN 3 THEN 3 ELSE 2 END,
 (ARRAY['4-3-3','4-2-3-1','4-4-2','4-1-4-1'])[1+mod(abs(hashtext(s.name||':f')),4)],
 (ARRAY['Equilibrado','Ofensivo','Contra-ataque','Pelas alas','Posse de bola'])[1+mod(abs(hashtext(s.name||':p')),5)],
 c.id,35+mod(abs(hashtext(s.name||':x')),51),true,
 jsonb_build_object('career_stage','professional','division',s.division_level),
 'PRO_'||s.division_level||'_'||lpad(s.ord::text,2,'0'),'professional',s.division_level,private.club_monogram(s.name),private.club_palette(s.name,1),private.club_palette(s.name,2),private.club_palette(s.name,3)
FROM _pro_seed s JOIN public.base_coaches c ON c.name='Treinador '||private.club_monogram(s.name)
WHERE NOT EXISTS(SELECT 1 FROM public.base_clubs b WHERE b.club_code='PRO_'||s.division_level||'_'||lpad(s.ord::text,2,'0'));

CREATE TEMP TABLE _youth_seed(ord int,name text,city text) ON COMMIT DROP;
INSERT INTO _youth_seed SELECT ord,name,city FROM unnest(
 ARRAY['Belmiro Formação Sub-18','Parque Alviverde Sub-18','Gávea Rubra Sub-18','Morumbi Athletic Sub-18','Pampas Formação Sub-18','Alterosas Formação Sub-18','Recife Base Sub-18','Bahia Jovem Sub-18','Paraná Futuro Sub-18','Goiás Formação Sub-18','Amazônia Talentos Sub-18'],
 ARRAY['Santos','São Paulo','Rio de Janeiro','São Paulo','Porto Alegre','Belo Horizonte','Recife','Salvador','Curitiba','Goiânia','Manaus']
) WITH ORDINALITY AS t(name,city,ord);
INSERT INTO public.base_coaches(name,profile)
SELECT 'Professor '||private.club_monogram(name),(ARRAY['Equilibrado','Técnico','Teórico','Amigável'])[1+mod(abs(hashtext(name)),4)] FROM _youth_seed s
WHERE NOT EXISTS(SELECT 1 FROM public.base_coaches c WHERE c.name='Professor '||private.club_monogram(s.name));
INSERT INTO public.base_clubs(name,city,shield_url,reputation,formation,play_style,coach_id,flexibility,is_active,base_terms,club_code,club_level,short_name,primary_color,secondary_color,accent_color)
SELECT s.name,s.city,private.generated_club_crest(s.name,private.club_palette(s.name,1),private.club_palette(s.name,2),private.club_palette(s.name,3),s.ord),3+(s.ord%2),
 (ARRAY['4-3-3','4-2-3-1','4-4-2'])[1+mod(s.ord,3)],(ARRAY['Equilibrado','Ofensivo','Pelas alas','Posse de bola'])[1+mod(s.ord,4)],c.id,55,true,jsonb_build_object('career_stage','academy'),
 'Y_NEW_'||lpad(s.ord::text,2,'0'),'academy',NULL,private.club_monogram(s.name),private.club_palette(s.name,1),private.club_palette(s.name,2),private.club_palette(s.name,3)
FROM _youth_seed s JOIN public.base_coaches c ON c.name='Professor '||private.club_monogram(s.name)
WHERE NOT EXISTS(SELECT 1 FROM public.base_clubs b WHERE b.club_code='Y_NEW_'||lpad(s.ord::text,2,'0'));

UPDATE public.base_clubs SET club_level='academy',club_code=COALESCE(club_code,CASE name WHEN 'Academia Aurora Sub-18' THEN 'Y_AURORA' WHEN 'Atlético do Vale Sub-18' THEN 'Y_VALE' WHEN 'Ferroviário Central Sub-18' THEN 'Y_FERRO' WHEN 'Real Horizonte Sub-18' THEN 'Y_HORIZONTE' WHEN 'União Litorânea Sub-18' THEN 'Y_LITORANEA' END),short_name=COALESCE(short_name,private.club_monogram(name)),primary_color=COALESCE(primary_color,private.club_palette(name,1)),secondary_color=COALESCE(secondary_color,private.club_palette(name,2)),accent_color=COALESCE(accent_color,private.club_palette(name,3)) WHERE name IN('Academia Aurora Sub-18','Atlético do Vale Sub-18','Ferroviário Central Sub-18','Real Horizonte Sub-18','União Litorânea Sub-18');
UPDATE public.base_clubs SET shield_url=private.generated_club_crest(name,primary_color,secondary_color,accent_color,abs(hashtext(club_code))) WHERE club_code LIKE 'Y_%';

INSERT INTO public.base_academy_profiles(club_id,physical,speed,technical,recovery,tactical)
SELECT c.id,CASE WHEN c.division_level=1 THEN 5 WHEN c.division_level=2 THEN 4 ELSE 3 END,CASE WHEN coalesce(c.division_level,2)<=2 THEN 4 ELSE 3 END,CASE WHEN c.division_level=1 THEN 5 WHEN c.division_level=2 THEN 4 ELSE 3 END,4,CASE WHEN coalesce(c.division_level,2)<=2 THEN 4 ELSE 3 END FROM public.base_clubs c
WHERE c.club_code IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.base_academy_profiles a WHERE a.club_id=c.id);

WITH clubs_to_fill AS (SELECT c.id,c.club_code,c.club_level,c.division_level FROM public.base_clubs c WHERE c.club_code IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.base_ai_players p WHERE p.club_id=c.id)),
slots AS (SELECT * FROM (VALUES (1,'Goleiro',NULL),(2,'Goleiro',NULL),(3,'Lateral Direito','Lateral Esquerdo'),(4,'Lateral Esquerdo','Lateral Direito'),(5,'Zagueiro',NULL),(6,'Zagueiro',NULL),(7,'Zagueiro','Volante'),(8,'Lateral Direito','Ponta Direita'),(9,'Volante','Meio-Campo'),(10,'Volante','Zagueiro'),(11,'Meio-Campo','Volante'),(12,'Meio-Campo','Meia Direita'),(13,'Meia Direita','Ponta Direita'),(14,'Meia Esquerda','Ponta Esquerda'),(15,'Ponta Direita','Atacante'),(16,'Ponta Esquerda','Atacante'),(17,'Atacante','Ponta Direita'),(18,'Atacante','Ponta Esquerda'),(19,'Meio-Campo','Meia Esquerda'),(20,'Zagueiro','Volante'),(21,'Atacante','Meio-Campo'),(22,'Ponta Direita','Meia Direita')) x(slot,primary_position,secondary_position)),
names AS (SELECT ARRAY['João','Lucas','Mateus','Gabriel','Rafael','Bruno','Caio','Pedro','André','Felipe','Diego','Henrique','Gustavo','Vinícius','Murilo','Danilo','Thiago','Renan','Samuel','Igor'] firsts,ARRAY['Silva','Souza','Oliveira','Santos','Lima','Costa','Pereira','Almeida','Rocha','Mendes','Ribeiro','Barbosa','Cardoso','Teixeira','Moreira','Nunes','Freitas','Campos','Azevedo','Moura'] lasts)
INSERT INTO public.base_ai_players(club_id,name,age,primary_position,secondary_position,ovr,archetype,squad_role,is_starter)
SELECT c.id,n.firsts[1+mod(abs(hashtext(c.club_code||':'||s.slot||':f')),20)]||' '||n.lasts[1+mod(abs(hashtext(c.club_code||':'||s.slot||':l')),20)],CASE WHEN c.club_level='academy' THEN 16+mod(s.slot,3) ELSE 19+mod(abs(hashtext(c.club_code||':'||s.slot||':a')),15) END,s.primary_position,s.secondary_position,
CASE WHEN c.club_level='academy' THEN 44+mod(abs(hashtext(c.club_code||':'||s.slot||':o')),19) ELSE (CASE c.division_level WHEN 1 THEN 68 WHEN 2 THEN 62 WHEN 3 THEN 57 ELSE 52 END)+mod(abs(hashtext(c.club_code||':'||s.slot||':o')),17) END,
CASE s.primary_position WHEN 'Atacante' THEN 'Finalizador' WHEN 'Ponta Direita' THEN 'Driblador' WHEN 'Ponta Esquerda' THEN 'Driblador' WHEN 'Volante' THEN 'Marcador' WHEN 'Zagueiro' THEN 'Defensor' ELSE 'Equilibrado' END,CASE WHEN s.slot<=11 THEN 'Titular' WHEN s.slot<=17 THEN 'Rotação' ELSE 'Reserva' END,s.slot<=11 FROM clubs_to_fill c CROSS JOIN slots s CROSS JOIN names n;

CREATE TABLE IF NOT EXISTS public.competition_definitions(code text PRIMARY KEY,name text NOT NULL,short_name text NOT NULL,career_stage text NOT NULL CHECK(career_stage IN('academy','professional')),age_level text,format text NOT NULL CHECK(format IN('league','knockout')),division_level integer,team_count integer NOT NULL,double_round boolean NOT NULL DEFAULT false,promotion_slots integer NOT NULL DEFAULT 0,relegation_slots integer NOT NULL DEFAULT 0,champion_reward integer NOT NULL DEFAULT 0,top_scorer_reward integer NOT NULL DEFAULT 0,top_assist_reward integer NOT NULL DEFAULT 0,rules jsonb NOT NULL DEFAULT '{}'::jsonb,display_order integer NOT NULL DEFAULT 100,is_active boolean NOT NULL DEFAULT true);
INSERT INTO public.competition_definitions VALUES
('ACA_U15_LEAGUE','Liga Nacional Sub-15','Liga Sub-15','academy','u15','league',NULL,16,true,0,0,450,300,220,'{"points_win":3,"points_draw":1}',10,true),
('ACA_U17_LEAGUE','Liga Nacional Sub-17','Liga Sub-17','academy','u17','league',NULL,16,true,0,0,650,400,300,'{"points_win":3,"points_draw":1}',11,true),
('ACA_U18_LEAGUE','Liga Nacional Sub-18','Liga Sub-18','academy','u18','league',NULL,16,true,0,0,900,550,400,'{"points_win":3,"points_draw":1}',12,true),
('ACA_U20_LEAGUE','Liga Nacional Sub-20','Liga Sub-20','academy','u20','league',NULL,16,true,0,0,1200,700,500,'{"points_win":3,"points_draw":1}',13,true),
('ACA_U18_CUP','Copa Jovem Nacional','Copa Jovem','academy','u18','knockout',NULL,16,false,0,0,700,300,250,'{"penalties_on_draw":true}',14,true),
('PRO_A','Liga Nacional Série A','Série A','professional',NULL,'league',1,20,true,0,4,22000,15000,12000,'{"points_win":3,"points_draw":1}',20,true),
('PRO_B','Liga Nacional Série B','Série B','professional',NULL,'league',2,20,true,4,4,14000,9000,7000,'{"points_win":3,"points_draw":1}',21,true),
('PRO_C','Liga Nacional Série C','Série C','professional',NULL,'league',3,20,true,4,4,9000,6000,4500,'{"points_win":3,"points_draw":1}',22,true),
('PRO_D','Liga Nacional Série D','Série D','professional',NULL,'league',4,20,true,4,0,6000,4000,3000,'{"points_win":3,"points_draw":1}',23,true),
('PRO_CUP','Copa Nacional','Copa Nacional','professional',NULL,'knockout',NULL,64,false,0,0,12000,5500,4000,'{"penalties_on_draw":true,"entry":"A+B+C+top4D"}',24,true)
ON CONFLICT(code) DO UPDATE SET name=excluded.name,short_name=excluded.short_name,champion_reward=excluded.champion_reward,top_scorer_reward=excluded.top_scorer_reward,top_assist_reward=excluded.top_assist_reward,rules=excluded.rules,is_active=true;

CREATE TABLE IF NOT EXISTS public.career_competition_seasons(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),player_id uuid NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,competition_code text NOT NULL REFERENCES public.competition_definitions(code),season_year integer NOT NULL,season_label text NOT NULL,starts_on date NOT NULL,ends_on date,status text NOT NULL DEFAULT 'scheduled' CHECK(status IN('scheduled','active','completed')),current_round integer NOT NULL DEFAULT 0,champion_club_id uuid REFERENCES public.base_clubs(id) ON DELETE SET NULL,completed_at timestamptz,metadata jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(player_id,competition_code,season_year));
CREATE TABLE IF NOT EXISTS public.career_club_divisions(player_id uuid NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,season_year integer NOT NULL,club_id uuid NOT NULL REFERENCES public.base_clubs(id) ON DELETE CASCADE,division_level integer NOT NULL CHECK(division_level BETWEEN 1 AND 4),PRIMARY KEY(player_id,season_year,club_id));
CREATE TABLE IF NOT EXISTS public.career_competition_entries(season_id uuid NOT NULL REFERENCES public.career_competition_seasons(id) ON DELETE CASCADE,club_id uuid NOT NULL REFERENCES public.base_clubs(id) ON DELETE CASCADE,seed integer NOT NULL,group_name text,final_position integer,eliminated_stage text,metadata jsonb NOT NULL DEFAULT '{}'::jsonb,PRIMARY KEY(season_id,club_id));
CREATE TABLE IF NOT EXISTS public.career_competition_fixtures(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),season_id uuid NOT NULL REFERENCES public.career_competition_seasons(id) ON DELETE CASCADE,stage text NOT NULL,round_number integer NOT NULL,leg integer NOT NULL DEFAULT 1,match_date date NOT NULL,home_club_id uuid REFERENCES public.base_clubs(id) ON DELETE SET NULL,away_club_id uuid REFERENCES public.base_clubs(id) ON DELETE SET NULL,source_home_fixture_id uuid REFERENCES public.career_competition_fixtures(id) ON DELETE SET NULL,source_away_fixture_id uuid REFERENCES public.career_competition_fixtures(id) ON DELETE SET NULL,status text NOT NULL DEFAULT 'scheduled' CHECK(status IN('scheduled','completed')),home_goals integer,away_goals integer,home_penalties integer,away_penalties integer,simulated_at timestamptz,metadata jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now(),CHECK(home_club_id IS NULL OR away_club_id IS NULL OR home_club_id<>away_club_id));
CREATE INDEX IF NOT EXISTS idx_comp_fixture_season_date ON public.career_competition_fixtures(season_id,match_date,round_number);
CREATE TABLE IF NOT EXISTS public.career_competition_player_stats(season_id uuid NOT NULL REFERENCES public.career_competition_seasons(id) ON DELETE CASCADE,entity_key text NOT NULL,club_id uuid NOT NULL REFERENCES public.base_clubs(id) ON DELETE CASCADE,player_id uuid REFERENCES public.jogadores(id) ON DELETE CASCADE,ai_player_id uuid REFERENCES public.base_ai_players(id) ON DELETE CASCADE,display_name text NOT NULL,appearances integer NOT NULL DEFAULT 0,starts integer NOT NULL DEFAULT 0,minutes integer NOT NULL DEFAULT 0,goals integer NOT NULL DEFAULT 0,assists integer NOT NULL DEFAULT 0,rating_sum numeric NOT NULL DEFAULT 0,rated_games integer NOT NULL DEFAULT 0,PRIMARY KEY(season_id,entity_key));
CREATE TABLE IF NOT EXISTS public.career_competition_rewards(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),player_id uuid NOT NULL REFERENCES public.jogadores(id) ON DELETE CASCADE,season_id uuid NOT NULL REFERENCES public.career_competition_seasons(id) ON DELETE CASCADE,reward_type text NOT NULL CHECK(reward_type IN('champion','top_scorer','top_assists','promotion')),title text NOT NULL,amount integer NOT NULL DEFAULT 0,awarded_on date NOT NULL,metadata jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(player_id,season_id,reward_type));

ALTER TABLE public.career_competition_seasons ENABLE ROW LEVEL SECURITY; ALTER TABLE public.career_club_divisions ENABLE ROW LEVEL SECURITY; ALTER TABLE public.career_competition_entries ENABLE ROW LEVEL SECURITY; ALTER TABLE public.career_competition_fixtures ENABLE ROW LEVEL SECURITY; ALTER TABLE public.career_competition_player_stats ENABLE ROW LEVEL SECURITY; ALTER TABLE public.career_competition_rewards ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.competition_definitions,public.career_competition_seasons,public.career_club_divisions,public.career_competition_entries,public.career_competition_fixtures,public.career_competition_player_stats,public.career_competition_rewards TO authenticated;
DROP POLICY IF EXISTS "Career Competition Seasons Owner Select" ON public.career_competition_seasons; CREATE POLICY "Career Competition Seasons Owner Select" ON public.career_competition_seasons FOR SELECT TO authenticated USING(public.is_player_owner(player_id));
DROP POLICY IF EXISTS "Career Club Divisions Owner Select" ON public.career_club_divisions; CREATE POLICY "Career Club Divisions Owner Select" ON public.career_club_divisions FOR SELECT TO authenticated USING(public.is_player_owner(player_id));
DROP POLICY IF EXISTS "Career Competition Entries Owner Select" ON public.career_competition_entries; CREATE POLICY "Career Competition Entries Owner Select" ON public.career_competition_entries FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.career_competition_seasons s WHERE s.id=season_id AND public.is_player_owner(s.player_id)));
DROP POLICY IF EXISTS "Career Competition Fixtures Owner Select" ON public.career_competition_fixtures; CREATE POLICY "Career Competition Fixtures Owner Select" ON public.career_competition_fixtures FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.career_competition_seasons s WHERE s.id=season_id AND public.is_player_owner(s.player_id)));
DROP POLICY IF EXISTS "Career Competition Stats Owner Select" ON public.career_competition_player_stats; CREATE POLICY "Career Competition Stats Owner Select" ON public.career_competition_player_stats FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.career_competition_seasons s WHERE s.id=season_id AND public.is_player_owner(s.player_id)));
DROP POLICY IF EXISTS "Career Competition Rewards Owner Select" ON public.career_competition_rewards; CREATE POLICY "Career Competition Rewards Owner Select" ON public.career_competition_rewards FOR SELECT TO authenticated USING(public.is_player_owner(player_id));

COMMIT;
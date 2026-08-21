BEGIN;

ALTER TABLE public.base_ai_players DROP CONSTRAINT IF EXISTS base_ai_players_age_check;
ALTER TABLE public.base_ai_players ADD CONSTRAINT base_ai_players_age_check CHECK(age BETWEEN 14 AND 40);

-- The sixteen academy identities reuse sixteen existing Serie D first teams.
-- This keeps the professional pyramid at exactly 20 clubs per division.
WITH youth AS (
  SELECT b.id AS base_id,b.family_code,b.name,b.city,b.shield_url,b.reputation,b.formation,b.play_style,b.flexibility,b.base_terms,b.short_name,b.primary_color,b.secondary_color,b.accent_color,
         row_number() OVER(ORDER BY b.family_code) rn
  FROM public.base_clubs b
  WHERE b.club_level='academy' AND b.squad_level='base' AND b.family_code LIKE 'Y_%' AND b.is_active
), pro AS (
  SELECT p.id,row_number() OVER(ORDER BY p.club_code,p.name) rn
  FROM public.base_clubs p
  WHERE p.club_level='professional' AND p.division_level=4 AND p.family_code LIKE 'PRO_4_%' AND p.is_active
  ORDER BY p.club_code,p.name
  LIMIT 16
)
UPDATE public.base_clubs p
SET family_code=y.family_code,
    academy_base_id=y.base_id,
    name=CASE y.name
      WHEN 'Academia Aurora' THEN 'Aurora FC'
      WHEN 'Belmiro Formação' THEN 'Belmiro FC'
      WHEN 'Pampas Formação' THEN 'Pampas FC'
      WHEN 'Alterosas Formação' THEN 'Alterosas FC'
      WHEN 'Recife Base' THEN 'Recife FC'
      WHEN 'Amazônia Talentos' THEN 'Amazônia FC'
      ELSE y.name END,
    city=y.city,
    shield_url=COALESCE(y.shield_url,p.shield_url),
    primary_color=COALESCE(y.primary_color,p.primary_color),
    secondary_color=COALESCE(y.secondary_color,p.secondary_color),
    accent_color=COALESCE(y.accent_color,p.accent_color),
    short_name=COALESCE(y.short_name,p.short_name),
    is_active=true
FROM youth y JOIN pro q ON q.rn=y.rn
WHERE p.id=q.id;

INSERT INTO public.base_clubs(
  name,city,shield_url,reputation,formation,play_style,coach_id,flexibility,is_active,base_terms,
  club_code,club_level,division_level,short_name,primary_color,secondary_color,accent_color,family_code,squad_level,academy_base_id
)
SELECT b.name||' Sub-15',b.city,b.shield_url,b.reputation,b.formation,b.play_style,b.coach_id,b.flexibility,true,b.base_terms,
       b.family_code||'_U15','academy',NULL,b.short_name,b.primary_color,b.secondary_color,b.accent_color,b.family_code,'u15',b.id
FROM public.base_clubs b
WHERE b.club_level='academy' AND b.squad_level='base' AND b.family_code LIKE 'Y_%' AND b.is_active
  AND NOT EXISTS(SELECT 1 FROM public.base_clubs x WHERE x.family_code=b.family_code AND x.squad_level='u15' AND x.is_active);

-- Derive a playable U15 roster from the football-role structure of the family U17.
WITH u17_ranked AS (
  SELECT c.family_code,p.*,row_number() OVER(PARTITION BY c.family_code ORDER BY p.is_starter DESC,p.ovr DESC,p.id) rn
  FROM public.base_ai_players p
  JOIN public.base_clubs c ON c.id=p.club_id
  WHERE c.club_level='academy' AND c.squad_level='u17' AND c.family_code LIKE 'Y_%'
), targets AS (
  SELECT id,family_code FROM public.base_clubs
  WHERE club_level='academy' AND squad_level='u15' AND family_code LIKE 'Y_%' AND is_active
), source AS (
  SELECT t.id target_club,u.rn,u.primary_position,u.secondary_position,u.archetype,u.squad_role,u.is_starter,u.squad_number,u.ovr
  FROM targets t JOIN u17_ranked u ON u.family_code=t.family_code AND u.rn<=18
)
INSERT INTO public.base_ai_players(club_id,name,age,primary_position,secondary_position,ovr,archetype,squad_role,is_starter,squad_number)
SELECT s.target_club,
       (ARRAY['Lucas','Pedro','Gabriel','Rafael','Matheus','João','Caio','Bruno','Enzo','Thiago','Vitor','Arthur','Guilherme','Davi','Felipe','Henrique','Murilo','André'])[((s.rn-1)%18)+1]
       ||' '||
       (ARRAY['Silva','Santos','Oliveira','Souza','Costa','Pereira','Lima','Almeida','Rocha','Martins','Barbosa','Ribeiro','Carvalho','Gomes','Melo','Freitas','Cardoso','Teixeira'])[((s.rn+5)%18)+1],
       14+((s.rn-1)%2),s.primary_position,s.secondary_position,GREATEST(35,s.ovr-4),s.archetype,s.squad_role,s.is_starter,s.squad_number
FROM source s
WHERE NOT EXISTS(SELECT 1 FROM public.base_ai_players x WHERE x.club_id=s.target_club);

COMMIT;

BEGIN;

-- base_clubs.shield_url is the single source of truth for a club crest.
-- These five clubs already had hand-made assets before the competition engine
-- existed, so restore those canonical files if an earlier competition migration
-- replaced them with generated SVGs.
UPDATE public.base_clubs
SET shield_url = CASE name
  WHEN 'Academia Aurora Sub-18' THEN 'img/clubs/academia_aurora_sub_18.png'
  WHEN 'Atlético do Vale Sub-18' THEN 'img/clubs/atletico_do_vale_sub_18.png'
  WHEN 'Ferroviário Central Sub-18' THEN 'img/clubs/ferroviario_central_sub_18.png'
  WHEN 'Real Horizonte Sub-18' THEN 'img/clubs/real_horizonte_sub_18.png'
  WHEN 'União Litorânea Sub-18' THEN 'img/clubs/uniao_litoranea_sub_18.png'
  ELSE shield_url
END
WHERE name IN (
  'Academia Aurora Sub-18',
  'Atlético do Vale Sub-18',
  'Ferroviário Central Sub-18',
  'Real Horizonte Sub-18',
  'União Litorânea Sub-18'
);

-- Generated crests are only a fallback for clubs that truly do not have one.
UPDATE public.base_clubs
SET shield_url = private.generated_club_crest(
  name,
  coalesce(primary_color,'#111827'),
  coalesce(secondary_color,'#F8FAFC'),
  coalesce(accent_color,'#D4AF37'),
  abs(hashtext(coalesce(club_code,name)))
)
WHERE club_code IS NOT NULL
  AND nullif(btrim(shield_url),'') IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.base_clubs
    WHERE club_code IS NOT NULL
      AND nullif(btrim(shield_url),'') IS NULL
  ) THEN
    RAISE EXCEPTION 'Há clube ativo no motor de competição sem brasão canônico.';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;

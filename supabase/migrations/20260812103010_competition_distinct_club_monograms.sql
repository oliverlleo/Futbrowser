BEGIN;

CREATE OR REPLACE FUNCTION private.club_monogram(p_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path=''
AS $$
DECLARE
  v_words text[];
  v_word text;
  v_code text := '';
  v_last text := '';
  v_need integer;
BEGIN
  v_words := regexp_split_to_array(
    trim(regexp_replace(coalesce(p_name,'FC'),'[^[:alnum:]-]+',' ','g')),
    '[[:space:]]+'
  );

  FOREACH v_word IN ARRAY v_words LOOP
    IF coalesce(v_word,'')='' THEN CONTINUE; END IF;
    v_last := v_word;
    IF length(v_code)<3 THEN
      v_code := v_code || upper(left(v_word,1));
    END IF;
  END LOOP;

  IF length(v_code)<3 AND length(v_last)>1 THEN
    v_need := 3-length(v_code);
    v_code := v_code || upper(substr(v_last,2,v_need));
  END IF;

  RETURN left(v_code || 'FC',3);
END $$;

UPDATE public.base_clubs
SET short_name=private.club_monogram(name)
WHERE club_code IS NOT NULL;

-- A crest already assigned to a club is canonical. Only clubs without any
-- crest receive an automatically generated one.
UPDATE public.base_clubs
SET shield_url=private.generated_club_crest(
  name,
  coalesce(primary_color,'#111827'),
  coalesce(secondary_color,'#F8FAFC'),
  coalesce(accent_color,'#D4AF37'),
  abs(hashtext(coalesce(club_code,name)))
)
WHERE club_code IS NOT NULL
  AND nullif(btrim(shield_url),'') IS NULL;

COMMIT;

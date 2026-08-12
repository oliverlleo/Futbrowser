BEGIN;

-- Preserve the existing competition hub as the core implementation and wrap it
-- so the default "Jogos da rodada" view stays on the last round the player's
-- club actually played. The next fixture is still returned separately by the
-- core payload, so finishing a match no longer makes a defeat/win disappear.
DO $$
BEGIN
  IF to_regprocedure('public.get_career_competition_hub_core(text,integer)') IS NULL THEN
    IF to_regprocedure('public.get_career_competition_hub(text,integer)') IS NULL THEN
      RAISE EXCEPTION 'get_career_competition_hub(text,integer) não existe.';
    END IF;
    ALTER FUNCTION public.get_career_competition_hub(text,integer)
      RENAME TO get_career_competition_hub_core;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_career_competition_hub(
  p_competition_code text DEFAULT NULL,
  p_round integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_data jsonb;
  v_selected_code text;
  v_last_played_round integer;
  v_current_round integer;
BEGIN
  v_data := public.get_career_competition_hub_core(p_competition_code,p_round);

  -- Explicit navigation always wins. Only choose the last played round when
  -- the caller did not ask for a specific one.
  IF p_round IS NULL THEN
    v_selected_code := v_data #>> '{selected,code}';
    v_current_round := nullif(v_data #>> '{selected,current_round}','')::integer;

    SELECT nullif(item->>'round','')::integer
      INTO v_last_played_round
    FROM jsonb_array_elements(coalesce(v_data->'calendar','[]'::jsonb)) item
    WHERE item->>'status'='completed'
      AND item->>'competition_code'=v_selected_code
      AND nullif(item->>'round','') IS NOT NULL
    ORDER BY nullif(item->>'date','')::date DESC,
             nullif(item->>'round','')::integer DESC
    LIMIT 1;

    IF v_last_played_round IS NOT NULL
       AND v_last_played_round IS DISTINCT FROM v_current_round THEN
      v_data := public.get_career_competition_hub_core(v_selected_code,v_last_played_round);
    END IF;
  END IF;

  RETURN v_data;
END $$;

REVOKE ALL ON FUNCTION public.get_career_competition_hub(text,integer) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.get_career_competition_hub(text,integer) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

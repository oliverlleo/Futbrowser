-- Onboarding manager seguro e domínio canônico de caminhos.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'usuarios_caminho_check'
      AND conrelid = 'public.usuarios'::regclass
  ) THEN
    ALTER TABLE public.usuarios
      ADD CONSTRAINT usuarios_caminho_check
      CHECK (caminho IS NULL OR caminho IN ('jogador', 'manager', 'tecnico', 'presidente'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.create_manager_profile(
  p_display_name text,
  p_nationality text,
  p_profile_type text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_profile public.manager_profiles%ROWTYPE;
  v_type text := lower(trim(coalesce(p_profile_type, '')));
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão expirada.'; END IF;
  IF length(trim(coalesce(p_display_name, ''))) NOT BETWEEN 2 AND 40 THEN
    RAISE EXCEPTION 'O nome do manager deve ter entre 2 e 40 caracteres.';
  END IF;
  IF length(trim(coalesce(p_nationality, ''))) NOT BETWEEN 2 AND 60 THEN
    RAISE EXCEPTION 'Informe uma nacionalidade válida.';
  END IF;
  IF v_type NOT IN ('tecnico', 'presidente') THEN
    RAISE EXCEPTION 'Tipo de perfil manager inválido.';
  END IF;

  INSERT INTO public.manager_profiles(user_id, display_name, nationality, profile_type)
  VALUES (v_uid, trim(p_display_name), trim(p_nationality), v_type)
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = excluded.display_name,
    nationality = excluded.nationality,
    profile_type = excluded.profile_type,
    updated_at = now()
  RETURNING * INTO v_profile;

  UPDATE public.usuarios SET caminho = 'manager' WHERE id = v_uid;

  RETURN jsonb_build_object(
    'id', v_profile.id,
    'display_name', v_profile.display_name,
    'nationality', v_profile.nationality,
    'profile_type', v_profile.profile_type,
    'reputation', v_profile.reputation
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_manager_job_offers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_offers jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão expirada.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.manager_profiles WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Crie seu perfil de Manager antes de consultar propostas.';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'short_name', c.short_name,
    'city', c.city,
    'shield_url', c.shield_url,
    'reputation', c.reputation,
    'division_level', c.division_level,
    'formation', c.formation,
    'play_style', c.play_style,
    'transfer_budget', CASE coalesce(c.division_level,4) WHEN 3 THEN 6000000 ELSE 3000000 END,
    'wage_budget', CASE coalesce(c.division_level,4) WHEN 3 THEN 900000 ELSE 550000 END
  ) ORDER BY c.reputation DESC, c.name), '[]'::jsonb)
  INTO v_offers
  FROM (
    SELECT c2.*
    FROM public.base_clubs c2
    WHERE c2.is_active IS TRUE
      AND c2.club_level = 'professional'
      AND coalesce(c2.division_level,4) >= 3
      AND c2.id IN (
        SELECT ranked.id
        FROM (
          SELECT c3.id
          FROM public.base_clubs c3
          WHERE c3.is_active IS TRUE
            AND c3.club_level = 'professional'
            AND coalesce(c3.division_level,4) >= 3
          ORDER BY md5(c3.id::text || ':' || v_uid::text)
          LIMIT 5
        ) ranked
      )
  ) c;

  RETURN v_offers;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_manager_profile(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_manager_profile(text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_manager_job_offers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_manager_job_offers() TO authenticated;
